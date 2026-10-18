import { existsSync } from 'node:fs';

/** Preparações históricas não podem repor os sítios/fixtures removidos pelo dono. */
export function exigirPreparacaoAntigaDisponivel(arquivo: string | URL = new URL('../../.seedatev3/consolidacao-sitios.json', import.meta.url)) {
  if (existsSync(arquivo)) throw new Error('Preparação histórica encerrada pela consolidação em dois sítios. Use seedatev4; não recrie fixtures QA/planner.');
}
