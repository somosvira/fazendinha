import { Prisma } from "@prisma/client";
import { prisma } from "../../../db.js";
import { auditar, hojeFazendaDate, RebanhoError, travarAnimais } from "../rebanho/regras.js";
import { transacaoPecuaria } from "../transacao.js";
import { hashDados, operacaoIdempotenteTx } from "../reproducao/operacoes.js";
import { criarTipoExameTx, editarTipoExame, registrarExameTx, corrigirExameTx, travarTiposExame } from "../sanidade/exames.js";
import { ocultarCustosDetalhe } from "../sanidade/detalhes.js";
import { camposExameSchema, validarObservacoesExame } from "../exames/formatos.js";
import { conferirSitioLeiteTx } from "./configuracoes.js";
import { hashFormatoExame } from "../exames/formato-snapshot.js";
import {
  criarFormatoQualidadeSchema, editarFormatoQualidadeSchema, registrarQualidadeSchema, corrigirQualidadeSchema,
  consultarQualidadeSchema, historicoQualidadeSchema, consultarOrigensQualidadeSchema, consultarParametrosQualidadeSchema,
  type CriarFormatoQualidadeInput, type EditarFormatoQualidadeInput, type RegistrarQualidadeInput,
  type CorrigirQualidadeInput, type ConsultaQualidade, type ConsultaParametrosQualidade,
} from "./qualidade.schemas.js";
import type { AmostraQualidadeLeiteDTO, FormatoQualidadeLeiteDTO, ResultadoQualidadeDTO } from "./qualidade.contratos.js";

