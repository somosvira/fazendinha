import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { baixarLeiteTx, classificarEntradaLeiteTx, estornarBaixaLeiteTx, saldosOrigensLeiteTx, valoresMovimentosLeiteTx } from "../../estoque/leite.js";
import { registrarInversoValorizadoTx, travarValorizacaoTx } from "../../estoque/valorizacao.js";
import { converterQuantidade } from "../../estoque/unidades.js";
import { exigirPeriodoAberto } from "../../financeiro/regras.js";
import { consumirEstoqueTx } from "../consumo.js";
import { conferirAnimalNoFato } from "../fatos.js";
import { camposExameSchema, validarObservacoesExame } from "../exames/formatos.js";
import { hashFormatoExame } from "../exames/formato-snapshot.js";
import { auditar, hojeFazendaDate, RebanhoError, travarAnimais } from "../rebanho/regras.js";
import { conferirCriaTx, corrigirColostroTx, registrarColostroTx } from "../reproducao/colostro.js";
import { normalizarDetalhesParto } from "../reproducao/partos.js";
import { hashDados, operacaoIdempotenteTx } from "../reproducao/operacoes.js";
import { travarTiposExame } from "../sanidade/exames.js";
import { transacaoPecuaria } from "../transacao.js";
import { confirmarProducaoGeralTx } from "../leite/estoque.js";
import { salvarParcelasTx } from "../leite/tanques.js";
import { salvarParcelasOrdenhaSchema } from "../leite/tanques.schemas.js";
import { conferirSitioLeiteTx } from "../leite/configuracoes.js";
import { avaliarBrixColostro, conciliarDestinacaoColostro, conferirCronologiaColostro, saldoColostro, saldoUnidadeColostro } from "./colostro.calc.js";
import {
  retiradaColostroSchema, confirmarRetiradaColostroSchema, brixColostroSchema, destinacaoColostroSchema,
  enriquecimentoColostroSchema, estornoColostroSchema, consultaColostroSchema,
  type RetiradaColostroInput, type ConfirmarRetiradaColostroInput, type BrixColostroInput, type DestinacaoColostroInput,
  type EnriquecimentoColostroInput, type EstornoColostroInput, type ConsultaColostro, type OpcoesColostroDTO,
} from "./colostro.schemas.js";
import { vincularFornecimentoColostragemTx } from "./acompanhamento.js";

