import { DEFAULT_HERO_ID, cosmeticSprite } from '@/features/character/catalog';
import type { ItemSpriteName, PixelSpriteData } from '@/features/character/sprites';
import { heroSprites } from '@/features/character/sprites';
import type { RaidHit, RaidRankingEntry } from './api';
import { raidProgressPercent } from './messages';
import { raidWeapons, sentinelaSprite } from './raid-scene-sprites';

/*
 * Regras de apresentação da tela da Raid (Figma 06b). O domínio continua em XP; a tela mostra horas de foco.
 */

/** A Raid soma o XP das sessões, e o backend dá 10 XP por minuto de foco (`XP_PER_MINUTE`): 600 XP valem uma hora. */
export const XP_PER_FOCUS_HOUR = 600;

const ONE_DECIMAL = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const WHOLE = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });

/**
 * XP em horas de foco. Totais da Raid acima de 10h aparecem inteiros ("138h"); o resto, e o que cada membro
 * fez (`precise`), com uma casa ("24,2h").
 */
export function formatFocusHours(xp: number, { precise = false }: { precise?: boolean } = {}): string {
  const hours = Math.max(0, xp) / XP_PER_FOCUS_HOUR;
  if (!precise && hours >= 10) return `${WHOLE.format(Math.floor(hours))}h`;
  return `${ONE_DECIMAL.format(Math.floor(hours * 10) / 10)}h`;
}

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

/** Vida que resta ao chefe: o que falta para a meta. Zero depois da Meta batida. */
export function bossLifePercent(progressXp: number, goalXp: number, goalReached: boolean): number {
  return goalReached ? 0 : 100 - raidProgressPercent(progressXp, goalXp);
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

export type PartyHero = 'guerreira' | 'sentinela' | 'paladino' | 'arcanista' | 'erudito';

export const partyHeroSprites: Record<PartyHero, PixelSpriteData> = {
  guerreira: heroSprites.guerreira,
  sentinela: sentinelaSprite,
  paladino: heroSprites.paladino,
  arcanista: heroSprites.arcanista,
  erudito: heroSprites.erudito,
};

export const partyHeroWeapons: Record<PartyHero, keyof typeof raidWeapons> = {
  guerreira: 'sword',
  sentinela: 'sword',
  paladino: 'crossbow',
  arcanista: 'staff',
  erudito: 'staff',
};

/** The class a worn Avatar dresses; Avatars without one (and an empty slot) keep the initial class. */
const heroByAvatar: Record<string, PartyHero> = {
  'Armadura do Lobo': 'guerreira',
  'Manto Estelar': 'arcanista',
  'Manto da Vigília': 'sentinela',
};

/** The hero drawn for a member, from the Avatar they have equipped. */
export function heroOf(member: Pick<RaidRankingEntry, 'avatar'>): PartyHero {
  return (member.avatar && heroByAvatar[member.avatar.name]) || DEFAULT_HERO_ID;
}

export type PartyMember = {
  userId: string;
  displayName: string;
  level: number;
  isMe: boolean;
  hero: PartyHero;
  /** The sprite of the equipped Acessório, drawn beside the hero; `null` with the slot empty. */
  accessory: ItemSpriteName | null;
};

/** Quem aparece na cena: os primeiros Participantes do Ranking interno (`party` da Raid, no máximo cinco). */
export function raidParty(party: readonly RaidRankingEntry[]): PartyMember[] {
  return party.map((entry) => ({
    userId: entry.userId,
    displayName: entry.isMe ? 'Você' : entry.displayName,
    level: entry.level,
    isMe: entry.isMe,
    hero: heroOf(entry),
    accessory: entry.accessory ? cosmeticSprite({ category: 'accessory', name: entry.accessory.name }) : null,
  }));
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
