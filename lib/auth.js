import jwt from 'jsonwebtoken';
export function signJwt(payload){const s=process.env.JWT_SECRET; if(!s) throw new Error('JWT_SECRET'); return jwt.sign(payload, s, {expiresIn:'30d'});}
export function verifyJwt(token){const s=process.env.JWT_SECRET; if(!s) throw new Error('JWT_SECRET'); return jwt.verify(token, s);}
export function getBearer(req){const h=req.headers.get?.('authorization')||''; const m=/^Bearer\s+(.+)/i.exec(h); return m?m[1]:null;}