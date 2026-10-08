import { prisma } from '../../src/db.js';
import { criarConta } from '../../src/services/financeiro/contas.js';
import { contaSchema, operacaoSchema } from '../../src/services/financeiro/schemas.js';
import { criarOperacao, liquidarCompromisso, transferir, estornarTransacao, estornarOperacao } from '../../src/services/financeiro/operacoes.js';
import { salvarRascunho } from '../../src/services/financeiro/rascunhos.js';
import { auditar } from '../../src/services/financeiro/regras.js';
import { criarProduto } from '../../src/services/estoque/produtos.js';
import { produtoSchema } from '../../src/services/estoque/produtos.schemas.js';
import { transferirEstoque } from '../../src/services/estoque/transferencias.js';
import { chave, dia, deslocar, type Contexto } from './contexto.js';

export async function obterPartida(c: Contexto, produto: string) {
  const validade = c.dias(produto === 'vacina' ? 180 : 360);
  const linha = await c.registro(`partida:${produto}`, id => prisma.partidaProduto.findFirst({ where: id ? { id } : { produtoId: c.id(`produto:${produto}`), validade: { gte: dia(validade), lt: dia(deslocar(validade, 1)) }, lotePrincipalId: null } }), async () => { throw new Error(`Partida adquirida ausente: ${produto}`); });
  return String(linha.id);
}

export async function operacao(c: Contexto, ref: string, sitio: string, dados: unknown) {
  const propriedadeId = c.numero(`sitio:${sitio}`);
  const input = operacaoSchema.parse(dados);
  return c.registro(`operacao:${ref}`, id => prisma.operacao.findFirst({ where: id ? { id } : { descricao: input.descricao, propriedadeId } }),
    () => criarOperacao({ ...input, chave: chave(`operacao:${ref}`), propriedadeId, usuarioId: c.numero('usuario:dono') }));
}

