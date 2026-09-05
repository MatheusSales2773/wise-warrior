import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { Session } from './entities/session.entity';
import { RefreshTokenHistory } from './entities/refresh-token-history.entity';
import { User } from '../users/entities/user.entity';
import { Character } from '../progression/entities/character.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Character, Session, RefreshTokenHistory]),
    PassportModule,
    JwtModule.register({}),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
