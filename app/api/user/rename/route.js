import { NextResponse } from 'next/server';
import { verifyJwt, getBearer } from '@/lib/auth';
import { redis, keys } from '@/lib/db';
export async function POST(req){
  try{
    const token = getBearer(req);
    if(!token) return NextResponse.json({ok:false,error:'missing_token'},{status:401});
    const { sub:userId } = verifyJwt(token);
    const { username } = await req.json();
    if(!username) return NextResponse.json({ok:false,error:'missing_username'},{status:400});
    const used = Number(await redis.get(keys.usernameChanges(userId)) || 0);
    if(used >= 3) return NextResponse.json({ok:false,error:'rename_limit'},{status:403});
    await redis.hset(keys.progress(userId), { username });
    await redis.set(keys.usernameChanges(userId), used+1);
    return NextResponse.json({ok:true, username, remaining: 3-(used+1)});
  }catch(e){ return NextResponse.json({ok:false,error:'server_error'},{status:500}); }
}