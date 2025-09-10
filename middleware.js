import { NextResponse } from 'next/server';
const allowed = process.env.CORS_ALLOW_ORIGIN?.split(',').map(s=>s.trim()).filter(Boolean) || ['*'];
export function middleware(req){
  const res = NextResponse.next();
  const origin = req.headers.get('origin')||'*';
  const allowOrigin = allowed.includes('*') || allowed.includes(origin) ? origin : allowed[0] || '*';
  res.headers.set('Access-Control-Allow-Origin', allowOrigin);
  res.headers.set('Access-Control-Allow-Methods','GET,POST,DELETE,OPTIONS');
  res.headers.set('Access-Control-Allow-Headers','Content-Type, Authorization');
  res.headers.set('Access-Control-Max-Age','86400');
  return res;
}
export const config = { matcher: ['/api/:path*'] };