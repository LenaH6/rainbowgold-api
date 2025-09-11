import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { redis, keys } from '@/lib/db';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: CORS });
}

export async function GET() {
  return NextResponse.json(
    { ok: false, error: 'method_not_allowed', message: 'Use POST method' },
    { status: 405, headers: CORS }
  );
}

export async function POST(req) {
  try {
    const body = await req.json();

    // --- Normalización: soporta tanto {proof,...} como {payload:{...}} ---
    let {
      action = '',
      signal = '',
      payload = null, // si viene del MiniKit moderno
      proof,
      merkle_root,
      merkleRoot,
      nullifier_hash,
      nullifierHash,
      verification_level,
      level,
    } = body || {};

    // Si vino en payload, extraemos
    if (payload && typeof payload === 'object') {
      proof = proof || payload.proof || payload?.proof?.proof;
      merkle_root = merkle_root || payload.merkle_root || payload.merkleRoot;
      nullifier_hash = nullifier_hash || payload.nullifier_hash || payload.nullifierHash;
      verification_level = verification_level || payload.verification_level || payload.level;
    }

    // Compat camelCase
    merkle_root = merkle_root || merkleRoot;
    nullifier_hash = nullifier_hash || nullifierHash;
    verification_level = verification_level || level || 'device';

    // Validaciones mínimas
    if (!action) {
      return NextResponse.json(
        { ok: false, error: 'missing_action' },
        { status: 400, headers: CORS }
      );
    }
    if (!nullifier_hash) {
      return NextResponse.json(
        { ok: false, error: 'missing_nullifier_hash' },
        { status: 400, headers: CORS }
      );
    }
    if (!proof || !merkle_root) {
      return NextResponse.json(
        { ok: false, error: 'missing_proof_fields' },
        { status: 400, headers: CORS }
      );
    }

    // --- Verificación con Worldcoin ---
    const APP_ID = process.env.WORLD_ID_APP_ID;
    const APP_SECRET = process.env.WORLD_ID_APP_SECRET;

    let verified = false;
    let wcDetail = null;

    // 1) Endpoint autenticado (si tenemos secreto): POST /api/v2/verify/:app_id
    if (APP_ID && APP_SECRET) {
      try {
        const r1 = await fetch(`https://developer.worldcoin.org/api/v2/verify/${APP_ID}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${APP_SECRET}`,
          },
          // Este endpoint acepta tanto "payload" como los campos planos
          body: JSON.stringify(
            payload
              ? { action, signal: signal || '', payload }
              : { action, signal: signal || '', proof, merkle_root, nullifier_hash, verification_level }
          ),
        });
        const j1 = await r1.json().catch(() => null);
        wcDetail = j1;
        verified = !!j1?.success;
      } catch (e) {
        // seguimos al fallback
      }
    }

    // 2) Fallback público: POST /api/v2/verify (requiere app_id en el body)
    if (!verified && APP_ID) {
      try {
        const r2 = await fetch('https://developer.worldcoin.org/api/v2/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            app_id: APP_ID,
            action,
            signal: signal || '',
            proof,
            merkle_root,
            nullifier_hash,
            verification_level,
          }),
        });
        const j2 = await r2.json().catch(() => null);
        wcDetail = j2;
        verified = !!j2?.success;
      } catch (e) {
        // dejamos verified como esté
      }
    }

    if (!verified) {
      return NextResponse.json(
        { ok: false, error: 'worldcoin_verification_failed', details: wcDetail || null },
        { status: 400, headers: CORS }
      );
    }

    // --- Usuario y estado ---
    const userId = nullifier_hash;
    let userState = await redis.get(keys.user(userId));
    if (typeof userState === 'string') {
      try { userState = JSON.parse(userState); } catch { userState = null; }
    }
    if (!userState) {
      userState = {
        wld: 0,
        rbgp: 0,
        energy: 100,
        capacity: 100,
        created: Date.now(),
      };
      await redis.set(keys.user(userId), JSON.stringify(userState));
    }

    // --- Token ---
    if (!process.env.JWT_SECRET) {
      return NextResponse.json(
        { ok: false, error: 'jwt_secret_not_configured' },
        { status: 500, headers: CORS }
      );
    }

    const token = jwt.sign(
      {
        sub: userId,
        lvl: verification_level || 'device',
        iat: Math.floor(Date.now() / 1000),
      },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    return NextResponse.json(
      { ok: true, verified: true, userId, token, state: userState },
      { status: 200, headers: CORS }
    );
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: 'internal_server_error', message: error?.message || String(error) },
      { status: 500, headers: CORS }
    );
  }
}
