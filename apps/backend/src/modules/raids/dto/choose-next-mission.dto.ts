import { IsOptional, IsUUID } from 'class-validator';

export class ChooseNextMissionDto {
  @IsUUID()
  missionId: string;

  /** Dono da Missão à venda, entre os membros atuais. Não se aplica à Missão do rodízio, que é de todos. */
  @IsOptional()
  @IsUUID()
  ownerId?: string;
}
