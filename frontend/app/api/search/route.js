// frontend/app/api/search/route.js

import redis from '@/lib/redis';
import crypto from 'crypto';

export async function GET(req) {
    try {
        const { searchParams } = new URL(req.url);
        const q = searchParams.get("q") || "";
        const start = searchParams.get("start") || "1";

        // Usando las variables de entorno para las credenciales
        const apiKey = process.env.GOOGLE_API_KEY || "";
        const cx = process.env.GOOGLE_CX || "";

        if (!apiKey || !cx) {
            return new Response(JSON.stringify({
                error: "Faltan variables de entorno (GOOGLE_API_KEY o GOOGLE_CX)",
                have: { GOOGLE_API_KEY: !!apiKey, GOOGLE_CX: !!cx }
            }), { status: 500 });
        }
        if (!q) {
            return new Response(JSON.stringify({ error: "Falta parámetro q" }), { status: 400 });
        }

        const cacheKey = crypto.createHash('sha256').update(`${q}-${start}`).digest('hex');

        // --- 1. INTENTAR OBTENER DE CACHÉ (REDIS) ---
        // Este bloque requiere que Redis esté corriendo y configurado en '@/lib/redis'
        try {
            const cached = await redis.get(cacheKey);
            if (cached) {
                try {
                    const parsed = JSON.parse(cached);
                    console.log('Cache HIT para:', q);
                    return new Response(JSON.stringify(parsed), { headers: { "Content-Type": "application/json" } });
                } catch (parseError) {
                    console.warn('Cache corrupto eliminado para:', q);
                    await redis.del(cacheKey);
                }
            }
        } catch (redisError) {
            console.error('Error accediendo a Redis:', redisError);
            // Continuar sin cache si Redis falla
        }

        console.log('Cache MISS para:', q);

        // --- 2. CONSULTA A GOOGLE CUSTOM SEARCH ---
        const url = new URL("https://www.googleapis.com/customsearch/v1");
        url.searchParams.set("key", apiKey);
        url.searchParams.set("cx", cx);
        url.searchParams.set("q", q);
        url.searchParams.set("num", "10");
        url.searchParams.set("start", start);
        url.searchParams.set("hl", "es");
        url.searchParams.set("safe", "off");

        const res = await fetch(url.toString(), { cache: "no-store" });
        const data = await res.json();

        if (!res.ok) {
            return new Response(JSON.stringify({
                error: "Google API error",
                sent: { url: url.toString(), start },
                details: data
            }), { status: res.status });
        }

        // --- 3. PROCESAR Y ESTRUCTURAR RESPUESTA ---
        const items = Array.isArray(data.items)
            ? data.items.map(it => ({
                  title: it.title,
                  link: it.link,
                  snippet: it.snippet || "",
                  displayLink: it.displayLink || "",
              }))
            : [];

        const totalResults = Number(data?.searchInformation?.totalResults || 0);
        const nextStart = data?.queries?.nextPage?.[0]?.startIndex || null;
        const prevStart = data?.queries?.previousPage?.[0]?.startIndex || null;

        const responseData = {
            q, items, totalResults, nextStart, prevStart
        };

        const responseJSON = JSON.stringify(responseData);

        // --- 4. GUARDAR EN CACHÉ (REDIS) ---
        try {
            await redis.set(cacheKey, responseJSON, { ex: 3600 }); 
        } catch (cacheSetError) {
            console.error('Error guardando cache en Redis:', cacheSetError);
        }

        return new Response(responseJSON, { headers: { "Content-Type": "application/json" } });

    } catch (e) {
        return new Response(JSON.stringify({ error: "Error interno del servidor Dork", details: String(e) }), { status: 500 });
    }
}