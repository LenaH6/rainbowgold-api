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

export async function POST(req) {
  try {
    const { action, proof, merkle_root, nullifier_hash, verification_level, signal = "" } = await req.json();

    if (!action || !proof || !merkle_root || !nullifier_hash || !verification_level) {
      return NextResponse.json({ ok:false, error:'missing_fields' }, { status:400 });
    }

    const app_id   = process.env.WORLD_ID_APP_ID;
    const endpoint = process.env.WORLD_ID_VERIFY_ENDPOINT || 'https://developer.worldcoin.org/api/v2/verify';

    const vr = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ app_id, action, signal, proof, merkle_root, nullifier_hash, verification_level })
    });

    const res = await vr.json().catch(() => null);
    if (!vr.ok || !res?.success) {
      return NextResponse.json({ ok:false, error:'invalid_proof', detail:res }, { status:400 });
    }

    // … tu lógica de sesión / redis / token …
    return NextResponse.json({ ok:true, userId: nullifier_hash, token: signJwt({ sub:nullifier_hash, lvl:verification_level }) });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ ok:false, error:'server_error' }, { status:500 });
  }
}


export async function GET() {
  return NextResponse.json({
    ok: false,
    error: 'method_not_allowed',
    message: 'Use POST method'
  }, { status: 405, headers: CORS });
}