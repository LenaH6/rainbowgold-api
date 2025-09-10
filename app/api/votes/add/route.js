import { NextResponse } from 'next/server';
import { verifyJwt, getBearer } from '@/lib/auth';
import { redis, keys } from '@/lib/db';

export async function POST(req){
  try{
    const token = getBearer(req);
    if(!token) return NextResponse.json({ok:false,error:'missing_token'},{status:401});
    const { sub:userId } = verifyJwt(token);
    const { suggestionId, delta } = await req.json();
    if(!suggestionId || ![1,-1].includes(delta)) return NextResponse.json({ok:false,error:'bad_payload'},{status:400});
    await redis.zincrby(keys.votes(suggestionId), delta, userId);
    const score = await redis.zscore(keys.votes(suggestionId), userId);
    return NextResponse.json({ok:true, score});
  }catch(e){ return NextResponse.json({ok:false,error:'server_error'},{status:500}); }
}