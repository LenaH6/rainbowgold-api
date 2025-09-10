import jwt from 'jsonwebtoken';

export function signJwt(payload) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET not configured');
  }
  return jwt.sign(payload, secret, { expiresIn: '30d' });
}

export function verifyJwt(token) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET not configured');
  }
  return jwt.verify(token, secret);
}

export function getBearer(req) {
  const authHeader = req.headers.get?.('authorization') || '';
  const match = /^Bearer\s+(.+)/i.exec(authHeader);
  return match ? match[1] : null;
}