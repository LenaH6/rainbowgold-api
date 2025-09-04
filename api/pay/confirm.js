// /api/pay/confirm.js
import jwt from "jsonwebtoken";
import { Redis } from "@upstash/redis";
import fetch from "cross-fetch";

// Inicializa Redis
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL,
  token: process.env.UPSTASH_REDIS_TOKEN,
});

export default async function handler(req, res) {
  // --- CORS ---
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Método no permitido" });
  }

  try {
    // Normalizar body
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

    const { token, action, proof, nullifier_hash } = body;

    if (!token) {
      return res.status(401).json({ ok: false, error: "Falta token" });
    }
    if (!action) {
      return res.status(400).json({ ok: false, error: "Falta action" });
    }

    // 1. Verificar sesión del usuario
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ ok: false, error: "Token inválido" });
    }
    const userId = decoded.userId;

    // 2. Aceptar solo acciones válidas para pagos
    if (action !== "rainbowgold" && action !== "ideas") {
      return res.status(400).json({ ok: false, error: "Acción inválida para pagos" });
    }

    // 3. Validar el pago con World App
    const verifyRes = await fetch("https://developer.worldcoin.org/api/v1/verify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.WORLD_ID_APP_SECRET}`,
      },
      body: JSON.stringify({
        app_id: process.env.WORLD_ID_APP_ID,
        action, // ya sabemos que es seguro: refill o ideas
        signal: nullifier_hash || userId,
        proof,
      }),
    });

    const data = await verifyRes.json();
    if (!data.success) {
      return res.status(400).json({ ok: false, error: "Pago no válido" });
    }

    // 4. Recuperar estado en Redis
    const raw = await redis.get(`user:${userId}`);
    if (!raw) {
      return res.status(404).json({ ok: false, error: "Usuario no encontrado" });
    }
    const state = typeof raw === "string" ? JSON.parse(raw) : raw;

    // 5. Aplicar lógica según el action
    if (action === "rainbowgold") {
      // Refill: siempre restaura 100% de la capacidad
      const capacity = state.capacity || 100;
      const cost = capacity * 0.001; // 0.1% de capacidad como costo simbólico
      state.energy = capacity;
      state.wld = (state.wld || 0) + cost;
    } else if (action === "ideas") {
      // Pago de ideas: siempre cuesta 1 WLD
      state.wld = (state.wld || 0) + 1;
    }

    // 6. Guardar estado en Redis
    await redis.set(`user:${userId}`, JSON.stringify(state));

    // 7. Renovar token
    const newToken = jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "1h" });

    return res.status(200).json({ ok: true, token: newToken, state });
  } catch (err) {
    console.error("pay/confirm error:", err);
    return res.status(500).json({ ok: false, error: "Error interno en confirm" });
  }
}
