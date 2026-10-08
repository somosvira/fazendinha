import { Prisma } from '@prisma/client';
import { prisma } from '../../src/db.js';
import { listarContas } from '../../src/services/financeiro/contas.js';
import { listarSaldos } from '../../src/services/estoque/estoque.js';
import { calcularAnimalDias } from '../../src/services/pecuaria/nutricao/animalDias.calc.js';
import { calcularPrazoCarencia } from '../../src/services/pecuaria/sanidade/carencia.calc.js';
import { buscarFicha, listarFilhos } from '../../src/services/pecuaria/rebanho/animais.js';
import { calcularComposicaoFilho } from '../../src/services/pecuaria/rebanho/composicao.calc.js';
import { CATEGORIAS, DOENCAS, MOTIVOS, RACAS } from './catalogos.js';
import { dia, type Contexto } from './contexto.js';

function exigir(condicao: unknown, mensagem: string): asserts condicao { if (!condicao) throw new Error(`Verificação: ${mensagem}`); }
const zero = () => new Prisma.Decimal(0);

async function verificarCatalogos(c: Contexto) {
  for (const nome of CATEGORIAS) exigir(await prisma.categoria.findUnique({ where: { id: c.id(`categoria:${nome}`) } }), `categoria ${nome}`);
  exigir(await prisma.categoriaAnimal.count() === 7, 'sete categorias animais das migrations');
  for (const nome of ['Tratamento', 'Vacina', 'Vermífugo']) exigir(await prisma.tipoAplicacaoSanitaria.findUnique({ where: { id: c.id(`aplicacao:${nome}`) } }), `tipo ${nome}`);
  exigir(await prisma.centroCusto.count() === 4, 'quatro centros de custo');
  exigir(await prisma.raca.count() === RACAS.length, 'dez raças');
  exigir(await prisma.motivoBaixa.count() === Object.values(MOTIVOS).flat().length, '29 motivos de baixa');
  exigir(await prisma.doenca.count() === DOENCAS.length, '34 doenças');
  exigir(await prisma.tipoExame.count() === 5, 'quatro exames e um por opções');
  const usuarios = await prisma.usuario.findMany();
  exigir(usuarios.length === 3 && usuarios.filter(u => u.dono).length === 1, 'três acessos, um dono');
  exigir(!usuarios.find(u => String(u.id) === c.id('usuario:consulta'))?.flags.includes('lancar'), 'consulta sem escrita');
  exigir(!usuarios.find(u => String(u.id) === c.id('usuario:operador'))?.flags.includes('verValores'), 'operador sem valores');
}

async function verificarRebanho(c: Contexto) {
  const sitios = await prisma.propriedade.findMany();
  exigir(sitios.length === 2 && sitios.filter(p => p.principal).length === 1, 'duas propriedades, uma principal');
  exigir(await prisma.lote.count() === 6 && await prisma.lote.count({ where: { propriedadeId: c.numero('sitio:Principal') } }) === 4, 'seis lotes, quatro na Principal');
  const animais = await prisma.animal.findMany({ include: { localizacoes: { orderBy: { desde: 'asc' } }, baixas: true, composicao: true } });
  exigir(animais.length === 18, '18 animais');
  for (const a of animais) {
    exigir(a.dataNascimento <= a.dataEntrada && a.dataEntrada <= dia(c.manifesto.dataBase), `cronologia ${a.brinco}`);
    exigir(a.origem !== 'NASCIDO' || +a.dataNascimento === +a.dataEntrada, `entrada no nascimento ${a.brinco}`);
    exigir(a.composicao.reduce((s, i) => s + i.fracao64, 0) === 64, `composição ${a.brinco}`);
    for (const id of [a.maeId, a.paiId]) if (id) exigir(animais.some(g => g.id === id && g.dataNascimento < a.dataNascimento), `filiação ${a.brinco}`);
    for (const [i, loc] of a.localizacoes.entries()) {
      exigir(loc.desde >= a.dataEntrada && (!loc.ate || loc.ate >= loc.desde), `localização ${a.brinco}`);
      if (i) exigir(a.localizacoes[i - 1].ate && +a.localizacoes[i - 1].ate! <= +loc.desde, `sobreposição ${a.brinco}`);
      if (loc.loteId) exigir(await prisma.lote.findFirst({ where: { id: loc.loteId, propriedadeId: loc.propriedadeId } }), `lote/sítio ${a.brinco}`);
    }
    exigir(await prisma.pesagem.count({ where: { animalId: a.id } }) >= 2, `pesagens ${a.brinco}`);
    const ficha = await buscarFicha(a.id, null);
    exigir(ficha.categoria, `categoria de ${a.brinco}`);
  }
  exigir((await listarFilhos(c.id('animal:1'), null)).some(a => a.id === c.id('animal:8')), 'descendência da doadora');
  const filho = animais.find(a => a.id === c.id('animal:14'))!;
  const mae = await prisma.composicaoGenitorExterno.findMany({ where: { genitorId: c.id('genitor:matriz') } });
  const pai = animais.find(a => a.id === c.id('animal:13'))!;
  const prevista = calcularComposicaoFilho(mae.map(i => ({ sigla: i.racaId, fracao64: i.fracao64 })), pai.composicao.map(i => ({ sigla: i.racaId, fracao64: i.fracao64 })));
  exigir(prevista.every(i => filho.composicao.some(f => f.racaId === i.sigla && f.fracao64 === i.fracao64 && f.origem === 'CALCULADA')), 'herança racial calculada');
  const baixas = await prisma.baixaAnimal.findMany({ include: { motivo: true } });
  exigir(baixas.length === 2 && baixas.some(b => b.tipo === 'VENDA' && b.motivo?.classe === 'DESCARTE_VOLUNTARIO') && baixas.some(b => b.tipo === 'MORTE' && b.motivo?.classe === 'MORTE'), 'baixas e motivos compatíveis');
  exigir(await prisma.materialGenetico.count() === 2, 'sêmen e embrião');
  for (const sitio of sitios) exigir(animais.some(a => a.localizacoes.some(l => l.propriedadeId === sitio.id && !l.ate)), `rebanho ativo na ${sitio.nome}`);
}

