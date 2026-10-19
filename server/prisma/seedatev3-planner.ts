import { readFile } from 'node:fs/promises';
import { env } from '../src/env.js';
import { abrirContexto, diretorio } from './seedatev3/contexto.js';
import { abrirComplementoPlanner } from './seedatev3/planner/contexto.js';
import { exigirPreparacaoAntigaDisponivel } from './seedatev3/retomada-local.js';

const argumentos = process.argv.slice(2).filter(a => a !== '--');
if (argumentos.some(a => a !== '--verificar')) throw new Error('Use somente --verificar ou nenhum argumento.');
const verificar = argumentos.includes('--verificar');
let fechar: (() => Promise<void>) | undefined;
let desconectar: (() => Promise<void>) | undefined;
try {
  exigirPreparacaoAntigaDisponivel();
  // Reutiliza as proteções e a trava do seed principal SEM escrever seu manifesto.
  const base = await abrirContexto(true); fechar = base.fechar;
  const original = await readFile(`${diretorio}/manifesto.json`, 'utf8');
  if (verificar) {
    const url = new URL(env.DATABASE_URL);
    url.searchParams.set('options', `${url.searchParams.get('options') ?? ''} -c default_transaction_read_only=on`.trim());
    env.DATABASE_URL = url.toString();
  }
  const { prisma } = await import('../src/db.js'); desconectar = () => prisma.$disconnect();
  const c = await abrirComplementoPlanner(base.contexto.manifesto, verificar, async () =>
    await prisma.animal.count({ where: { brinco: { startsWith: 'PLN-' } } }) > 0
      || await prisma.protocolo.count({ where: { nome: { startsWith: 'PLANNER ·' } } }) > 0);
  const { prepararPlanner, verificarPlanner } = await import('./seedatev3/planner/cenario.js');
  if (!verificar) await prepararPlanner(c);
  await verificarPlanner(c);
  if (await readFile(`${diretorio}/manifesto.json`, 'utf8') !== original) throw new Error('O manifesto base foi alterado durante a execução.');
} catch (e) {
  console.error('[planner]', e);
  process.exitCode = 1;
} finally { await desconectar?.(); await fechar?.(); }
