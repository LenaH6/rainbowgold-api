// /api/suggestions/add.js
import jwt from "jsonwebtoken";
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
    let body = req.body;
    if (typeof body === "string") {
      body = JSON.parse(body);
    }

    const { token, suggestion } = body;
    if (!token || !suggestion) {
      return res.status(400).json({ ok: false, error: "Faltan datos" });
    }

    // Validar token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ ok: false, error: "Token inválido" });
    }

    const userId = decoded.userId;

    // Obtener estado para identificar al usuario
    const raw = await redis.get(`user:${userId}`);
    if (!raw) return res.status(404).json({ ok: false, error: "Usuario no encontrado" });
    const state = typeof raw === "string" ? JSON.parse(raw) : raw;

    const entry = {
      userId,
      name: state.name || "Anon",
      suggestion,
      timestamp: Date.now(),
    };

    // Guardar en lista global "suggestions"
    await redis.lpush("suggestions", JSON.stringify(entry));

    return res.status(200).json({ ok: true, message: "Sugerencia guardada" });
  } catch (err) {
    console.error("suggestions/add error:", err);
    return res.status(500).json({ ok: false, error: "Error interno" });
  }
}
