import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../../src/db.js';
import type { Contexto } from '../contexto.js';
import { dia } from '../contexto.js';
import { abrirOperacaoLeite, retirarOperacaoLeite, fecharOperacaoLeite } from '../../../src/services/pecuaria/leite/comercial.operacoes.js';
import { venderLeite } from '../../../src/services/pecuaria/leite/estoque.js';
import { registrarEntregaLeite, registrarDemonstrativoLeite } from '../../../src/services/pecuaria/leite/comercial.js';
import { liquidarCompromisso } from '../../../src/services/financeiro/operacoes.js';
import { AVISO, calendario, intervalo, key, ref } from './catalogo.js';
import { ctx, executar, guardar, id, sitio, uid } from './base.js';

export type PeriodoComercialSeed = 'anterior' | 'atual';
export const quantidadeColetaDia = (data: string, hoje: string) => data === hoje ? 300 : 900;

/** Cada retirada ocorre depois das entradas do mesmo dia e antes de produzir o seguinte. */
export async function registrarRetiradaDia(c: Contexto, periodo: PeriodoComercialSeed, data: string) {
  const cal = calendario(c.dataBase), anterior = periodo === 'anterior';
  const inicio = anterior ? cal.inicio : cal.inicioAtual, fim = anterior ? cal.fimAnterior : cal.hoje;
  if (data < inicio || data > fim) throw new Error(`Coleta ${data} fora do período ${periodo}.`);
  const n = `comercial:${periodo}`, acao = `${n}:retirada:${data}`;
  await executar(c, n, () => abrirOperacaoLeite({ chave: key(n), parceiroId: c.id('parceiro:cliente'), inicio, fim, referencia: `V5 ${periodo}. ${AVISO}` }, ctx(c)));
  await executar(c, acao, async () => {
    const o = await prisma.operacaoComercialLeite.findUniqueOrThrow({ where: { id: id(c, n) } });
    return retirarOperacaoLeite(o.id, { chave: key(acao), versaoEsperada: o.versao, produtoId: id(c, 'produto:comercial'), data,
      quantidadeLitros: quantidadeColetaDia(data, cal.hoje), referencia: `Coleta diária sintética ${data}. ${AVISO}`,
      pontoColeta: 'Tanque principal', horarioColeta: data === cal.hoje ? '08:00' : '21:00' }, ctx(c));
  });
  // A resposta durável permite recuperar o comprovante mesmo após queda antes de salvar o manifesto.
  const recibo = await prisma.requisicaoPecuaria.findUniqueOrThrow({ where: { chave: key(acao) } });
  const retirada = z.object({ retiradaId: z.string().uuid() }).parse(recibo.resultadoIds);
  const indice = Number(data.slice(8)) - 1;
  await guardar(c, `${n}:retirada-id:${indice}`, retirada.retiradaId);
}

