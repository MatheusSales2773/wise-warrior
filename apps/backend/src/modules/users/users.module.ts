import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { Character } from '../progression/entities/character.entity';
import { CosmeticItem } from './entities/cosmetic-item.entity';
import { UserCosmeticItem } from './entities/user-cosmetic-item.entity';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Character, CosmeticItem, UserCosmeticItem]),
    AuthModule,
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
