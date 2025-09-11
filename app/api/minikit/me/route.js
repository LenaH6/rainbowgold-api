import { NextResponse } from 'next/server';
import { redis, keys } from '@/lib/db';
import { getBearer, verifyJwt } from '@/lib/auth';
export async function GET(req) {
  try {
    const token = getBearer(req);
    if (!token) return NextResponse.json({ ok:false, error:'missing_token' }, { status: 401 });
    const payload = verifyJwt(token);
    const userId = payload.sub;
    const data = await redis.hgetall(keys.user(userId));
    return NextResponse.json({ ok:true, userId, user:data||{} });
  } catch (e) {
    return NextResponse.json({ ok:false, error:'invalid_token' }, { status: 401 });
  }
}
