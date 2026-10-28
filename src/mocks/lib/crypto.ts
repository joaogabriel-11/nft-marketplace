const encoder = new TextEncoder();

const toHex = (buffer: ArrayBuffer | Uint8Array) =>
  Array.from(buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

/** PBKDF2-SHA256. A senha nunca é persistida, só salt + hash. */
export async function hashPassword(password: string, salt: string) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: encoder.encode(salt), iterations: 10_000 },
    key,
    256,
  );
  return toHex(bits);
}

export function randomHex(bytes = 16) {
  return toHex(crypto.getRandomValues(new Uint8Array(bytes)));
}

export function randomId(prefix: string) {
  return `${prefix}_${randomHex(8)}`;
}

/** Hash estável de um payload, usado para comparar reenvios com a mesma chave de idempotência. */
export async function hashPayload(payload: unknown) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(stableStringify(payload)));
  return toHex(digest);
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

/** PRNG determinístico (mulberry32) para fixtures e latência reproduzíveis. */
export function createRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