type Db = Prisma.TransactionClient;
const dia = (s: string) => new Date(`${s}T00:00:00Z`);
const incluirFormato = { tipoExame: { include: { _count: { select: { exames: true, etapas: true } } } }, _count: { select: { amostras: true } } } as const;
const incluirAmostra = {
  formato: { include: { tipoExame: true } },
  exameAnimal: { include: { animal: { select: { id: true, brinco: true, nome: true } }, resultados: { where: { vigente: true } } } },
  resultados: { where: { vigente: true } }, laudos: { orderBy: { criadoEm: "asc" } },
} as const;
type Formato = Prisma.FormatoQualidadeLeiteGetPayload<{ include: typeof incluirFormato }>;
type Amostra = Prisma.AmostraQualidadeLeiteGetPayload<{ include: typeof incluirAmostra }>;
function formatoDTO(f: Formato): FormatoQualidadeLeiteDTO {
  const t = f.tipoExame;
  return { id: t.id, nome: t.nome, ativo: t.ativo, tipoResultado: "MULTIPLO", campos: camposExameSchema.parse(t.campos), unidade: null, opcoes: null,
    versaoFormato: t.versaoFormato, versaoAnteriorId: t.versaoAnteriorId, formatoExameHash: hashFormatoExame(t),
    formatoBloqueado: f._count.amostras > 0 || t._count.exames > 0 || t._count.etapas > 0 };
}
function resultadoDTO(r: { id: string; campo: string; valor: Prisma.JsonValue; unidade: string | null; criadoEm: Date; criadoPorId: number | null }): ResultadoQualidadeDTO {
  if (!["string", "number", "boolean"].includes(typeof r.valor)) throw new RebanhoError("CONFLITO", "Resultado de qualidade incompatível com o formato");
  return { id: r.id, campo: r.campo, valor: r.valor as string | number | boolean, unidade: r.unidade, criadoEm: r.criadoEm.toISOString(), criadoPorId: r.criadoPorId };
}
export function amostraQualidadeDTO(a: Amostra): AmostraQualidadeLeiteDTO {
  const e = a.exameAnimal;
  const snapshot = (e?.formatoSnapshot ?? a.formatoSnapshot) as { nome: string; tipoResultado: string; versao: number; campos: unknown };
  return { id: a.id, propriedadeId: a.propriedadeId, data: a.data.toISOString().slice(0, 10), versao: a.versao,
    dataResultadoLaboratorial: a.dataResultadoLaboratorial?.toISOString().slice(0, 10) ?? null,
    dataRecebimentoLaudo: a.dataRecebimentoLaudo?.toISOString().slice(0, 10) ?? null,
    sujeito: e ? { tipo: "ANIMAL", animalId: e.animalId } : { tipo: "COLETIVO", origem: a.origemColetiva!, ...(a.entradaId ? { entradaId: a.entradaId } : {}) },
    animal: e?.animal ?? null, exameAnimalId: a.exameAnimalId, tipoExameId: a.tipoExameId,
    formatoSnapshot: { nome: snapshot.nome, tipoResultado: "MULTIPLO", versao: snapshot.versao, campos: camposExameSchema.parse(snapshot.campos) },
    resultados: (e?.resultados ?? a.resultados).map(resultadoDTO), realizacao: (e?.realizacao ?? a.realizacao) as AmostraQualidadeLeiteDTO["realizacao"],
    status: e?.status ?? a.status, motivoAnulacao: e?.motivoAnulacao ?? a.motivoAnulacao,
    responsavel: a.responsavel, anotacaoOriginal: a.anotacaoOriginal, criadoEm: a.criadoEm.toISOString(), criadoPorId: a.criadoPorId,
    laudos: a.laudos.map(l => ({ id: l.id, nome: l.nome, mimeType: l.mimeType, tamanhoBytes: l.tamanhoBytes, criadoEm: l.criadoEm.toISOString(), criadoPorId: l.criadoPorId })) };
}
export async function listarFormatosQualidade(incluirInativos = false) {
  const formatos = await prisma.formatoQualidadeLeite.findMany({ where: incluirInativos ? {} : { tipoExame: { ativo: true } }, include: incluirFormato, orderBy: { tipoExame: { nome: "asc" } } });
  return formatos.map(formatoDTO);
}
export async function criarFormatoQualidade(input: CriarFormatoQualidadeInput, usuarioId: number | null, versaoAnteriorId?: string) {
  input = criarFormatoQualidadeSchema.parse(input);
  return transacaoPecuaria(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`pec-formato-qualidade:${input.chave}`}))`;
    const hashPayload = hashDados({ input, versaoAnteriorId: versaoAnteriorId ?? null });
    const anterior = await tx.formatoQualidadeLeite.findUnique({ where: { chave: input.chave }, include: incluirFormato });
    if (anterior) {
      if (anterior.hashPayload !== hashPayload || anterior.criadoPorId !== usuarioId) throw new RebanhoError("CONFLITO", "Chave de reenvio usada com outro formato");
      return formatoDTO(anterior);
    }
    if (versaoAnteriorId && !await tx.formatoQualidadeLeite.findUnique({ where: { tipoExameId: versaoAnteriorId } }))
      throw new RebanhoError("NAO_ENCONTRADO", "Formato anterior de qualidade não encontrado");
    const tipo = await criarTipoExameTx(tx, { nome: input.nome, campos: input.campos, tipoResultado: "MULTIPLO", versaoAnteriorId }, usuarioId, "SANITARIO", true);
    const criado = await tx.formatoQualidadeLeite.create({ data: { tipoExameId: tipo.id, chave: input.chave, hashPayload, criadoPorId: usuarioId }, include: incluirFormato });
    return formatoDTO(criado);
  });
}
export async function editarFormatoQualidade(id: string, input: EditarFormatoQualidadeInput, usuarioId: number | null) {
  input = editarFormatoQualidadeSchema.parse(input);
  if (!await prisma.formatoQualidadeLeite.findUnique({ where: { tipoExameId: id } })) throw new RebanhoError("NAO_ENCONTRADO", "Formato de qualidade não encontrado");
  await editarTipoExame(id, input, usuarioId);
  return formatoDTO(await prisma.formatoQualidadeLeite.findUniqueOrThrow({ where: { tipoExameId: id }, include: incluirFormato }));
}
export async function obterAmostraQualidadeTx(tx: Db, id: string, propriedadeId: number) {
  const amostra = await tx.amostraQualidadeLeite.findFirst({ where: { id, propriedadeId }, include: incluirAmostra });
  if (!amostra) throw new RebanhoError("NAO_ENCONTRADO", "Amostra não encontrada neste sítio");
  return amostra;
}
export async function obterAmostraQualidade(id: string, propriedadeId: number) {
  return amostraQualidadeDTO(await obterAmostraQualidadeTx(prisma, id, propriedadeId));
}
export async function registrarQualidade(input: RegistrarQualidadeInput, usuarioId: number | null) {
  input = registrarQualidadeSchema.parse(input);
  return transacaoPecuaria(async tx => {
    // A ordem é a mesma do executor comum: animal, tipo; o reenvio tem chave própria.
    if (input.sujeito.tipo === "ANIMAL") await travarAnimais(tx, [input.sujeito.animalId]);
    const resultado = await operacaoIdempotenteTx(tx, input, usuarioId, "QUALIDADE_LEITE_REGISTRAR", async () => {
      await conferirSitioLeiteTx(tx, input.propriedadeId, true);
      if (dia(input.data) > hojeFazendaDate()) throw new RebanhoError("VALIDACAO", "A amostra deve ter data até hoje", "data");
      await travarTiposExame(tx, [input.tipoExameId]);
      const formato = await tx.formatoQualidadeLeite.findFirst({ where: { tipoExameId: input.tipoExameId, tipoExame: { ativo: true } }, include: { tipoExame: true } });
      if (!formato) throw new RebanhoError("VALIDACAO", "Formato de qualidade não encontrado ou inativo", "tipoExameId");
      const tipo = formato.tipoExame;
      if (hashFormatoExame(tipo) !== input.formatoExameHash) throw new RebanhoError("CONFLITO", "O formato mudou; atualize e confira o laudo", "formatoExameHash");
      const resultados = validarObservacoesExame(tipo.campos, input.resultados, input.resultados.length > 0);
      let exameAnimalId: string | null = null;
      if (input.sujeito.tipo === "ANIMAL") {
        const exame = await registrarExameTx(tx, { animalId: input.sujeito.animalId, propriedadeId: input.propriedadeId, tipoExameId: tipo.id, data: input.data, resultados: input.resultados, responsavel: input.responsavel }, usuarioId, true);
        exameAnimalId = exame.id;
        await tx.exameAnimal.update({ where: { id: exame.id }, data: { finalidades: ["QUALIDADE_LEITE"], finalidadePrincipal: "QUALIDADE_LEITE", anotacaoOriginal: input.anotacaoOriginal ?? null } });
      } else if (input.sujeito.entradaId) {
        const origem = await tx.entradaProducaoLeite.findFirst({ where: { id: input.sujeito.entradaId, status: "CONFIRMADA", sessao: { dia: { propriedadeId: input.propriedadeId, dataOperacional: { lte: dia(input.data) } } } }, select: { id: true } });
        if (!origem) throw new RebanhoError("VALIDACAO", "Entrada não pertence ao sítio/data da amostra", "entradaId");
      }
      const sujeito = input.sujeito;
      const coletivo = sujeito.tipo === "COLETIVO";
      const criado = await tx.amostraQualidadeLeite.create({ data: {
        propriedadeId: input.propriedadeId, data: dia(input.data), sujeito: input.sujeito.tipo, tipoExameId: tipo.id, exameAnimalId,
        dataResultadoLaboratorial: input.dataResultadoLaboratorial ? dia(input.dataResultadoLaboratorial) : null,
        dataRecebimentoLaudo: input.dataRecebimentoLaudo ? dia(input.dataRecebimentoLaudo) : null,
        origemColetiva: sujeito.tipo === "COLETIVO" ? sujeito.origem : null, entradaId: sujeito.tipo === "COLETIVO" ? sujeito.entradaId ?? null : null,
        formatoSnapshot: coletivo ? { nome: tipo.nome, tipoResultado: "MULTIPLO", versao: tipo.versaoFormato, campos: tipo.campos } : Prisma.DbNull,
        realizacao: resultados.length ? "REALIZADO" : "COLETA_REGISTRADA", responsavel: input.responsavel, anotacaoOriginal: input.anotacaoOriginal,
        criadoPorId: usuarioId, ...(coletivo ? { resultados: { create: resultados.map(r => ({ ...r, criadoPorId: usuarioId })) } } : {}),
      } });
      await auditar(tx, { entidade: "AmostraQualidadeLeite", entidadeId: criado.id, propriedadeId: input.propriedadeId,
        animalId: input.sujeito.tipo === "ANIMAL" ? input.sujeito.animalId : null, usuarioId, acao: "REGISTRO", depois: { ...criado, resultados } });
      return { id: criado.id };
    });
    return amostraQualidadeDTO(await obterAmostraQualidadeTx(tx, resultado.id, input.propriedadeId));
  });
}
export async function corrigirQualidade(id: string, input: CorrigirQualidadeInput, usuarioId: number | null) {
  input = corrigirQualidadeSchema.parse(input);
  return transacaoPecuaria(async tx => {
    const resposta = await operacaoIdempotenteTx(tx, input, usuarioId, `QUALIDADE_LEITE_CORRIGIR:${id}`, async () => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`pec-amostra-qualidade:${id}`}))`;
      const original = await obterAmostraQualidadeTx(tx, id, input.propriedadeId);
      if (original.versao !== input.versaoEsperada) throw new RebanhoError("CONFLITO", "A amostra mudou; recarregue o laudo");
      if (original.status !== "VALIDO" || original.exameAnimal?.status === "ANULADO") throw new RebanhoError("CONFLITO", "Amostra anulada não pode receber outro resultado");
      if (original.exameAnimalId && (input.anular || input.resultados !== undefined)) {
        await corrigirExameTx(tx, original.exameAnimalId, input.propriedadeId, { motivo: input.motivo, resultados: input.resultados, anular: input.anular }, usuarioId, id);
      } else if (!original.exameAnimalId && !input.anular && input.resultados !== undefined) {
        const formato = original.formatoSnapshot as { campos: unknown };
        const resultados = validarObservacoesExame(formato.campos, input.resultados);
        await tx.resultadoQualidadeLeite.updateMany({ where: { amostraId: id, vigente: true }, data: { vigente: false, substituidoEm: new Date() } });
        await tx.resultadoQualidadeLeite.createMany({ data: resultados.map(r => ({ ...r, amostraId: id, criadoPorId: usuarioId })) });
      }
      await tx.amostraQualidadeLeite.update({ where: { id }, data: {
        versao: { increment: 1 },
        ...(input.dataResultadoLaboratorial !== undefined ? { dataResultadoLaboratorial: input.dataResultadoLaboratorial === null ? null : dia(input.dataResultadoLaboratorial) } : {}),
        ...(input.dataRecebimentoLaudo !== undefined ? { dataRecebimentoLaudo: input.dataRecebimentoLaudo === null ? null : dia(input.dataRecebimentoLaudo) } : {}),
        ...(input.anular ? { status: "ANULADO", motivoAnulacao: input.motivo, anuladoEm: new Date() } : input.resultados !== undefined ? { realizacao: "REALIZADO" } : {}),
      } });
      const depois = await obterAmostraQualidadeTx(tx, id, input.propriedadeId);
      await auditar(tx, { entidade: "AmostraQualidadeLeite", entidadeId: id, propriedadeId: input.propriedadeId,
        animalId: original.exameAnimal?.animalId, usuarioId, acao: input.anular ? "ANULACAO" : input.resultados !== undefined ? "RESULTADO_CORRIGIDO" : "DATAS_CORRIGIDAS", antes: amostraQualidadeDTO(original), depois: { ...amostraQualidadeDTO(depois), motivo: input.motivo } });
      return { id };
    });
    return amostraQualidadeDTO(await obterAmostraQualidadeTx(tx, resposta.id, input.propriedadeId));
  });
}
export async function listarAmostrasQualidade(propriedadeId: number, filtro: ConsultaQualidade) {
  filtro = consultarQualidadeSchema.parse(filtro);
  const where: Prisma.AmostraQualidadeLeiteWhereInput = { propriedadeId,
    ...(filtro.sujeito ? { sujeito: filtro.sujeito } : {}), ...(filtro.animalId ? { exameAnimal: { animalId: filtro.animalId } } : {}),
    ...(filtro.inicio || filtro.fim ? { data: { ...(filtro.inicio ? { gte: dia(filtro.inicio) } : {}), ...(filtro.fim ? { lte: dia(filtro.fim) } : {}) } } : {}) };
  return prisma.$transaction(async tx => {
    const [lista, total] = await Promise.all([tx.amostraQualidadeLeite.findMany({ where, include: incluirAmostra, orderBy: [{ data: "desc" }, { criadoEm: "desc" }, { id: "desc" }], skip: (filtro.pagina - 1) * filtro.tamanho, take: filtro.tamanho }), tx.amostraQualidadeLeite.count({ where })]);
    return { propriedadeId, itens: lista.map(amostraQualidadeDTO), total, pagina: filtro.pagina, tamanho: filtro.tamanho };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}
export async function historicoQualidade(id: string, propriedadeId: number, pagina = 1, tamanho = 20) {
  ({ pagina, tamanho } = historicoQualidadeSchema.parse({ pagina, tamanho }));
  const amostra = await obterAmostraQualidadeTx(prisma, id, propriedadeId);
  const where: Prisma.AuditoriaPecuariaWhereInput = { propriedadeId, OR: [
    { entidade: "AmostraQualidadeLeite", entidadeId: id }, ...(amostra.exameAnimalId ? [{ entidade: "ExameAnimal", entidadeId: amostra.exameAnimalId }] : []),
  ] };
  return prisma.$transaction(async tx => {
    const [itens, total] = await Promise.all([tx.auditoriaPecuaria.findMany({ where, include: { usuario: { select: { id: true, nome: true } } }, orderBy: [{ em: "desc" }, { id: "desc" }], skip: (pagina - 1) * tamanho, take: tamanho }), tx.auditoriaPecuaria.count({ where })]);
    return { amostraId: id, itens: itens.map(a => ({ id: a.id, acao: a.acao, em: a.em.toISOString(), usuarioId: a.usuarioId, autor: a.usuario,
      motivo: a.depois && typeof a.depois === "object" && !Array.isArray(a.depois) ? a.depois.motivo ?? a.depois.motivoAnulacao ?? null : null,
      antes: ocultarCustosDetalhe(a.antes), depois: ocultarCustosDetalhe(a.depois) })), total, pagina, tamanho };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}
export async function listarOrigensQualidade(propriedadeId: number, input: { data: string; busca?: string; pagina?: number }) {
  const filtro = consultarOrigensQualidadeSchema.parse(input), tamanho = 20;
  const where: Prisma.EntradaProducaoLeiteWhereInput = { status: "CONFIRMADA", sessao: { dia: { propriedadeId, dataOperacional: { lte: dia(filtro.data) } } },
    ...(filtro.busca ? { OR: [{ sessao: { nome: { contains: filtro.busca, mode: "insensitive" } } }, { movimento: { produto: { nome: { contains: filtro.busca, mode: "insensitive" } } } }] } : {}) };
  return prisma.$transaction(async tx => {
    const [origens, total] = await Promise.all([tx.entradaProducaoLeite.findMany({ where, include: { sessao: { include: { dia: true } }, movimento: { include: { produto: { select: { nome: true } } } } }, orderBy: [{ criadoEm: "desc" }, { id: "desc" }], skip: (filtro.pagina - 1) * tamanho, take: tamanho }), tx.entradaProducaoLeite.count({ where })]);
    return { itens: origens.map(o => ({ entradaId: o.id, data: o.sessao.dia.dataOperacional.toISOString().slice(0, 10), nomeOrdenha: o.sessao.nome, produtoNome: o.movimento.produto?.nome ?? "Leite", quantidadeLitros: o.movimento.quantidade.toNumber() })), total, pagina: filtro.pagina, tamanho };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}

/** Uma linha por amostra e parâmetro vigente; data laboratorial não é inferida de criadoEm. */
export async function consultarParametrosQualidade(propriedadeId: number, input: ConsultaParametrosQualidade) {
  const filtro = consultarParametrosQualidadeSchema.parse(input);
  const resultado = { campo: filtro.campo, vigente: true };
  const where: Prisma.AmostraQualidadeLeiteWhereInput = {
    propriedadeId, status: "VALIDO", data: { gte: dia(filtro.inicio), lte: dia(filtro.fim) },
    ...(filtro.tipoExameId ? { tipoExameId: filtro.tipoExameId } : {}),
    ...(filtro.sujeito ? { sujeito: filtro.sujeito } : {}),
    OR: [
      { exameAnimalId: null, resultados: { some: resultado } },
      { exameAnimal: { status: "VALIDO", resultados: { some: resultado } } },
    ],
  };
  return prisma.$transaction(async tx => {
    const [amostras, total] = await Promise.all([
      tx.amostraQualidadeLeite.findMany({ where, include: incluirAmostra,
        orderBy: [{ data: "desc" }, { criadoEm: "desc" }, { id: "desc" }],
        skip: (filtro.pagina - 1) * filtro.tamanho, take: filtro.tamanho }),
      tx.amostraQualidadeLeite.count({ where }),
    ]);
    const montar = (lista: typeof amostras) => lista.map(amostraQualidadeDTO).map(a => {
      const r = a.resultados.find(r => r.campo === filtro.campo);
      const campo = a.formatoSnapshot.campos.find(c => c.codigo === filtro.campo);
      if (!r || !campo) throw new RebanhoError("CONFLITO", "Resultado incompatível com o formato preservado da amostra");
      // Mesmo nome/código não comprova método equivalente: preservar identidade e snapshot completos.
      const serie = hashDados({ tipoExameId: a.tipoExameId, formato: a.formatoSnapshot,
        campo: filtro.campo, unidade: r.unidade, sujeito: a.sujeito });
      return { amostraId: a.id, dataAmostra: a.data, registradoEm: r.criadoEm,
        dataResultadoLaboratorial: a.dataResultadoLaboratorial, dataRecebimentoLaudo: a.dataRecebimentoLaudo, sujeito: a.sujeito, animal: a.animal,
        campo: r.campo, tipo: campo.tipo, rotulo: campo.rotulo ?? campo.codigo, valor: r.valor, unidade: r.unidade,
        formato: { id: a.tipoExameId, nome: a.formatoSnapshot.nome, versao: a.formatoSnapshot.versao },
        serie, versaoAmostra: a.versao };
    });
    const itens = montar(amostras);
    // A série é do recorte completo, nunca somente da página. Um recorte muito
    // grande continua paginável, mas pede refinamento antes de desenhar o gráfico.
    const serieCompleta = filtro.incluirSerie ? total <= 2000 : undefined;
    const serieItens = filtro.incluirSerie ? serieCompleta ? montar(await tx.amostraQualidadeLeite.findMany({
      where, include: incluirAmostra, orderBy: [{ data: "asc" }, { criadoEm: "asc" }, { id: "asc" }], skip: 0, take: 2000,
    })) : [] : undefined;
    return { propriedadeId, periodo: { inicio: filtro.inicio, fim: filtro.fim }, campo: filtro.campo,
      itens, total, pagina: filtro.pagina, tamanho: filtro.tamanho,
      ...(filtro.incluirSerie ? { serieCompleta, serieItens } : {}) };

  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}
