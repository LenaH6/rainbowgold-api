// /api/verify.js
import jwt from "jsonwebtoken";
import { Redis } from "@upstash/redis";
import fetch from "cross-fetch";

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
    if (!body) return res.status(400).json({ ok: false, error: "Body vacío" });
    if (typeof body === "string") {
      try { body = JSON.parse(body); }
      catch { return res.status(400).json({ ok: false, error: "Body no es JSON válido" }); }
    }

    const { action, nullifier_hash, proof } = body;

    // Aceptamos solo la acción de login
    if (action && action !== "rainbowgold_login") {
      return res.status(400).json({ ok: false, error: "Acción inválida para login" });
    }
    if (!nullifier_hash) {
      return res.status(400).json({ ok: false, error: "Falta nullifier_hash" });
    }

    // 1) Verificar con la API oficial de Worldcoin
    const verifyRes = await fetch("https://developer.worldcoin.org/api/v1/verify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.WORLD_ID_APP_SECRET}`,
      },
      body: JSON.stringify({
        app_id: process.env.WORLD_ID_APP_ID,
        action: "rainbowgold_login",
        signal: nullifier_hash,
        proof: proof || {},
      }),
    });
    const data = await verifyRes.json();
    if (!data.success) {
      return res.status(400).json({ ok: false, error: "Verificación inválida" });
    }

    // 2) Identidad del usuario = nullifier
    const userId = nullifier_hash;

    // 3) Estado inicial
    const initialState = { wld: 0, rbgp: 0, energy: 100, capacity: 100 };

    // 4) Persistir en Redis
    await redis.set(`user:${userId}`, JSON.stringify(initialState));

    // 5) Token de sesión (1h)
    const token = jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "1h" });

    return res.status(200).json({ ok: true, token, state: initialState });
  } catch (err) {
    console.error("Verify error:", err);
    return res.status(500).json({ ok: false, error: "Error interno" });
  }
}
