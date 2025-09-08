// /api/verify.js  — Login con World ID + restaurar progreso
import jwt from "jsonwebtoken";
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL,
  token: process.env.UPSTASH_REDIS_TOKEN,
});

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ ok:false, error:"Método no permitido" });
  }

  try {
    // ---- Normaliza body (PowerShell/envía string a veces)
    let body = req.body;
    if (!body) return res.status(400).json({ ok:false, error:"Body vacío" });
    if (typeof body === "string") {
      try { body = JSON.parse(body); }
      catch { return res.status(400).json({ ok:false, error:"Body no es JSON válido" }); }
    }
    console.log("Payload recibido en backend:", JSON.stringify(body));

    // ---- Validación mínima local
    const { action, nullifier_hash } = body; // lo manda MiniKit en finalPayload
    if (!action) return res.status(400).json({ ok:false, error:"Falta action" });            // :contentReference[oaicite:0]{index=0}
    if (!nullifier_hash) return res.status(400).json({ ok:false, error:"Falta nullifier_hash" }); // :contentReference[oaicite:1]{index=1}

    if (!process.env.WORLD_ID_APP_ID || !process.env.WORLD_ID_APP_SECRET) {
      return res.status(500).json({ ok:false, error:"Config World ID incompleta" });        // :contentReference[oaicite:2]{index=2}
    }

    // ---- Formato correcto para Worldcoin v2: { payload, action, signal }
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

    // ---- Usuario único = nullifier_hash (identidad verificada)
    const userId = nullifier_hash;

    // ► R E S T A U R A R   P R O G R E S O
    //    - Si ya existe en Redis → NO tocar
    //    - Si no existe → crear estado inicial solo 1ª vez
    let state = await redis.get(`user:${userId}`);
    if (typeof state === "string") {
      try { state = JSON.parse(state); } catch { state = null; }
    }
    if (!state) {
      state = { wld: 0, rbgp: 0, energy: 100, capacity: 100 }; // inicial SOLO primera vez
      await redis.set(`user:${userId}`, JSON.stringify(state));
    }

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ ok:false, error:"Config JWT incompleta" });             // :contentReference[oaicite:3]{index=3}
    }

    // ---- Sesión (JWT) para el front
    const token = jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "1h" });

    // ---- Respuesta de LOGIN
    return res.status(200).json({
      ok: true,
      verified: true,
      userId,     // identidad (nullifier único)
      token,      // sesión
      state       // progreso restaurado
    });
  } catch (err) {
    console.error("Verify error:", err);
    return res.status(500).json({ ok:false, error:"Error interno" });
  }
}
