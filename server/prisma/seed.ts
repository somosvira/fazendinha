import { argumentos, abrirContexto } from './seed/contexto.js';

async function main() {
  const args = argumentos(process.argv.slice(2));
  const aberto = await abrirContexto(args.modo, args.interromperApos);
  let db: Awaited<typeof import('../src/db.js')> | undefined;
  try {
    const c = aberto.contexto;
    if (args.modo === 'preflight') {
      process.stdout.write(`[seed] Preflight somente leitura: ${c.manifesto.banco}, baseline ${c.manifesto.baseline.nome}, data-base ${c.dataBase}.\n`);
      return;
    }
    if (args.modo === 'verificar') {
      // A opção é passada a TODAS as conexões Prisma, inclusive serviços importados abaixo.
      const url = new URL(process.env.DATABASE_URL!);
      url.searchParams.set('options', '-c default_transaction_read_only=on');
      process.env.DATABASE_URL = url.toString();
    }
    db = await import('../src/db.js'); c.prisma = db.prisma;
    const { verificar, gerarGuia } = await import('./seed/verificacao.js');
    if (args.modo === 'verificar') { process.stdout.write(`${JSON.stringify(await verificar(c), null, 2)}\n`); return; }
    await c.salvar();
    const { catalogos } = await import('./seed/catalogos.js');
    const { financeiro, financeiroFinal } = await import('./seed/financeiro.js');
    const { estoque } = await import('./seed/estoque.js');
    const { rebanho } = await import('./seed/rebanho.js');
    const { reproducao } = await import('./seed/reproducao.js');
    const { sanidade } = await import('./seed/sanidade.js');
    const { visitas } = await import('./seed/visitas.js');
    const { nutricaoGeral } = await import('./seed/nutricao.js');
    const { prepararLeite } = await import('./seed/leite/index.js');
    await c.etapa('catalogos', () => catalogos(c));
    await c.etapa('financeiro', () => financeiro(c));
    await c.etapa('estoque', () => estoque(c));
    await c.etapa('rebanho', () => rebanho(c));
    await c.etapa('reproducao', () => reproducao(c));
    await c.etapa('sanidade', () => sanidade(c));
    await c.etapa('visitas', () => visitas(c));
    await c.etapa('nutricao', () => nutricaoGeral(c));
    await prepararLeite(c);
    await c.etapa('financeiro-final', () => financeiroFinal(c));
    if (args.arquivosR2) {
      const { prepararArquivos } = await import('./seed/leite/index.js');
      await c.etapa('arquivos-r2', () => prepararArquivos(c));
    }
    const resumo = await verificar(c);
    await gerarGuia(c, resumo);
    process.stdout.write(`${JSON.stringify(resumo, null, 2)}\n`);
  } finally {
    await db?.prisma.$disconnect(); await aberto.fechar();
  }
}
main().catch((erro: unknown) => { console.error(`[seed] ${erro instanceof Error ? erro.message : 'Falha na seed única.'}`); process.exitCode = 1; });
