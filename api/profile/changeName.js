// /api/profile/changeName.js
import jwt from "jsonwebtoken";
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
    let body = req.body;
    if (typeof body === "string") {
      body = JSON.parse(body);
    }

    const { token, newName } = body;
    if (!token || !newName) {
      return res.status(400).json({ ok: false, error: "Faltan datos" });
    }

    // Verificar token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ ok: false, error: "Token inválido" });
    }

    const userId = decoded.userId;

    // Leer estado actual
    const raw = await redis.get(`user:${userId}`);
    if (!raw) {
      return res.status(404).json({ ok: false, error: "Usuario no encontrado" });
    }
    const state = typeof raw === "string" ? JSON.parse(raw) : raw;

    // Límite de cambios
    if ((state.nameChanges || 0) >= 3) {
      return res.status(403).json({ ok: false, error: "Has alcanzado el límite de cambios de nombre (3)" });
    }

    // Aplicar cambio
    state.name = newName;
    state.nameChanges = (state.nameChanges || 0) + 1;

    await redis.set(`user:${userId}`, JSON.stringify(state));

    return res.status(200).json({ ok: true, name: state.name, remaining: 3 - state.nameChanges });
  } catch (err) {
    console.error("changeName error:", err);
    return res.status(500).json({ ok: false, error: "Error interno en changeName" });
  }
}
