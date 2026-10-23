export class MilestoneDto {
  id: string;
  name: string;
  /** Limitado a `target`; igual a `target` quando o Badge já foi conquistado. */
  progress: number;
  target: number;
  earned: boolean;
}

export class MilestonesResponseDto {
  /** Quantos Badges do Catálogo estão no Inventário. */
  earned: number;
  /** Quantos Marcos existem. */
  total: number;
  items: MilestoneDto[];
}
