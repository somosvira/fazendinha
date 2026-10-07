import { prisma } from '../src/db.js';
import { env } from '../src/env.js';
import { cadastrar, movimentar } from '../src/services/pecuaria/rebanho/animais.js';
import { cadastrarAnimalSchema } from '../src/services/pecuaria/rebanho/schemas.js';
import { criarLote } from '../src/services/pecuaria/rebanho/lotes.js';
import { criarProduto } from '../src/services/estoque/produtos.js';
import { produtoSchema } from '../src/services/estoque/produtos.schemas.js';
import { criarOperacao } from '../src/services/financeiro/operacoes.js';
import { operacaoSchema } from '../src/services/financeiro/schemas.js';
import { criarParceiro } from '../src/services/financeiro/parceiros.js';
import { criarCentroCusto } from '../src/services/financeiro/cadastros-gerenciais.js';
import { hashSenha } from '../src/services/auth/hash.js';
import { calcularAnimalDias } from '../src/services/pecuaria/nutricao/animalDias.calc.js';
import { listarSaldos } from '../src/services/estoque/estoque.js';
import { autenticar } from '../src/services/auth/contas.js';

const url = new URL(env.DATABASE_URL);
if (!['localhost', '127.0.0.1'].includes(url.hostname) || url.pathname !== '/fazendinha_v3_teste') {
  throw new Error('Preparação permitida somente no banco local fazendinha_v3_teste.');
}
try {
  if (process.argv.includes('--limpar') && !process.argv.includes('--preparar')) {
    throw new Error('Use --limpar junto com --preparar para não deixar o banco sem o cenário de testes.');
  }
  if (process.argv.includes('--limpar')) await limparCenario();
  if (process.argv.includes('--preparar')) await preparar();
  if (process.argv.includes('--verificar')) await verificar();
  console.log(JSON.stringify({
    banco: url.pathname.slice(1),
    sitios: await prisma.propriedade.findMany({ select: { id: true, nome: true, ativo: true } }),
    usuarios: await prisma.usuario.findMany({ select: { id: true, email: true, status: true, dono: true } }),
    categorias: await prisma.categoria.findMany({ select: { id: true, nome: true, ativo: true } }),
    guiaAnimais: await prisma.animal.count({ where: { brinco: { startsWith: 'GV3-' } } }),
    guiaProdutos: await prisma.produto.findMany({ where: { nome: { startsWith: 'Guia V3' } }, select: { id: true, nome: true } }),
  }, null, 2));
} finally { await prisma.$disconnect(); }

/**
 * Banco local de homologação: remove os dados fora do guia e preserva apenas o
 * mínimo para entrar e lançar operações. Nunca roda sem a opção explícita.
 */
