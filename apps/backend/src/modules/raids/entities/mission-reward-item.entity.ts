import { Entity, PrimaryColumn } from 'typeorm';

/**
 * Um Cosmetic Item da Recompensa de Raid de uma Missão. O item é de outro módulo (ADR-001), então só o id é guardado
 * aqui; nome e categoria vêm do `UsersService`.
 */
@Entity('mission_reward_items')
export class MissionRewardItem {
  @PrimaryColumn({ name: 'mission_id', type: 'varchar', length: 36 })
  missionId: string;

  @PrimaryColumn({ name: 'cosmetic_item_id', type: 'varchar', length: 36 })
  cosmeticItemId: string;
}
