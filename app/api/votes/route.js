import { NextResponse } from 'next/server';
import { verifyJwt } from '@/lib/auth';
import { redis, keys } from '@/lib/db';

export async function POST(req) {
  try {
    const token = (req.headers.get('authorization')||'').split(' ')[1];
    if (!token) return NextResponse.json({ ok:false, error:'missing_token' }, { status: 401 });
    const { sub: userId } = verifyJwt(token);
    const { suggestionId, delta } = await req.json(); // delta = +1 or -1
    if (!suggestionId || ![1,-1].includes(delta)) return NextResponse.json({ ok:false, error:'bad_payload' }, { status: 400 });
    await redis.zincrby(`votes:${suggestionId}`, delta, userId);
    const score = await redis.zscore(`votes:${suggestionId}`, userId);
    return NextResponse.json({ ok:true, score });
  } catch (e) {
    return NextResponse.json({ ok:false, error:'server_error' }, { status: 500 });
  }
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('suggestionId');
  if (!id) return NextResponse.json({ ok:false, error:'missing_suggestionId' }, { status: 400 });
  const scores = await redis.zrange(`votes:${id}`, 0, -1, { withScores: true });
  return NextResponse.json({ ok:true, votes: scores });
}
