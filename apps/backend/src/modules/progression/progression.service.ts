import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type EntityManager, Repository } from 'typeorm';
import { Character } from './entities/character.entity';
import {
  applyXp,
  levelForXp,
  validateXpTotal,
  xpThresholdForLevel,
  XpApplicationResult,
} from './domain/progression-policy';
import { RealtimeGateway } from '../realtime/realtime.gateway';

export interface CharacterProgressionSnapshot {
  xpTotal: number;
  level: number;
  title: string | null;
}

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

  getProjection(xpTotal: number): {
    level: number;
    levelStartXp: number;
    nextLevelXp: number;
  } {
    validateXpTotal(xpTotal);
    const level = levelForXp(xpTotal);
    return {
      level,
      levelStartXp: xpThresholdForLevel(level),
      nextLevelXp: xpThresholdForLevel(level + 1),
    };
  }

  async getCharacterSnapshot(
    userId: string,
  ): Promise<CharacterProgressionSnapshot | null> {
    const character = await this.characters.findOne({ where: { userId } });
    if (!character) {
      return null;
    }

    validateXpTotal(character.xpTotal);
    const projectedLevel = levelForXp(character.xpTotal);
    if (character.level !== projectedLevel) {
      throw new Error('nível persistido inconsistente com xpTotal');
    }

    return {
      xpTotal: character.xpTotal,
      level: character.level,
      title: character.title ?? null,
    };
  }

  async awardXp(userId: string, xpGained: number): Promise<XpApplicationResult> {
    const character = await this.characters.findOne({ where: { userId } });
    if (!character) {
      throw new NotFoundException('Personagem não encontrado para este usuário');
    }

    const result = await this.persistXp(this.characters, character, xpGained);

    this.publishAwardedXp(userId, xpGained, result);

    return result;
  }

  async awardXpInTransaction(
    manager: EntityManager,
    userId: string,
    xpGained: number,
  ): Promise<XpApplicationResult> {
    const characters = manager.getRepository(Character);
    const character = await characters
      .createQueryBuilder('character')
      .where('character.userId = :userId', { userId })
      .setLock('pessimistic_write')
      .getOne();
    if (!character) {
      throw new NotFoundException('Personagem não encontrado para este usuário');
    }

    return this.persistXp(characters, character, xpGained);
  }

  publishAwardedXp(userId: string, xpGained: number, result: XpApplicationResult): void {
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
  }

  private async persistXp(
    characters: Repository<Character>,
    character: Character,
    xpGained: number,
  ): Promise<XpApplicationResult> {
    const result = applyXp(character.xpTotal, xpGained);
    character.xpTotal = result.newXpTotal;
    character.level = result.newLevel;
    await characters.save(character);
    return result;
  }
}
