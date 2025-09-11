// app/api/verify/route.js
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
    { ok: false, error: 'use_post', info: 'POST /api/verify proxyea a /api/minikit/verify' },
    { status: 405, headers: CORS }
  );
}

export async function POST(req) {
  try {
    const payload = req.headers.get('content-type')?.includes('application/json')
      ? await req.json().catch(() => ({}))
      : {};

    const target = new URL('/api/minikit/verify', req.url).toString();
    const r = await fetch(target, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      cache: 'no-store',
    });

    const data = await r.json().catch(() => ({}));
    return NextResponse.json(data, { status: r.status, headers: CORS });
  } catch (e) {
    console.error('proxy /api/verify -> /api/minikit/verify error:', e);
    return NextResponse.json({ ok: false, error: 'proxy_error' }, { status: 500, headers: CORS });
  }
}
