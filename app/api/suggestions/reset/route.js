import { NextResponse } from 'next/server';
import { redis, keys } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() { return new NextResponse(null, { status: 200, headers: CORS }); }
export async function GET() { return NextResponse.json({ ok:false, error:'method_not_allowed' }, { status:405, headers:CORS }); }

export async function POST(req) {
  try {
    const url = new URL(req.url);
    const qKey = url.searchParams.get('key');
    const body = req.headers.get('content-type')?.includes('application/json') ? await req.json().catch(()=>({})) : {};
    const key = body?.key ?? qKey;
    if (key !== process.env.ADMIN_KEY) return NextResponse.json({ ok:false, error:'unauthorized' }, { status:403, headers:CORS });

    await redis.del(keys.suggestions || 'suggestions');
    return NextResponse.json({ ok:true, message:'Sugerencias reiniciadas' }, { headers:CORS });
  } catch (e) {
    console.error('suggestions/reset error:', e);
    return NextResponse.json({ ok:false, error:'server_error' }, { status:500, headers:CORS });
  }
}
