import { NextResponse } from 'next/server';

export function middleware(req) {
  // Manejar preflight OPTIONS requests
  if (req.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  const response = NextResponse.next();
  
  // Obtener origen de la request
  const origin = req.headers.get('origin');
  const allowedOrigins = process.env.CORS_ALLOW_ORIGIN?.split(',').map(s => s.trim()).filter(Boolean) || [];
  
  // Configurar CORS headers
  if (allowedOrigins.includes('*') || !origin) {
    response.headers.set('Access-Control-Allow-Origin', '*');
  } else if (allowedOrigins.includes(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin);
  } else {
    // Permitir orígenes comunes para desarrollo
    const commonOrigins = [
      'https://lenaH6.github.io',
      'https://rainbowgold-tap.vercel.app',
      'http://localhost:3000',
      'http://127.0.0.1:5500',
      'https://worldapp.org'
    ];
    
    if (commonOrigins.includes(origin)) {
      response.headers.set('Access-Control-Allow-Origin', origin);
    } else {
      response.headers.set('Access-Control-Allow-Origin', '*');
    }
  }
  
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, X-Requested-With');
  response.headers.set('Access-Control-Allow-Credentials', 'false');
  response.headers.set('Access-Control-Max-Age', '86400');

  return response;
}

export const config = {
  matcher: ['/api/:path*']
};