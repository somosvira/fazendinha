import { readFile } from 'node:fs/promises';
import { env } from '../src/env.js';
import { abrirContexto, diretorio } from './seedatev3/contexto.js';
import { abrirComplementoPlanner } from './seedatev3/planner/contexto.js';

const args = process.argv.slice(2).filter(a => a !== '--');
if (args.some(a => a !== '--verificar' && !a.startsWith('--interromper-apos='))) throw new Error('Use --verificar ou --interromper-apos=<etapa>.');
const verificar = args.includes('--verificar');
const interrupcao = args.find(a => a.startsWith('--interromper-apos='))?.split('=')[1];
const nomes = ['catalogos', 'rebanho', 'reproducao', 'protocolos', 'complementos', 'custos-nutricao', 'visitas', 'relatorios', 'validacao-inicial'];
if (interrupcao && (!nomes.includes(interrupcao) || verificar)) throw new Error(`Interrupção inválida. Etapas: ${nomes.join(', ')}.`);
let fechar: (() => Promise<void>) | undefined;
let desconectar: (() => Promise<void>) | undefined;
try {
  // Mesma trava, migrations e identidade da V3, sem recarga ou validação R2.
  const base = await abrirContexto(true); fechar = base.fechar;
  const original = await readFile(`${diretorio}/manifesto.json`, 'utf8');
  if (verificar) {
    const url = new URL(env.DATABASE_URL);
    url.searchParams.set('options', `${url.searchParams.get('options') ?? ''} -c default_transaction_read_only=on`.trim());
    env.DATABASE_URL = url.toString();
  }
  const { prisma } = await import('../src/db.js'); desconectar = () => prisma.$disconnect();
  const pasta = `${diretorio}/v4`;
  const c = await abrirComplementoPlanner(base.contexto.manifesto, verificar, async () =>
    !!await prisma.propriedade.findFirst({ where: { nome: { startsWith: 'V4 · Fazenda' } } })
      || !!await prisma.animal.findFirst({ where: { brinco: { startsWith: 'V4-' } } }), pasta, 'V4');
  const { catalogos } = await import('./seedatev4/catalogos.js');
  const { rebanho } = await import('./seedatev4/rebanho.js');
  const { reproducao } = await import('./seedatev4/reproducao.js');
  const { protocolos } = await import('./seedatev4/protocolos.js');
  const { complementos } = await import('./seedatev4/complementos.js');
  const { custosNutricao } = await import('./seedatev4/custos-nutricao.js');
  const { visitas } = await import('./seedatev4/visitas.js');
  const { relatorios, verificarInicial, verificarV4, gerarGuia } = await import('./seedatev4/verificacao.js');
  if (!verificar) {
    for (const [nome, executar] of [['catalogos', catalogos], ['rebanho', rebanho], ['reproducao', reproducao], ['protocolos', protocolos], ['complementos', complementos], ['custos-nutricao', custosNutricao], ['visitas', visitas], ['relatorios', relatorios], ['validacao-inicial', verificarInicial]] as const) {
      await c.etapa(`seedatev4:${nome}`, () => executar(c));
      if (interrupcao === nome) throw new Error(`Interrupção solicitada após ${nome}; execute novamente para retomar.`);
    }
  }
  await verificarV4(c);
  if (!verificar) await gerarGuia(c, pasta);
  if (await readFile(`${diretorio}/manifesto.json`, 'utf8') !== original) throw new Error('O manifesto V3 mudou durante o complemento.');
  console.log(`[seedatev4] ${verificar ? 'Conferência somente de leitura concluída' : 'Demonstração pronta'}. Guia: server/.seedatev3/v4/guia.html. R2 pendente.`);
} catch (e) {
  console.error('[seedatev4]', e); process.exitCode = 1;
} finally { await desconectar?.(); await fechar?.(); }
