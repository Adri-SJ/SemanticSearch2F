// frontend/lib/redis.js
import { createClient } from "redis";

let redis;

// Evitamos múltiples conexiones durante hot reload en Next.js
if (!global.redisClient) {
  global.redisClient = createClient({
    url: "redis://localhost:6379",
  });

  global.redisClient.on("error", (err) =>
    console.error(" Error en Redis Client:", err)
  );

  global.redisClient.connect().then(() => {
    console.log(" Redis client conectado desde Next.js");
  });
}

redis = global.redisClient;

export default redis;
