import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Character } from './entities/character.entity';
import { applyXp, XpApplicationResult } from './domain/progression-policy';
import { RealtimeGateway } from '../realtime/realtime.gateway';

/**
 * Camada de Aplicação: orquestra a regra pura de XP (domínio) com
 * persistência e notificação em tempo real. Outros módulos (ex.: `sessions`)
 * chamam este service — nunca o repositório de `Character` diretamente
 * (regra de acoplamento do Documento de Arquitetura, seção 3.2).
 */
@Injectable()
export class ProgressionService {
  constructor(
    @InjectRepository(Character)
    private readonly characters: Repository<Character>,
    private readonly realtime: RealtimeGateway,
  ) {}

  async awardXp(userId: string, xpGained: number): Promise<XpApplicationResult> {
    const character = await this.characters.findOne({ where: { userId } });
    if (!character) {
      throw new NotFoundException('Personagem não encontrado para este usuário');
    }

    const result = applyXp(character.xpTotal, xpGained);
    character.xpTotal = result.newXpTotal;
    character.level = result.newLevel;
    await this.characters.save(character);

    this.realtime.emitToUser(userId, 'progress:xpUpdated', {
      xpGained,
      xpTotal: result.newXpTotal,
      level: result.newLevel,
    });

    if (result.leveledUp) {
      this.realtime.emitToUser(userId, 'notification:levelup', {
        previousLevel: result.previousLevel,
        newLevel: result.newLevel,
      });
    }

    return result;
  }
}
