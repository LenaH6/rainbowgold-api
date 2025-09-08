// /api/pay/confirm.js
import jwt from "jsonwebtoken";
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL,
  token: process.env.UPSTASH_REDIS_TOKEN,
});

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ ok:false, error:"Método no permitido" });

  try {
    let body = req.body;
    if (!body) return res.status(400).json({ ok:false, error:"Body vacío" });
    if (typeof body === "string") {
      try { body = JSON.parse(body); }
      catch { return res.status(400).json({ ok:false, error:"Body no es JSON válido" }); }
    }

    const { token, action } = body;
    if (!token) return res.status(401).json({ ok:false, error:"Falta token" });
    if (!action) return res.status(400).json({ ok:false, error:"Falta action" });

    let decoded;
    try { decoded = jwt.verify(token, process.env.JWT_SECRET); }
    catch { return res.status(401).json({ ok:false, error:"Token inválido" }); }

    const userId = decoded.userId;
    if (action !== "rainbowgold" && action !== "ideas") {
      return res.status(400).json({ ok:false, error:"Acción inválida para pagos" });
    }

    // Verificación de pago con World ID v2 (reenviamos lo que manda el front)
    const resp = await fetch(
      `https://developer.worldcoin.org/api/v2/verify/${process.env.WORLD_ID_APP_ID}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.WORLD_ID_APP_SECRET}`,
        },
        body: JSON.stringify(body),
      }
    );
    const data = await resp.json().catch(() => null);
    if (!data?.success) {
      return res.status(400).json({ ok:false, error:"Pago no válido", details: data });
    }

    // Estado y lógica de pago
    const raw = await redis.get(`user:${userId}`);
    if (!raw) return res.status(404).json({ ok:false, error:"Usuario no encontrado" });
    const state = typeof raw === "string" ? JSON.parse(raw) : raw;

    if (action === "rainbowgold") {
      const capacity = state.capacity || 100;
      const cost = capacity * 0.001;
      state.energy = capacity;
      state.wld = (state.wld || 0) + cost;
    } else if (action === "ideas") {
      state.wld = (state.wld || 0) + 1;
    }

    await redis.set(`user:${userId}`, JSON.stringify(state));
    const newToken = jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "1h" });
    return res.status(200).json({ ok:true, token: newToken, state });
  } catch (err) {
    console.error("pay/confirm error:", err);
    return res.status(500).json({ ok:false, error:"Error interno en confirm" });
  }
}