async function verificarFinanceiro() {
  const contas = await listarContas(null, true);
  for (const conta of contas) {
    exigir(conta.saldoAbertura.isZero(), `abertura zero ${conta.nome}`);
    const movimentos = await prisma.movimentoConta.findMany({ where: { contaId: conta.id }, include: { transacao: true }, orderBy: [{ transacao: { data: 'asc' } }, { seq: 'asc' }] });
    const saldo = movimentos.reduce((s, m) => m.direcao === 'ENTRADA' ? s.plus(m.valor) : s.minus(m.valor), zero());
    exigir(saldo.equals(conta.saldoAtual), `saldo financeiro ${conta.nome}`);
    exigir(movimentos.every(m => m.transacao.propriedadeId === conta.propriedadeId), `escopo da conta ${conta.nome}`);
  }
  const compromissos = await prisma.compromissoFinanceiro.findMany({ include: { liquidacoes: { include: { transacao: true } } } });
  for (const cp of compromissos) {
    const pago = cp.liquidacoes.filter(l => l.transacao.status === 'CONFIRMADA').reduce((s, l) => s.plus(l.valor), zero());
    exigir(pago.lte(cp.valorOriginal), `liquidações ${cp.id}`);
    if (cp.status !== 'CANCELADO') exigir(cp.status === (pago.isZero() ? 'PENDENTE' : pago.equals(cp.valorOriginal) ? 'LIQUIDADO' : 'PARCIAL'), `status do compromisso ${cp.id}`);
  }
  exigir(['PENDENTE', 'PARCIAL', 'LIQUIDADO', 'CANCELADO'].every(status => compromissos.some(c => c.status === status)), 'situações de compromissos');
  const transferencias = await prisma.transacaoFinanceira.findMany({ where: { tipo: 'TRANSFERENCIA' }, include: { movimentos: true } });
  exigir(transferencias.length > 0, 'transferência de contas');
  for (const t of transferencias) exigir(t.movimentos.length === 2 && t.movimentos.reduce((s, m) => m.direcao === 'ENTRADA' ? s.plus(m.valor) : s.minus(m.valor), zero()).isZero(), 'transferência sem alterar disponibilidade');
  const reversoes = await prisma.transacaoFinanceira.findMany({ where: { reversaoDeId: { not: null } }, include: { movimentos: true, reversaoDe: { include: { movimentos: true } } } });
  exigir(reversoes.length > 0, 'reversão financeira');
  for (const r of reversoes) exigir(r.reversaoDe && r.valorTotal.equals(r.reversaoDe.valorTotal) && r.movimentos.every(m => r.reversaoDe!.movimentos.some(o => o.contaId === m.contaId && o.direcao !== m.direcao && o.valor.equals(m.valor))), 'reversão conciliada');
}

