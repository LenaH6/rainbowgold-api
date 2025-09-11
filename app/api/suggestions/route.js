import { NextResponse } from 'next/server';
import { verifyJwt } from '@/lib/auth';
import { redis, keys } from '@/lib/db';
import { isAdmin } from '@/lib/admin';
export async function GET(req) {
  const list = await redis.lrange(keys.suggestions, 0, -1);
  const items = list.map(s => JSON.parse(s));
  return NextResponse.json({ ok:true, items });
}

export async function POST(req) {
  try {
    const token = (req.headers.get('authorization')||'').split(' ')[1];
    if (!token) return NextResponse.json({ ok:false, error:'missing_token' }, { status: 401 });
    const { sub: userId } = verifyJwt(token);
    const { text } = await req.json();
    if (!text) return NextResponse.json({ ok:false, error:'missing_text' }, { status: 400 });
    const item = { id:`s_${Date.now()}`, text, userId, ts: Date.now() };
    await redis.lpush(keys.suggestions, JSON.stringify(item));
    return NextResponse.json({ ok:true, item });
  } catch (e) {
    return NextResponse.json({ ok:false, error:'server_error' }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    const token = (req.headers.get('authorization')||'').split(' ')[1];
    const { sub: userId } = verifyJwt(token);
    if (!await isAdmin(userId)) return NextResponse.json({ ok:false, error:'forbidden' }, { status: 403 });
    const { id } = await req.json();
    const list = await redis.lrange(keys.suggestions, 0, -1);
    for (let i=0;i<list.length;i++) {
      const obj = JSON.parse(list[i]);
      if (obj.id === id) {
        await redis.lset(keys.suggestions, i, "__DEL__");
        await redis.lrem(keys.suggestions, 0, "__DEL__");
        break;
      }
    }
    return NextResponse.json({ ok:true });
  } catch (e) {
    return NextResponse.json({ ok:false, error:'server_error' }, { status: 500 });
  }
}
