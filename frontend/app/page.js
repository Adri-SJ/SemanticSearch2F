"use client";
import { useEffect, useMemo, useState } from "react";
// Usamos lucide-react (ya incluido en tu código)
import { Search, History, Loader2, Sun, Moon, ArrowLeft, ArrowRight, X } from "lucide-react"; 

// --- Configuración API ---
const API_URL = 'http://localhost:5000/api/search';

export default function Home() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [history, setHistory] = useState([]);
  const [dark, setDark] = useState(false);

  // NOTA: total, start, goPrev, goNext, etc. ya no son necesarios 
  // porque FastAPI no maneja la paginación con start. Lo dejamos simple.

  const quickDorks = [
    'site:huawei.com filetype:pdf "router"',
    'site:cisco.com "ospf" filetype:pdf',
    'intitle:"configuration guide" filetype:pdf router',
    'site:juniper.net "bgp" filetype:pdf',
    'site:microsoft.com "active directory" filetype:pdf',
  ];

  const theme = useMemo(() => (dark ? "dark" : ""), [dark]);

  // Lógica de Historial (Se mantiene igual, usando localStorage)
  useEffect(() => {
    try {
      const h = JSON.parse(localStorage.getItem("dorkHistory") || "[]");
      if (Array.isArray(h)) setHistory(h);
    } catch {}
  }, []);

  const pushHistory = (q) => {
    try {
      const h = JSON.parse(localStorage.getItem("dorkHistory") || "[]");
      const newH = [q, ...h.filter(x => x !== q)].slice(0, 8);
      localStorage.setItem("dorkHistory", JSON.stringify(newH));
      setHistory(newH);
    } catch {}
  };
  
  const clearHistory = () => {
    localStorage.removeItem("dorkHistory");
    setHistory([]);
  };
  
  // --- FUNCIÓN DE BÚSQUEDA HÍBRIDA (Adaptada a FastAPI POST) ---
  const handleSearch = async (e, opts = {}) => {
    e?.preventDefault?.();
    setMsg("");
    setResults([]);
    if (!query.trim()) return;

    setLoading(true);
    try {
      // 1. Llamada a FastAPI con POST
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: query,
          top_k: 10, // Pedimos 10 resultados al backend
        }),
      });
      
      const data = await res.json();
      
      if (!res.ok || data.status !== "success") {
        setMsg(data?.detail || data?.error || "Error en la búsqueda (Revisa logs de FastAPI).");
        console.error("Detalles del Error:", data);
        setResults([]);
      } else {
        const finalResults = data.results || [];
        setResults(finalResults);
        
        if (finalResults.length === 0) {
          setMsg("Sin resultados. Ajusta tu consulta o verifica la conexión.");
        } else {
          pushHistory(query);
        }
      }
      
    } catch (error) {
      console.error("Fallo de red o conexión:", error);
      setMsg("Fallo de red o el Backend no está operativo en :5000.");
    } finally {
      setLoading(false);
    }
  };

  const applyDork = (d) => {
    setQuery(d);
    setTimeout(() => handleSearch(), 0);
  };
  
  const favicon = (url) => {
    try {
      const domain = new URL(url).hostname;
      return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
    } catch { return ""; }
  };
  
  const getSourceColor = (type) => {
    return type === "SEMÁNTICO" ? { 
        bg: "bg-teal-100 dark:bg-teal-900/30", 
        text: "text-teal-700 dark:text-teal-300",
        border: "border-teal-200 dark:border-teal-800"
    } : { 
        bg: "bg-sky-50 dark:bg-sky-900/30", 
        text: "text-sky-700 dark:text-sky-300",
        border: "border-sky-200 dark:border-sky-800"
    };
  }

  // Usamos el código de tu anterior page.js con Tailwind (¡excelente!)
  return (
    <div className={`${theme}`}>
      <div className="min-h-screen bg-gradient-to-b from-sky-50 to-white dark:from-slate-900 dark:to-slate-950 text-slate-800 dark:text-slate-100 transition-colors">
        
        {/* Header */}
        <header className="sticky top-0 z-10 backdrop-blur bg-white/70 dark:bg-slate-900/60 border-b border-slate-200/60 dark:border-slate-800/60">
          <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="text-2xl font-extrabold tracking-tight">
              <span className="text-teal-600">Semantik</span>
              <span className="text-slate-900 dark:text-white">Dork</span>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setDark(!dark)}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-800/60 hover:bg-white dark:hover:bg-slate-800 transition"
                title="Modo claro/oscuro"
              >
                {dark ? <Sun size={16}/> : <Moon size={16}/> }
              </button>
            </div>
          </div>
        </header>

        {/* Search Section */}
        <main className="max-w-6xl mx-auto px-6">
          <form onSubmit={handleSearch} className="mt-10 flex items-stretch gap-3">
            <div className="flex-1 bg-white/80 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm ring-1 ring-transparent hover:ring-teal-200/60 dark:hover:ring-teal-700/30 transition">
              <div className="flex items-center gap-3 px-4 py-3">
                <Search className="text-slate-400" size={18} />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder='Ej: "optimización de red" o dork avanzado.'
                  className="w-full bg-transparent outline-none placeholder:text-slate-400"
                />
              </div>
            </div>
            <button
              type="submit"
              className="px-6 py-3 rounded-2xl bg-teal-600 text-white font-semibold shadow hover:bg-teal-700 active:scale-[.98] transition"
            >
              {loading ? <span className="inline-flex items-center gap-2"><Loader2 className="animate-spin" size={16}/> Buscando</span> : "Buscar Híbrido"}
            </button>
          </form>

          {/* Quick Dorks / History / Status (Se mantiene el diseño Tailwind) */}
          <div className="mt-4 flex flex-wrap gap-2">
            {quickDorks.map((d) => (
              <button
                key={d}
                onClick={() => applyDork(d)}
                className="text-xs sm:text-sm px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/60 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                title="Usar este dork"
              >
                {d}
              </button>
            ))}
          </div>

          {history.length > 0 && (
            <div className="mt-6">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-2">
                  <History size={16}/> Historial
                </h3>
                <button onClick={clearHistory} className="text-xs text-slate-500 hover:underline flex items-center gap-1">
                  <X size={14}/> limpiar
                </button>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {history.map((h) => (
                  <button
                    key={h}
                    onClick={() => applyDork(h)}
                    className="text-xs px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                    title="Reutilizar"
                  >
                    {h}
                  </button>
                ))}
              </div>
            </div>
          )}

          {msg && !loading && <p className="mt-6 text-sm text-rose-600">{msg}</p>}

          {/* Results Section - Muestra el tipo de resultado */}
          <section className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-4">
            {(!loading && results.length > 0) && results.map((r, i) => {
                const colors = getSourceColor(r.type);
                return (
                    <article key={i} className={`group rounded-2xl border ${colors.border} bg-white/70 dark:bg-slate-900/60 backdrop-blur shadow-sm hover:shadow-md transition overflow-hidden relative`}>
                        <div className="p-4">
                            
                            {/* TAG DE FUENTE (Híbrido) */}
                            <div className={`absolute top-4 right-4 text-xs font-semibold px-2 py-1 rounded-full ${colors.bg} ${colors.text}`}>
                                {r.type.split('/')[0]} {r.score > 0 ? `(${Math.round(r.score * 100)}%)` : ''}
                            </div>
                            
                            <div className="flex items-center gap-3 mb-2">
                              <img src={favicon(r.url)} alt="" className="w-5 h-5 rounded-sm"/>
                              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-50 text-slate-700 border border-slate-100 dark:bg-slate-800/60 dark:text-slate-300 dark:border-slate-800">
                                {r.url.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0]}
                              </span>
                            </div>

                            <a href={r.url} target="_blank" rel="noreferrer" className="block text-lg font-semibold text-teal-700 dark:text-teal-300 group-hover:underline">
                              {r.title}
                            </a>

                            <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">
                              {r.snippet}
                            </p>

                            <p className="text-[11px] text-slate-400 mt-2 break-all">
                              {r.url}
                            </p>
                        </div>
                    </article>
                );
            })}

            {/* Empty State / Message */}
            {!loading && results.length === 0 && !msg && (
              <div className="col-span-full mt-10 text-center text-slate-500 dark:text-slate-400">
                Escribe un dork, una pregunta conceptual, o usa uno de los botones rápidos para comenzar la búsqueda híbrida.
              </div>
            )}
          </section>

          {/* NO HAY PAGINACIÓN porque la búsqueda híbrida es compleja y no la necesitamos para top K */}
        </main>
      </div>
    </div>
  );
}
