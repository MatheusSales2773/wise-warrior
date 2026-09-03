const PUBLIC_API_URL_NAME = 'EXPO_PUBLIC_API_URL';

/**
 * Validates and normalizes the public API base URL used by the Expo bundle.
 *
 * The value is deliberately accepted as an argument so this module remains a
 * pure boundary: callers can supply process.env.EXPO_PUBLIC_API_URL while
 * tests and future adapters can provide their own environment explicitly.
 */
export function normalizePublicApiUrl(value: string | undefined): string {
  const input = value?.trim();

  if (!input) {
    throw new Error(`${PUBLIC_API_URL_NAME} must be configured.`);
  }

  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new Error(`${PUBLIC_API_URL_NAME} must be a valid HTTP(S) URL.`);
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`${PUBLIC_API_URL_NAME} must use http: or https:.`);
  }

  if (url.username || url.password) {
    throw new Error(`${PUBLIC_API_URL_NAME} must not include credentials.`);
  }

  if (url.search || url.hash) {
    throw new Error(`${PUBLIC_API_URL_NAME} must not include a query or fragment.`);
  }

  const pathname = url.pathname.replace(/\/+$/, '');
  return `${url.origin}${pathname}`;
}

export function getPublicApiUrl(): string {
  return normalizePublicApiUrl(process.env.EXPO_PUBLIC_API_URL);
}
