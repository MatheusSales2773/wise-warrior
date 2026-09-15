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
        origin === undefined || this.allowedOrigins.includes(origin),
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
