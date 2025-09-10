import { NextResponse } from 'next/server';
import { getBearer, verifyJwt } from '@/lib/auth';
import { redis, keys } from '@/lib/db';

/**
 * Creates a payment order for MiniKit.
 * Expected body: { amount: string, currency: 'WORLD'|'USDC'|string, memo?: string }
 * Stores order under orders:<userId>
 */
export async function POST(req) {
  try {
    const token = (req.headers.get('authorization')||'').split(' ')[1];
    if (!token) return NextResponse.json({ ok:false, error:'missing_token' }, { status: 401 });
    const { sub: userId } = verifyJwt(token);

    const { amount, currency, memo } = await req.json();
    if (!amount || !currency) return NextResponse.json({ ok:false, error:'missing_amount_currency' }, { status: 400 });

    const order = {
      id: `ord_${Date.now()}`,
      userId,
      amount: String(amount),
      currency,
      memo: memo || null,
      status: 'pending',
      createdAt: Date.now()
    };
    await redis.lpush(keys.ordersByUser(userId), JSON.stringify(order));

    // Return a payload the client can pass to MiniKit payment request
    return NextResponse.json({ ok:true, order });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ ok:false, error:'server_error' }, { status: 500 });
  }
}
