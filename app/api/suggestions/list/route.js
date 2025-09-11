// app/api/suggestions/list/route.js
import { NextResponse } from 'next/server';
import { redis, keys } from '@/lib/db';

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

export async function GET(req) {
  try {
    const url = new URL(req.url);
    const key = url.searchParams.get('key');
    if (key !== process.env.ADMIN_KEY) {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 403, headers: CORS });
    }

    const items = await redis.lrange(keys.suggestions, 0, 49);
    const suggestions = items
      .map((i) => { try { return JSON.parse(i); } catch { return null; } })
      .filter(Boolean);

    return NextResponse.json({ ok: true, suggestions }, { headers: CORS });
  } catch (err) {
    console.error('suggestions/list error:', err);
    return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500, headers: CORS });
  }
}
