import { getAuthenticatedHttpClient } from '@/core/api/api-client';
import { isApiError } from '@/core/api/api-error';

export type GuildRole = 'leader' | 'member';

export type GuildSummary = {
  id: string;
  name: string;
  level: number;
  memberCount: number;
};

export type GuildDetail = GuildSummary & {
  leader: { userId: string; displayName: string } | null;
};

export type MyGuild = {
  guild: GuildDetail;
  role: GuildRole;
};

export type GuildMember = {
  userId: string;
  displayName: string;
  level: number;
  title: string | null;
  avatar: EquippedLook;
  accessory: EquippedLook;
  role: GuildRole;
  joinedAt: string;
};

export type GuildMemberPage = {
  items: GuildMember[];
  nextCursor: string | null;
};

export type GuildPage = {
  items: GuildSummary[];
  nextCursor: string | null;
};

export type RaidRewardCategory = 'avatar' | 'badge' | 'title' | 'accessory';

export type MissionOwner = { userId: string; displayName: string };

/** Missão do rodízio: grátis e de todos os membros, então sem dono declarado. */
export type MissionSummary = {
  id: string;
  slug: string;
  name: string;
  description: string;
  imageUrl: string | null;
  rotation: boolean;
};

export type AvailableMission = MissionSummary & { owners: MissionOwner[] };

/** A escolha do Líder para a próxima Raid; `owner` é `null` na Missão do rodízio. */
export type NextMissionChoice = { mission: MissionSummary; owner: MissionOwner | null; chosenAt: string };

export type ActiveRaid = {
  id: string;
  mission: { slug: string; name: string; description: string; imageUrl: string | null };
  /** De quem é a Missão escolhida pelo Líder; `null` na Missão do rodízio. */
  missionOwner: MissionOwner | null;
  /** Every Cosmetic Item the Missão gives, plus `coins` Moedas, to whoever contributes to a won Raid. */
  rewards: { itemId: string; name: string; category: RaidRewardCategory }[];
  coins: number;
  /** The first five of the Ranking interno, in ranking order, with their equipped look. */
  party: RaidRankingEntry[];
  goalXp: number;
  progressXp: number;
  /** Life the Fúria do dragão already gave back to the boss. */
  regeneratedXp: number;
  /** Vida do chefe: `goalXp − progressXp + regeneratedXp`, between 0 and `goalXp`. */
  healthXp: number;
  /** The Fúria rule: the percent of the goal the boss recovers per whole day without a Dia de estudo. */
  furyPercent: number;
  /** The first time the Vida do chefe reached zero (Meta batida); Contributions keep adding until `endsAt`. */
  goalReachedAt: string | null;
  startsAt: string;
  endsAt: string;
  status: 'active' | 'completed' | 'expired';
  /** The seven São Paulo days of the Raid week, Monday first, as `YYYY-MM-DD`. */
  weekDays: string[];
  /** Today in São Paulo by the server clock, as `YYYY-MM-DD`. */
  today: string;
  /** Dias de estudo of the week so far, as São Paulo `YYYY-MM-DD` days. */
  studyDays: string[];
  /** Sequência: Dias de estudo in a row ending today or yesterday. */
  streak: number;
  /** `position` is the user's place in the Ranking interno, `null` while they are not a Participant. */
  me: { participating: boolean; contributionXp: number; position: number | null };
  /** The most recent Golpe, `null` before the first Contribution. */
  lastHit: RaidHit | null;
};

/** Golpe: one Contribution seen as damage to the boss (the XP), with its author and the focus minutes of the session. */
export type RaidHit = {
  userId: string;
  displayName: string;
  xp: number;
  /** Whole minutes of validated focus; `null` when the Study Session no longer exists. */
  focusMinutes: number | null;
  at: string;
};

/** An equipped Cosmetic Item as shown on someone else's screen; `null` when the slot is empty. */
export type EquippedLook = { itemId: string; name: string } | null;

export type RaidRankingEntry = {
  position: number;
  userId: string;
  displayName: string;
  level: number;
  /** The equipped Título (ADR-010); `null` when the slot is empty. */
  title: string | null;
  avatar: EquippedLook;
  accessory: EquippedLook;
  contributionXp: number;
  isMe: boolean;
};

/** A Raid closed by the weekly closing: `completed` with Meta batida (the Guild went up a level), `expired` without. */
export type PastRaid = {
  id: string;
  mission: { slug: string; name: string };
  startsAt: string;
  endsAt: string;
  status: 'completed' | 'expired';
  goalXp: number;
  progressXp: number;
  me: { participated: boolean; contributionXp: number; position: number | null };
};

