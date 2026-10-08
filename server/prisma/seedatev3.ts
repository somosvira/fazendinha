import { env } from '../src/env.js';
import { abrirContexto } from './seedatev3/contexto.js';

const argumentos = process.argv.slice(2).filter(a => a !== '--');
const verificar = argumentos.includes('--verificar');
const interrupcao = argumentos.find(a => a.startsWith('--interromper-apos='))?.split('=')[1];
if (argumentos.some(a => a !== '--verificar' && !a.startsWith('--interromper-apos='))) throw new Error('Opção desconhecida. Use --verificar ou --interromper-apos=<etapa>.');
const etapas = ['catalogos', 'rebanho', 'financeiro', 'sanidade', 'nutricao', 'financeiro-atual', 'dados-verificados', 'arquivos', 'periodo'];
if (interrupcao && !etapas.includes(interrupcao)) throw new Error(`Etapa desconhecida. Use: ${etapas.join(', ')}.`);
if (verificar && interrupcao) throw new Error('--verificar não pode ser combinado com interrupção de escrita.');

let fechar: (() => Promise<void>) | undefined;
let desconectar: (() => Promise<void>) | undefined;
try {
  const aberto = await abrirContexto(verificar, interrupcao); fechar = aberto.fechar;
  // Modo de conferência é read-only em TODAS as conexões Prisma, não só na conexão da trava.
  if (verificar) { const url = new URL(env.DATABASE_URL); url.searchParams.set('options', `${url.searchParams.get('options') ?? ''} -c default_transaction_read_only=on`.trim()); env.DATABASE_URL = url.toString(); }
  const { prisma } = await import('../src/db.js'); desconectar = () => prisma.$disconnect();
  const { catalogos } = await import('./seedatev3/catalogos.js');
  const { rebanho } = await import('./seedatev3/rebanho.js');
  const { financeiro, financeiroAtual, fecharPeriodo } = await import('./seedatev3/financeiro.js');
  const { sanidade } = await import('./seedatev3/sanidade.js');
  const { nutricao } = await import('./seedatev3/nutricao.js');
  const { arquivos, conferirArmazenamento, verificarArquivos } = await import('./seedatev3/arquivos.js');
  const { verificarCenario } = await import('./seedatev3/verificacao.js');
  const c = aberto.contexto;
  await conferirArmazenamento();
  if (!verificar) {
    await c.etapa('catalogos', () => catalogos(c));
    await c.etapa('rebanho', () => rebanho(c));
    await c.etapa('financeiro', () => financeiro(c));
    await c.etapa('sanidade', () => sanidade(c));
    await c.etapa('nutricao', () => nutricao(c));
    await c.etapa('financeiro-atual', () => financeiroAtual(c));
    // Conferência de dados antes de publicar documentos e fechar o período.
    await c.etapa('dados-verificados', async () => { await verificarCenario(c); });
    await c.etapa('arquivos', () => arquivos(c));
    await c.etapa('periodo', () => fecharPeriodo(c));
  }
  await verificarCenario(c); await verificarArquivos(c);
  process.stdout.write('[seedatev3] Cenário completo e conciliado. Nenhum banco externo foi alterado.\n');
} catch (e) {
  console.error('[seedatev3]', e instanceof Error ? e.message : 'Falha desconhecida');
  if (e instanceof Error && e.cause) console.error(e.cause instanceof Error ? e.cause.message : 'Falha na dependência');
  process.exitCode = 1;
} finally { await desconectar?.(); await fechar?.(); }
