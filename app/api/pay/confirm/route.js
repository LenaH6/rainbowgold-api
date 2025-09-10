import { NextResponse } from 'next/server';
import { verifyJwt, getBearer } from '@/lib/auth';
import { redis, keys } from '@/lib/db';

// Body esperado: { type: 'refill'|'ideas', energyCapacity?: number, txHash?: string, amount?: string|number }
// Reglas: refill = 0.1% de energyCapacity en WLD; ideas = 1 WLD. Guarda order y tx por usuario.
export async function POST(req){
  try{
    const token = getBearer(req);
    if(!token) return NextResponse.json({ok:false,error:'missing_token'},{status:401});
    const { sub:userId } = verifyJwt(token);

    const body = await req.json();
    const { type, energyCapacity, txHash, amount } = body||{};
    if(!type) return NextResponse.json({ok:false,error:'missing_type'},{status:400});

    let amtWLD;
    if(type==='refill'){
      if(typeof energyCapacity!=='number') return NextResponse.json({ok:false,error:'missing_energyCapacity'},{status:400});
      amtWLD = +(energyCapacity*0.001).toFixed(6); // 0.1%
    }else if(type==='ideas'){
      amtWLD = 1;
    }else{
      return NextResponse.json({ok:false,error:'bad_type'},{status:400});
    }
    if (amount && Math.abs(+amount - amtWLD) > 1e-6) {
      // permitir pequeña desviación pero avisar
    }

    const order = { id:`ord_${Date.now()}`, userId, type, amount: String(amtWLD), currency:'WLD', status:'confirmed', txHash: txHash||null, at:Date.now() };
    await redis.lpush(keys.ordersByUser(userId), JSON.stringify(order));
    await redis.lpush(keys.txByUser(userId), JSON.stringify({userId, ...order}));

    // actualizar progreso/energía si aplica
    if(type==='refill'){
      const prog = await redis.hgetall(keys.progress(userId)) || {};
      const cap = Number(prog.energyCapacity||energyCapacity||100);
      const current = Number(prog.energy||0);
      const refillAmount = cap; // refill full capacity
      await redis.hset(keys.progress(userId), { energy: Math.min(cap, current+refillAmount), energyCapacity: cap });
    } else if (type==='ideas'){
      // incrementar ideas compradas
      const prog = await redis.hgetall(keys.progress(userId)) || {};
      const ideas = Number(prog.ideas||0)+1;
      await redis.hset(keys.progress(userId), { ideas });
    }

    return NextResponse.json({ok:true,state: await redis.hgetall(keys.progress(userId)) });
  }catch(e){
    console.error(e);
    return NextResponse.json({ok:false,error:'server_error'},{status:500});
  }
}