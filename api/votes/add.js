// /api/votes/add.js
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

    const { token, option } = body;
    if (!token || !option) {
      return res.status(400).json({ ok: false, error: "Faltan datos" });
    }

    // Validar token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ ok: false, error: "Token inválido" });
    }

    const userId = decoded.userId;

    // Verificar si el usuario ya votó (1 voto por acción "ideas")
    const alreadyVoted = await redis.sismember("voters", userId);
    if (alreadyVoted) {
      return res.status(400).json({ ok: false, error: "El usuario ya votó" });
    }

    // Guardar el voto
    await redis.hincrby("votes", option, 1);

    // Marcar que este usuario ya votó
    await redis.sadd("voters", userId);

    return res.status(200).json({ ok: true, message: "Voto registrado" });
  } catch (err) {
    console.error("votes/add error:", err);
    return res.status(500).json({ ok: false, error: "Error interno" });
  }
}
