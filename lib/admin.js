import { redis, keys } from './db';

export async function isAdmin(userId) {
  if (!userId) return false;
  // Admins can be injected via env list or redis set
  const envAdmins = (process.env.ADMIN_USER_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (envAdmins.includes(userId)) return true;
  return await redis.sismember(keys.adminSet, userId);
}
