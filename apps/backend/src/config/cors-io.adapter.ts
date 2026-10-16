import type { INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import type { ServerOptions } from 'socket.io';

export class CorsIoAdapter extends IoAdapter {
  constructor(
    app: INestApplicationContext,
    private readonly allowedOrigins: string[],
  ) {
    super(app);
  }

  override createIOServer(port: number, options?: ServerOptions) {
    const allowRequest: NonNullable<ServerOptions['allowRequest']> = (
      request,
      callback,
    ) => {
      const origin = request.headers.origin;
      callback(
        null,
        origin === undefined ||
          this.allowedOrigins.includes(origin) ||
          isSameHostOrigin(origin, request.headers.host),
      );
    };

    return super.createIOServer(port, {
      ...options,
      cors: {
        ...options?.cors,
        origin: this.allowedOrigins,
        credentials: true,
      },
      allowRequest,
    });
  }
}

// The native app sends an Origin derived from the socket URL itself. It matches
// the Host header; TLS ends at nginx, so only host:port is compared.
function isSameHostOrigin(origin: string, host: string | undefined): boolean {
  if (host === undefined) {
    return false;
  }
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
