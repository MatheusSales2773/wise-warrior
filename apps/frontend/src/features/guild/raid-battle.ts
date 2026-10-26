import { cosmeticSprite } from '@/features/character/catalog';
import type { ItemSpriteName } from '@/features/character/sprites';
import type { ActiveRaid, EquippedAppearance, EquippedLook, RaidHit, RaidRankingEntry } from './api';
import { XP_PER_FOCUS_HOUR, formatFocusHours } from './focus-hours';

/*
 * Regras de apresentação da tela da Raid (Figma 06b). O domínio continua em XP; a tela mostra horas de foco.
 */

export { XP_PER_FOCUS_HOUR, formatFocusHours };

const WHOLE = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });

/**
 * Golpe sobre a cena: o dano ("−75") e, abaixo, "Eldoria · 25 min". O dano fica em XP e a duração substitui os
 * "ciclos" do Figma, porque cada Golpe é um Ciclo. Sem a Study Session, a segunda linha traz só o autor.
 */
export function formatRaidHit({ displayName, xp, focusMinutes }: Pick<RaidHit, 'displayName' | 'xp' | 'focusMinutes'>): { damage: string; detail: string; label: string } {
  const damage = `−${WHOLE.format(xp)}`;
  if (focusMinutes === null) {
    return { damage, detail: displayName, label: `Último golpe: ${displayName} causou ${WHOLE.format(xp)} de dano` };
  }
  return {
    damage,
    detail: `${displayName} · ${focusMinutes} min`,
    label: `Último golpe: ${displayName} causou ${WHOLE.format(xp)} de dano em ${focusMinutes} min de foco`,
  };
}

/** Vida do chefe (com a Fúria) sobre a meta, arredondada para cima: só chega a zero com a Meta batida. */
export function bossLifePercent(healthXp: number, goalXp: number, goalReached: boolean): number {
  if (goalReached || goalXp <= 0) return 0;
  return Math.min(100, Math.max(0, Math.ceil((healthXp / goalXp) * 100)));
}

/** Contagem regressiva da cena: "3d 14h", "5h 20min", "45min". A versão longa ganha "restantes". */
export function formatBattleTimeLeft(milliseconds: number, { long = false }: { long?: boolean } = {}): string {
  const minutes = Math.floor(milliseconds / 60_000);
  if (minutes <= 0) return 'Encerrando…';
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const short = days > 0 ? `${days}d ${hours}h` : hours > 0 ? `${hours}h ${minutes % 60}min` : `${minutes}min`;
  return long ? `${short} restantes` : short;
}

/** The sprite of an equipped Acessório; `null` with the slot empty. */
export function accessorySpriteOf(look: EquippedLook): ItemSpriteName | null {
  return look ? cosmeticSprite({ category: 'accessory', name: look.name }) : null;
}

export type PartyMember = {
  userId: string;
  displayName: string;
  level: number;
  isMe: boolean;
  /** What the member wears; the scene composes the Herói from it (ADR-013). */
  equipped: EquippedAppearance;
};

/** Quem aparece na cena: os primeiros Participantes do Ranking interno (`party` da Raid, no máximo cinco). */
export function raidParty(party: readonly RaidRankingEntry[]): PartyMember[] {
  return party.map((entry) => ({
    userId: entry.userId,
    displayName: entry.isMe ? 'Você' : entry.displayName,
    level: entry.level,
    isMe: entry.isMe,
    equipped: entry,
  }));
}

/** One sentence per row for screen readers: the position, the member and the Contribution in focus hours, plus who "you" are. */
export function rankingEntryLabel(entry: { position: number; displayName: string; level: number; title: string | null; contributionXp: number; isMe: boolean }): string {
  const who = [`${entry.displayName}${entry.isMe ? ' (você)' : ''}`, `nível ${entry.level}`, entry.title].filter(Boolean).join(', ');
  return `Posição ${entry.position}: ${who}, ${formatFocusHours(entry.contributionXp, { precise: true })} de foco`;
}

export type Strike = { entry: RaidRankingEntry; fraction: number };

/**
 * Linhas de "Golpes da semana": os primeiros do ranking. Se você está mais abaixo, a sua linha ocupa a última vaga.
 * A barra é proporcional a quem mais contribuiu.
 */
export function weeklyStrikes(entries: readonly RaidRankingEntry[], limit: number): Strike[] {
  const top = entries.slice(0, limit);
  const me = entries.find((entry) => entry.isMe);
  const rows = me && !top.includes(me) && top.length === limit ? [...top.slice(0, limit - 1), me] : top;
  const best = Math.max(0, ...entries.map((entry) => entry.contributionXp));
  return rows.map((entry) => ({ entry, fraction: best > 0 ? entry.contributionXp / best : 0 }));
}

const WEEKDAY_INITIALS = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'] as const;

export type WeekDay = { key: string; initial: (typeof WEEKDAY_INITIALS)[number]; name: string; state: 'studied' | 'missed' | 'today' | 'upcoming' };

/** How a day state is spoken to screen readers: "segunda: com estudo". */
export const WEEK_DAY_STATE_LABEL: Record<WeekDay['state'], string> = {
  studied: 'com estudo',
  today: 'hoje, ainda sem estudo',
  missed: 'sem estudo',
  upcoming: 'ainda não chegou',
};

const WEEKDAY_NAMES = ['segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado', 'domingo'] as const;

/**
 * The seven days of the Raid week, Monday first. The backend owns the calendar (`weekDays`, `today`, `studyDays`,
 * all São Paulo days), so this only compares the `YYYY-MM-DD` keys: `today` without study is `today`, earlier days
 * without study are `missed`.
 */
export function raidWeekGrid({ weekDays, studyDays, today }: Pick<ActiveRaid, 'weekDays' | 'studyDays' | 'today'>): WeekDay[] {
  const studied = new Set(studyDays);
  return weekDays.map((key, index) => ({
    key,
    initial: WEEKDAY_INITIALS[index] ?? 'S',
    name: WEEKDAY_NAMES[index] ?? '',
    state: studied.has(key) ? 'studied' : key === today ? 'today' : key < today ? 'missed' : 'upcoming',
  }));
}

/** "4 dias sem falhar"; `compact` drops the "da guilda" label for the phone strip. */
export function formatStreak(streak: number, { compact = false }: { compact?: boolean } = {}): string {
  const label = compact ? 'Guilda' : 'Sequência da guilda';
  return `${label}: ${streak === 0 ? 'nenhum dia ainda' : formatStreakDays(streak)}`;
}

/** The streak alone, for a card that already titles it: "4 dias sem falhar". */
export function formatStreakDays(streak: number): string {
  if (streak === 0) return 'Nenhum dia ainda';
  return `${streak} ${streak === 1 ? 'dia' : 'dias'} sem falhar`;
}
