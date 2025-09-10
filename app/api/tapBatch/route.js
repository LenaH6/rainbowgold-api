import { NextResponse } from 'next/server';
import { verifyJwt, getBearer } from '@/lib/auth';
import { redis, keys } from '@/lib/db';

// Body: { taps: number, gain: number, energyUsed: number, progress?: object }
export async function POST(req){
  try{
    const token = getBearer(req);
    if(!token) return NextResponse.json({ok:false,error:'missing_token'},{status:401});
    const { sub:userId } = verifyJwt(token);
    const { taps, gain, energyUsed, progress } = await req.json();
    const rec = { taps: +taps||0, gain:+gain||0, energyUsed:+energyUsed||0, ts:Date.now() };
    await redis.lpush(keys.taps(userId), JSON.stringify(rec));
    if (progress && typeof progress==='object'){
      await redis.hset(keys.progress(userId), progress);
    }
    return NextResponse.json({ok:true});
  }catch(e){ console.error(e); return NextResponse.json({ok:false,error:'server_error'},{status:500}); }
}