export async function comercial(c: Contexto, periodo: PeriodoComercialSeed) {
  const cal = calendario(c.dataBase), anterior = periodo === 'anterior';
  const inicio = anterior ? cal.inicio : cal.inicioAtual, fim = anterior ? cal.fimAnterior : cal.hoje, data = fim;
  const n = `comercial:${periodo}`, dias = intervalo(inicio, fim);
  // Conferimos as retiradas reais; o fechamento não repete suas baixas físicas.
  const retiradas = dias.map((diaColeta, indice) => ({
    retiradaId: id(c, `${n}:retirada-id:${indice}`),
    quantidadeReconhecida: quantidadeColetaDia(diaColeta, cal.hoje) - (indice === dias.length - 1 ? 2 : 0),
    motivoDiferenca: indice === dias.length - 1 ? AVISO : null,
  }));
  const preco = anterior ? 2.5 : 2.7;
  const valor = retiradas.reduce((s, r) => s.plus(r.quantidadeReconhecida), new Prisma.Decimal(0)).mul(preco).toDecimalPlaces(2).toNumber();
  await executar(c, `${n}:fechar`, async () => {
    const o = await prisma.operacaoComercialLeite.findUniqueOrThrow({ where: { id: id(c, n) } });
    const amostra = await prisma.amostraQualidadeLeite.findUniqueOrThrow({ where: { id: id(c, `qualidade:${periodo}:coletiva`) } });
    return fecharOperacaoLeite(o.id, { chave: key(`${n}:fechar`), versaoEsperada: o.versao, data: fim, precoUnitario: preco, ajuste: 0, motivo: AVISO,
      categoriaId: c.id('categoria:Venda de leite'), centroCustoId: c.id('centro:Pecuária'), amostras: [{ amostraId: amostra.id, versaoEsperada: amostra.versao }],
      retiradas,
      financeiro: { condicao: 'A_PRAZO', parcelas: [{ valor, dataVencimento: dia(fim) }] },
    }, ctx(c));
  });
  const fechamento = await prisma.fechamentoOperacaoLeite.findFirstOrThrow({ where: { comercialId: id(c, n) }, orderBy: { versao: 'desc' } });
  await guardar(c, `${n}:fechamento`, fechamento.id);
  const compromisso = await prisma.compromissoFinanceiro.findFirstOrThrow({ where: { operacaoId: fechamento.operacaoId } });
  await c.registro(ref(`${n}:recebimento`), i => prisma.transacaoFinanceira.findFirst({ where: i ? { id: i } : { operacaoId: fechamento.operacaoId, descricao: `V5 · Recebimento ${periodo}` } }),
    () => liquidarCompromisso(compromisso.id, { propriedadeId: sitio(c), usuarioId: uid(c), contaId: c.id('conta:Banco Principal'),
      data: dia(fim), valor: anterior ? 100 : compromisso.valorOriginal.toNumber(), descricao: `V5 · Recebimento ${periodo}` }));
  if (anterior) return;
  // Operação em aberto em um subperíodo distinto: preço ainda desconhecido.
  await executar(c, 'comercial:aberta', () => abrirOperacaoLeite({ chave: key('comercial:aberta'), parceiroId: c.id('parceiro:cliente'), inicio: data, fim: c.mes(1, 0), referencia: `V5 em aberto. ${AVISO}` }, ctx(c)));
  await executar(c, 'comercial:aberta:retirar', async () => {
    const o = await prisma.operacaoComercialLeite.findUniqueOrThrow({ where: { id: id(c, 'comercial:aberta') } });
    return retirarOperacaoLeite(o.id, { chave: key('comercial:aberta:retirar'), versaoEsperada: o.versao, produtoId: id(c, 'produto:comercial'), data, quantidadeLitros: 50, referencia: AVISO }, ctx(c));
  });
  await executar(c, 'venda:imediata', () => venderLeite({ chave: key('venda:imediata'), produtoId: id(c, 'produto:comercial'), quantidadeLitros: 20, data, descricao: 'V5 · Venda avulsa demonstrativa', parceiroId: c.id('parceiro:cliente'), valorTotal: 54,
    categoriaId: c.id('categoria:Venda de leite'), centroCustoId: c.id('centro:Pecuária'), financeiro: { condicao: 'A_PRAZO', parcelas: [{ valor: 54, dataVencimento: dia(data) }] } }, ctx(c)));
  await executar(c, 'entrega', () => registrarEntregaLeite({ chave: key('entrega'), vinculo: { tipo: 'VENDA_EXISTENTE', operacaoId: id(c, 'venda:imediata') }, referencia: AVISO,
    pontoColeta: 'Tanque principal', horarioColeta: '18:00', volumeAceito: 20, situacao: 'ACEITE_INFORMADO', motivo: AVISO }, ctx(c)));
  await executar(c, 'demonstrativo', async () => {
    const e = await prisma.entregaLeite.findUniqueOrThrow({ where: { id: id(c, 'entrega') }, include: { conferencias: { orderBy: { versao: 'desc' }, take: 1 }, retirada: { include: { versoesComerciaisLeite: { orderBy: { versao: 'desc' }, take: 1 } } } } });
    return registrarDemonstrativoLeite({ chave: key('demonstrativo'), parceiroId: c.id('parceiro:cliente'), inicio: data, fim: data, referencia: AVISO,
      precoBase: 2.5, volumeReconhecido: 20, valorComercial: 54, valorPagamentoInformado: 52,
      componentes: [{ natureza: 'BONUS', valor: 4, referencia: AVISO }, { natureza: 'RETENCAO', valor: 2, referencia: AVISO }],
      alocacoes: [{ entregaId: e.id, versaoEsperadaEntrega: e.conferencias[0].versao, versaoVendaId: e.retirada.versoesComerciaisLeite[0].id, quantidadeLitros: 20, valor: 54 }],
    }, ctx(c));
  });
}