async function verificarEstoque() {
  const sitios = await prisma.propriedade.findMany();
  const movimentos = await prisma.movimentoEstoque.findMany({ include: { produto: true, operacao: true, alocacaoPartidaEstoques: { include: { partida: true } }, reversaoDe: true }, orderBy: [{ data: 'asc' }, { seq: 'asc' }] });
  for (const m of movimentos) {
    exigir(m.propriedadeId, 'estoque com sítio explícito');
    if (m.tipo === 'ENTRADA' && !m.reversaoDeId) exigir(m.operacao?.status === 'CONFIRMADA', `entrada lastreada ${m.id}`);
    if (m.reversaoDeId) exigir(m.reversaoDe && m.quantidade.equals(m.reversaoDe.quantidade) && m.valorTotal.equals(m.reversaoDe.valorTotal), 'reversão física conciliada');
    if (m.produto.rastrearPartidas) exigir(m.alocacaoPartidaEstoques.reduce((s, a) => s.plus(a.quantidade), zero()).equals(m.quantidade), `partidas ${m.id}`);
    for (const a of m.alocacaoPartidaEstoques) exigir(a.partida.produtoId === m.produtoId, 'partida do produto correto');
    if (m.origem === 'TRANSFERENCIA') {
      const outra = movimentos.find(o => o.operacaoId === m.operacaoId && o.id !== m.id);
      exigir(outra && outra.tipo !== m.tipo && outra.quantidade.equals(m.quantidade) && outra.custoUnitario.equals(m.custoUnitario) && outra.valorTotal.equals(m.valorTotal), 'transferência preserva quantidade e custo');
      exigir(m.alocacaoPartidaEstoques.every(a => outra.alocacaoPartidaEstoques.some(o => o.partidaId === a.partidaId && o.quantidade.equals(a.quantidade))), 'transferência preserva origem da partida');
    }
  }
  for (const sitio of sitios) {
    const saldos = await listarSaldos({ propriedadeId: sitio.id });
    for (const saldo of saldos) {
      const ms = movimentos.filter(m => m.propriedadeId === sitio.id && m.produtoId === saldo.produtoId);
      const calculado = ms.reduce((s, m) => m.tipo === 'SAIDA' ? s.minus(m.quantidade) : s.plus(m.quantidade), zero());
      exigir(calculado.gte(0) && calculado.equals(saldo.saldo), `saldo ${saldo.nome}/${sitio.nome}`);
      const partidas = new Map<string, Prisma.Decimal>();
      for (const m of ms) for (const a of m.alocacaoPartidaEstoques) partidas.set(a.partidaId, (partidas.get(a.partidaId) ?? zero()).plus(m.tipo === 'SAIDA' ? a.quantidade.negated() : a.quantidade));
      exigir([...partidas.values()].every(v => v.gte(0)), `saldo por validade ${saldo.nome}/${sitio.nome}`);
    }
  }
}

