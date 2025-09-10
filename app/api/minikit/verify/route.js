import { NextResponse } from 'next/server';
import { redis, keys } from '@/lib/db';
import { signJwt } from '@/lib/auth';

export async function POST(req) {
  try {
    console.log('🔍 Verificación iniciada');
    
    const body = await req.json();
    console.log('📥 Body recibido:', { 
      action: body.action,
      hasProof: !!body.proof,
      hasMerkleRoot: !!body.merkle_root,
      hasNullifierHash: !!body.nullifier_hash,
      verification_level: body.verification_level
    });

    const { action, proof, merkle_root, nullifier_hash, verification_level } = body;
    
    // Validar campos requeridos
    if (!action || !proof || !merkle_root || !nullifier_hash || !verification_level) {
      console.log('❌ Campos faltantes');
      return NextResponse.json({
        ok: false,
        error: 'missing_fields',
        details: {
          action: !!action,
          proof: !!proof,
          merkle_root: !!merkle_root,
          nullifier_hash: !!nullifier_hash,
          verification_level: !!verification_level
        }
      }, { status: 400 });
    }
    
    // Validar action específico
    const expectedAction = process.env.ACTION_ID_LOGIN || 'rainbowgold-login';
    if (action !== expectedAction) {
      console.log('❌ Action inválido:', action, 'esperado:', expectedAction);
      return NextResponse.json({
        ok: false,
        error: 'invalid_action',
        expected: expectedAction,
        received: action
      }, { status: 400 });
    }

    const app_id = process.env.WORLD_ID_APP_ID;
    if (!app_id) {
      console.log('❌ WORLD_ID_APP_ID no configurado');
      return NextResponse.json({
        ok: false,
        error: 'server_config_error',
        message: 'WORLD_ID_APP_ID not configured'
      }, { status: 500 });
    }

    // Verificar con World ID (si no es mock)
    if (!proof.startsWith('mock_')) {
      console.log('🔍 Verificando con World ID API...');
      
      const endpoint = process.env.WORLD_ID_VERIFY_ENDPOINT || 'https://developer.worldcoin.org/api/v2/verify';
      
      try {
        const vr = await fetch(endpoint, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ 
            app_id, 
            action, 
            proof, 
            merkle_root, 
            nullifier_hash, 
            verification_level 
          })
        });

        const res = await vr.json().catch(() => null);
        
        if (!vr.ok || !res?.success) {
          console.log('❌ World ID API error:', vr.status, res);
          return NextResponse.json({
            ok: false,
            error: 'invalid_proof',
            detail: res,
            status: vr.status
          }, { status: 400 });
        }
        
        console.log('✅ Verificación exitosa con World ID');
      } catch (worldIdError) {
        console.error('❌ Error conectando con World ID:', worldIdError);
        return NextResponse.json({
          ok: false,
          error: 'worldid_api_error',
          message: worldIdError.message
        }, { status: 500 });
      }
    } else {
      console.log('🧪 Verificación mock detectada - saltando World ID API');
    }

    const userId = nullifier_hash;
    
    // Guardar usuario en Redis
    try {
      await redis.hset(keys.user(userId), { 
        id: userId, 
        verification_level, 
        createdAt: Date.now() 
      });
      console.log('✅ Usuario guardado en Redis');
    } catch (redisError) {
      console.error('⚠️ Error guardando en Redis:', redisError);
      // Continuar sin Redis para testing
    }
    
    // Inicializar progreso si no existe
    try {
      const exists = await redis.hgetall(keys.progress(userId));
      if (!exists || !Object.keys(exists).length) {
        await redis.hset(keys.progress(userId), { 
          username: `RG-${userId.slice(0, 6)}`, 
          energy: 100, 
          energyCapacity: 100, 
          taps: 0, 
          rbgp: 0 
        });
        console.log('✅ Progreso inicial creado');
      }
    } catch (redisError) {
      console.error('⚠️ Error inicializando progreso:', redisError);
      // Continuar sin Redis para testing
    }
    
    const token = signJwt({ sub: userId, lvl: verification_level });
    console.log('✅ Token JWT generado');
    
    return NextResponse.json({
      ok: true, 
      userId, 
      token,
      state: {
        wld: 0,
        rbgp: 0,
        energy: 100
      }
    });

  } catch (e) {
    console.error('💥 Error general en verificación:', e);
    return NextResponse.json({
      ok: false,
      error: 'server_error',
      message: e.message
    }, { status: 500 });
  }
}

// Manejar OPTIONS requests
export async function OPTIONS(req) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept',
      'Access-Control-Max-Age': '86400',
    },
  });
}