export const GUILD_NAME_MIN_LENGTH = 3;
export const GUILD_NAME_MAX_LENGTH = 60;

/** Names are compared and sent without outer whitespace, matching the API's 3 to 60 character rule. */
export function normalizeGuildName(value: string): string {
  return value.trim();
}

export function validateGuildName(value: string): string | undefined {
  const name = normalizeGuildName(value);
  if (!name) return 'Dê um nome à sua guilda.';
  if (name.length < GUILD_NAME_MIN_LENGTH) return `O nome precisa ter ao menos ${GUILD_NAME_MIN_LENGTH} caracteres.`;
  if (name.length > GUILD_NAME_MAX_LENGTH) return `O nome pode ter no máximo ${GUILD_NAME_MAX_LENGTH} caracteres.`;
  return undefined;
}
