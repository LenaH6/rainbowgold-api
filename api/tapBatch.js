// /api/tapBatch.js
import jwt from "jsonwebtoken";
import { Redis } from "@upstash/redis";

// Inicializa Redis
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL,
  token: process.env.UPSTASH_REDIS_TOKEN,
});

// Config base
const POWER_BASE = 0.1;
const ENERGY_COST = 1;

export default async function handler(req, res) {
    // --- CORS ---
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    // 👇 nuevo: manejo de preflight
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Método no permitido" });
  }

  try {
    // Normalizar body (string o vacío)
    let body = req.body;
    if (!body) {
      return res.status(400).json({ ok: false, error: "Body vacío" });
    }
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch {
        return res.status(400).json({ ok: false, error: "Body no es JSON válido" });
      }
    }

    const token = body.token;
    const taps = body.taps;

    if (!token) {
      return res.status(401).json({ ok: false, error: "Falta token" });
    }
    if (typeof taps !== "number") {
      return res.status(400).json({ ok: false, error: "Falta número de taps" });
    }

    // Verificar token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ ok: false, error: "Token inválido" });
    }
    const userId = decoded.userId;

    // Leer estado del usuario
    const raw = await redis.get(`user:${userId}`);
    if (!raw) {
      return res.status(404).json({ ok: false, error: "Usuario no encontrado" });
    }
    const state = typeof raw === "string" ? JSON.parse(raw) : raw;

    // Aplicar taps
    for (let i = 0; i < taps; i++) {
      if (state.energy >= ENERGY_COST) {
        state.energy -= ENERGY_COST;
        state.rbgp += POWER_BASE;
      } else {
        break;
      }
    }

    // Guardar estado actualizado
    await redis.set(`user:${userId}`, JSON.stringify(state));

    // Renovar token
    const newToken = jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "1h" });

    return res.status(200).json({ ok: true, token: newToken, state });
  } catch (err) {
    console.error("tapBatch error:", err);
    return res.status(500).json({ ok: false, error: "Error interno tapBatch" });
  }
}

