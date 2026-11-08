const normalize = (value: string): string => value.trim().toLowerCase();

/** O e-mail está em `DEV_TOOLS_EMAILS` (separado por vírgula, sem espaços nem maiúsculas)? Vazia ou ausente libera ninguém. */
export function isDevToolsEmail(email: string, list: string | undefined): boolean {
  const target = normalize(email);
  return target !== '' && (list ?? '').split(',').some((item) => normalize(item) === target);
}