async function verificarPecuaria(c: Contexto) {
  const aplicacoes = await prisma.aplicacaoProduto.findMany({ include: { movimentoEstoque: { include: { alocacaoPartidaEstoques: { include: { partida: true } } } }, itemCompraDireta: { include: { operacao: true } }, operacaoServico: true, tarefa: true } });
  for (const a of aplicacoes) {
    if (a.origemInsumo === 'BAIXA_ESTOQUE') {
      exigir(a.movimentoEstoque && a.movimentoEstoque.propriedadeId === a.propriedadeId && a.movimentoEstoque.quantidade.equals(a.quantidadeUtilizada!), 'aplicação lastreada');
      exigir(a.movimentoEstoque.alocacaoPartidaEstoques.every(p => !p.partida.validade || p.partida.validade >= a.data), 'aplicações não usam vencidos');
      exigir(a.valorProdutoAtribuido?.equals(a.movimentoEstoque.valorTotal), 'custo da aplicação');
    } else if (a.origemInsumo === 'COMPRA_CONSUMO_DIRETO') exigir(a.itemCompraDireta?.operacao.status === 'CONFIRMADA' && a.itemCompraDireta.operacao.tipo === 'COMPRA_CONSUMO_DIRETO', 'origem direta');
    else if (a.origemInsumo === 'INCLUSO_SERVICO') exigir(a.operacaoServico?.status === 'CONFIRMADA', 'medicamento em serviço');
    else throw new Error('Aplicação sem origem comprovada.');
    exigir(await prisma.localizacaoAnimal.findFirst({ where: { animalId: a.animalId, propriedadeId: a.propriedadeId!, desde: { lte: a.data }, OR: [{ ate: null }, { ate: { gt: a.data } }] } }), 'sítio da aplicação na data');
    if (a.tarefaId) exigir(a.tarefa?.parametros && a.desvioProtocoloSnapshot, 'snapshot de tarefa planejada/realizada');
  }
  const ativa = aplicacoes.find(a => a.id === c.id('fato:aplicacao:carencia-ativa'))!;
  const encerrada = aplicacoes.find(a => a.id === c.id('fato:aplicacao:tratamento-encerrado'))!;
  const prazoAtivo = calcularPrazoCarencia([ativa], 'LEITE'); const prazoEncerrado = calcularPrazoCarencia([encerrada], 'LEITE');
  // Compara com a data-base persistida, não exige que um seed antigo mantenha carência ativa para sempre.
  exigir(prazoAtivo.estado === 'CONHECIDO' && prazoAtivo.ate > dia(c.manifesto.dataBase) && prazoEncerrado.estado === 'CONHECIDO' && prazoEncerrado.ate < dia(c.manifesto.dataBase), 'carências ativa/encerrada na preparação');
  const fechamentos = await prisma.fechamentoConsumo.findMany({ include: { participacoes: true, itens: { include: { movimentoEstoque: { include: { revertidoPor: true } } } }, vigencia: { include: { dieta: { include: { itens: true } } } } } });
  for (const f of fechamentos) {
    const locs = await prisma.localizacaoAnimal.findMany({ where: { loteId: f.loteId } });
    const recalculo = calcularAnimalDias(locs, f.inicio, f.fim);
    exigir(recalculo.animalDias === f.animalDias && f.participacoes.reduce((s, p) => s + p.dias, 0) === f.animalDias && recalculo.participacoes.every(p => f.participacoes.some(i => i.animalId === p.animalId && i.dias === p.dias)), 'animal-dias e participantes');
    for (const i of f.itens) {
      const ingrediente = f.vigencia.dieta.itens.find(d => d.produtoId === i.produtoId)!;
      exigir(ingrediente.quantidadeCabecaDia.mul(f.animalDias).equals(i.quantidadePrevista), 'consumo previsto');
      exigir(i.movimentoEstoque && i.movimentoEstoque.quantidade.equals(i.quantidadeConfirmada) && i.movimentoEstoque.centroCustoId === f.centroCustoId, 'consumo, estoque e centro');
      if (f.status === 'ESTORNADO') exigir(i.movimentoEstoque.revertidoPor?.quantidade.equals(i.quantidadeConfirmada), 'estoque devolvido pelo estorno');
    }
  }
  exigir(fechamentos.some(f => f.status === 'ESTORNADO'), 'fechamento estornado');
  const movimento = fechamentos.find(f => f.id === c.id('fechamento:movimentacao'))!;
  exigir(movimento.participacoes.some(p => p.dias < 10), 'participação parcial devido à troca de lote');
  const vigencias = await prisma.vigenciaDietaLote.findMany({ orderBy: { desde: 'asc' } });
  for (const [i, v] of vigencias.entries()) for (const anterior of vigencias.slice(0, i).filter(a => a.loteId === v.loteId)) exigir(anterior.ate && anterior.ate <= v.desde, 'vigências sem sobreposição');
}

export async function verificarCenario(c: Contexto) {
  await verificarCatalogos(c); await verificarRebanho(c); await verificarFinanceiro(); await verificarEstoque(); await verificarPecuaria(c);
  const resumo = {
    banco: c.manifesto.banco, dataBase: c.manifesto.dataBase, etapas: c.manifesto.etapas,
    sitios: await prisma.propriedade.findMany({ select: { nome: true, principal: true } }), animais: await prisma.animal.count(), lotes: await prisma.lote.count(),
    operacoes: await prisma.operacao.count(), transacoes: await prisma.transacaoFinanceira.count(), compromissos: await prisma.compromissoFinanceiro.count(),
    movimentosEstoque: await prisma.movimentoEstoque.count(), aplicacoes: await prisma.aplicacaoProduto.count(), exames: await prisma.exameAnimal.count(),
    rodadas: await prisma.rodadaProtocoloSanitario.count(), fechamentos: await prisma.fechamentoConsumo.count(),
    contas: (await listarContas()).map(c => ({ nome: c.nome, saldo: c.saldoAtual.toFixed(2) })),
  };
  process.stdout.write(`${JSON.stringify({ verificacao: 'ok', ...resumo }, null, 2)}\n`); return resumo;
}
