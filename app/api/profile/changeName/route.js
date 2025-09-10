// Auto-migrated from api/profile/changeName.js
// Next.js App Router route
import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL,
  token: process.env.UPSTASH_REDIS_TOKEN,
});

// ---- ORIGINAL HANDLER BODY (lightly adapted) ----
// /api/profile/changeName.js
import jwt from "jsonwebtoken";
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL,
  token: process.env.UPSTASH_REDIS_TOKEN,
});

export default async function handler(req, res) {
// --- CORS (inserted) ---
const ORIGIN = process.env.ALLOWED_ORIGIN || "https://rainbowgold-app.vercel.app";
res.setHeader("Access-Control-Allow-Origin", ORIGIN);
res.setHeader("Vary", "Origin");
res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
if (req.method === "OPTIONS") {
  res.status(204).end();
  return;
}
// --- end CORS ---


  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Método no permitido" });
  }

  try {
    let body = req.body;
    if (typeof body === "string") {
      body = JSON.parse(body);
    }

    const { token, newName } = body;
    if (!token || !newName) {
      return res.status(400).json({ ok: false, error: "Faltan datos" });
    }

    // Verificar token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ ok: false, error: "Token inválido" });
    }

    const userId = decoded.userId;

    // Leer estado actual
    const raw = await redis.get(`user:${userId}`);
    if (!raw) {
      return res.status(404).json({ ok: false, error: "Usuario no encontrado" });
    }
    const state = typeof raw === "string" ? JSON.parse(raw) : raw;

    // Límite de cambios
    if ((state.nameChanges || 0) >= 3) {
      return res.status(403).json({ ok: false, error: "Has alcanzado el límite de cambios de nombre (3)" });
    }

    // Aplicar cambio
    state.name = newName;
    state.nameChanges = (state.nameChanges || 0) + 1;

    await redis.set(`user:${userId}`, JSON.stringify(state));

    return res.status(200).json({ ok: true, name: state.name, remaining: 3 - state.nameChanges });
  } catch (err) {
    console.error("changeName error:", err);
    return res.status(500).json({ ok: false, error: "Error interno en changeName" });
  }
}


// ---- Adapter layer: emulate (req,res) over NextRequest ----
function ok(json) { return NextResponse.json(json, { status: 200, headers: corsHeaders() }); }
function bad(status, json) { return NextResponse.json(json, { status, headers: corsHeaders() }); }
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };
}

export async function OPTIONS() { return new NextResponse(null, { status: 200, headers: corsHeaders() }); }

export async function GET(req) {
  // Some legacy endpoints used GET for listing; call "handler" if present
  try {
    const url = new URL(req.url);
    const query = Object.fromEntries(url.searchParams);
    const body = null;
    const res = createRes();
    const legacyReq = { method:'GET', headers:Object.fromEntries(req.headers), query, body };
    const ret = await handler(legacyReq, res);
    if (ret && ret.__nextResponse) return ret.__nextResponse;
    return ok({ ok:true, note:'GET handled by adapter but original handler may expect POST.' });
  } catch (e) {
    console.error(e);
    return bad(500, { ok:false, error:'GET adapter error' });
  }
}

export async function POST(req) {
  try {
    const json = req.headers.get('content-type')?.includes('application/json') ? await req.json() : null;
    const res = createRes();
    const legacyReq = { method:'POST', headers:Object.fromEntries(req.headers), body: json };
    const ret = await handler(legacyReq, res);
    if (ret && ret.__nextResponse) return ret.__nextResponse;
    // If legacy handler wrote to res, that response is already returned
    return ok({ ok:true, note:'POST handled by adapter.' });
  } catch (e) {
    console.error(e);
    return bad(500, { ok:false, error:'POST adapter error' });
  }
}

function createRes() {
  const res = {
    statusCode: 200,
    headers: {},

    setHeader(k,v) { this.headers[k]=v; },
    status(s) { this.statusCode = s; return this; },
    json(obj) { 
      const r = NextResponse.json(obj, { status: this.statusCode, headers: {...corsHeaders(), ...this.headers} });
      return { __nextResponse: r };
    },
    end() { const r = new NextResponse(null, { status: this.statusCode, headers: {...corsHeaders(), ...this.headers} }); return { __nextResponse: r }; }
  };
  return res;
}
