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
    const body = req.body || {};

    // Si no trae payload, abortamos aquí
    if (!body.nullifier_hash) {
      return res.status(400).json({ ok: false, error: "Payload vacío o inválido" });
    }

    // 1. Validar con la API de Worldcoin
    const verifyRes = await fetch("https://developer.worldcoin.org/api/v1/verify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.WORLD_ID_APP_SECRET}`,
      },
      body: JSON.stringify({
        app_id: process.env.WORLD_ID_APP_ID,
        action: body.action || "rainbowgold",
        signal: body.nullifier_hash,
        proof: body.proof || {},
      }),
    });

    const data = await verifyRes.json();
    if (!data.success) {
      return res.status(400).json({ ok: false, error: "Verificación inválida" });
    }

    const userId = body.nullifier_hash;

    // 2. Estado inicial del usuario
    const initialState = { wld: 0, rbgp: 0, energy: 100 };

    // 3. Guardar en Redis (como string)
    await redis.set(`user:${userId}`, JSON.stringify(initialState));

    // 4. Generar token firmado
    const token = jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "1h" });

    return res.status(200).json({ ok: true, token, state: initialState });
  } catch (err) {
    console.error("Verify error:", err);
    return res.status(500).json({ ok: false, error: "Error interno" });
  }
}
