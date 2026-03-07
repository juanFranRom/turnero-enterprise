export function redisPrefix() {
  return process.env.REDIS_PREFIX ?? `turnero:${process.env.NODE_ENV ?? 'dev'}`;
}