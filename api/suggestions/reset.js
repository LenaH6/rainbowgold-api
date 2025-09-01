// /api/suggestions/reset.js
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL,
  token: process.env.UPSTASH_REDIS_TOKEN,
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Método no permitido" });
  }

  try {
    const { key } = req.query;

    if (key !== process.env.ADMIN_KEY) {
      return res.status(403).json({ ok: false, error: "No autorizado" });
    }

    // Borrar todas las sugerencias
    await redis.del("suggestions");

    return res.status(200).json({ ok: true, message: "Sugerencias reiniciadas" });
  } catch (err) {
    console.error("suggestions/reset error:", err);
    return res.status(500).json({ ok: false, error: "Error interno" });
  }
}
