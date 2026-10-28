/** Timeout do Axios. O cenário "order-timeout" dos mocks responde depois disso de propósito. */
export const API_TIMEOUT_MS = 10_000;

export const HEADERS = {
  idempotencyKey: "Idempotency-Key",
  guestCartId: "X-Guest-Cart-Id",
} as const;
