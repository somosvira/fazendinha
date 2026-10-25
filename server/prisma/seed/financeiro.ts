import { prisma } from '../../src/db.js';
import { criarConta } from '../../src/services/financeiro/contas.js';
import { contaSchema, operacaoSchema } from '../../src/services/financeiro/schemas.js';
import { criarOperacao, liquidarCompromisso, transferir, estornarTransacao, estornarOperacao } from '../../src/services/financeiro/operacoes.js';
import { transferirEstoque } from '../../src/services/estoque/transferencias.js';
import { auditar } from '../../src/services/financeiro/regras.js';
import { chave, dia, type ContextoSeed } from './contexto.js';
import { SITIOS } from './catalogos.js';
export const CONTAS = [
  ['Principal', 'Banco Principal', 'Banco do Brasil'], ['Principal', 'Banco Reserva Principal', 'Sicoob'],
  ['Arrendado', 'Banco Arrendado', 'Sicredi'], ['Test', 'Banco Test', 'Caixa Econômica Federal'],
] as const;
export async function operacao(c: ContextoSeed, ref: string, sitio: string, dados: unknown) {
  const propriedadeId = c.numero(`sitio:${sitio}`), input = operacaoSchema.parse(dados), key = chave(`operacao:${ref}`);
  return c.registro(`operacao:${ref}`, async id => {
    if (id) return prisma.operacao.findUnique({ where: { id } });
    const auditoria = await prisma.auditoriaFinanceira.findFirst({ where: { entidade: 'Operacao', acao: 'CONFIRMACAO_OPERACAO_IDEMPOTENTE', estadoPosterior: { path: ['chave'], equals: key } } });
    return auditoria ? prisma.operacao.findUnique({ where: { id: auditoria.entidadeId } }) : null;
  },
    () => criarOperacao({ ...input, chave: key, propriedadeId, usuarioId: c.usuarioId }));
}
export async function financeiro(c: ContextoSeed) {
  for (const [ordem, [sitio, nome, instituicao]] of CONTAS.entries()) {
    const propriedadeId = c.numero(`sitio:${sitio}`);
    await c.registro(`conta:${nome}`, id => prisma.contaFinanceira.findFirst({ where: id ? { id } : { nome, propriedadeId } }), () => criarConta({
      ...contaSchema.parse({ nome, tipo: 'BANCO', instituicao, saldoAbertura: 0, dataSaldoAbertura: c.dias(-701), agencia: '0001', numeroConta: `1000${ordem + 1}`, digito: '0', titular: `Sítio ${sitio} — fictício`, tipoBancario: 'CORRENTE' }),
      propriedadeId, usuarioId: c.usuarioId,
    }));
  }
  for (const [sitio] of SITIOS) await operacao(c, `aporte:${sitio}`, sitio, { tipo: 'APORTE', data: c.dias(-701), descricao: `Seed única — aporte ${sitio}`,
    valorTotal: 500000, parceiroId: c.id('parceiro:proprietario'), financeiro: { condicao: 'A_VISTA', contaId: c.id(`conta:Banco ${sitio}`), formaPagamento: 'PIX' } });
  for (const [ref, sitio, parceiro, categoria, valor, condicao, vencimento] of [
    ['servico-veterinario', 'Principal', 'veterinario', 'Serviços veterinários', 1000, 'A_PRAZO', c.dias(15)],
    ['servico-arrendado', 'Arrendado', 'veterinario', 'Serviços veterinários', 250, 'A_VISTA', c.dias(15)],
    ['servico-test', 'Test', 'veterinario', 'Serviços veterinários', 300, 'A_VISTA', c.dias(15)],
    ['manutencao-vencida', 'Principal', 'manutencao', 'Manutenção e serviços', 300, 'A_PRAZO', c.dias(-10)],
    ['manutencao-cancelada', 'Principal', 'manutencao', 'Manutenção e serviços', 150, 'A_PRAZO', c.dias(10)],
    ['visita-estornada', 'Principal', 'veterinario', 'Serviços veterinários', 180, 'A_VISTA', c.dias(10)],
  ] as const) await operacao(c, ref, sitio, { tipo: 'SERVICO', data: c.dias(-20), descricao: `Seed única — ${ref}`, parceiroId: c.id(`parceiro:${parceiro}`), categoriaId: c.id(`categoria:${categoria}`), centroCustoId: c.id('centro:Pecuária'), valorTotal: valor,
    financeiro: condicao === 'A_VISTA' ? { condicao, contaId: c.id(`conta:Banco ${sitio}`), formaPagamento: 'PIX' } : { condicao, parcelas: [{ valor, dataVencimento: vencimento }] },
  });
}
export async function financeiroFinal(c: ContextoSeed) {
  // Liquidações e estornos conservam o vínculo com as mesmas compras/serviços.
  for (const [ref, percentual] of [['compra:Principal:mineral', 1], ['compra:Principal:silagem', 0.5]] as const) {
    const compromisso = await prisma.compromissoFinanceiro.findFirstOrThrow({ where: { operacaoId: c.id(`operacao:${ref}`) } });
    const descricao = `Seed única — liquidação ${ref}`;
    await c.acao(`liquidar:${ref}`, async () => !!await prisma.liquidacao.findFirst({ where: { compromissoId: compromisso.id, transacao: { descricao } } }),
      () => liquidarCompromisso(compromisso.id, { contaId: c.id('conta:Banco Principal'), valor: compromisso.valorOriginal.mul(percentual).toNumber(), data: dia(c.dias(-5)), formaPagamento: 'PIX', descricao, usuarioId: c.usuarioId }));
  }
  await c.acao('transferencia:bancos', async () => !!await prisma.transacaoFinanceira.findFirst({ where: { descricao: 'Seed única — reserva bancária' } }),
    () => transferir({ contaOrigemId: c.id('conta:Banco Principal'), contaDestinoId: c.id('conta:Banco Reserva Principal'), valor: 10000, data: dia(c.dias(-8)), descricao: 'Seed única — reserva bancária', propriedadeId: c.sitioIds.principal, usuarioId: c.usuarioId }));
  const key = chave('transferencia:filtros');
  await c.acao('transferencia:filtros', async () => !!await prisma.auditoriaFinanceira.findFirst({ where: { entidade: 'TransferenciaEstoque', estadoPosterior: { path: ['chave'], equals: key } } }),
    () => transferirEstoque({ chave: key, produtoId: c.id('produto:manutencao'), origemId: c.sitioIds.principal, destinoId: c.sitioIds.arrendado, quantidade: '5', data: c.dias(-10), motivo: 'Transferência sintética com custo e origem preservados', partidas: [{ partidaId: c.id('partida:Principal:manutencao'), quantidade: '5' }] }, c.usuarioId));
  await c.acao('cancelamento:operacao', async () => (await prisma.operacao.findUniqueOrThrow({ where: { id: c.id('operacao:manutencao-cancelada') } })).status === 'CANCELADA',
    () => estornarOperacao(c.id('operacao:manutencao-cancelada'), 'Serviço sintético cancelado antes da execução.', { propriedadeId: c.sitioIds.principal, usuarioId: c.usuarioId }));
  const transacao = await prisma.transacaoFinanceira.findFirstOrThrow({ where: { operacaoId: c.id('operacao:visita-estornada'), reversaoDeId: null } });
  await c.acao('estorno:transacao', async () => !!await prisma.transacaoFinanceira.findFirst({ where: { reversaoDeId: transacao.id } }),
    () => estornarTransacao(transacao.id, 'Pagamento sintético estornado.', { propriedadeId: c.sitioIds.principal, usuarioId: c.usuarioId }));
  const data = dia(c.mes(-3, 1));
  // Exceção administrativa: o app não dispõe de comando público para fechar período.
  await c.registro('periodo:fechado', id => prisma.periodoFinanceiro.findFirst({ where: id ? { id } : { propriedadeId: c.sitioIds.principal, ano: data.getUTCFullYear(), mes: data.getUTCMonth() + 1 } }),
    () => prisma.$transaction(async tx => {
      const periodo = await tx.periodoFinanceiro.create({ data: { propriedadeId: c.sitioIds.principal, ano: data.getUTCFullYear(), mes: data.getUTCMonth() + 1, status: 'FECHADO', fechadoEm: new Date(), fechadoPorId: c.usuarioId, observacao: 'Fechamento sintético da seed única.' } });
      await auditar(tx, { entidade: 'PeriodoFinanceiro', entidadeId: periodo.id, acao: 'FECHAMENTO', usuarioId: c.usuarioId, depois: periodo }); return periodo;
    }));
}
