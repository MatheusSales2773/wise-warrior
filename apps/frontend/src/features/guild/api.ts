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

export type ActiveRaid = {
  id: string;
  mission: { slug: string; name: string; description: string; imageUrl: string | null };
  reward: { itemId: string; name: string; category: RaidRewardCategory };
  goalXp: number;
  progressXp: number;
  startsAt: string;
  endsAt: string;
  status: 'active' | 'completed' | 'expired';
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
