import type { Milestone } from './api';

/** Texto de cada Marco (frame v3 de Crônicas), por id do Badge no Catálogo (`docs/api/openapi.yaml`). */
type MilestoneCopy = { short: string; describe: (milestone: Milestone) => string };

const MADRUGADOR = 'c05e71c0-0000-4000-8000-000000000003';
const CEM_SESSOES = 'c05e71c0-0000-4000-8000-000000000006';
const GRIMORIO = 'c05e71c0-0000-4000-8000-000000000009';
const FORJA = 'c05e71c0-0000-4000-8000-00000000000b';

const raidOf = (raid: string): MilestoneCopy['describe'] => ({ progress, target }) => `Vença a Raid ${raid} · ${progress} de ${target}`;

const copyById: Record<string, MilestoneCopy> = {
  [MADRUGADOR]: { short: 'Madrugador', describe: ({ progress, target, earned }) => (earned ? `${target} sessões antes das 7h` : `${progress} de ${target} sessões antes das 7h`) },
  [CEM_SESSOES]: { short: 'Cem Sessões', describe: ({ progress, target }) => `${progress} de ${target} sessões` },
  [GRIMORIO]: { short: 'Grimório', describe: raidOf('Cerco ao Grimório') },
  [FORJA]: { short: 'Forja', describe: raidOf('Forja dos Sábios') },
};

/** Uma linha do card no desktop: "87 de 100 sessões". */
export function milestoneDescription(milestone: Milestone): string {
  return (copyById[milestone.id]?.describe ?? (({ progress, target }) => `${progress} de ${target}`))(milestone);
}

/** O nome curto do bloco no celular ("Grimório"). */
export const milestoneShortName = (milestone: Milestone): string => copyById[milestone.id]?.short ?? milestone.name;

/** O rodapé do bloco no celular: ✓ conquistado, "87%" nas sessões, "0/1" na Raid. */
export function milestoneFooter(milestone: Milestone): string {
  if (milestone.earned) return '✓';
  if (milestone.target > 1) return `${Math.floor((milestone.progress / milestone.target) * 100)}%`;
  return `${milestone.progress}/${milestone.target}`;
}

/** O rótulo acessível de um Marco: "Madrugador. Conquistado." ou o progresso. */
export const milestoneLabel = (milestone: Milestone): string => `${milestone.name}. ${milestone.earned ? 'Conquistado' : milestoneDescription(milestone)}.`;
