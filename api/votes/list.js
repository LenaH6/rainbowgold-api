// /api/votes/list.js
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

    // Traer todos los votos acumulados
    const votes = await redis.hgetall("votes");

    return res.status(200).json({ ok: true, votes: votes || {} });
  } catch (err) {
    console.error("votes/list error:", err);
    return res.status(500).json({ ok: false, error: "Error interno" });
  }
}
