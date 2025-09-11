import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { redis, keys } from '@/lib/db';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: CORS });
}

export async function POST(req) {
  try {
    console.log('🔍 MiniKit verify endpoint called');
    
    const body = await req.json();
    console.log('📥 Request body:', JSON.stringify(body));

    // Extraer datos del payload de MiniKit
    const { action, signal, payload } = body;
    
    if (!action) {
      return NextResponse.json({ 
        ok: false, 
        error: 'missing_action' 
      }, { status: 400, headers: CORS });
    }

    if (!payload || !payload.nullifier_hash) {
      return NextResponse.json({ 
        ok: false, 
        error: 'missing_nullifier_hash' 
      }, { status: 400, headers: CORS });
    }

    console.log('🔐 Verifying with Worldcoin API...');

    // Verificar con Worldcoin
    if (process.env.WORLD_ID_APP_ID && process.env.WORLD_ID_APP_SECRET) {
      try {
        const worldcoinResponse = await fetch(
          `https://developer.worldcoin.org/api/v2/verify/${process.env.WORLD_ID_APP_ID}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${process.env.WORLD_ID_APP_SECRET}`,
            },
            body: JSON.stringify({
              action: action,
              signal: signal || "",
              payload: payload
            })
          }
        );

        const worldcoinData = await worldcoinResponse.json();
        console.log('🌍 Worldcoin response:', worldcoinData);

        if (!worldcoinData.success) {
          return NextResponse.json({
            ok: false,
            error: 'worldcoin_verification_failed',
            details: worldcoinData
          }, { status: 400, headers: CORS });
        }
      } catch (worldcoinError) {
        console.error('❌ Worldcoin API error:', worldcoinError);
        // En desarrollo, continuar sin verificación
        console.log('⚠️ Continuing without Worldcoin verification (dev mode)');
      }
    }

    // Crear usuario único basado en nullifier_hash
    const userId = payload.nullifier_hash;
    
    console.log('👤 User ID:', userId);

    // Restaurar/crear estado del usuario
    let userState = await redis.get(keys.user(userId));
    if (typeof userState === 'string') {
      try {
        userState = JSON.parse(userState);
      } catch {
        userState = null;
      }
    }

    if (!userState) {
      console.log('🆕 Creating new user state');
      userState = {
        wld: 0,
        rbgp: 0,
        energy: 100,
        capacity: 100,
        created: Date.now()
      };
      await redis.set(keys.user(userId), JSON.stringify(userState));
    }

    console.log('🎮 User state:', userState);

    // Crear JWT token
    if (!process.env.JWT_SECRET) {
      return NextResponse.json({
        ok: false,
        error: 'jwt_secret_not_configured'
      }, { status: 500, headers: CORS });
    }

    const token = jwt.sign(
      { 
        sub: userId,
        lvl: payload.verification_level || 'device',
        iat: Math.floor(Date.now() / 1000)
      },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    console.log('✅ Verification successful');

    return NextResponse.json({
      ok: true,
      verified: true,
      userId: userId,
      token: token,
      state: userState
    }, { status: 200, headers: CORS });

  } catch (error) {
    console.error('💥 MiniKit verify error:', error);
    return NextResponse.json({
      ok: false,
      error: 'internal_server_error',
      message: error.message
    }, { status: 500, headers: CORS });
  }
}

export async function GET() {
  return NextResponse.json({
    ok: false,
    error: 'method_not_allowed',
    message: 'Use POST method'
  }, { status: 405, headers: CORS });
}