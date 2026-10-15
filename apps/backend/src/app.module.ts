import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthController } from './health.controller';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ProgressionModule } from './modules/progression/progression.module';
import { SessionsModule } from './modules/sessions/sessions.module';
import { GuildsModule } from './modules/guilds/guilds.module';
import { RaidsModule } from './modules/raids/raids.module';
import { ChatModule } from './modules/chat/chat.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { createDatabaseOptions } from './config/database.config';
import { RateLimitModule } from './shared/security/rate-limit';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    RateLimitModule,
    // Registered once, here: importing it in more modules would run each job more than once.
    ScheduleModule.forRoot(),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        createDatabaseOptions({
          NODE_ENV: config.get<string>('NODE_ENV'),
          DB_MIGRATIONS_RUN: config.get<string>('DB_MIGRATIONS_RUN'),
          DB_HOST: config.get<string>('DB_HOST'),
          DB_PORT: config.get<string>('DB_PORT'),
          DB_USERNAME: config.get<string>('DB_USERNAME'),
          DB_PASSWORD: config.get<string>('DB_PASSWORD'),
          DB_DATABASE: config.get<string>('DB_DATABASE'),
        }),
    }),
    AuthModule,
    UsersModule,
    ProgressionModule,
    SessionsModule,
    GuildsModule,
    RaidsModule,
    RealtimeModule,
    ChatModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