async function limparCenario() {
  const principal = await prisma.propriedade.upsert({
    where: { nome: 'Guia V3 — Principal' },
    update: { ativo: true, principal: true, apelido: null },
    create: { nome: 'Guia V3 — Principal', ativo: true, principal: true },
  });
  const destino = await prisma.propriedade.upsert({
    where: { nome: 'Guia V3 — Destino' },
    update: { ativo: true, principal: false, apelido: null },
    create: { nome: 'Guia V3 — Destino', ativo: true, principal: false },
  });
  await prisma.propriedade.updateMany({ where: { id: { not: principal.id } }, data: { principal: false } });

  // A conta é preservada depois da limpeza. Fazê-lo nesta ordem evita colisão
  // de nomes enquanto ainda existirem contas no sítio de destino.
  const conta = await prisma.contaFinanceira.findFirst({ orderBy: { id: 'asc' } });

  // Apenas dados operacionais, cadastros e históricos locais. As migrations,
  // a conta acima, os dois sítios e os usuários do guia não participam do TRUNCATE.
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE
    "pecuaria"."Animal", "pecuaria"."AplicacaoProduto", "pecuaria"."AuditoriaPecuaria", "pecuaria"."BaixaAnimal", "pecuaria"."CategoriaAnimal", "pecuaria"."CategoriaManualAnimal", "pecuaria"."ComposicaoGenitorExterno", "pecuaria"."ComposicaoRacial", "pecuaria"."DestinoAnimal", "pecuaria"."Dieta", "pecuaria"."Doenca", "pecuaria"."EtapaProtocoloSanitario", "pecuaria"."ExameAnimal", "pecuaria"."ExecucaoProtocoloSanitario", "pecuaria"."FechamentoConsumo", "pecuaria"."GenitorExterno", "pecuaria"."ItemDieta", "pecuaria"."ItemFechamentoConsumo", "pecuaria"."LocalizacaoAnimal", "pecuaria"."Lote", "pecuaria"."ManejoAnimal", "pecuaria"."MaterialGenetico", "pecuaria"."MotivoBaixa", "pecuaria"."Movimentacao", "pecuaria"."MovimentacaoAnimal", "pecuaria"."OcorrenciaSanitaria", "pecuaria"."ParticipacaoConsumoAnimal", "pecuaria"."PerfilNutricionalProduto", "pecuaria"."PerfilSanitarioProduto", "pecuaria"."Pesagem", "pecuaria"."ProtocoloSanitario", "pecuaria"."Raca", "pecuaria"."RequisicaoPecuaria", "pecuaria"."TarefaSanitaria", "pecuaria"."TipoAplicacaoSanitaria", "pecuaria"."TipoExame", "pecuaria"."VigenciaDietaLote", "pecuaria"."VinculoImportacaoPecuaria",
    "public"."AlocacaoPartidaEstoque", "public"."AuditoriaFinanceira", "public"."Categoria", "public"."CentroCusto", "public"."CompromissoFinanceiro", "public"."ConversaWhatsapp", "public"."DocumentoFinanceiro", "public"."ItemOperacao", "public"."Liquidacao", "public"."MensagemWhatsapp", "public"."MovimentoConta", "public"."MovimentoEstoque", "public"."Operacao", "public"."Parceiro", "public"."ParceiroPapel", "public"."PartidaProduto", "public"."PeriodoFinanceiro", "public"."Produto", "public"."ProdutoCentroCusto", "public"."ProdutoFornecedor", "public"."RascunhoOperacao", "public"."RascunhoRelatorioFinanceiro", "public"."RegistroChuva", "public"."RelatorioFinanceiro", "public"."Sessao", "public"."TokenAcesso", "public"."TransacaoFinanceira", "public"."UsuarioWhatsapp"
    RESTART IDENTITY CASCADE`);

  if (conta) {
    await prisma.contaFinanceira.deleteMany({ where: { id: { not: conta.id } } });
    await prisma.contaFinanceira.update({ where: { id: conta.id }, data: { propriedadeId: principal.id, ativo: true } });
  } else {
    await prisma.contaFinanceira.create({ data: { nome: 'Conta de testes V3', tipo: 'BANCO', saldoAbertura: 0, dataSaldoAbertura: new Date('2026-09-01'), propriedadeId: principal.id } });
  }

  const manterEmails = ['testdev@rionovo.com.br', 'guia.v3.leitura@example.test', 'guia.v3.semvalores@example.test'];
  await prisma.usuario.deleteMany({ where: { email: { notIn: manterEmails } } });
  await prisma.propriedade.deleteMany({ where: { id: { notIn: [principal.id, destino.id] } } });
  await prisma.categoria.createMany({ data: [
    { nome: 'Sanidade', classificacao: 'CUSTEIO', ativo: true, ordem: 1 },
    { nome: 'Nutrição', classificacao: 'CUSTEIO', ativo: true, ordem: 2 },
  ], skipDuplicates: true });
  console.log(JSON.stringify({ limpeza: 'concluída', contaMantida: conta?.nome ?? 'Conta de testes V3', sitios: [principal.nome, destino.nome] }));
}

async function preparar() {
  const autor = await prisma.usuario.findUniqueOrThrow({ where: { email: 'testdev@rionovo.com.br' } });
  const sitios = [];
  for (const nome of ['Guia V3 — Principal', 'Guia V3 — Destino']) {
    sitios.push(await prisma.propriedade.upsert({ where: { nome }, update: {}, create: { nome, ativo: true } }));
  }
  const centro = await prisma.centroCusto.findFirst({ where: { nome: 'Guia V3 — Pecuária' } })
    ?? await criarCentroCusto({ nome: 'Guia V3 — Pecuária', ordem: 0 }, autor.id);
  const lotes = new Map<string, string>();
  for (const nome of ['Guia V3 — Nutrição', 'Guia V3 — Sanidade', 'Guia V3 — Manejo', 'Guia V3 — Transição', 'Guia V3 — Sem dieta', 'Guia V3 — Vazio']) {
    const lote = await prisma.lote.findFirst({ where: { nome, propriedadeId: sitios[0].id } })
      ?? await criarLote({ nome, propriedadeId: sitios[0].id, centroCustoId: centro.id }, autor.id);
    lotes.set(nome.split(' — ')[1], lote.id);
  }
  const animais = [
    ...Array.from({ length: 12 }, (_, i) => ({ brinco: `GV3-N${String(i + 1).padStart(2, '0')}`, lote: 'Nutrição', sexo: 'F', entrada: i < 10 ? '2026-09-01' : '2026-09-06' })),
    ...Array.from({ length: 6 }, (_, i) => ({ brinco: `GV3-S${i + 1}`, lote: 'Sanidade', sexo: 'F', entrada: '2026-09-01' })),
    { brinco: 'GV3-M1', lote: 'Manejo', sexo: 'F', entrada: '2026-09-01' },
    { brinco: 'GV3-M2', lote: 'Manejo', sexo: 'M', entrada: '2026-09-01' },
    { brinco: 'GV3-T1', lote: 'Transição', sexo: 'F', entrada: '2026-09-01' },
    { brinco: 'GV3-D1', lote: 'Sem dieta', sexo: 'F', entrada: '2026-09-01' },
    { brinco: 'GV3-H1', lote: 'Sanidade', sexo: 'F', entrada: '2026-09-01' },
  ];
  for (const a of animais) {
    if (await prisma.animal.findFirst({ where: { brinco: a.brinco } })) continue;
    await cadastrar(cadastrarAnimalSchema.parse({ brinco: a.brinco, sexo: a.sexo, dataNascimento: '2026-01-01', dataEntrada: a.entrada, origem: 'COMPRADO', propriedadeId: sitios[0].id, loteId: lotes.get(a.lote), aptidao: a.sexo === 'M' ? 'CORTE' : 'LEITE' }), autor.id);
  }
  const historico = await prisma.animal.findFirstOrThrow({ where: { brinco: 'GV3-H1' } });
  if (!await prisma.localizacaoAnimal.findFirst({ where: { animalId: historico.id, propriedadeId: sitios[1].id } })) {
    await movimentar({ animalIds: [historico.id], propriedadeId: sitios[1].id, data: '2026-09-15', motivo: 'Preparação do teste de sítio histórico' }, autor.id);
  }
  const categorias = await prisma.categoria.findMany({ where: { nome: { in: ['Sanidade', 'Nutrição'] }, ativo: true } });
  if (categorias.length !== 2) throw new Error('Categorias padrão Sanidade e Nutrição precisam estar ativas.');
  const parceiros = [];
  for (const nome of ['Guia V3 — Fornecedor A', 'Guia V3 — Fornecedor B']) {
    parceiros.push(await prisma.parceiro.findFirst({ where: { nome } }) ?? await criarParceiro({ nome, papeis: ['FORNECEDOR', 'PRESTADOR_SERVICO'], usuarioId: autor.id }));
  }
  for (const [nome, unidade, quantidade, preco, validade, nutricional] of [
    ['Ração', 'KG', 500, 2, '2027-09-17', true],
    ['Mineral', 'KG', 30, 4, '2027-09-17', true],
    ['Sanidade', 'ML', 200, 2, '2027-09-17', false],
    ['Vencido', 'ML', 20, 2, '2026-09-05', false],
    ['Sem validade', 'ML', 20, 2, null, false],
    ['Legado', 'ML', 20, 2, null, false],
    ['Direto', 'ML', 10, 3, null, false],
  ] as const) {
    const nomeProduto = `Guia V3 — ${nome}`;
    const produto = await prisma.produto.findUnique({ where: { nome: nomeProduto } }) ?? await criarProduto(produtoSchema.parse({
      nome: nomeProduto, unidade, categoriaId: categorias.find(c => c.nome === (nutricional ? 'Nutrição' : 'Sanidade'))!.id,
      usoNutricional: nutricional, usoSanitario: !nutricional, rastrearPartidas: !['Legado', 'Direto'].includes(nome),
      centroCustoIds: [centro.id],
      ...(nutricional ? { perfilNutricional: { materiaSecaPercentual: nome === 'Ração' ? 90 : null } } : { perfilSanitario: { carenciaLeiteHoras: 0, carenciaCarneHoras: 48, viaPadrao: 'Intramuscular' } }),
    }), autor.id);
    const descricao = `Guia V3 — preparação ${nome}`;
    if (await prisma.operacao.findFirst({ where: { descricao, propriedadeId: sitios[0].id } })) continue;
    const direto = nome === 'Direto';
    await criarOperacao({ ...operacaoSchema.parse({
      tipo: direto ? 'COMPRA_CONSUMO_DIRETO' : 'INVENTARIO_INICIAL', descricao, data: '2026-09-01', parceiroId: parceiros[0].id,
      centroCustoId: centro.id,
      itens: [{ produtoId: produto.id, descricao: nomeProduto, quantidade, unidade, valorUnitario: preco, estocavel: !direto,
        ...(!['Legado', 'Direto'].includes(nome) ? { partidas: [{ validade, quantidade, cienciaValidadeDesconhecida: validade === null }] } : {}),
      }],
      financeiro: direto ? { condicao: 'A_PRAZO', parcelas: [{ valor: 30, dataVencimento: '2026-12-01' }] } : { condicao: 'SEM_EFEITO_FINANCEIRO' },
    }), propriedadeId: sitios[0].id, usuarioId: autor.id });
  }
  const descricao = 'Guia V3 — Atendimento veterinário';
  if (!await prisma.operacao.findFirst({ where: { descricao, propriedadeId: sitios[0].id } })) {
    await criarOperacao({ ...operacaoSchema.parse({ tipo: 'SERVICO', data: '2026-09-01', descricao, valorTotal: 1000, parceiroId: parceiros[0].id,
      categoriaId: categorias.find(c => c.nome === 'Sanidade')!.id, centroCustoId: centro.id,
      financeiro: { condicao: 'A_PRAZO', parcelas: [{ valor: 1000, dataVencimento: '2026-12-01' }] },
    }), propriedadeId: sitios[0].id, usuarioId: autor.id });
  }
  const senha = hashSenha('GuiaV3!2026');
  for (const [email, nome, flags] of [
    ['guia.v3.leitura@example.test', 'Guia V3 — Consulta', ['verValores']],
    ['guia.v3.semvalores@example.test', 'Guia V3 — Sem valores', ['lancar']],
  ] as const) {
    await prisma.usuario.upsert({ where: { email }, update: { abas: ['dashboard', 'gastos', 'lancar', 'caixinha', 'cadastros', 'relatorio'] }, create: { email, nome, senhaHash: senha, papel: 'operador', areas: ['financeiro', 'pecuaria'], abas: ['dashboard', 'gastos', 'lancar', 'caixinha', 'cadastros', 'relatorio'], flags: [...flags], status: 'ATIVO' } });
  }
}

async function verificar() {
  const sitio = await prisma.propriedade.findUniqueOrThrow({ where: { nome: 'Guia V3 — Principal' } });
  const lote = await prisma.lote.findFirstOrThrow({ where: { nome: 'Guia V3 — Nutrição', propriedadeId: sitio.id } });
  const permanencias = await prisma.localizacaoAnimal.findMany({ where: { loteId: lote.id } });
  const dias = calcularAnimalDias(permanencias, new Date('2026-09-01'), new Date('2026-09-10'));
  if (dias.animalDias !== 110 || dias.participacoes.length !== 12) throw new Error('Cenário nutricional diferente do guia.');
  const produtos = await prisma.produto.findMany({ where: { nome: { startsWith: 'Guia V3 — ' } } });
  const saldos = await listarSaldos({ propriedadeId: sitio.id, produtoIds: produtos.map(p => p.id) });
  const esperado: Record<string, number> = { 'Ração': 500, 'Mineral': 30, 'Sanidade': 200, 'Vencido': 20, 'Sem validade': 20, 'Legado': 20 };
  for (const [nome, saldo] of Object.entries(esperado)) {
    if (saldos.find(s => s.nome === `Guia V3 — ${nome}`)?.saldo !== saldo) throw new Error(`Saldo inicial divergente: ${nome}`);
  }
  for (const email of ['guia.v3.leitura@example.test', 'guia.v3.semvalores@example.test']) {
    if (!await autenticar(email, 'GuiaV3!2026')) throw new Error(`Login local não funciona: ${email}`);
  }
  console.log(JSON.stringify({ verificacao: 'ok', animais: await prisma.animal.count({ where: { brinco: { startsWith: 'GV3-' } } }), animalDias: dias.animalDias, participantes: dias.participacoes.length, saldos }, null, 2));
}
