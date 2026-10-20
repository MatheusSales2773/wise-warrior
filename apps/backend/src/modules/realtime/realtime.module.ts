import { forwardRef, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthModule } from '../auth/auth.module';
import { GuildsModule } from '../guilds/guilds.module';
import { RealtimeGateway } from './realtime.gateway';

@Module({
  imports: [JwtModule.register({}), forwardRef(() => AuthModule), forwardRef(() => GuildsModule)],
  providers: [RealtimeGateway],
  exports: [RealtimeGateway],
})
export class RealtimeModule {}
