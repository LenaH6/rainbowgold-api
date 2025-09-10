import { NextResponse } from 'next/server';
import { verifyJwt, getBearer } from '@/lib/auth';
import { redis, keys } from '@/lib/db';

export async function POST(req){
  try{
    const token = getBearer(req);
    if(!token) return NextResponse.json({ok:false,error:'missing_token'},{status:401});
    const { sub:userId } = verifyJwt(token);
    const { text } = await req.json();
    if(!text) return NextResponse.json({ok:false,error:'missing_text'},{status:400});
    const item = { id:`s_${Date.now()}`, text, userId, ts:Date.now() };
    await redis.lpush(keys.suggestions, JSON.stringify(item));
    return NextResponse.json({ok:true, item});
  }catch(e){ return NextResponse.json({ok:false,error:'server_error'},{status:500}); }
}