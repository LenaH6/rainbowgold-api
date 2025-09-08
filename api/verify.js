// /api/verify.js
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
    // Normaliza body (PowerShell/envía string a veces)
    let body = req.body;
    if (!body) return res.status(400).json({ ok:false, error:"Body vacío" });
    if (typeof body === "string") {
      try { body = JSON.parse(body); }
      catch { return res.status(400).json({ ok:false, error:"Body no es JSON válido" }); }
    }
    console.log("Payload recibido en backend:", JSON.stringify(body));
    // En v2: el front ya manda el payload correcto (finalPayload de MiniKit).
    // Solo validamos campos mínimos y NO forzamos action fijo.
    const { action, nullifier_hash } = body;
    if (!action) return res.status(400).json({ ok:false, error:"Falta action" });
    if (!nullifier_hash) return res.status(400).json({ ok:false, error:"Falta nullifier_hash" });

    if (!process.env.WORLD_ID_APP_ID || !process.env.WORLD_ID_APP_SECRET) {
      return res.status(500).json({ ok:false, error:"Config World ID incompleta" });
    }

    // Llamada a Worldcoin v2: /api/v2/verify/{app_id}
    const payload = body?.payload ?? body;
    const actionFinal = body?.action ?? payload?.action;
    const signal = body?.signal ?? undefined;

    const resp = await fetch(
      `https://developer.worldcoin.org/api/v2/verify/${process.env.WORLD_ID_APP_ID}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "rainbowgold-api/1.0",
          Authorization: `Bearer ${process.env.WORLD_ID_APP_SECRET}`,
        },
        body: JSON.stringify({ payload, action: actionFinal, signal })
      }
    );



    const ct = resp.headers.get("content-type") || "";
    if (!ct.includes("application/json")) {
      const txt = await resp.text();
      console.error("Worldcoin no devolvió JSON", { status: resp.status, ct, body: txt.slice(0,300) });
      return res.status(502).json({ ok:false, error:`Worldcoin ${resp.status} no-json` });
    }

    const data = await resp.json();
    if (!data?.success) {
      return res.status(400).json({ ok:false, error:"Verificación inválida", details: data });
    }

    // userId = nullifier
    const userId = nullifier_hash;
    const initialState = { wld: 0, rbgp: 0, energy: 100, capacity: 100 };
    await redis.set(`user:${userId}`, JSON.stringify(initialState));

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ ok:false, error:"Config JWT incompleta" });
    }
    const token = jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "1h" });

    return res.status(200).json({ ok:true, token, state: initialState });
  } catch (err) {
    console.error("Verify error:", err);
    return res.status(500).json({ ok:false, error:"Error interno" });
  }
}
