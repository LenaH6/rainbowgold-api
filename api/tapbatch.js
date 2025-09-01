// /api/tapBatch.js
import jwt from "jsonwebtoken";
import { Redis } from "@upstash/redis";

// Inicializa Redis
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL,
  token: process.env.UPSTASH_REDIS_TOKEN,
});

// Config base
const POWER_BASE = 0.1000;  // cada tap suma 0.1 WLGp
const ENERGY_COST = 1;   // cada tap cuesta 1 de energía

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Método no permitido" });
  }

  try {
    // Validar body de forma segura
    let token, taps;
    try {
      ({ token, taps } = req.body || {});
    } catch (e) {
      return res.status(400).json({ ok: false, error: "Body inválido" });
    }

    if (!token) {
      return res.status(401).json({ ok: false, error: "Falta token" });
    }
    if (typeof taps !== "number") {
      return res.status(400).json({ ok: false, error: "Falta número de taps" });
    }

    // 1. Verificar token JWT
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (e) {
      return res.status(401).json({ ok: false, error: "Token inválido" });
    }
    const userId = decoded.userId;

    // 2. Recuperar estado en Redis
    const raw = await redis.get(`user:${userId}`);
    if (!raw) {
      return res.status(404).json({ ok: false, error: "Usuario no encontrado" });
    }
    const state = typeof raw === "string" ? JSON.parse(raw) : raw;

    // 3. Aplicar taps
    let applied = 0;
    for (let i = 0; i < taps; i++) {
      if (state.energy >= ENERGY_COST) {
        state.energy -= ENERGY_COST;
        state.wlgp += POWER_BASE;
        applied++;
      } else {
        break;
      }
    }

    // 4. Guardar nuevo estado en Redis
    await redis.set(`user:${userId}`, JSON.stringify(state));

    // 5. Renovar token
    const newToken = jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "1h" });

    return res.status(200).json({ ok: true, token: newToken, state });
  } catch (err) {
    console.error("tapBatch error:", err);
    return res.status(500).json({ ok: false, error: "Error interno" });
  }
}
