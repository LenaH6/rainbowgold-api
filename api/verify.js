// /api/verify.js
import jwt from "jsonwebtoken";
import { Redis } from "@upstash/redis";
import fetch from "cross-fetch";

// Inicializa Redis con env vars de Vercel
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL,
  token: process.env.UPSTASH_REDIS_TOKEN,
});

// Endpoint principal
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Método no permitido" });
  }

  try {
    const body = req.body;

    // 1. Validar con la API de Worldcoin
    const verifyRes = await fetch("https://developer.worldcoin.org/api/v1/verify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.WORLD_ID_APP_SECRET}`,
      },
      body: JSON.stringify({
        app_id: process.env.WORLD_ID_APP_ID,
        action: body.action, // viene del frontend
        signal: body.nullifier_hash, // se usa para evitar duplicados
        proof: body.proof,          // payload completo
      }),
    });

    const data = await verifyRes.json();
    if (!data.success) {
      return res.status(400).json({ ok: false, error: "Verificación inválida" });
    }

    const userId = body.nullifier_hash;
    // 2. Estado inicial del usuario (puedes ajustar valores iniciales)
    const initialState = {
      wld: 0,
      wlgp: 0,
      energy: 100,
    };

    // 3. Guardar estado en Redis
    await redis.set(`user:${userId}`, initialState);

    // 4. Generar SESSION_TOKEN firmado
    const token = jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "1h" });

    return res.status(200).json({
      ok: true,
      token,
      state: initialState,
    });
  } catch (err) {
    console.error("Verify error:", err);
    return res.status(500).json({ ok: false, error: "Error interno" });
  }
}
