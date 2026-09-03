/**
 * Taxa de conversão de duração válida de sessão em XP. Nenhum documento
 * orientador define esse número — só que "quanto mais focado e contínuo,
 * mais XP acumulado" (Pitch). Valor inicial assumido para o MVP, sujeito a
 * balanceamento pelo Product Owner: 10 XP por minuto completo de foco válido.
 */
export const XP_PER_MINUTE = 10;

export function xpForDuration(validSeconds: number): number {
  if (validSeconds < 0) {
    throw new Error('validSeconds não pode ser negativo');
  }
  return Math.floor(validSeconds / 60) * XP_PER_MINUTE;
}
