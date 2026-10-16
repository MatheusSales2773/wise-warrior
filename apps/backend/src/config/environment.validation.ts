/**
 * Validação do ambiente no boot (#13), chamada por `main.ts` antes de criar a aplicação. Em produção o
 * backend não sobe com segredo ausente, curto ou de exemplo. As mensagens citam só o nome da variável,
 * nunca o valor, para o erro de boot não vazar um segredo nos logs.
 */
export const MIN_SECRET_LENGTH = 32;

/** Trechos dos valores de exemplo de `.env.example` e dos fallbacks antigos. */
const PLACEHOLDER_MARKERS = ['change-me', 'changeme'];

const POSITIVE_INTEGER_KEYS = [
  'RATE_LIMIT_CREDENTIALS_LIMIT',
  'RATE_LIMIT_CREDENTIALS_TTL_SECONDS',
  'RATE_LIMIT_REFRESH_LIMIT',
  'RATE_LIMIT_REFRESH_TTL_SECONDS',
  'RATE_LIMIT_STUDY_SESSION_LIMIT',
  'RATE_LIMIT_STUDY_SESSION_TTL_SECONDS',
  'RATE_LIMIT_PURCHASE_LIMIT',
  'RATE_LIMIT_PURCHASE_TTL_SECONDS',
] as const;

function isPlaceholder(value: string): boolean {
  const normalized = value.toLowerCase();
  return PLACEHOLDER_MARKERS.some((marker) => normalized.includes(marker));
}

function readString(config: Record<string, unknown>, key: string): string | undefined {
  const value = config[key];
  if (value === undefined || value === null) return undefined;
  const text = String(value).trim();
  return text === '' ? undefined : text;
}

export function validateEnvironment(config: Record<string, unknown>): Record<string, unknown> {
  const problems: string[] = [];

  for (const key of POSITIVE_INTEGER_KEYS) {
    const value = readString(config, key);
    if (value !== undefined && !/^[1-9]\d*$/.test(value)) {
      problems.push(`${key} deve ser um inteiro positivo`);
    }
  }

  if (readString(config, 'NODE_ENV') === 'production') {
    const accessSecret = readString(config, 'JWT_ACCESS_SECRET');
    if (accessSecret === undefined) {
      problems.push('JWT_ACCESS_SECRET é obrigatório em produção');
    } else if (accessSecret.length < MIN_SECRET_LENGTH) {
      problems.push(`JWT_ACCESS_SECRET deve ter ao menos ${MIN_SECRET_LENGTH} caracteres em produção`);
    } else if (isPlaceholder(accessSecret)) {
      problems.push('JWT_ACCESS_SECRET não pode ser um valor de exemplo em produção');
    }

    const dbPassword = readString(config, 'DB_PASSWORD');
    if (dbPassword === undefined) {
      problems.push('DB_PASSWORD é obrigatório em produção');
    } else if (isPlaceholder(dbPassword)) {
      problems.push('DB_PASSWORD não pode ser um valor de exemplo em produção');
    }

    if (readString(config, 'CORS_ORIGIN') === undefined) {
      problems.push('CORS_ORIGIN é obrigatório em produção');
    }
  }

  if (problems.length > 0) {
    throw new Error(`Configuração de ambiente inválida:\n- ${problems.join('\n- ')}`);
  }
  return config;
}
