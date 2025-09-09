// /api/votes/reset.js
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL,
  token: process.env.UPSTASH_REDIS_TOKEN,
});

export default async function handler(req, res) {
// --- CORS (inserted) ---
const ORIGIN = process.env.ALLOWED_ORIGIN || "https://rainbowgold-app.vercel.app";
res.setHeader("Access-Control-Allow-Origin", ORIGIN);
res.setHeader("Vary", "Origin");
res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
if (req.method === "OPTIONS") {
  res.status(204).end();
  return;
}
// --- end CORS ---


  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Método no permitido" });
  }

  try {
    const { key } = req.query;

    if (key !== process.env.ADMIN_KEY) {
      return res.status(403).json({ ok: false, error: "No autorizado" });
    }

    // Borrar los votos y la lista de votantes
    await redis.del("votes");
    await redis.del("voters");

    return res.status(200).json({ ok: true, message: "Votación reiniciada" });
  } catch (err) {
    console.error("votes/reset error:", err);
    return res.status(500).json({ ok: false, error: "Error interno" });
  }
}
