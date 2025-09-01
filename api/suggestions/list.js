// /api/suggestions/list.js
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL,
  token: process.env.UPSTASH_REDIS_TOKEN,
});

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Método no permitido" });
  }

  try {
    const { key } = req.query;

    if (key !== process.env.ADMIN_KEY) {
      return res.status(403).json({ ok: false, error: "No autorizado" });
    }

    // Traer todas las sugerencias (últimas 50 por ejemplo)
    const items = await redis.lrange("suggestions", 0, 49);
    const suggestions = items.map((i) => JSON.parse(i));

    return res.status(200).json({ ok: true, suggestions });
  } catch (err) {
    console.error("suggestions/list error:", err);
    return res.status(500).json({ ok: false, error: "Error interno" });
  }
}
