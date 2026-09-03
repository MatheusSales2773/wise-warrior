import { normalizePublicApiUrl } from '../src/config/environment';

describe('normalizePublicApiUrl', () => {
  it.each([undefined, '', '   '])('rejects a missing value (%p)', (value) => {
    expect(() => normalizePublicApiUrl(value)).toThrow(/EXPO_PUBLIC_API_URL/);
  });

  it.each(['ftp://api.example.com', 'api.example.com'])('rejects non-HTTP(S) values (%s)', (value) => {
    expect(() => normalizePublicApiUrl(value)).toThrow(/EXPO_PUBLIC_API_URL/);
  });

  it.each([
    'https://warrior:secret@api.example.com',
    'https://api.example.com/sessions?status=active',
    'https://api.example.com/sessions#latest',
  ])('rejects credentials, queries, and fragments (%s)', (value) => {
    expect(() => normalizePublicApiUrl(value)).toThrow(/EXPO_PUBLIC_API_URL/);
    expect(() => normalizePublicApiUrl(value)).not.toThrow(/secret|status|latest/);
  });

  it('trims input and removes trailing path slashes', () => {
    expect(normalizePublicApiUrl('  https://api.example.com/v1///  ')).toBe(
      'https://api.example.com/v1',
    );
  });

  it('keeps the origin without a trailing slash', () => {
    expect(normalizePublicApiUrl('https://api.example.com/')).toBe('https://api.example.com');
  });
});