export async function financeiro(c: Contexto) {
  const uid = c.numero('usuario:dono');
  for (const [sitio, nome, tipo] of [['Principal', 'Banco Principal', 'BANCO'], ['Destino', 'Banco Destino', 'BANCO'], ['Principal', 'Caixa Principal', 'CAIXA']] as const) {
    const propriedadeId = c.numero(`sitio:${sitio}`);
    await c.registro(`conta:${nome}`, id => prisma.contaFinanceira.findFirst({ where: id ? { id } : { nome, propriedadeId } }), () => criarConta({ ...contaSchema.parse({ nome, tipo, saldoAbertura: 0, dataSaldoAbertura: c.mes(-2, 1), instituicao: tipo === 'BANCO' ? 'Banco fictício' : null,
      ...(tipo === 'BANCO' ? { agencia: '0001', numeroConta: sitio === 'Principal' ? '10001' : '10002', digito: '0', titular: `Fazenda ${sitio} — fictícia`, tipoBancario: 'CORRENTE' } : { local: 'Escritório demonstrativo', responsavel: 'Proprietário demonstrativo' }),
    }), propriedadeId, usuarioId: uid }));
  }
  for (const sitio of ['Principal', 'Destino']) await operacao(c, `aporte:${sitio}`, sitio, {
    tipo: 'APORTE', data: c.mes(-2, 1), descricao: `seedatev3 — aporte ${sitio}`, valorTotal: 60000,
    parceiroId: c.id('parceiro:proprietario'), financeiro: { condicao: 'A_VISTA', contaId: c.id(`conta:Banco ${sitio}`), formaPagamento: 'PIX' },
  });
  for (const [ref, nome, unidade, categoria, uso, rastrear] of [
    ['racao', 'Ração demonstrativa', 'KG', 'Ração', 'nutricional', true],
    ['mineral', 'Mineral demonstrativo', 'KG', 'Sal mineral e suplementos', 'nutricional', true],
    ['silagem', 'Silagem demonstrativa', 'KG', 'Silagem', 'nutricional', true],
    ['vacina', 'Vacina demonstrativa', 'ML', 'Vacinas', 'sanitario', true],
    ['vermifugo', 'Vermífugo demonstrativo', 'ML', 'Medicamentos veterinários', 'sanitario', true],
    ['medicamento', 'Medicamento demonstrativo', 'ML', 'Medicamentos veterinários', 'sanitario', true],
    ['direto', 'Medicamento de consumo direto demonstrativo', 'ML', 'Medicamentos veterinários', 'sanitario', false],
    ['manutencao', 'Filtro de manutenção demonstrativo', 'UN', 'Manutenção e serviços', 'manutencao', false],
  ] as const) await c.registro(`produto:${ref}`, id => prisma.produto.findFirst({ where: id ? { id } : { nome } }), () => criarProduto(produtoSchema.parse({
    nome, unidade, categoriaId: c.id(`categoria:${categoria}`), centroCustoIds: [c.id(`centro:${uso === 'manutencao' ? 'Gestão' : 'Pecuária'}`)], fornecedorIds: [c.id(`parceiro:${uso === 'manutencao' ? 'manutencao' : 'fornecedor'}`)],
    usoNutricional: uso === 'nutricional', usoSanitario: uso === 'sanitario', rastrearPartidas: rastrear, minimoEstoque: 10,
    ...(uso === 'nutricional' ? { perfilNutricional: { materiaSecaPercentual: ref === 'silagem' ? 35 : 90 } } : {}),
    ...(uso === 'sanitario' ? { perfilSanitario: { carenciaLeiteHoras: ref === 'medicamento' ? 96 : 0, carenciaCarneHoras: 48, viaPadrao: 'Intramuscular', referenciaTecnica: 'PARÂMETROS FICTÍCIOS — não usar como prescrição.' } } : {}),
  }), uid));

  const compra = async (ref: string, produto: string, quantidade: number, preco: number, mes: number, dataDia: number, financeiro: unknown, partidas?: Array<{ codigo: string; nome: string; validade: string | null; quantidade: number; cienciaValidadeDesconhecida?: boolean }>, sitio = 'Principal', direto = false) => {
    const p = await prisma.produto.findUniqueOrThrow({ where: { id: c.id(`produto:${produto}`) } });
    await operacao(c, ref, sitio, { tipo: direto ? 'COMPRA_CONSUMO_DIRETO' : 'COMPRA_ESTOQUE', data: c.mes(mes, dataDia), descricao: `seedatev3 — ${ref}`,
      parceiroId: c.id(`parceiro:${produto === 'manutencao' ? 'manutencao' : 'fornecedor'}`), centroCustoId: c.id(`centro:${produto === 'manutencao' ? 'Gestão' : 'Pecuária'}`),
      itens: [{ produtoId: p.id, descricao: p.nome, quantidade, unidade: p.unidade, valorUnitario: preco, estocavel: !direto, ...(partidas ? { partidas } : {}) }], financeiro,
    });
  };
  const vista = { condicao: 'A_VISTA', contaId: c.id('conta:Banco Principal'), formaPagamento: 'PIX' };
  const partida = (ref: string, quantidade: number, validade = c.dias(360)) => [{ codigo: `DEV-${ref}`, nome: `Lote demonstrativo ${ref}`, validade, quantidade }];
  await compra('compra-racao', 'racao', 3000, 2, -2, 3, vista, partida('racao', 3000));
  await compra('compra-mineral', 'mineral', 300, 4, -2, 4, { condicao: 'A_PRAZO', parcelas: [{ valor: 1200, dataVencimento: c.mes(-1, 10) }] }, partida('mineral', 300));
  await compra('compra-silagem', 'silagem', 2000, 0.3, -2, 5, vista, partida('silagem', 2000));
  await compra('compra-vacina', 'vacina', 1000, 1, -2, 6, vista, [
    ...partida('vacina-a', 700, c.dias(180)), ...partida('vacina-b', 250, c.dias(270)),
    { codigo: 'DEV-vacina-desconhecida', nome: 'Validade desconhecida — segregado', validade: null, quantidade: 30, cienciaValidadeDesconhecida: true },
    ...partida('vacina-vencida', 20, c.mes(-1, 1)),
  ]);
  await compra('compra-vermifugo', 'vermifugo', 600, 1.5, -2, 7, { condicao: 'PARCIAL', contaId: c.id('conta:Banco Principal'), valorPago: 200, parcelas: [{ valor: 700, dataVencimento: c.mes(-1, 15) }] }, partida('vermifugo', 600));
  await compra('compra-medicamento', 'medicamento', 200, 3, -2, 8, vista, partida('medicamento', 200));
  await compra('compra-direta', 'direto', 20, 3, -1, 3, vista, undefined, 'Principal', true);
  await compra('compra-filtros', 'manutencao', 10, 25, -1, 4, vista);
  await compra('compra-semen', 'semen', 10, 80, -2, 9, vista);
  await compra('compra-embriao', 'embriao', 3, 350, -2, 9, vista);
  for (const [ref, valor] of [['compra-mineral', 1200], ['compra-vermifugo', 150]] as const) {
    const compromisso = await prisma.compromissoFinanceiro.findFirstOrThrow({ where: { operacaoId: c.id(`operacao:${ref}`) } });
    const descricao = `seedatev3 — liquidação ${ref}`;
    await c.acao(`liquidar:${ref}`, async () => !!await prisma.liquidacao.findFirst({ where: { compromissoId: compromisso.id, transacao: { descricao } } }), () => liquidarCompromisso(compromisso.id, { contaId: c.id('conta:Banco Principal'), valor, data: dia(c.mes(-1, 10)), formaPagamento: 'PIX', descricao, usuarioId: uid }));
  }
  for (const [ref, sitio, parceiro, categoria, centro, mes, d, valor, condicao, vencimento] of [
    ['servico-veterinario', 'Principal', 'veterinario', 'Serviços veterinários', 'Pecuária', -1, 3, 1000, 'A_PRAZO', c.dias(15)],
    ['servico-destino', 'Destino', 'veterinario', 'Serviços veterinários', 'Pecuária', -1, 4, 250, 'A_VISTA', c.dias(15)],
    ['manutencao-paga', 'Principal', 'manutencao', 'Manutenção e serviços', 'Gestão', -2, 12, 600, 'A_VISTA', c.dias(15)],
    ['manutencao-vencida', 'Principal', 'manutencao', 'Manutenção e serviços', 'Gestão', -1, 12, 300, 'A_PRAZO', c.mes(-1, 20)],
    ['manutencao-cancelada', 'Principal', 'manutencao', 'Manutenção e serviços', 'Gestão', 0, 1, 150, 'A_PRAZO', c.dias(10)],
    ['visita-estornada', 'Principal', 'veterinario', 'Serviços veterinários', 'Pecuária', 0, 1, 180, 'A_VISTA', c.dias(10)],
  ] as const) await operacao(c, ref, sitio, { tipo: 'SERVICO', data: c.mes(mes, d), descricao: `seedatev3 — ${ref}`, parceiroId: c.id(`parceiro:${parceiro}`), categoriaId: c.id(`categoria:${categoria}`), centroCustoId: c.id(`centro:${centro}`), valorTotal: valor,
    financeiro: condicao === 'A_VISTA' ? { condicao, contaId: c.id(`conta:Banco ${sitio}`) } : { condicao, parcelas: [{ valor, dataVencimento: vencimento }] },
  });
  const chaveFiltros = chave('transferencia:estoque:filtros');
  await c.acao('transferencia:estoque:filtros', async () => !!await prisma.auditoriaFinanceira.findFirst({ where: { entidade: 'TransferenciaEstoque', estadoPosterior: { path: ['chave'], equals: chaveFiltros } } }), () => transferirEstoque({ chave: chaveFiltros, produtoId: c.id('produto:manutencao'), origemId: c.numero('sitio:Principal'), destinoId: c.numero('sitio:Destino'), quantidade: '5', data: c.mes(-1, 6), motivo: 'Filtros adquiridos e enviados para manutenção na Destino' }, uid));
  for (const [ref, sitio, data, descricao, quantidade, valor, condicao] of [
    ['venda-rubi', 'Principal', c.mes(-1, 25), 'Venda de Rubí DEV-017 — baixa consultável no rebanho', 1, 4200, 'A_VISTA'],
    ['venda-destino', 'Destino', c.mes(0, 1), 'Venda de filtros excedentes adquiridos e transferidos', 2, 80, 'A_PRAZO'],
  ] as const) await operacao(c, ref, sitio, { tipo: 'VENDA', data, descricao: `seedatev3 — ${ref === 'venda-rubi' ? 'venda de Rubí' : ref}`, parceiroId: c.id('parceiro:cliente'), categoriaId: c.id(`categoria:${ref === 'venda-rubi' ? 'Venda de animais' : 'Manutenção e serviços'}`), centroCustoId: c.id('centro:Pecuária'), itens: [{ descricao, quantidade, unidade: 'UN', valorUnitario: valor, ...(ref === 'venda-destino' ? { produtoId: c.id('produto:manutencao') } : {}) }],
    financeiro: condicao === 'A_VISTA' ? { condicao, contaId: c.id(`conta:Banco ${sitio}`) } : { condicao, parcelas: [{ valor: quantidade * valor, dataVencimento: c.dias(15) }] },
  });
  await c.acao('transferencia:contas', async () => !!await prisma.transacaoFinanceira.findFirst({ where: { descricao: 'seedatev3 — suprimento do caixa' } }), () => transferir({ contaOrigemId: c.id('conta:Banco Principal'), contaDestinoId: c.id('conta:Caixa Principal'), valor: 1000, data: dia(c.mes(-1, 5)), descricao: 'seedatev3 — suprimento do caixa', propriedadeId: c.numero('sitio:Principal'), usuarioId: uid }));
  await c.acao('cancelamento:operacao', async () => (await prisma.operacao.findUniqueOrThrow({ where: { id: c.id('operacao:manutencao-cancelada') } })).status === 'CANCELADA', () => estornarOperacao(c.id('operacao:manutencao-cancelada'), 'Serviço demonstrativo cancelado antes da execução.', { propriedadeId: c.numero('sitio:Principal'), usuarioId: uid }));
  const transacao = await prisma.transacaoFinanceira.findFirstOrThrow({ where: { operacaoId: c.id('operacao:visita-estornada'), reversaoDeId: null } });
  await c.acao('estorno:transacao', async () => !!await prisma.transacaoFinanceira.findFirst({ where: { reversaoDeId: transacao.id } }), () => estornarTransacao(transacao.id, 'Pagamento demonstrativo estornado para conferência.', { propriedadeId: c.numero('sitio:Principal'), usuarioId: uid }));

  for (const [produto, quantidade] of [['racao', '700'], ['mineral', '80'], ['silagem', '500'], ['vacina', '100'], ['vermifugo', '100']] as const) {
    const partidaId = await obterPartida(c, produto);
    const key = `transferencia:estoque:${produto}`;
    await c.acao(key, async () => !!await prisma.auditoriaFinanceira.findFirst({ where: { entidade: 'TransferenciaEstoque', estadoPosterior: { path: ['chave'], equals: chave(key) } } }), () => transferirEstoque({ chave: chave(key), produtoId: c.id(`produto:${produto}`), origemId: c.numero('sitio:Principal'), destinoId: c.numero('sitio:Destino'), quantidade, data: c.mes(-2, 15), motivo: 'Transferência demonstrativa com origem e custo preservados', partidas: [{ partidaId, quantidade }] }, uid));
  }
  await c.registro('rascunho:operacao', id => prisma.rascunhoOperacao.findFirst({ where: id ? { id } : { propriedadeId: c.numero('sitio:Principal'), criadoPorId: uid } }), () => salvarRascunho({ propriedadeId: c.numero('sitio:Principal'), usuarioId: uid, dados: { operacao: { tipo: 'SERVICO', descricao: 'seedatev3 — orçamento ainda não confirmado', data: c.manifesto.dataBase, parceiroId: c.id('parceiro:manutencao'), valorTotal: 450, categoriaId: c.id('categoria:Manutenção e serviços'), centroCustoId: c.id('centro:Gestão'), financeiro: { condicao: 'A_PRAZO', parcelas: [{ valor: 450, dataVencimento: c.dias(30) }] } } } }));
}

