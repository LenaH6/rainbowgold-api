import { NextResponse } from 'next/server';
import { redis, keys } from '@/lib/db';
import { signJwt } from '@/lib/auth';

export async function POST(req){
  try{
    const { action, proof, merkle_root, nullifier_hash, verification_level } = await req.json();
    if(!action || !proof || !merkle_root || !nullifier_hash || !verification_level){
      return NextResponse.json({ok:false,error:'missing_fields'},{status:400});
    }
    // Optionally validate action === process.env.ACTION_ID_LOGIN
    const app_id = process.env.WORLD_ID_APP_ID;
    const endpoint = process.env.WORLD_ID_VERIFY_ENDPOINT || 'https://developer.worldcoin.org/api/v2/verify';
    const vr = await fetch(endpoint, {
      method:'POST', headers:{'content-type':'application/json'},
      body: JSON.stringify({ app_id, action, proof, merkle_root, nullifier_hash, verification_level })
    });
    const res = await vr.json().catch(()=>null);
    if(!vr.ok || !res?.success) return NextResponse.json({ok:false,error:'invalid_proof', detail:res},{status:400});

    const userId = nullifier_hash;
    await redis.hset(keys.user(userId), { id:userId, verification_level, createdAt: Date.now() });
    // initialize progress if not exists
    const exists = await redis.hgetall(keys.progress(userId));
    if(!exists || !Object.keys(exists).length){
      await redis.hset(keys.progress(userId), { username:`RG-${userId.slice(0,6)}`, energy:100, energyCapacity:100, taps:0, rbgp:0 });
    }
    const token = signJwt({ sub:userId, lvl:verification_level });
    return NextResponse.json({ok:true, userId, token});
  }catch(e){
    console.error(e);
    return NextResponse.json({ok:false,error:'server_error'},{status:500});
  }
}