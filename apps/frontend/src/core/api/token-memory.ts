/**
 * Único lar do access token no runtime. O valor vive apenas na memória do
 * módulo durante a sessão e nunca é persistido, serializado ou exposto a
 * componentes. Em Web o refresh continua exclusivamente no cookie `httpOnly`.
 */
let accessToken: string | null = null;
const listeners = new Set<(token: string | null) => void>();

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  const next = token && token.length > 0 ? token : null;
  if (next === accessToken) return;
  accessToken = next;
  listeners.forEach((listener) => listener(next));
}

export function clearAccessToken(): void {
  setAccessToken(null);
}

/** Avisa quem mantém conexões autenticadas (ex.: o tempo real) quando o token muda, sem expor o valor a componentes. */
export function subscribeAccessToken(listener: (token: string | null) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
