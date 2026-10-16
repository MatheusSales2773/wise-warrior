import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

/** A Missão que o Líder escolheu para a próxima Raid da Guild (ADR-012). Uma por Guild; o job de segunda a consome. */
@Entity('guild_mission_choices')
export class GuildMissionChoice {
  @PrimaryColumn({ name: 'guild_id', type: 'varchar', length: 36 })
  guildId: string;

  @Column({ name: 'mission_id', type: 'varchar', length: 36 })
  missionId: string;

  /** Dono declarado de uma Missão à venda. Nulo na Missão do rodízio. */
  @Column({ name: 'owner_user_id', type: 'varchar', length: 36, nullable: true })
  ownerUserId: string | null;

  @CreateDateColumn({ name: 'chosen_at', type: 'datetime', precision: 6 })
  chosenAt: Date;
}