export type PastRaidPage = {
  items: PastRaid[];
  nextCursor: string | null;
};

export type RaidRankingPage = {
  items: RaidRankingEntry[];
  nextCursor: string | null;
};

/** `null` means the user is not in any guild (the API answers 404), which is a normal state, not a failure. */
export async function getMyGuild({ signal }: { signal?: AbortSignal } = {}): Promise<MyGuild | null> {
  try {
    const response = await getAuthenticatedHttpClient().get<MyGuild>('/guilds/me', { signal });
    return response.data;
  } catch (error) {
    if (isApiError(error) && error.status === 404) return null;
    throw error;
  }
}

export async function listGuilds(
  { search, cursor, signal }: { search?: string; cursor?: string | null; signal?: AbortSignal } = {},
): Promise<GuildPage> {
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (cursor) params.set('cursor', cursor);
  const query = params.toString();
  const response = await getAuthenticatedHttpClient().get<GuildPage>(`/guilds${query ? `?${query}` : ''}`, { signal });
  return response.data;
}

export async function createGuild(name: string): Promise<void> {
  await getAuthenticatedHttpClient().post('/guilds', { name });
}

export async function joinGuild(guildId: string): Promise<void> {
  await getAuthenticatedHttpClient().post(`/guilds/${encodeURIComponent(guildId)}/members`);
}

export async function listGuildMembers(
  guildId: string,
  { cursor, signal }: { cursor?: string | null; signal?: AbortSignal } = {},
): Promise<GuildMemberPage> {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
  const response = await getAuthenticatedHttpClient().get<GuildMemberPage>(`/guilds/${encodeURIComponent(guildId)}/members${query}`, { signal });
  return response.data;
}

export async function leaveGuild(guildId: string): Promise<void> {
  await getAuthenticatedHttpClient().delete(`/guilds/${encodeURIComponent(guildId)}/members/me`);
}

/** `null` means the Guild has no Raid this week (the API answers 404), which is a normal state, not a failure. */
export async function getActiveRaid(guildId: string, { signal }: { signal?: AbortSignal } = {}): Promise<ActiveRaid | null> {
  try {
    const response = await getAuthenticatedHttpClient().get<ActiveRaid>(`/guilds/${encodeURIComponent(guildId)}/raids/active`, { signal });
    return response.data;
  } catch (error) {
    if (isApiError(error) && error.status === 404) return null;
    throw error;
  }
}

/** Idempotent on the server: confirming twice is not an error. A 409 means the Raid already ended. */
export async function joinRaid(raidId: string): Promise<void> {
  await getAuthenticatedHttpClient().post(`/raids/${encodeURIComponent(raidId)}/join`);
}

export async function getRaidRanking(
  raidId: string,
  { cursor, signal }: { cursor?: string | null; signal?: AbortSignal } = {},
): Promise<RaidRankingPage> {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
  const response = await getAuthenticatedHttpClient().get<RaidRankingPage>(`/raids/${encodeURIComponent(raidId)}/ranking${query}`, { signal });
  return response.data;
}

export async function listPastRaids(
  guildId: string,
  { cursor, signal }: { cursor?: string | null; signal?: AbortSignal } = {},
): Promise<PastRaidPage> {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
  const response = await getAuthenticatedHttpClient().get<PastRaidPage>(`/guilds/${encodeURIComponent(guildId)}/raids${query}`, { signal });
  return response.data;
}

export async function listAvailableMissions(guildId: string, { signal }: { signal?: AbortSignal } = {}): Promise<AvailableMission[]> {
  const response = await getAuthenticatedHttpClient().get<AvailableMission[]>(`/guilds/${encodeURIComponent(guildId)}/raids/next-mission/available`, { signal });
  return response.data;
}

/** `null` means nobody chose: the rotation applies. */
export async function getNextMission(guildId: string, { signal }: { signal?: AbortSignal } = {}): Promise<NextMissionChoice | null> {
  const response = await getAuthenticatedHttpClient().get<{ choice: NextMissionChoice | null }>(`/guilds/${encodeURIComponent(guildId)}/raids/next-mission`, { signal });
  return response.data.choice;
}

/** Only the Leader; replaces the previous choice until the next Raid starts. `ownerId` is required for a priced Missão. */
export async function chooseNextMission(guildId: string, body: { missionId: string; ownerId?: string }): Promise<NextMissionChoice> {
  const response = await getAuthenticatedHttpClient().put<{ choice: NextMissionChoice }>(`/guilds/${encodeURIComponent(guildId)}/raids/next-mission`, body);
  return response.data.choice;
}
