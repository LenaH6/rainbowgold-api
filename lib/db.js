import { Redis } from '@upstash/redis';
export const redis = new Redis({ url: process.env.UPSTASH_REDIS_URL, token: process.env.UPSTASH_REDIS_TOKEN });
export const keys = {
  user: (id)=>`user:${id}`,
  usernameChanges: (id)=>`user:${id}:rename`,
  taps: (id)=>`taps:${id}`,            // list of batches
  progress: (id)=>`progress:${id}`,    // hash with fields
  suggestions:'suggestions',
  votes:(sid)=>`votes:${sid}`,
  ordersByUser:(id)=>`orders:${id}`,
  txByUser:(id)=>`tx:${id}`,
  adminSet:'admins'
};