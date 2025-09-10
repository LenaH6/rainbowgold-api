import { NextResponse } from 'next/server';
import { verifyJwt } from '@/lib/auth';
import { redis, keys } from '@/lib/db';

/**
 * Confirms a payment after MiniKit returns success client-side OR via webhook (future).
 * Expected body: { orderId: string, txHash?: string, chain?: string, status?: 'confirmed'|'failed' }
 * Marks order as confirmed and appends a tx record to tx:<userId>
 */
export async function POST(req) {
  try {
    const token = (req.headers.get('authorization')||'').split(' ')[1];
    if (!token) return NextResponse.json({ ok:false, error:'missing_token' }, { status: 401 });
    const { sub: userId } = verifyJwt(token);

    const { orderId, txHash, chain, status } = await req.json();
    if (!orderId) return NextResponse.json({ ok:false, error:'missing_orderId' }, { status: 400 });

    // Load & update order (simple scan of list)
    const listKey = keys.ordersByUser(userId);
    const orders = await redis.lrange(listKey, 0, -1);
    let updated = false;
    for (let i=0;i<orders.length;i++) {
      const o = JSON.parse(orders[i]);
      if (o.id === orderId) {
        o.status = status || 'confirmed';
        o.confirmedAt = Date.now();
        o.txHash = txHash || o.txHash || null;
        o.chain = chain || o.chain || 'world';
        await redis.lset(listKey, i, JSON.stringify(o));
        updated = true;
        // store tx
        await redis.lpush(keys.txByUser(userId), JSON.stringify({
          orderId, txHash: o.txHash, chain: o.chain, amount: o.amount, currency: o.currency, ts: Date.now()
        }));
        break;
      }
    }
    if (!updated) return NextResponse.json({ ok:false, error:'order_not_found' }, { status: 404 });

    return NextResponse.json({ ok:true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ ok:false, error:'server_error' }, { status: 500 });
  }
}
