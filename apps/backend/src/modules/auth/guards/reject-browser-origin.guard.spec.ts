import { ForbiddenException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { RejectBrowserOriginGuard } from './reject-browser-origin.guard';

function contextFor(headers: Record<string, string>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ headers }) as unknown as Request,
    }),
  } as unknown as ExecutionContext;
}

describe('RejectBrowserOriginGuard', () => {
  const guard = new RejectBrowserOriginGuard();

  it('allows requests without an Origin header, including native apps', () => {
    expect(guard.canActivate(contextFor({}))).toBe(true);
    expect(
      guard.canActivate(contextFor({ 'user-agent': 'wise-ios/1.0' })),
    ).toBe(true);
  });

  it.each([
    ['an allowlisted Web origin', 'http://localhost:8081'],
    ['a foreign origin', 'https://evil.example'],
    ['the opaque null origin', 'null'],
  ])('rejects %s as defense in depth', (_label, origin) => {
    expect(() => guard.canActivate(contextFor({ origin }))).toThrow(
      ForbiddenException,
    );
  });
});
