import { NextResponse } from 'next/server';
import { signJwt } from '@/lib/auth';

export async function POST(req){
  const { password } = await req.json();
  const ok = password && password === (process.env.ADMIN_PASSWORD || 'RBGp');
  if(!ok) return NextResponse.json({ok:false,error:'forbidden'},{status:403});
  // admin token with role
  const token = signJwt({ sub:'admin', role:'admin' });
  return NextResponse.json({ok:true, token});
}