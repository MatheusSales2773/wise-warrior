import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthController } from './health.controller';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ProgressionModule } from './modules/progression/progression.module';
import { SessionsModule } from './modules/sessions/sessions.module';
import { GuildsModule } from './modules/guilds/guilds.module';
import { RaidsModule } from './modules/raids/raids.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { createDatabaseOptions } from './config/database.config';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        createDatabaseOptions({
          NODE_ENV: config.get<string>('NODE_ENV'),
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
  ],
  controllers: [HealthController],
})
export class AppModule {}
