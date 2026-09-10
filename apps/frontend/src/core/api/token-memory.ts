/**
 * Único lar do access token no runtime. O valor vive apenas na memória do
 * módulo durante a sessão e nunca é persistido, serializado ou exposto a
 * componentes. Em Web o refresh continua exclusivamente no cookie `httpOnly`.
 */
let accessToken: string | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token && token.length > 0 ? token : null;
}

export function clearAccessToken(): void {
  accessToken = null;
}
