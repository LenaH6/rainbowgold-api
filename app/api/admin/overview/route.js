import { NextResponse } from 'next/server';
import { verifyJwt, getBearer } from '@/lib/auth';
import { redis, keys } from '@/lib/db';
export async function GET(req){
  const token = getBearer(req);
  try{
    const { role } = verifyJwt(token||'');
    if(role!=='admin') return NextResponse.json({ok:false,error:'forbidden'},{status:403});
  }catch{ return NextResponse.json({ok:false,error:'forbidden'},{status:403}); }

  // Collect some aggregates
  const sugg = await redis.lrange(keys.suggestions, 0, -1);
  // Warning: we don't have an index of all users; build from suggestions/taps/progress keys
  const scanUsers = new Set();
  for (const key of await redis.keys('progress:*')) scanUsers.add(key.split(':')[1]);
  const users = [];
  for (const id of scanUsers){
    const prog = await redis.hgetall(keys.progress(id));
    users.push({ id, ...prog });
  }
  return NextResponse.json({ok:true, suggestions: sugg.map(JSON.parse), users});
}