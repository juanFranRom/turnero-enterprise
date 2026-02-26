export const ANTI_BRUTE_FORCE_CONFIG = {
  FAILURE_WINDOW_MS: 60 * 60 * 1000,

  LOCK_STEPS_EMAIL: [
    { minAttempts: 4, lockMs: 30_000 },
    { minAttempts: 6, lockMs: 2 * 60_000 },
    { minAttempts: 8, lockMs: 10 * 60_000 },
    { minAttempts: 10, lockMs: 60 * 60_000 },
  ],

  // más alto para no romper NAT/oficinas
  LOCK_STEPS_IP: [
    { minAttempts: 30, lockMs: 30_000 },
    { minAttempts: 40, lockMs: 2 * 60_000 },
    { minAttempts: 50, lockMs: 10 * 60_000 },
    { minAttempts: 70, lockMs: 60 * 60_000 },
  ],
};