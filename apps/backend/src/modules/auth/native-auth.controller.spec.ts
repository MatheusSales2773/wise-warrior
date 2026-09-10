import type { Request } from 'express';
import { NativeAuthController } from './native-auth.controller';
import type { AuthService, AuthTokens } from './auth.service';
import type { NativeLoginDto } from './dto/native-login.dto';
import type { NativeRefreshDto } from './dto/native-refresh.dto';
import type { NativeRegisterDto } from './dto/native-register.dto';

const tokens: AuthTokens = {
  accessToken: 'access-token',
  refreshToken: 'session-id.refresh-secret',
  sessionId: 'session-id',
};

function request(userAgent = 'wise-ios/1.0'): Request {
  return { headers: { 'user-agent': userAgent } } as unknown as Request;
}

describe('NativeAuthController contract', () => {
  it('registers and returns the rotating credential trio in the body', async () => {
    const auth = {
      register: jest.fn().mockResolvedValue({ id: 'user-1', email: 'a@b.com' }),
      issueSession: jest.fn().mockResolvedValue(tokens),
    };
    const controller = new NativeAuthController(auth as unknown as AuthService);
    const dto: NativeRegisterDto = {
      email: 'a@b.com',
      password: 'super-secret',
      displayName: 'Hero',
      deviceLabel: 'Wise iOS',
    };

    const result = await controller.register(dto, request());

    expect(auth.register).toHaveBeenCalledWith(dto);
    expect(auth.issueSession).toHaveBeenCalledWith(
      { id: 'user-1', email: 'a@b.com' },
      { deviceLabel: 'Wise iOS', userAgent: 'wise-ios/1.0' },
    );
    expect(result).toEqual(tokens);
  });

  it('logs in with body credentials and returns the trio without a cookie', async () => {
    const auth = {
      validateCredentials: jest.fn().mockResolvedValue({
        id: 'user-1',
        email: 'a@b.com',
      }),
      issueSession: jest.fn().mockResolvedValue(tokens),
    };
    const controller = new NativeAuthController(auth as unknown as AuthService);
    const dto: NativeLoginDto = {
      email: 'a@b.com',
      password: 'super-secret',
      deviceLabel: 'Wise Android',
    };

    const result = await controller.login(dto, request('wise-android/1.0'));

    expect(auth.validateCredentials).toHaveBeenCalledWith('a@b.com', 'super-secret');
    expect(auth.issueSession).toHaveBeenCalledWith(
      { id: 'user-1', email: 'a@b.com' },
      { deviceLabel: 'Wise Android', userAgent: 'wise-android/1.0' },
    );
    expect(result).toEqual(tokens);
    expect(result).toHaveProperty('refreshToken');
  });

  it('rotates and revokes through the same session domain using body credentials', async () => {
    const auth = {
      refresh: jest.fn().mockResolvedValue(tokens),
      logoutByRefreshToken: jest.fn().mockResolvedValue(undefined),
    };
    const controller = new NativeAuthController(auth as unknown as AuthService);
    const dto: NativeRefreshDto = { refreshToken: 'session-id.old-secret' };

    await expect(controller.refresh(dto)).resolves.toEqual(tokens);
    expect(auth.refresh).toHaveBeenCalledWith('session-id.old-secret');

    await expect(controller.logout(dto)).resolves.toBeUndefined();
    expect(auth.logoutByRefreshToken).toHaveBeenCalledWith('session-id.old-secret');
  });
});
