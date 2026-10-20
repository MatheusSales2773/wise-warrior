import {
  CHAT_MAX_BODY_LENGTH,
  SlidingWindowRateLimiter,
  parseBlockedTerms,
  sanitizeChatBody,
} from './chat-policy';

describe('sanitizeChatBody', () => {
  it('trims and strips control characters but keeps line breaks', () => {
    expect(sanitizeChatBody('  oi\u0000 time\nvamos  ')).toEqual({ ok: true, body: 'oi time\nvamos' });
  });

  it('keeps tabs', () => {
    expect(sanitizeChatBody('a\tb')).toEqual({ ok: true, body: 'a\tb' });
  });

  it('blocks whole words only', () => {
    expect(sanitizeChatBody('classe', ['ass']).ok).toBe(true);
    expect(sanitizeChatBody('seu ASS aí', ['ass'])).toEqual({ ok: false, reason: 'ABUSIVE' });
  });

  it.each([[''], ['   \n '], [42], [undefined]])('rejects empty content %p', (raw) => {
    expect(sanitizeChatBody(raw)).toEqual({ ok: false, reason: 'EMPTY' });
  });

  it('rejects bodies over the size limit and accepts the exact limit', () => {
    expect(sanitizeChatBody('a'.repeat(CHAT_MAX_BODY_LENGTH + 1))).toEqual({ ok: false, reason: 'TOO_LONG' });
    expect(sanitizeChatBody('ab'.repeat(CHAT_MAX_BODY_LENGTH / 2)).ok).toBe(true);
  });

  it.each([
    ['character flood', 'a'.repeat(30)],
    ['link spam', 'http://a.co http://b.co http://c.co'],
    ['line flood', Array.from({ length: 12 }, () => 'x').join('\n')],
  ])('rejects %s as abusive', (_name, raw) => {
    expect(sanitizeChatBody(raw)).toEqual({ ok: false, reason: 'ABUSIVE' });
  });

  it('rejects configured blocked terms ignoring case and accents', () => {
    const blocked = parseBlockedTerms(' Palavrão , ,spam ');
    expect(blocked).toEqual(['Palavrão', 'spam']);
    expect(sanitizeChatBody('que PALAVRAO feio', blocked)).toEqual({ ok: false, reason: 'ABUSIVE' });
    expect(sanitizeChatBody('tudo certo', blocked).ok).toBe(true);
  });
});

describe('SlidingWindowRateLimiter', () => {
  it('blocks after the limit within the window and recovers afterwards', () => {
    let now = 1_000;
    const limiter = new SlidingWindowRateLimiter(2, 10_000, () => now);
    expect(limiter.consume('u1')).toBeNull();
    expect(limiter.consume('u1')).toBeNull();
    now += 4_000;
    expect(limiter.consume('u1')).toBe(6_000);
    expect(limiter.consume('u2')).toBeNull();
    now += 6_000;
    expect(limiter.consume('u1')).toBeNull();
  });
});
