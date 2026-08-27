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

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'mysql',
        host: config.get('DB_HOST', 'localhost'),
        port: Number(config.get('DB_PORT', 3306)),
        username: config.get('DB_USERNAME', 'wise'),
        password: config.get('DB_PASSWORD', 'change-me'),
        database: config.get('DB_DATABASE', 'wise'),
        autoLoadEntities: true,
        // Migrations versionadas em produção (Documento de Arquitetura);
        // sincronização automática só é aceitável em desenvolvimento local.
        synchronize: config.get('NODE_ENV') !== 'production',
        // Pool pequeno de propósito: a VM Oracle Always Free (ADR-006) tem
        // só 2 OCPU/12GB pra backend + MySQL — nada de pool dimensionado
        // para carga de produção grande aqui (postgres-pro: connection pooling).
        extra: { connectionLimit: 5 },
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
