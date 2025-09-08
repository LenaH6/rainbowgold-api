// /api/verify.js
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
  if (req.method !== "POST") return res.status(405).json({ ok:false, error:"Método no permitido" });

  try {
    // Body seguro
    let body = req.body;
    if (!body) return res.status(400).json({ ok:false, error:"Body vacío" });
    if (typeof body === "string") {
      try { body = JSON.parse(body); }
      catch { return res.status(400).json({ ok:false, error:"Body no es JSON válido" }); }
    }

    const { action, nullifier_hash, proof } = body;

    if (action && action !== "rainbowgold_login") {
      return res.status(400).json({ ok:false, error:"Acción inválida para login" });
    }
    if (!nullifier_hash) {
      return res.status(400).json({ ok:false, error:"Falta nullifier_hash" });
    }

    // Validación rápida de ENV
    if (!process.env.WORLD_ID_APP_ID || !process.env.WORLD_ID_APP_SECRET) {
      console.error("ENV World ID incompletas", {
        hasAppId: !!process.env.WORLD_ID_APP_ID,
        hasSecret: !!process.env.WORLD_ID_APP_SECRET,
      });
      return res.status(500).json({ ok:false, error:"Config World ID incompleta" });
    }

    // 1) Llamada a Worldcoin
const resp = await fetch(
  `https://developer.worldcoin.org/api/v2/verify/${process.env.WORLD_ID_APP_ID}`,
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // Recomendado por docs:
      "User-Agent": "rainbowgold-api/1.0",
      Authorization: `Bearer ${process.env.WORLD_ID_APP_SECRET}`,
    },
    body: JSON.stringify({
      // v2: el app_id va en la URL; aquí ya no hace falta
      // app_id: process.env.WORLD_ID_APP_ID,  <-- quitar
      action: "rainbowgold_login",
      signal: nullifier_hash,
      proof: proof || {},
    }),
  }
);


    const ct = resp.headers.get("content-type") || "";
    if (!ct.includes("application/json")) {
      const txt = await resp.text();
      console.error("Worldcoin no devolvió JSON", {
        status: resp.status,
        ct,
        bodySnippet: txt.slice(0, 300),
      });
      return res.status(502).json({ ok:false, error:`Worldcoin ${resp.status} no-json` });
    }

    const data = await resp.json();

    if (!data?.success) {
      // Aquí ya es JSON: verificación inválida normal (proof malo, etc.)
      return res.status(400).json({ ok:false, error:"Verificación inválida", details: data });
    }

    // 2) Crear estado y guardar
    const userId = nullifier_hash;
    const initialState = { wld: 0, rbgp: 0, energy: 100, capacity: 100 };
    await redis.set(`user:${userId}`, JSON.stringify(initialState));

    // 3) Token
    if (!process.env.JWT_SECRET) {
      console.error("JWT_SECRET faltante");
      return res.status(500).json({ ok:false, error:"Config JWT incompleta" });
    }
    const token = jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "1h" });

    return res.status(200).json({ ok:true, token, state: initialState });
  } catch (err) {
    console.error("Verify error:", err);
    return res.status(500).json({ ok:false, error:"Error interno" });
  }
}
