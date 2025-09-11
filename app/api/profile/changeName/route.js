// app/api/profile/changeName/route.js
import { NextResponse } from 'next/server';
import { redis, keys } from '@/lib/db';
import { verifyJwt } from '@/lib/auth';

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

export async function POST(req) {
  try {
    const isJson = req.headers.get('content-type')?.includes('application/json');
    const body = isJson ? await req.json().catch(() => ({})) : {};
    const auth = req.headers.get('authorization') || '';
    const token = body.token || auth.replace(/^Bearer\s+/i, '').trim();

    if (!token) {
      return NextResponse.json({ ok: false, error: 'missing_token' }, { status: 401, headers: CORS });
    }

    const payload = verifyJwt(token);
    const userId = payload?.sub;
    if (!userId) {
      return NextResponse.json({ ok: false, error: 'invalid_token' }, { status: 401, headers: CORS });
    }

    const usernameRaw = (body.username || '').toString().trim();
    const username = usernameRaw.replace(/[^\w\-\.]/g, '').slice(0, 20);
    if (username.length < 3) {
      return NextResponse.json({ ok: false, error: 'username_too_short' }, { status: 400, headers: CORS });
    }

    await redis.hset(keys.progress(userId), { username });
    return NextResponse.json({ ok: true, username }, { headers: CORS });
  } catch (e) {
    console.error('changeName error:', e);
    return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500, headers: CORS });
  }
}