const D = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);
const dia = (v: string) => new Date(`${v}T00:00:00Z`);
const autor = (id: number | null) => id != null && id > 0 ? id : null;
const semValores: OpcoesColostroDTO = { verValores: false };
const json = (v: unknown): Prisma.InputJsonValue => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
function erro(mensagem: string, campo?: string): never { throw new RebanhoError("VALIDACAO", mensagem, campo); }
function conflito(mensagem: string, campo?: string): never { throw new RebanhoError("CONFLITO", mensagem, campo); }
function conferirData(data: Date) { if (data > hojeFazendaDate()) erro("O registro deve ter data até hoje", "data"); }
function conferirVersao(atual: { status: string; versao: number }, esperada: number, status = "CONFIRMADO") {
  if (atual.status !== status || atual.versao !== esperada) conflito("O registro mudou ou foi estornado; atualize a consulta", "versaoEsperada");
}
async function travarOrigensTx(tx: Prisma.TransactionClient, ids: string[]) {
  const chaves = [...new Set(ids)].sort().map(id => `pec-origem-colostro:${id}`);
  if (chaves.length) await tx.$executeRaw`SELECT pg_advisory_xact_lock(h) FROM (SELECT DISTINCT hashtext(k) AS h FROM unnest(${chaves}::text[]) AS k) chaves ORDER BY h`;
}
const incluirOrigem = {
  loteColostro: true, preparo: true,
  unidades: { orderBy: { criadoEm: "asc" as const } },
  preparos: { where: { ativo: true }, include: { preparo: true } },
  fornecimentos: { where: { ativo: true }, include: { fornecimento: true } },
  amostras: { where: { status: "VALIDO" as const }, orderBy: [{ data: "desc" as const }, { criadoEm: "desc" as const }, { id: "desc" as const }], include: { resultados: { where: { vigente: true } } } },
} satisfies Prisma.OrigemColostroInclude;
type Origem = Prisma.OrigemColostroGetPayload<{ include: typeof incluirOrigem }>;
async function origemTx(tx: Prisma.TransactionClient, id: string, propriedadeId: number) {
  const origem = await tx.origemColostro.findFirst({ where: { id, propriedadeId }, include: incluirOrigem });
  if (!origem) throw new RebanhoError("NAO_ENCONTRADO", "Origem de colostro não encontrada neste sítio");
  return origem;
}
function dadosOrigem(origem: Origem) {
  const base = origem.loteColostro ?? origem.preparo;
  if (!base) conflito("Origem histórica sem vínculo conciliado ao parto ou preparo");
  const horarioEstimado = origem.loteColostro?.horarioEstimado
    ?? (origem.preparo?.snapshot as { horarioEstimado?: boolean } | null)?.horarioEstimado ?? false;
  return { ...base, horarioEstimado };
}
function saldoUnidade(origem: Origem, unidadeId: string) {
  const unidade = origem.unidades.find(u => u.id === unidadeId);
  if (!unidade) conflito("Unidade não pertence à origem selecionada", "unidadeId");
  return unidade.status === "ESTORNADA" ? D(0) : saldoUnidadeColostro(unidade.volumeLitros,
    origem.fornecimentos.filter(a => a.unidadeId === unidadeId).reduce((s, a) => s.plus(a.quantidadeLitros), D(0)),
    origem.preparos.filter(a => a.unidadeId === unidadeId).reduce((s, a) => s.plus(a.quantidadeLitros), D(0)));
}
function saldoOrigem(origem: Origem) {
  return saldoColostro({ volume: origem.quantidadeLitros,
    fornecido: origem.fornecimentos.reduce((s, a) => s.plus(a.quantidadeLitros), D(0)),
    enriquecido: origem.preparos.reduce((s, a) => s.plus(a.quantidadeLitros), D(0)),
    congelado: origem.unidades.filter(u => u.status !== "ESTORNADA").reduce((s, u) => s.plus(saldoUnidade(origem, u.id)), D(0)) });
}
export function brixOrigem(origem: { amostras: { id: string; data: Date; formatoSnapshot: Prisma.JsonValue | null; resultados: { campo: string; valor: Prisma.JsonValue }[] }[] }, data?: Date) {
  const amostra = origem.amostras.find(a => !data || a.data <= data);
  if (!amostra) return { amostraId: null, data: null, resultado: null, limiteInclusivo: null, situacao: "PENDENTE" as const, politica: null };
  const snapshot = amostra.formatoSnapshot as { politicaBrix?: { campo: string; limiteInclusivo: string; configuracaoId: string | null; versaoConfiguracao: number } } | null;
  const politica = snapshot?.politicaBrix;
  if (!politica) return { amostraId: amostra.id, data: amostra.data.toISOString().slice(0, 10), resultado: null, limiteInclusivo: null, situacao: "PENDENTE" as const, politica: null };
  const resultado = amostra.resultados.find(r => r.campo === politica.campo)?.valor;
  const numero = typeof resultado === "string" || typeof resultado === "number" ? D(resultado) : null;
  return { amostraId: amostra.id, data: amostra.data.toISOString().slice(0, 10), resultado: numero?.toString() ?? null,
    limiteInclusivo: politica.limiteInclusivo, situacao: avaliarBrixColostro(numero, politica.limiteInclusivo), politica };
}
async function conferirSaldoCompartilhadoTx(tx: Prisma.TransactionClient, origem: Origem, data: Date) {
  const entradaId = origem.loteColostro?.entradaId;
  if (!entradaId) return;
  const entrada = await tx.entradaProducaoLeite.findFirst({ where: { id: entradaId, status: "CONFIRMADA", movimento: { propriedadeId: origem.propriedadeId, status: "CONFIRMADO" } }, include: { movimento: true } });
  if (!entrada) conflito("A entrada física da origem foi alterada ou anulada");
  await travarValorizacaoTx(tx, [entrada.movimento.produtoId]);
  const saldo = (await saldosOrigensLeiteTx(tx, entrada.movimento.produtoId, origem.propriedadeId, data)).find(s => s.entradaId === entradaId);
  if (!saldo || saldo.natureza !== "COLOSTRO" || !saldo.quantidade.eq(saldoOrigem(origem).disponivel))
    conflito("O saldo compartilhado diverge da origem de colostro; concilie os consumidores antes de destinar");
}
async function baixarOrigemTx(tx: Prisma.TransactionClient, origem: Origem, quantidade: Prisma.Decimal, data: Date, usuarioId: number | null, observacao: string) {
  const entradaId = origem.loteColostro?.entradaId;
  if (!entradaId) return null; // Preparo tem seu próprio razão, após consumir o leite bruto uma única vez.
  const entrada = await tx.entradaProducaoLeite.findUniqueOrThrow({ where: { id: entradaId }, include: { movimento: true } });
  return baixarLeiteTx(tx, { produtoId: entrada.movimento.produtoId, propriedadeId: origem.propriedadeId, entradaIds: [entradaId],
    data, quantidade, origem: "NUTRICAO", usuarioId, observacao, permitirOrigemColostro: true });
}
type CustoOrigemAtual = { valorTotal: Prisma.Decimal | null; valorSaldo: Prisma.Decimal | null; alocacoes: Map<string, Prisma.Decimal | null> };
/** Reapuração em leitura: deriva o custo da origem real sem alterar snapshots ou fatos. */
async function calcularCustoOrigemAtualTx(tx: Prisma.TransactionClient, id: string, propriedadeId: number,
  cache = new Map<string, CustoOrigemAtual>(), caminho = new Set<string>()): Promise<CustoOrigemAtual> {
  const anterior = cache.get(id); if (anterior) return anterior;
  if (caminho.has(id)) conflito("Há um ciclo na rastreabilidade do enriquecimento; concilie as origens");
  const proximo = new Set(caminho).add(id);
  const origem = await tx.origemColostro.findFirst({ where: { id, propriedadeId }, select: { id: true, quantidadeLitros: true,
    loteColostro: { select: { entrada: { select: { movimentoId: true } } } },
    preparo: { select: { origens: { select: { id: true, origemId: true } }, insumos: { select: { movimento: { select: { valorTotal: true } } } } } },
  } });
  if (!origem) conflito("Origem de custo não encontrada no sítio");
  const [fornecimentos, preparos] = await Promise.all([
    tx.alocacaoFornecimentoColostro.findMany({ where: { origemId: id, ativo: true }, select: { id: true, movimentoId: true, quantidadeLitros: true,
      fornecimento: { select: { data: true, criadoEm: true } } } }),
    tx.origemPreparoColostro.findMany({ where: { origemId: id, ativo: true }, select: { id: true, movimentoId: true, quantidadeLitros: true,
      preparo: { select: { data: true, criadoEm: true } } } }),
  ]);
  const consumos = [
    ...fornecimentos.map(a => ({ chave: `F:${a.id}`, id: a.id, quantidade: a.quantidadeLitros, movimentoId: a.movimentoId, ...a.fornecimento })),
    ...preparos.map(a => ({ chave: `P:${a.id}`, id: a.id, quantidade: a.quantidadeLitros, movimentoId: a.movimentoId, ...a.preparo })),
  ].sort((a, b) => a.data.getTime() - b.data.getTime() || a.criadoEm.getTime() - b.criadoEm.getTime() || a.id.localeCompare(b.id));
  let valorTotal: Prisma.Decimal | null = null;
  const valores = origem.loteColostro?.entrada ? await valoresMovimentosLeiteTx(tx, [origem.loteColostro.entrada.movimentoId, ...consumos.flatMap(a => a.movimentoId ? [a.movimentoId] : [])]) : null;
  if (origem.loteColostro?.entrada) valorTotal = valores?.get(origem.loteColostro.entrada.movimentoId)?.valorTotal ?? null;
  else if (origem.preparo) {
    const parcelas = await Promise.all(origem.preparo.origens.map(async alocacao => {
      const custoPai = await calcularCustoOrigemAtualTx(tx, alocacao.origemId, propriedadeId, cache, proximo);
      return custoPai.alocacoes.get(`P:${alocacao.id}`) ?? null;
    }));
    const insumos = origem.preparo.insumos.map(i => i.movimento.valorTotal);
    const partes = [...parcelas, ...insumos];
    valorTotal = partes.length && partes.every(v => v != null) ? partes.reduce<Prisma.Decimal>((s, v) => s.plus(v!), D(0)) : null;
  }
  let litros = origem.quantidadeLitros, valorSaldo = valorTotal;
  const alocacoes = new Map<string, Prisma.Decimal | null>();
  for (const consumo of consumos) {
    if (consumo.quantidade.gt(litros)) conflito("O custo não pode ser apropriado porque o consumo excede a origem");
    const valor = consumo.movimentoId && valores ? valores.get(consumo.movimentoId)?.valorTotal ?? null
      : valorSaldo == null ? null : consumo.quantidade.eq(litros) ? valorSaldo : valorSaldo.mul(consumo.quantidade).div(litros).toDecimalPlaces(2);
    alocacoes.set(consumo.chave, valor); litros = litros.minus(consumo.quantidade);
    valorSaldo = valorSaldo == null || valor == null ? null : valorSaldo.minus(valor);
  }
  const calculado = { valorTotal, valorSaldo, alocacoes }; cache.set(id, calculado); return calculado;
}
async function valorDisponivelTx(tx: Prisma.TransactionClient, origem: Origem) {
  return (await calcularCustoOrigemAtualTx(tx, origem.id, origem.propriedadeId)).valorSaldo;
}
async function custoRetiradaTx(tx: Prisma.TransactionClient, origem: Origem, quantidade: Prisma.Decimal) {
  const saldo = saldoOrigem(origem).disponivel;
  const valor = await valorDisponivelTx(tx, origem);
  return valor == null ? null : quantidade.eq(saldo) ? valor : valor.mul(quantidade).div(saldo).toDecimalPlaces(2);
}
export async function origemColostroDTO(tx: Prisma.TransactionClient, origem: Origem, options: OpcoesColostroDTO = semValores) {
  const saldo = saldoOrigem(origem), base = dadosOrigem(origem);
  const valor = options.verValores ? await valorDisponivelTx(tx, origem) : null;
  return { id: origem.id, propriedadeId: origem.propriedadeId, versao: origem.versao, status: origem.status,
    tipo: origem.preparoId ? "ENRIQUECIDO" as const : "NAO_ENRIQUECIDO" as const,
    loteColostroId: origem.loteColostroId, preparoId: origem.preparoId, partoId: origem.loteColostro?.partoId ?? null,
    matrizId: origem.loteColostro?.matrizId ?? null, entradaId: origem.loteColostro?.entradaId ?? null,
    data: base.data.toISOString().slice(0, 10), ocorridoEm: base.ocorridoEm?.toISOString() ?? null, horarioEstimado: base.horarioEstimado,
    quantidadeLitros: origem.quantidadeLitros.toString(), saldoLitros: origem.status === "CONFIRMADO" ? saldo.disponivel.toString() : "0",
    livreLitros: origem.status === "CONFIRMADO" ? saldo.livre.toString() : "0", reservadoLitros: origem.status === "CONFIRMADO" ? saldo.reservado.toString() : "0",
    origemFisica: origem.loteColostro?.origemFisicaSnapshot ?? null, brix: brixOrigem(origem),
    custo: { situacao: !options.verValores ? "OCULTO" : valor == null ? "A_APURAR" : "APURADO", valorTotal: options.verValores ? valor?.toFixed(2) ?? null : null },
    unidades: origem.unidades.map(u => ({ id: u.id, codigo: u.codigo, volumeLitros: u.volumeLitros.toString(), status: u.status, versao: u.versao, saldoRestanteLitros: saldoUnidade(origem, u.id).toString(),
      dataCongelamento: u.dataCongelamento.toISOString().slice(0, 10), dataRetirada: u.dataRetirada?.toISOString().slice(0, 10) ?? null, retiradoEm: u.retiradoEm?.toISOString() ?? null })),
    criadoPorId: origem.criadoPorId, criadoEm: origem.criadoEm.toISOString() };
}
export async function consultarOrigemColostro(id: string, propriedadeId: number, options: OpcoesColostroDTO = semValores) {
  return transacaoPecuaria(async tx => {
  const origem = await origemTx(tx, id, propriedadeId);
  const [destinacoes, enriquecimentos] = await Promise.all([
    tx.destinacaoColostro.findMany({where:{origemId:origem.id,propriedadeId:origem.propriedadeId},select:{id:true,data:true,status:true},orderBy:[{data:'desc'},{id:'asc'}]}),
    tx.preparoColostro.findMany({where:{propriedadeId:origem.propriedadeId,origens:{some:{origemId:origem.id}}},select:{id:true,data:true,status:true},orderBy:[{data:'desc'},{id:'asc'}]}),
  ]);
  const historico = {destinacoes:destinacoes.map(d=>({...d,data:d.data.toISOString().slice(0, 10)})),enriquecimentos:enriquecimentos.map(d=>({...d,data:d.data.toISOString().slice(0, 10)}))};
  return {...await origemColostroDTO(tx, origem, options), historico};
  });
}
function retiradaDTO(lote: Prisma.LoteColostroGetPayload<{ include: { origem: true } }>) {
  return { id: lote.id, propriedadeId: lote.propriedadeId, partoId: lote.partoId, matrizId: lote.matrizId,
    data: lote.data.toISOString().slice(0, 10), ocorridoEm: lote.ocorridoEm?.toISOString() ?? null, horarioEstimado: lote.horarioEstimado,
    primeiraRetirada: lote.primeiraRetirada, quantidadeLitros: lote.quantidadeLitros.toString(), medicaoGeralId: lote.medicaoGeralId, entradaId: lote.entradaId,
    origemFisica: lote.origemFisicaSnapshot, status: lote.status, versao: lote.versao, origemId: lote.origem?.id ?? null,
    responsavel: lote.responsavel, observacao: lote.observacao, criadoPorId: lote.criadoPorId, criadoEm: lote.criadoEm.toISOString(),
    motivoEstorno: lote.motivoEstorno, estornadoEm: lote.estornadoEm?.toISOString() ?? null };
}
export async function registrarRetiradaColostro(input: RetiradaColostroInput, usuarioId: number | null) {
  const dados = retiradaColostroSchema.parse(input); usuarioId = autor(usuarioId);
  return transacaoPecuaria(async tx => {
    const resultado = await operacaoIdempotenteTx(tx, dados, usuarioId, "BEZERREIRO_RETIRADA_COLOSTRO", async () => {
      const data = dia(dados.data); conferirData(data);
      const horario = normalizarDetalhesParto(dados, dados.data);
      await conferirSitioLeiteTx(tx, dados.propriedadeId, true);
      const parto = await tx.partoAnimal.findFirst({ where: { id: dados.partoId, status: "VALIDO", propriedadeId: dados.propriedadeId } });
      if (!parto) erro("Selecione um parto válido e existente neste sítio", "partoId");
      await travarAnimais(tx, [parto.animalId]);
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`pec-retirada-parto:${parto.id}`}))`;
      conferirCronologiaColostro(parto, { data, ...horario });
      await conferirAnimalNoFato(tx, parto.animalId, dados.propriedadeId, data);
      if (dados.primeiraRetirada && await tx.loteColostro.findFirst({ where: { partoId: parto.id, primeiraRetirada: true, status: { not: "ESTORNADO" } } }))
        conflito("A primeira retirada deste parto já foi registrada", "primeiraRetirada");
      let medicaoId: string | null = null, entradaId: string | null = null;
      if (dados.producao.tipo === "NOVA") {
        const p = dados.producao.parcela;
        if (p.id || p.versaoEsperada !== 0 || p.natureza !== "COLOSTRO" || !D(p.litros).eq(dados.quantidadeLitros) || p.animaisOrigem.length !== 1 || p.animaisOrigem[0] !== parto.animalId || p.primeiraOrdenhaColostro !== dados.primeiraRetirada)
          erro("A nova parcela deve representar esta matriz, volume e declaração de retirada", "producao");
        const parcelas = await salvarParcelasTx(tx, salvarParcelasOrdenhaSchema.parse({ chave: dados.chave, propriedadeId: dados.propriedadeId, dataOperacional: dados.data, posicaoId: dados.producao.posicaoId, parcelas: [p] }), usuarioId);
        medicaoId = parcelas.parcelas[0].id;
      } else {
        medicaoId = dados.producao.medicaoGeralId ?? null; entradaId = dados.producao.entradaId ?? null;
        if (entradaId) {
          const entrada = await tx.entradaProducaoLeite.findFirst({ where: { id: entradaId, status: "CONFIRMADA", movimento: { propriedadeId: dados.propriedadeId, status: "CONFIRMADO", data } }, include: { movimento: true, vinculosMedicoes: { where: { ativo: true }, include: { medicao: { include: { participante: true } } } } } });
          if (!entrada || !entrada.movimento.quantidade.eq(dados.quantidadeLitros)) erro("A entrada deve corresponder à mesma data, sítio e volume integral da retirada", "producao");
          if (medicaoId && medicaoId !== entrada.medicaoGeralId) erro("A entrada e a medição informadas não correspondem", "producao");
          medicaoId = entrada.medicaoGeralId;
          if (!medicaoId && (!entrada.vinculosMedicoes.length || entrada.vinculosMedicoes.some(v => v.medicao.participante.animalId !== parto.animalId))) erro("A origem individual deve comprovar somente a matriz deste parto", "producao");
          if (!medicaoId && entrada.versaoSessao !== dados.producao.versaoEsperada) conflito("A produção mudou; atualize a consulta", "producao");
        }
      }
      let origemFisica: Prisma.InputJsonValue;
      if (medicaoId) {
        const medicao = await tx.medicaoGeralLeite.findFirst({ where: { id: medicaoId, sessao: { dia: { propriedadeId: dados.propriedadeId, dataOperacional: data } } }, include: { tanque: true, entradasEstoque: { where: { status: "CONFIRMADA" } } } });
        if (!medicao || medicao.natureza !== "COLOSTRO" || !medicao.litros.eq(dados.quantidadeLitros) || JSON.stringify(medicao.animaisOrigem) !== JSON.stringify([parto.animalId])) erro("A parcela deve comprovar o colostro desta matriz, data e volume integral", "producao");
        if (dados.producao.tipo === "EXISTENTE" && medicao.versao !== dados.producao.versaoEsperada) conflito("A medição mudou; atualize a retirada", "producao");
        if (medicao.primeiraOrdenhaColostro !== dados.primeiraRetirada) erro("Preserve a declaração de primeira ordenha da produção", "primeiraRetirada");
        entradaId = medicao.entradasEstoque[0]?.id ?? null;
        origemFisica = json({ medicaoGeralId: medicao.id, versaoMedicao: medicao.versao, tanqueId: medicao.tanqueId,
          tanque: medicao.tanque, recipiente: medicao.recipiente, sessaoId: medicao.sessaoId });
      } else {
        const entrada = await tx.entradaProducaoLeite.findUniqueOrThrow({ where: { id: entradaId! } });
        origemFisica = json({ entradaId, versaoSessao: entrada.versaoSessao, snapshot: entrada.snapshot });
      }
      if (entradaId) {
        const classificacao = await tx.classificacaoEntradaLeite.findFirst({ where: { entradaId }, orderBy: { versao: "desc" } });
        if (classificacao?.natureza !== "COLOSTRO") erro("A produção existente deve estar declarada como colostro", "producao");
      }
      if (await tx.loteColostro.findFirst({ where: { status: { not: "ESTORNADO" }, OR: [...(medicaoId ? [{ medicaoGeralId: medicaoId }] : []), ...(entradaId ? [{ entradaId }] : [])] } }))
        conflito("Esta produção já possui uma retirada ativa; regularize a retirada existente");
      const lote = await tx.loteColostro.create({ data: { propriedadeId: dados.propriedadeId, partoId: parto.id, matrizId: parto.animalId,
        data, ocorridoEm: horario.ocorridoEm, horarioEstimado: horario.horarioEstimado, primeiraRetirada: dados.primeiraRetirada,
        quantidadeLitros: D(dados.quantidadeLitros), medicaoGeralId: medicaoId, entradaId, origemFisicaSnapshot: origemFisica,
        chave: dados.chave, hash: hashDados(dados), responsavel: dados.responsavel, observacao: dados.observacao, criadoPorId: usuarioId } });
      await auditar(tx, { entidade: "LoteColostro", entidadeId: lote.id, animalId: parto.animalId, propriedadeId: dados.propriedadeId, usuarioId, acao: "REGISTRO", depois: lote });
      return { id: lote.id };
    });
    return retiradaDTO(await tx.loteColostro.findFirstOrThrow({ where: { id: resultado.id, propriedadeId: dados.propriedadeId }, include: { origem: true } }));
  });
}
export async function confirmarRetiradaColostro(id: string, input: ConfirmarRetiradaColostroInput, usuarioId: number | null) {
  const dados = confirmarRetiradaColostroSchema.parse(input); usuarioId = autor(usuarioId);
  return transacaoPecuaria(async tx => {
    const resultado = await operacaoIdempotenteTx(tx, { ...dados, id }, usuarioId, "BEZERREIRO_CONFIRMAR_RETIRADA", async () => {
      const lote = await tx.loteColostro.findFirst({ where: { id, propriedadeId: dados.propriedadeId } });
      if (!lote) throw new RebanhoError("NAO_ENCONTRADO", "Retirada não encontrada neste sítio");
      await travarAnimais(tx, [lote.matrizId]);
      await tx.$queryRaw`SELECT id FROM pecuaria."LoteColostro" WHERE id=${id} FOR UPDATE`;
      const atual = await tx.loteColostro.findUniqueOrThrow({ where: { id } }); conferirVersao(atual, dados.versaoEsperada, "RASCUNHO");
      await conferirSitioLeiteTx(tx, dados.propriedadeId, true); conferirData(atual.data);
      const parto = await tx.partoAnimal.findUniqueOrThrow({ where: { id: atual.partoId } });
      if (parto.status !== "VALIDO") conflito("O parto produtor foi anulado");
      await conferirAnimalNoFato(tx, atual.matrizId, dados.propriedadeId, atual.data);
      let entradaId = atual.entradaId;
      if (atual.medicaoGeralId) {
        const medicao = await tx.medicaoGeralLeite.findUniqueOrThrow({ where: { id: atual.medicaoGeralId }, include: { entradasEstoque: { where: { status: "CONFIRMADA" } } } });
        const snapshot = atual.origemFisicaSnapshot as { versaoMedicao: number };
        if (medicao.versao !== snapshot.versaoMedicao || !medicao.litros.eq(atual.quantidadeLitros) || medicao.natureza !== "COLOSTRO") conflito("A medição mudou desde a retirada; concilie antes de confirmar");
        entradaId = medicao.entradasEstoque[0]?.id ?? null;
        if (!entradaId) {
          if (!dados.produtoId) erro("Selecione o produto em litros para confirmar o estoque", "produtoId");
          entradaId = (await confirmarProducaoGeralTx(tx, { chave: randomUUID(), medicaoId: medicao.id, versaoEsperada: medicao.versao, produtoId: dados.produtoId, motivoNatureza: dados.motivoNatureza }, { propriedadeId: dados.propriedadeId, usuarioId })).id;
        }
      }
      if (!entradaId) conflito("A retirada exige entrada de produção comprovada");
      const entrada = await tx.entradaProducaoLeite.findFirst({ where: { id: entradaId, status: "CONFIRMADA", movimento: { propriedadeId: dados.propriedadeId, status: "CONFIRMADO" } }, include: { movimento: { include: { produto: true } } } });
      if (!entrada || !entrada.movimento.quantidade.eq(atual.quantidadeLitros) || (dados.produtoId && dados.produtoId !== entrada.movimento.produtoId)) conflito("A entrada não corresponde ao estoque da retirada");
      if (!entrada.movimento.produto.ativo || entrada.movimento.produto.unidade !== "L" || entrada.movimento.produto.rastrearPartidas) erro("A produção exige produto ativo em litros rastreado pela ordenha");
      await classificarEntradaLeiteTx(tx, { entradaId, natureza: "COLOSTRO", motivo: dados.motivoNatureza }, { propriedadeId: dados.propriedadeId, usuarioId });
      const saldo = (await saldosOrigensLeiteTx(tx, entrada.movimento.produtoId, dados.propriedadeId)).find(s => s.entradaId === entradaId);
      if (!saldo || !saldo.quantidade.eq(atual.quantidadeLitros)) conflito("A produção já possui litros consumidos; concilie antes de confirmar a origem");
      const origem = await tx.origemColostro.create({ data: { propriedadeId: dados.propriedadeId, loteColostroId: atual.id, quantidadeLitros: atual.quantidadeLitros, criadoPorId: usuarioId } });
      const salvo = await tx.loteColostro.update({ where: { id, versao: atual.versao }, data: { entradaId, status: "CONFIRMADO", versao: { increment: 1 } } });
      await auditar(tx, { entidade: "LoteColostro", entidadeId: id, animalId: atual.matrizId, propriedadeId: dados.propriedadeId, usuarioId, acao: "CONFIRMACAO", antes: atual, depois: { ...salvo, origemId: origem.id } });
      return { id };
    });
    return retiradaDTO(await tx.loteColostro.findUniqueOrThrow({ where: { id: resultado.id }, include: { origem: true } }));
  });
}

export async function registrarBrixColostro(id: string, input: BrixColostroInput, usuarioId: number | null) {
  const dados = brixColostroSchema.parse(input); usuarioId = autor(usuarioId);
  return transacaoPecuaria(async tx => {
    const resultado = await operacaoIdempotenteTx(tx, { ...dados, id }, usuarioId, "BEZERREIRO_BRIX_COLOSTRO", async () => {
      await conferirSitioLeiteTx(tx, dados.propriedadeId, true);
      await travarOrigensTx(tx, [id]);
      const origem = await origemTx(tx, id, dados.propriedadeId); conferirVersao(origem, dados.versaoEsperada);
      const data = dia(dados.data); conferirData(data); conferirCronologiaColostro(dadosOrigem(origem), { data });
      await travarTiposExame(tx, [dados.tipoExameId]);
      const formato = await tx.formatoQualidadeLeite.findFirst({ where: { tipoExameId: dados.tipoExameId, tipoExame: { ativo: true } }, include: { tipoExame: true } });
      if (!formato) erro("Selecione um formato de qualidade ativo", "tipoExameId");
      if (hashFormatoExame(formato.tipoExame) !== dados.formatoExameHash) conflito("O formato mudou; confira novamente o resultado", "formatoExameHash");
      const campos = camposExameSchema.parse(formato.tipoExame.campos);
      const campo = campos.find(c => c.codigo === dados.campoBrix);
      if (!campo || campo.tipo !== "NUMERO" || campo.unidade !== "%") erro("O campo de Brix deve ser numérico e ter unidade %", "campoBrix");
      const resultados = validarObservacoesExame(campos, dados.resultados, dados.resultados.length > 0);
      const brix = resultados.find(r => r.campo === campo.codigo)?.valor;
      const configuracao = await tx.configuracaoBezerreiro.findFirst({ where: { propriedadeId: dados.propriedadeId }, orderBy: { versao: "desc" } });
      const limite = configuracao?.brixReferencia ?? D(25);
      avaliarBrixColostro(brix == null ? null : String(brix), limite);
      const politicaBrix = { campo: campo.codigo, limiteInclusivo: limite.toString(), configuracaoId: configuracao?.id ?? null, versaoConfiguracao: configuracao?.versao ?? 0 };
      const amostra = await tx.amostraQualidadeLeite.create({ data: { propriedadeId: dados.propriedadeId, data,
        sujeito: "COLOSTRO", origemColostroId: origem.id, tipoExameId: formato.tipoExameId,
        formatoSnapshot: json({ nome: formato.tipoExame.nome, tipoResultado: "MULTIPLO", versao: formato.tipoExame.versaoFormato, campos, politicaBrix }),
        realizacao: resultados.length ? "REALIZADO" : "COLETA_REGISTRADA", responsavel: dados.responsavel,
        anotacaoOriginal: dados.anotacaoOriginal, criadoPorId: usuarioId,
        resultados: { create: resultados.map(r => ({ ...r, criadoPorId: usuarioId })) } } });
      await tx.origemColostro.update({ where: { id, versao: dados.versaoEsperada }, data: { versao: { increment: 1 } } });
      await auditar(tx, { entidade: "AmostraQualidadeLeite", entidadeId: amostra.id, propriedadeId: dados.propriedadeId, usuarioId, acao: "BRIX_COLOSTRO", depois: { ...amostra, resultados, politicaBrix } });
      return { id: amostra.id };
    });
    const origem = await origemTx(tx, id, dados.propriedadeId);
    return { amostraId: resultado.id, origemId: id, versaoOrigem: origem.versao, brix: brixOrigem(origem) };
  });
}
function conferirBrixDestino(origem: Origem, dados: DestinacaoColostroInput) {
  const brix = brixOrigem(origem, dia(dados.data));
  if (dados.crias.length && brix.situacao !== "ADEQUADO" && !dados.excecaoBrix) erro("Brix pendente ou abaixo da referência exige motivo e responsável pela exceção", "excecaoBrix");
  return { brix, excecaoBrix: dados.excecaoBrix ?? null };
}
async function conferirUnidadeTx(tx: Prisma.TransactionClient, origem: Origem, unidadeId: string, data: Date, ocorridoEm?: Date | null) {
  const unidade = origem.unidades.find(u => u.id === unidadeId && u.status !== "ESTORNADA");
  if (!unidade || unidade.propriedadeId !== origem.propriedadeId || !saldoUnidade(origem, unidadeId).gt(0)) conflito("A unidade não possui remanescente disponível nesta origem", "unidadeId");
  if (data < unidade.dataCongelamento) erro("A retirada não pode anteceder o congelamento", "data");
  if (unidade.dataRetirada && data < unidade.dataRetirada) erro("O uso do remanescente não pode anteceder a retirada da embalagem", "data");
  await tx.unidadeBancoColostro.update({ where: { id: unidade.id, versao: unidade.versao }, data: {
    status: "RETIRADA", ...(unidade.status === "CONGELADA" ? { dataRetirada: data, retiradoEm: ocorridoEm ?? null } : {}), versao: { increment: 1 } } });
  return unidade;
}
type DependenciaColostro = { tipo: 'destinacoes' | 'enriquecimentos' | 'fornecimentos' | 'unidades'; id: string; unidadeCodigo: string | null; animalId?: string | null; brinco?: string | null };
async function dependenciasColostroTx(tx: Prisma.TransactionClient, propriedadeId: number, filtro: { origemId?: string; unidades?: string[] }): Promise<DependenciaColostro[]> {
  if (!filtro.origemId && !filtro.unidades?.length) return [];
  const where = { ativo: true, origem: { propriedadeId }, ...(filtro.origemId ? { origemId: filtro.origemId } : { unidadeId: { in: filtro.unidades! } }) };
  const [fornecimentos, preparos, unidades] = await Promise.all([
    tx.alocacaoFornecimentoColostro.findMany({ where, include: { unidade: { select: { codigo: true } }, fornecimento: { select: { cria: { select: { animalId: true, Animal: { select: { brinco: true } } } } } } } }),
    tx.origemPreparoColostro.findMany({ where, include: { unidade: { select: { codigo: true } } } }),
    filtro.origemId ? tx.unidadeBancoColostro.findMany({ where: { origemId: filtro.origemId, propriedadeId, status: { not: 'ESTORNADA' } } }) : Promise.resolve([]),
  ]);
  const deps: DependenciaColostro[] = [
    ...fornecimentos.map(a => ({ tipo: a.destinacaoId ? 'destinacoes' as const : 'fornecimentos' as const, id: a.destinacaoId ?? a.fornecimentoId, unidadeCodigo: a.unidade?.codigo ?? null, ...(!a.destinacaoId ? {animalId:a.fornecimento?.cria?.animalId??null,brinco:a.fornecimento?.cria?.Animal?.brinco??null} : {}) })),
    ...preparos.map(a => ({ tipo: 'enriquecimentos' as const, id: a.preparoId, unidadeCodigo: a.unidade?.codigo ?? null })),
    ...unidades.map(u => ({ tipo: u.destinacaoId ? 'destinacoes' as const : 'unidades' as const, id: u.destinacaoId ?? u.id, unidadeCodigo: u.codigo })),
  ];
  return deps.filter((d,i) => deps.findIndex(x => x.tipo === d.tipo && x.id === d.id && x.unidadeCodigo === d.unidadeCodigo) === i);
}
async function destinacaoDTO(tx: Prisma.TransactionClient, id: string, propriedadeId: number, options: OpcoesColostroDTO) {
  const destino = await tx.destinacaoColostro.findFirst({ where: { id, propriedadeId }, include: { alocacoes: { include: { fornecimento: { include: { cria: { select: { animalId: true, Animal: { select: { brinco: true, nome: true } } } } } } } }, unidades: true } });
  if (!destino) throw new RebanhoError("NAO_ENCONTRADO", "Destinação não encontrada neste sítio");
  const snapshot = destino.snapshot as { brix?: unknown; excecaoBrix?: unknown; custosOrigens?: Record<string, string | null>; fornecimentosCriados?: string[] } | null;
  const custos = options.verValores && destino.status === "CONFIRMADO" ? await calcularCustoOrigemAtualTx(tx, destino.origemId, propriedadeId) : null;
  const parcelas = destino.alocacoes.filter(a => a.ativo).map(a => custos?.alocacoes.get(`F:${a.id}`) ?? null);
  const valor = !options.verValores ? null : destino.status === "ESTORNADO" ? snapshot?.custosOrigens?.[destino.origemId] ?? null
    : parcelas.every(v => v != null) ? parcelas.reduce<Prisma.Decimal>((s, v) => s.plus(v!), D(0)).toFixed(2) : null;
  return { dependencias: await dependenciasColostroTx(tx, propriedadeId, { unidades: destino.unidades.map(u => u.id) }), id: destino.id, propriedadeId, origemId: destino.origemId, data: destino.data.toISOString().slice(0, 10),
    ocorridoEm: destino.ocorridoEm?.toISOString() ?? null, horarioEstimado: destino.horarioEstimado, versao: destino.versao, status: destino.status,
    responsavel: destino.responsavel, observacao: destino.observacao, brix: snapshot?.brix ?? null, excecaoBrix: snapshot?.excecaoBrix ?? null,
    fornecimentos: destino.alocacoes.map(a => ({ id: a.id, fornecimentoId: a.fornecimentoId, criaId: a.fornecimento.criaId, animalId: a.fornecimento.cria?.animalId ?? null, brinco: a.fornecimento.cria?.Animal?.brinco ?? null, nome: a.fornecimento.cria?.Animal?.nome ?? null,
      quantidadeLitros: a.quantidadeLitros.toString(), unidadeId: a.unidadeId, movimentoId: a.movimentoId, ativo: a.ativo, criadoPelaDestinacao: snapshot?.fornecimentosCriados?.includes(a.fornecimentoId) ?? false })),
    unidades: destino.unidades.map(u => ({ id: u.id, codigo: u.codigo, status: u.status, volumeLitros: u.volumeLitros.toString() })),
    custo: { situacao: !options.verValores ? "OCULTO" : valor == null ? "A_APURAR" : "APURADO", valorTotal: options.verValores ? valor : null },
    criadoPorId: destino.criadoPorId, criadoEm: destino.criadoEm?.toISOString() ?? null, motivoEstorno: destino.motivoEstorno, estornadoEm: destino.estornadoEm?.toISOString() ?? null };
}
export async function consultarDestinacaoColostro(id: string, propriedadeId: number, options: OpcoesColostroDTO = semValores) {
  return transacaoPecuaria(tx => destinacaoDTO(tx, id, propriedadeId, options));
}
export async function destinarColostro(id: string, input: DestinacaoColostroInput, usuarioId: number | null, options: OpcoesColostroDTO = semValores) {
  const dados = destinacaoColostroSchema.parse(input); usuarioId = autor(usuarioId);
  return transacaoPecuaria(async tx => {
    const resultado = await operacaoIdempotenteTx(tx, { ...dados, id }, usuarioId, "BEZERREIRO_DESTINAR_COLOSTRO", async () => {
      await conferirSitioLeiteTx(tx, dados.propriedadeId, true);
      const data = dia(dados.data); conferirData(data);
      await exigirPeriodoAberto(tx, dados.propriedadeId, data);
      const horario = normalizarDetalhesParto(dados, dados.data);
      // Animais antes de origens e produtos: mesma ordem dos fatos comuns de reprodução.
      const referencias = await tx.criaParto.findMany({ where: { id: { in: dados.crias.map(c => c.criaId) } } });
      await travarAnimais(tx, referencias.flatMap(c => c.animalId ? [c.animalId] : []));
      await travarOrigensTx(tx, [id]);
      const origem = await origemTx(tx, id, dados.propriedadeId); conferirVersao(origem, dados.versaoEsperada);
      conferirCronologiaColostro(dadosOrigem(origem), { data, ...horario });
      await conferirSaldoCompartilhadoTx(tx, origem, data);
      const saldo = saldoOrigem(origem);
      conciliarDestinacaoColostro(dados.unidadeId ? saldoUnidade(origem, dados.unidadeId) : saldo.livre, dados.crias.map(c => c.quantidadeLitros), dados.unidades.length);
      if (dados.unidadeId) await conferirUnidadeTx(tx, origem, dados.unidadeId, data, horario.ocorridoEm);
      const qualidade = conferirBrixDestino(origem, dados);
      const custo = await custoRetiradaTx(tx, origem, dados.crias.reduce((s, c) => s.plus(c.quantidadeLitros), D(0)));
      const criado = await tx.destinacaoColostro.create({ data: { propriedadeId: dados.propriedadeId, origemId: origem.id, data,
        ocorridoEm: horario.ocorridoEm, horarioEstimado: horario.horarioEstimado, chave: dados.chave, hash: hashDados(dados),
        responsavel: dados.responsavel, observacao: dados.observacao, criadoPorId: usuarioId } });
      const fornecimentosCriados: string[] = [];
      for (const cria of dados.crias) {
        const contexto = await conferirCriaTx(tx, cria.criaId, dados.propriedadeId, data, horario);
        let fornecimentoId = cria.fornecimentoColostroId;
        if (fornecimentoId) {
          const fornecimento = await tx.fornecimentoColostro.findFirst({ where: { id: fornecimentoId, criaId: cria.criaId, propriedadeId: dados.propriedadeId, status: "VALIDO" } });
          if (!fornecimento || !fornecimento.quantidadeLitros?.eq(cria.quantidadeLitros) || fornecimento.data.getTime() !== data.getTime()
            || fornecimento.ocorridoEm?.getTime() !== horario.ocorridoEm?.getTime() || fornecimento.horarioEstimado !== horario.horarioEstimado) erro("O fornecimento existente deve corresponder à cria, data, horário e volume declarados", "crias");
          if (await tx.alocacaoFornecimentoColostro.findFirst({ where: { fornecimentoId, ativo: true } })) conflito("O fornecimento já possui origem ativa no Bezerreiro", "crias");
          if (await tx.parcelaDestinoLeite.findFirst({ where: { fornecimentoColostroId: fornecimentoId, ativo: true } })) conflito("O fornecimento já tem origem de estoque ativa", "crias");
        } else {
          fornecimentoId = (await registrarColostroTx(tx, { chave: randomUUID(), propriedadeId: dados.propriedadeId, criaId: cria.criaId,
            data: dados.data, ocorridoEm: dados.ocorridoEm, horarioEstimado: dados.horarioEstimado, quantidade: cria.quantidadeLitros,
            unidade: "L", tipo: cria.tipo, forma: cria.forma, responsavel: dados.responsavel, observacao: dados.observacao }, usuarioId)).id;
          fornecimentosCriados.push(fornecimentoId);
        }
        const movimento = await baixarOrigemTx(tx, origem, D(cria.quantidadeLitros), data, usuarioId, `Colostro à cria ${contexto.animalId}; destino ${criado.id}`);
        await tx.alocacaoFornecimentoColostro.create({ data: { destinacaoId: criado.id, fornecimentoId, origemId: origem.id,
          unidadeId: dados.unidadeId ?? null, quantidadeLitros: D(cria.quantidadeLitros), movimentoId: movimento?.id ?? null } });
        await vincularFornecimentoColostragemTx(tx, { animalId: contexto.animalId, criaId: cria.criaId, fornecimentoId,
          propriedadeId: dados.propriedadeId, data, motivoExcecao: dados.excecaoBrix?.motivo }, usuarioId);
        await auditar(tx, { entidade: "FornecimentoColostro", entidadeId: fornecimentoId, animalId: contexto.animalId, propriedadeId: dados.propriedadeId, usuarioId, acao: "ORIGEM_VINCULADA", depois: { destinacaoId: criado.id, origemId: origem.id, quantidadeLitros: cria.quantidadeLitros } });
      }
      for (const unidade of dados.unidades) await tx.unidadeBancoColostro.create({ data: { destinacaoId: criado.id, origemId: origem.id,
        propriedadeId: dados.propriedadeId, codigo: unidade.codigo, volumeLitros: D(2), dataCongelamento: data,
        chave: `${dados.chave}:${unidade.codigo}`, criadoPorId: usuarioId } });
      await tx.destinacaoColostro.update({ where: { id: criado.id }, data: { snapshot: json({ ...qualidade, custosOrigens: { [id]: custo?.toFixed(2) ?? null }, fornecimentosCriados }) } });
      await tx.origemColostro.update({ where: { id, versao: dados.versaoEsperada }, data: { versao: { increment: 1 } } });
      await auditar(tx, { entidade: "DestinacaoColostro", entidadeId: criado.id, propriedadeId: dados.propriedadeId, usuarioId, acao: "CONFIRMACAO", depois: { ...criado, ...qualidade, crias: dados.crias, unidades: dados.unidades } });
      return { id: criado.id };
    });
    return destinacaoDTO(tx, resultado.id, dados.propriedadeId, options);
  });
}

async function preparoDTO(tx: Prisma.TransactionClient, id: string, propriedadeId: number, options: OpcoesColostroDTO) {
  const preparo = await tx.preparoColostro.findFirst({ where: { id, propriedadeId }, include: { origens: { include: { unidade: { select: { codigo: true } } } }, insumos: { include: { produto: { select: { nome: true } }, movimento: { select: { valorTotal: true } } } }, origemResultado: true } });
  if (!preparo) throw new RebanhoError("NAO_ENCONTRADO", "Enriquecimento não encontrado neste sítio");
  const custoAtual = options.verValores && preparo.origemResultado ? preparo.status === "ESTORNADO"
    ? { valorTotal: preparo.origemResultado.valorTotal } : await calcularCustoOrigemAtualTx(tx, preparo.origemResultado.id, propriedadeId) : null;
  return { dependencias: preparo.origemResultado ? await dependenciasColostroTx(tx, propriedadeId, { origemId: preparo.origemResultado.id }) : [], id: preparo.id, propriedadeId, data: preparo.data.toISOString().slice(0, 10), ocorridoEm: preparo.ocorridoEm?.toISOString() ?? null,
    horarioEstimado: (preparo.snapshot as { horarioEstimado?: boolean } | null)?.horarioEstimado ?? false,
    volumeFinalLitros: preparo.volumeFinalLitros.toString(), status: preparo.status, versao: preparo.versao,
    responsavel: preparo.responsavel, observacao: preparo.observacao, origemResultadoId: preparo.origemResultado?.id ?? null,
    origens: preparo.origens.map(a => ({ id: a.id, origemId: a.origemId, unidadeId: a.unidadeId, unidadeCodigo: a.unidade?.codigo ?? null, quantidadeLitros: a.quantidadeLitros.toString(), ativo: a.ativo, movimentoId: a.movimentoId })),
    insumos: preparo.insumos.map(i => ({ id: i.id, produtoId: i.produtoId, produtoNome: i.produto.nome, partidaId: i.partidaId, quantidade: i.quantidade.toString(), unidade: i.unidade, movimentoId: i.movimentoId,
      valorTotal: options.verValores ? i.movimento.valorTotal?.toFixed(2) ?? null : null })),
    custo: { situacao: !options.verValores ? "OCULTO" : custoAtual?.valorTotal == null ? "A_APURAR" : "APURADO", valorTotal: options.verValores ? custoAtual?.valorTotal?.toFixed(2) ?? null : null },
    criadoPorId: preparo.criadoPorId, criadoEm: preparo.criadoEm.toISOString(), motivoEstorno: preparo.motivoEstorno, estornadoEm: preparo.estornadoEm?.toISOString() ?? null };
}
export async function consultarPreparoColostro(id: string, propriedadeId: number, options: OpcoesColostroDTO = semValores) {
  return transacaoPecuaria(tx => preparoDTO(tx, id, propriedadeId, options));
}
export async function enriquecerColostro(input: EnriquecimentoColostroInput, usuarioId: number | null, options: OpcoesColostroDTO = semValores) {
  const dados = enriquecimentoColostroSchema.parse(input); usuarioId = autor(usuarioId);
  return transacaoPecuaria(async tx => {
    const resultado = await operacaoIdempotenteTx(tx, dados, usuarioId, "BEZERREIRO_ENRIQUECER_COLOSTRO", async () => {
      const data = dia(dados.data); conferirData(data); const horario = normalizarDetalhesParto(dados, dados.data);
      await conferirSitioLeiteTx(tx, dados.propriedadeId, true);
      await travarOrigensTx(tx, dados.origens.map(o => o.origemId));
      const origens = await Promise.all(dados.origens.map(o => origemTx(tx, o.origemId, dados.propriedadeId)));
      const entradas = await tx.entradaProducaoLeite.findMany({ where: { id: { in: origens.flatMap(o => o.loteColostro?.entradaId ? [o.loteColostro.entradaId] : []) } }, include: { movimento: true } });
      // Todos produtos antes da primeira baixa; a ordem é comum com os demais gravadores de estoque.
      await travarValorizacaoTx(tx, [...dados.insumos.map(i => i.produtoId), ...entradas.map(e => e.movimento.produtoId)]);
      const custosOrigens: Record<string, string | null> = {};
      for (const entrada of dados.origens) {
        const origem = origens.find(o => o.id === entrada.origemId)!;
        conferirVersao(origem, entrada.versaoEsperada); conferirCronologiaColostro(dadosOrigem(origem), { data, ...horario });
        if (origem.preparoId) erro("Enriquecer exige origem não enriquecida registrada", "origens");
        await conferirSaldoCompartilhadoTx(tx, origem, data);
        const saldo = saldoOrigem(origem);
        if (D(entrada.quantidadeLitros).gt(entrada.unidadeId ? saldoUnidade(origem, entrada.unidadeId) : saldo.livre)) conflito("Volume de enriquecimento excede o saldo livre da origem", "origens");
        if (!(origem.id in custosOrigens)) custosOrigens[origem.id] = (await custoRetiradaTx(tx, origem, dados.origens.filter(o => o.origemId === origem.id).reduce((s, o) => s.plus(o.quantidadeLitros), D(0))))?.toFixed(2) ?? null;
        if (entrada.unidadeId) await conferirUnidadeTx(tx, origem, entrada.unidadeId, data, horario.ocorridoEm);
      }
      const preparo = await tx.preparoColostro.create({ data: { propriedadeId: dados.propriedadeId, data, ocorridoEm: horario.ocorridoEm,
        volumeFinalLitros: D(dados.volumeFinalLitros), chave: dados.chave, hash: hashDados(dados), responsavel: dados.responsavel,
        observacao: dados.observacao, snapshot: json({ custosOrigens, horarioEstimado: horario.horarioEstimado, insumosInformados: dados.insumos }), criadoPorId: usuarioId } });
      const atualizadas = new Set<string>();
      for (const entrada of dados.origens) {
        const origem = origens.find(o => o.id === entrada.origemId)!;
        const movimento = await baixarOrigemTx(tx, origem, D(entrada.quantidadeLitros), data, usuarioId, `Origem consumida no enriquecimento ${preparo.id}`);
        await tx.origemPreparoColostro.create({ data: { preparoId: preparo.id, origemId: origem.id, unidadeId: entrada.unidadeId ?? null,
          quantidadeLitros: D(entrada.quantidadeLitros), movimentoId: movimento?.id ?? null } });
        if (!atualizadas.has(origem.id)) {
          await tx.origemColostro.update({ where: { id: origem.id, versao: entrada.versaoEsperada }, data: { versao: { increment: 1 } } });
          atualizadas.add(origem.id);
        }
      }
      let custoInsumos = D(0);
      for (const insumo of dados.insumos) {
        const produto = await tx.produto.findFirst({ where: { id: insumo.produtoId, ativo: true } });
        if (!produto) erro("Insumo não encontrado ou inativo", "insumos");
        let quantidade: Prisma.Decimal;
        try { quantidade = converterQuantidade(insumo.quantidade, insumo.unidade, produto.unidade); }
        catch { erro("Unidade do insumo não é compatível com a unidade de estoque", "insumos"); }
        const consumo = await consumirEstoqueTx(tx, { produto, propriedadeId: dados.propriedadeId, quantidade,
          campoQuantidade: "quantidade", data, instante: horario.ocorridoEm ?? undefined, partidaId: insumo.partidaId,
          cienciaValidadeDesconhecida: insumo.cienciaValidadeDesconhecida, documentacaoExcepcional: insumo.documentacaoExcepcional,
          motivoDocumentacaoExcepcional: insumo.motivoDocumentacaoExcepcional, origem: "NUTRICAO", usuarioId,
          observacao: `Insumo do enriquecimento de colostro ${preparo.id}` });
        if (!consumo.movimentoEstoqueId) conflito("O insumo não gerou consumo comprovado");
        custoInsumos = custoInsumos.plus(consumo.valorProdutoAtribuido);
        await tx.insumoPreparoColostro.create({ data: { preparoId: preparo.id, produtoId: produto.id, partidaId: consumo.partida?.id ?? null,
          movimentoId: consumo.movimentoEstoqueId, quantidade, unidade: produto.unidade } });
      }
      const conhecido = Object.values(custosOrigens).every(v => v != null);
      const valorTotal = conhecido ? Object.values(custosOrigens).reduce<Prisma.Decimal>((s, v) => s.plus(v!), custoInsumos) : null;
      const origemResultado = await tx.origemColostro.create({ data: { propriedadeId: dados.propriedadeId, preparoId: preparo.id,
        quantidadeLitros: D(dados.volumeFinalLitros), valorTotal, snapshot: json({ custoInsumos: custoInsumos.toFixed(2), custosOrigens }), criadoPorId: usuarioId } });
      await auditar(tx, { entidade: "PreparoColostro", entidadeId: preparo.id, propriedadeId: dados.propriedadeId, usuarioId, acao: "CONFIRMACAO", depois: { ...preparo, origemResultadoId: origemResultado.id, origens: dados.origens, insumos: dados.insumos } });
      return { id: preparo.id };
    });
    return preparoDTO(tx, resultado.id, dados.propriedadeId, options);
  });
}

export async function estornarDestinacaoColostro(id: string, input: EstornoColostroInput, usuarioId: number | null, options: OpcoesColostroDTO = semValores) {
  const dados = estornoColostroSchema.parse(input); usuarioId = autor(usuarioId);
  return transacaoPecuaria(async tx => {
    const resultado = await operacaoIdempotenteTx(tx, { ...dados, id }, usuarioId, "BEZERREIRO_ESTORNAR_DESTINACAO", async () => {
      const referencia = await tx.destinacaoColostro.findFirst({ where: { id, propriedadeId: dados.propriedadeId }, include: { alocacoes: { include: { fornecimento: { include: { cria: true } } } } } });
      if (!referencia) throw new RebanhoError("NAO_ENCONTRADO", "Destinação não encontrada neste sítio");
      await travarAnimais(tx, referencia.alocacoes.flatMap(a => a.fornecimento.cria.animalId ? [a.fornecimento.cria.animalId] : []));
      await travarOrigensTx(tx, [referencia.origemId]);
      const atual = await tx.destinacaoColostro.findUniqueOrThrow({ where: { id }, include: { alocacoes: { include: { fornecimento: true } }, unidades: true } });
      conferirVersao(atual, dados.versaoEsperada);
      const unidades = atual.unidades.map(u => u.id);
      if (unidades.length && (await tx.alocacaoFornecimentoColostro.findFirst({ where: { unidadeId: { in: unidades }, ativo: true } })
        || await tx.origemPreparoColostro.findFirst({ where: { unidadeId: { in: unidades }, ativo: true } })))
        conflito("Uma unidade desta destinação possui consumidores; regularize-os antes de estornar o congelamento");
      await exigirPeriodoAberto(tx, dados.propriedadeId, atual.data); await exigirPeriodoAberto(tx, dados.propriedadeId, hojeFazendaDate());
      for (const alocacao of atual.alocacoes) if (alocacao.movimentoId) await estornarBaixaLeiteTx(tx, { movimentoId: alocacao.movimentoId, propriedadeId: dados.propriedadeId, usuarioId, motivo: dados.motivo, permitirOrigemColostro: true });
      await tx.alocacaoFornecimentoColostro.updateMany({ where: { destinacaoId: id, ativo: true }, data: { ativo: false } });
      await tx.unidadeBancoColostro.updateMany({ where: { destinacaoId: id }, data: { status: "ESTORNADA", versao: { increment: 1 } } });
      const snapshot = atual.snapshot as { fornecimentosCriados?: string[] } | null;
      for (const alocacao of atual.alocacoes) {
        if (snapshot?.fornecimentosCriados?.includes(alocacao.fornecimentoId)) await corrigirColostroTx(tx, alocacao.fornecimentoId, {
          chave: randomUUID(), propriedadeId: dados.propriedadeId, versaoEsperada: alocacao.fornecimento.versao, motivo: dados.motivo, anular: true }, usuarioId);
        if (alocacao.unidadeId) await tx.unidadeBancoColostro.update({ where: { id: alocacao.unidadeId }, data: { versao: { increment: 1 } } });
      }
      const salvo = await tx.destinacaoColostro.update({ where: { id, versao: dados.versaoEsperada }, data: { status: "ESTORNADO", versao: { increment: 1 }, estornadoEm: new Date(), estornadoPorId: usuarioId, motivoEstorno: dados.motivo } });
      await tx.origemColostro.update({ where: { id: atual.origemId }, data: { versao: { increment: 1 } } });
      await auditar(tx, { entidade: "DestinacaoColostro", entidadeId: id, propriedadeId: dados.propriedadeId, usuarioId, acao: "ESTORNO", antes: atual, depois: salvo });
      return { id };
    });
    return destinacaoDTO(tx, resultado.id, dados.propriedadeId, options);
  });
}
async function estornarInsumoTx(tx: Prisma.TransactionClient, id: string, propriedadeId: number, usuarioId: number | null, motivo: string) {
  const original = await tx.movimentoEstoque.findFirst({ where: { id, propriedadeId }, include: { alocacaoPartidaEstoques: true } });
  if (!original || original.status !== "CONFIRMADO" || original.tipo !== "SAIDA" || original.reversaoDeId) conflito("Consumo de insumo alterado ou estornado; concilie o histórico");
  await travarValorizacaoTx(tx, [original.produtoId]);
  await exigirPeriodoAberto(tx, propriedadeId, original.data); await exigirPeriodoAberto(tx, propriedadeId, hojeFazendaDate());
  const inverso = await tx.movimentoEstoque.create({ data: { produtoId: original.produtoId, propriedadeId, tipo: "ENTRADA", origem: "NUTRICAO",
    data: hojeFazendaDate(), quantidade: original.quantidade, custoUnitario: original.custoUnitario, valorTotal: original.valorTotal,
    reversaoDeId: id, criadoPorId: usuarioId, observacao: motivo,
    alocacaoPartidaEstoques: { create: original.alocacaoPartidaEstoques.map(a => ({ partidaId: a.partidaId, quantidade: a.quantidade })) } } });
  await registrarInversoValorizadoTx(tx, id, inverso.id);
  await tx.movimentoEstoque.update({ where: { id }, data: { status: "REVERTIDO" } });
  return inverso;
}
export async function estornarPreparoColostro(id: string, input: EstornoColostroInput, usuarioId: number | null, options: OpcoesColostroDTO = semValores) {
  const dados = estornoColostroSchema.parse(input); usuarioId = autor(usuarioId);
  return transacaoPecuaria(async tx => {
    const resultado = await operacaoIdempotenteTx(tx, { ...dados, id }, usuarioId, "BEZERREIRO_ESTORNAR_PREPARO", async () => {
      const referencia = await tx.preparoColostro.findFirst({ where: { id, propriedadeId: dados.propriedadeId }, include: { origens: true, origemResultado: true } });
      if (!referencia?.origemResultado) throw new RebanhoError("NAO_ENCONTRADO", "Enriquecimento não encontrado neste sítio");
      await travarOrigensTx(tx, [referencia.origemResultado.id, ...referencia.origens.map(o => o.origemId)]);
      const atual = await tx.preparoColostro.findUniqueOrThrow({ where: { id }, include: { origens: true, insumos: true } }); conferirVersao(atual, dados.versaoEsperada);
      const origem = await origemTx(tx, referencia.origemResultado.id, dados.propriedadeId);
      if (origem.fornecimentos.length || origem.preparos.length || origem.unidades.some(u => u.status !== "ESTORNADA")) conflito("O enriquecimento tem destinos ou unidades; regularize-os antes de estornar");
      await exigirPeriodoAberto(tx, dados.propriedadeId, atual.data);
      const movimentos = await tx.movimentoEstoque.findMany({ where: { id: { in: [...atual.origens.flatMap(o => o.movimentoId ? [o.movimentoId] : []), ...atual.insumos.map(i => i.movimentoId)] } }, select: { produtoId: true } });
      await travarValorizacaoTx(tx, movimentos.map(m => m.produtoId));
      for (const alocacao of atual.origens) {
        if (alocacao.movimentoId) await estornarBaixaLeiteTx(tx, { movimentoId: alocacao.movimentoId, propriedadeId: dados.propriedadeId, usuarioId, motivo: dados.motivo, permitirOrigemColostro: true });
        if (alocacao.unidadeId) await tx.unidadeBancoColostro.update({ where: { id: alocacao.unidadeId }, data: { versao: { increment: 1 } } });
        await tx.origemColostro.update({ where: { id: alocacao.origemId }, data: { versao: { increment: 1 } } });
      }
      for (const insumo of atual.insumos) await estornarInsumoTx(tx, insumo.movimentoId, dados.propriedadeId, usuarioId, dados.motivo);
      await tx.origemPreparoColostro.updateMany({ where: { preparoId: id, ativo: true }, data: { ativo: false } });
      await tx.origemColostro.update({ where: { id: origem.id }, data: { status: "ESTORNADO", versao: { increment: 1 } } });
      const salvo = await tx.preparoColostro.update({ where: { id, versao: dados.versaoEsperada }, data: { status: "ESTORNADO", versao: { increment: 1 }, estornadoEm: new Date(), estornadoPorId: usuarioId, motivoEstorno: dados.motivo } });
      await auditar(tx, { entidade: "PreparoColostro", entidadeId: id, propriedadeId: dados.propriedadeId, usuarioId, acao: "ESTORNO", antes: atual, depois: salvo });
      return { id };
    });
    return preparoDTO(tx, resultado.id, dados.propriedadeId, options);
  });
}
export async function estornarRetiradaColostro(id: string, input: EstornoColostroInput, usuarioId: number | null) {
  const dados = estornoColostroSchema.parse(input); usuarioId = autor(usuarioId);
  return transacaoPecuaria(async tx => {
    const resultado = await operacaoIdempotenteTx(tx, { ...dados, id }, usuarioId, "BEZERREIRO_ESTORNAR_RETIRADA", async () => {
      const ref = await tx.loteColostro.findFirst({ where: { id, propriedadeId: dados.propriedadeId }, include: { origem: true } });
      if (!ref) throw new RebanhoError("NAO_ENCONTRADO", "Retirada não encontrada neste sítio");
      await travarAnimais(tx, [ref.matrizId]); if (ref.origem) await travarOrigensTx(tx, [ref.origem.id]);
      await tx.$queryRaw`SELECT id FROM pecuaria."LoteColostro" WHERE id=${id} FOR UPDATE`;
      const atual = await tx.loteColostro.findUniqueOrThrow({ where: { id } });
      if (atual.status === "ESTORNADO" || atual.versao !== dados.versaoEsperada) conflito("A retirada mudou ou foi estornada; atualize a consulta");
      if (ref.origem) {
        const origem = await origemTx(tx, ref.origem.id, dados.propriedadeId);
        if (origem.fornecimentos.length || origem.preparos.length || origem.unidades.some(u => u.status !== "ESTORNADA")) conflito("A retirada possui consumidores ou unidades; regularize-os antes de estornar");
        await tx.origemColostro.update({ where: { id: origem.id }, data: { status: "ESTORNADO", versao: { increment: 1 } } });
      }
      const salvo = await tx.loteColostro.update({ where: { id, versao: dados.versaoEsperada }, data: { status: "ESTORNADO", versao: { increment: 1 }, estornadoEm: new Date(), estornadoPorId: usuarioId, motivoEstorno: dados.motivo } });
      // O vínculo e a produção permanecem: uma retirada anulada não apaga litros já aferidos.
      await auditar(tx, { entidade: "LoteColostro", entidadeId: id, animalId: ref.matrizId, propriedadeId: dados.propriedadeId, usuarioId, acao: "ESTORNO", antes: atual, depois: salvo });
      return { id };
    });
    return retiradaDTO(await tx.loteColostro.findUniqueOrThrow({ where: { id: resultado.id }, include: { origem: true } }));
  });
}
export async function listarRetiradasColostro(propriedadeId: number, filtro: ConsultaColostro) {
  const dados = consultaColostroSchema.parse(filtro);
  const where: Prisma.LoteColostroWhereInput = { propriedadeId,
    ...(dados.partoId ? { partoId: dados.partoId } : {}), ...(dados.matrizId ? { matrizId: dados.matrizId } : {}),
    ...(dados.criaId ? { origem: { fornecimentos: { some: { fornecimento: { criaId: dados.criaId } } } } } : {}),
    ...(!dados.incluirEstornados ? { status: { not: "ESTORNADO" } } : {}),
    ...(dados.inicio || dados.fim ? { data: { ...(dados.inicio ? { gte: dia(dados.inicio) } : {}), ...(dados.fim ? { lte: dia(dados.fim) } : {}) } } : {}) };
  return transacaoPecuaria(async tx => {
    const [itens, total] = await Promise.all([tx.loteColostro.findMany({ where, include: { origem: true }, orderBy: [{ data: "desc" }, { criadoEm: "desc" }, { id: "desc" }], skip: (dados.pagina - 1) * dados.tamanho, take: dados.tamanho }), tx.loteColostro.count({ where })]);
    return { itens: itens.map(retiradaDTO), total, pagina: dados.pagina, tamanho: dados.tamanho };
  });
}
export async function listarOrigensColostro(propriedadeId: number, filtro: ConsultaColostro, options: OpcoesColostroDTO = semValores) {
  const dados = consultaColostroSchema.parse(filtro);
  const data = dados.inicio || dados.fim ? { ...(dados.inicio ? { gte: dia(dados.inicio) } : {}), ...(dados.fim ? { lte: dia(dados.fim) } : {}) } : undefined;
  const where: Prisma.OrigemColostroWhereInput = { propriedadeId,
    ...(dados.tipo === "ENRIQUECIDO" ? { preparoId: { not: null } } : dados.tipo === "NAO_ENRIQUECIDO" ? { preparoId: null } : {}),
    ...(!dados.incluirEstornados ? { status: "CONFIRMADO" } : {}),
    ...(dados.partoId || dados.matrizId ? { loteColostro: { ...(dados.partoId ? { partoId: dados.partoId } : {}), ...(dados.matrizId ? { matrizId: dados.matrizId } : {}) } } : {}),
    ...(dados.criaId ? { fornecimentos: { some: { fornecimento: { criaId: dados.criaId } } } } : {}),
    ...(data ? { OR: [{ loteColostro: { data } }, { preparo: { data } }] } : {}) };
  return transacaoPecuaria(async tx => {
    const [itens, total] = await Promise.all([tx.origemColostro.findMany({ where, include: incluirOrigem, orderBy: [{ criadoEm: "desc" }, { id: "desc" }], skip: (dados.pagina - 1) * dados.tamanho, take: dados.tamanho }), tx.origemColostro.count({ where })]);
    return { itens: await Promise.all(itens.map(o => origemColostroDTO(tx, o, options))), total, pagina: dados.pagina, tamanho: dados.tamanho };
  });
}
export type OrigemColostroDTO = Awaited<ReturnType<typeof consultarOrigemColostro>>;
export type RetiradaColostroDTO = Awaited<ReturnType<typeof registrarRetiradaColostro>>;
export type DestinacaoColostroDTO = Awaited<ReturnType<typeof consultarDestinacaoColostro>>;
export type PreparoColostroDTO = Awaited<ReturnType<typeof consultarPreparoColostro>>;

/** Custo efetivo do fato: preço comercial não entra neste cálculo. */
export async function consultarCustosColostroTx(tx: Prisma.TransactionClient, propriedadeId: number, filtro: { de?: string; ate?: string; animalIds?: string[] }) {
  const alocacoes = await tx.alocacaoFornecimentoColostro.findMany({ where: { ativo: true, origem: { propriedadeId },
    fornecimento: { propriedadeId, status: "VALIDO", ...(filtro.de || filtro.ate ? { data: { ...(filtro.de ? { gte: dia(filtro.de) } : {}), ...(filtro.ate ? { lte: dia(filtro.ate) } : {}) } } : {}),
      ...(filtro.animalIds ? { cria: { animalId: { in: filtro.animalIds } } } : {}) } },
    include: { fornecimento: { include: { cria: true } }, destinacao: { include: { alocacoes: { where: { ativo: true }, orderBy: { id: "asc" } } } } }, orderBy: { id: "asc" } });
  const cache = new Map<string, CustoOrigemAtual>();
  for (const origemId of new Set(alocacoes.map(a => a.origemId))) await calcularCustoOrigemAtualTx(tx, origemId, propriedadeId, cache);
  return alocacoes.flatMap(a => a.fornecimento.cria.animalId ? [{ animalId: a.fornecimento.cria.animalId, data: a.fornecimento.data.toISOString().slice(0, 10),
    quantidadeLitros: a.quantidadeLitros, valorTotal: cache.get(a.origemId)?.alocacoes.get(`F:${a.id}`) ?? null,
    fornecimentoId: a.fornecimentoId, origemId: a.origemId }] : []);
}

/** Somente parcelas integrais, segregadas e ainda sem retirada vinculada. */
export async function listarProducoesRetiradaColostro(propriedadeId: number, input: { partoId: string; data: string }) {
  const { z } = await import("zod");
  const dados = z.object({ partoId: z.string().uuid(), data: z.string().date() }).strict().parse(input);
  return transacaoPecuaria(async tx => {
    const parto = await tx.partoAnimal.findFirst({ where: { id: dados.partoId, propriedadeId, status: "VALIDO" } });
    if (!parto) throw new RebanhoError("NAO_ENCONTRADO", "Parto não encontrado neste sítio");
    const data = dia(dados.data); conferirCronologiaColostro(parto, { data });
    await conferirAnimalNoFato(tx, parto.animalId, propriedadeId, data);
    const medicoes = await tx.medicaoGeralLeite.findMany({ where: { natureza: "COLOSTRO", lotesColostro: { none: { status: { not: "ESTORNADO" } } },
      animaisOrigem: { equals: [parto.animalId] }, sessao: { dia: { propriedadeId, dataOperacional: data } } },
      include: { tanque: true, sessao: { select: { nome: true } }, entradasEstoque: { where: { status: "CONFIRMADA" }, include: { movimento: true } } }, orderBy: { criadoEm: "asc" } });
    const individuais = await tx.entradaProducaoLeite.findMany({ where: { medicaoGeralId: null, lotesColostro: { none: { status: { not: "ESTORNADO" } } }, status: "CONFIRMADA",
      movimento: { propriedadeId, data, status: "CONFIRMADO" }, vinculosMedicoes: { some: { ativo: true, medicao: { participante: { animalId: parto.animalId } } } } },
      include: { movimento: true, sessao: { select: { nome: true } }, vinculosMedicoes: { where: { ativo: true }, include: { medicao: { include: { participante: true } } } }, classificacoes: { orderBy: { versao: "desc" }, take: 1 } } });
    const produtos = [...new Set([...medicoes.flatMap(m => m.entradasEstoque.map(e => e.movimento.produtoId)), ...individuais.map(e => e.movimento.produtoId)])];
    const saldos = (await Promise.all(produtos.map(produto => saldosOrigensLeiteTx(tx, produto, propriedadeId)))).flat();
    return { partoId: parto.id, matrizId: parto.animalId, data: dados.data,
      itens: [
        ...medicoes.filter(m => !m.entradasEstoque.length || m.entradasEstoque.every(e => saldos.some(s => s.entradaId === e.id && s.quantidade.eq(m.litros)))).map(m => ({
          tipo: "GERAL" as const, medicaoGeralId: m.id, entradaId: m.entradasEstoque[0]?.id ?? null, versaoEsperada: m.versao,
          quantidadeLitros: m.litros.toString(), nomeOrdenha: m.sessao.nome, primeiraRetirada: m.primeiraOrdenhaColostro,
          tanqueId: m.tanqueId, tanqueNome: m.tanque?.nome ?? null, recipiente: m.recipiente, estoqueConfirmado: m.entradasEstoque.length > 0 })),
        ...individuais.filter(e => e.vinculosMedicoes.every(v => v.medicao.participante.animalId === parto.animalId) && e.classificacoes[0]?.natureza === "COLOSTRO"
          && saldos.some(s => s.entradaId === e.id && s.quantidade.eq(e.movimento.quantidade))).map(e => ({
          tipo: "INDIVIDUAL" as const, medicaoGeralId: null, entradaId: e.id, versaoEsperada: e.versaoSessao,
          quantidadeLitros: e.movimento.quantidade.toString(), nomeOrdenha: e.sessao.nome, primeiraRetirada: null,
          tanqueId: null, tanqueNome: null, recipiente: null, estoqueConfirmado: true })),
      ] };
  });
}

/** Somente fatos reutilizáveis; a confirmação repete todos os gates sob locks. */
export async function listarFornecimentosColostro(propriedadeId:number,input:{criaId:string;data:string;pagina:number;porPagina:number;fornecimentoId?:string}) {
 return transacaoPecuaria(async tx=>{
  await conferirCriaTx(tx,input.criaId,propriedadeId,dia(input.data));
  const where:Prisma.FornecimentoColostroWhereInput={criaId:input.criaId,propriedadeId,data:dia(input.data),status:'VALIDO',quantidadeLitros:{gt:0},alocacoesOrigem:{none:{ativo:true}},parcelasDestinoLeite:{none:{ativo:true}}};
  const [total,itens,selecionado]=await Promise.all([tx.fornecimentoColostro.count({where}),tx.fornecimentoColostro.findMany({where,orderBy:[{data:'asc'},{criadoEm:'asc'},{id:'asc'}],skip:(input.pagina-1)*input.porPagina,take:input.porPagina}),input.fornecimentoId?tx.fornecimentoColostro.findFirst({where:{...where,id:input.fornecimentoId}}):null]);
  const dto=(f:Prisma.FornecimentoColostroGetPayload<Record<string,never>>)=>({id:f.id,criaId:f.criaId,data:f.data.toISOString().slice(0,10),ocorridoEm:f.ocorridoEm?.toISOString()??null,horarioEstimado:f.horarioEstimado,quantidadeLitros:f.quantidadeLitros!.toFixed(3),tipo:f.tipo,status:f.status});
  return{itens:itens.map(dto),selecionado:selecionado?dto(selecionado):null,total,pagina:input.pagina,porPagina:input.porPagina};
 });
}

/** Histórico paginado inclui estornados para conservar o caminho de regularização. */
export async function listarHistoricoColostro(propriedadeId: number, filtro: ConsultaColostro, tipo: 'destinacoes' | 'enriquecimentos') {
  const dados = consultaColostroSchema.parse(filtro);
  const where = { propriedadeId, ...(dados.inicio || dados.fim ? {data:{...(dados.inicio?{gte:dia(dados.inicio)}:{}),...(dados.fim?{lte:dia(dados.fim)}:{})}} : {}) };
  const args = {where,orderBy:[{data:'desc' as const},{id:'asc' as const}],skip:(dados.pagina-1)*dados.tamanho,take:dados.tamanho};
  return transacaoPecuaria(async tx => {
    if(tipo === 'destinacoes') {
      const [itens,total] = await Promise.all([tx.destinacaoColostro.findMany({...args,select:{id:true,data:true,status:true,versao:true,responsavel:true,origemId:true}}),tx.destinacaoColostro.count({where})]);
      return {itens:itens.map(d=>({...d,data:d.data.toISOString().slice(0, 10)})),total,pagina:dados.pagina,tamanho:dados.tamanho};
    }
    const [itens,total] = await Promise.all([tx.preparoColostro.findMany({...args,select:{id:true,data:true,status:true,versao:true,responsavel:true,origemResultado:{select:{id:true}}}}),tx.preparoColostro.count({where})]);
    return {itens:itens.map(({origemResultado,...d})=>({...d,data:d.data.toISOString().slice(0, 10),origemId:origemResultado?.id??null})),total,pagina:dados.pagina,tamanho:dados.tamanho};
  });
}
