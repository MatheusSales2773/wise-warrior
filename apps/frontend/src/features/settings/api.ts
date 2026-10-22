import { getAuthenticatedHttpClient } from '@/core/api/api-client';
import type { UserProfile } from '@/features/dashboard/api';

/** `PATCH /users/me`: renames the warrior and returns the profile in the shape of `GET /users/me`. */
export async function updateMyDisplayName(displayName: string): Promise<UserProfile> {
  const response = await getAuthenticatedHttpClient().patch<UserProfile>('/users/me', { displayName });
  return response.data;
}