export async function financeiroAtual(c: Contexto) {
  const p = await prisma.produto.findUniqueOrThrow({ where: { id: c.id('produto:racao') } });
  await operacao(c, 'reposicao-atual', 'Principal', { tipo: 'COMPRA_ESTOQUE', data: c.mes(0, 1), descricao: 'seedatev3 — reposicao-atual', parceiroId: c.id('parceiro:fornecedor'), centroCustoId: c.id('centro:Pecuária'),
    itens: [{ produtoId: p.id, descricao: p.nome, quantidade: 100, unidade: p.unidade, valorUnitario: 2.2, estocavel: true, partidas: [{ nome: 'Reposição atual demonstrativa', validade: c.dias(400), quantidade: 100 }] }],
    financeiro: { condicao: 'A_PRAZO', parcelas: [{ valor: 220, dataVencimento: c.dias(20) }] },
  });
}

export async function fecharPeriodo(c: Contexto) {
  const data = dia(c.mes(-2, 1));
  // O app possui a trava de período, mas ainda não um comando público de fechamento.
  // Fixture administrativa isolada: cria o período junto da auditoria, após todos os fatos.
  await c.registro('periodo:fechado', id => prisma.periodoFinanceiro.findFirst({ where: id ? { id } : { propriedadeId: c.numero('sitio:Principal'), ano: data.getUTCFullYear(), mes: data.getUTCMonth() + 1 } }), () => prisma.$transaction(async tx => {
    const periodo = await tx.periodoFinanceiro.create({ data: { propriedadeId: c.numero('sitio:Principal'), ano: data.getUTCFullYear(), mes: data.getUTCMonth() + 1, status: 'FECHADO', fechadoEm: new Date(), fechadoPorId: c.numero('usuario:dono'), observacao: 'Período demonstrativo concluído pelo seedatev3.' } });
    await auditar(tx, { entidade: 'PeriodoFinanceiro', entidadeId: periodo.id, acao: 'FECHAMENTO', usuarioId: c.numero('usuario:dono'), depois: periodo });
    return periodo;
  }));
}
