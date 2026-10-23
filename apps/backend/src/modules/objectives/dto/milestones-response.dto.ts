import type { Milestone } from '../../users/users.service';

/** `progress` é limitado a `target` e igual a `target` quando o Badge já foi conquistado. */
export type MilestoneDto = Milestone;

export class MilestonesResponseDto {
  /** Quantos Badges do Catálogo estão no Inventário. */
  earned: number;
  /** Quantos Marcos existem. */
  total: number;
  items: MilestoneDto[];
}
