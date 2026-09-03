import { createHash, randomBytes } from 'crypto';

/**
 * Hash rápido (SHA-256) para segredos de alta entropia já aleatórios
 * (ex.: o segredo do refresh token). Não usar para senhas de usuário —
 * senhas usam Argon2id (ver AuthService), que é deliberadamente lento
 * contra força bruta de segredos de baixa entropia escolhidos por humanos.
 */
export function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('hex');
}
