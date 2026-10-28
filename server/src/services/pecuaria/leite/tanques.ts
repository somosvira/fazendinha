import { z } from "zod";
import {
  Prisma,
  type TanqueLeite,
  type MedicaoGeralLeite,
} from "@prisma/client";
import { prisma } from "../../../db.js";
import {
  auditar,
  hojeFazendaDate,
  RebanhoError,
  travarAnimais,
} from "../rebanho/regras.js";
import { transacaoPecuaria } from "../transacao.js";
import { operacaoIdempotenteTx } from "../reproducao/operacoes.js";
import {
  conferirSitioLeiteTx,
  garantirConfiguracaoLeiteTx,
  travarRotinaLeiteTx,
} from "./configuracoes.js";
import { consultarFolha, consultarOrigensAutomaticasGeraisTx } from "./producao.js";
import { conferirConversaoTanque } from "./tanques.calc.js";
import {
  pontoConversaoSchema,
  tanqueLeiteSchema,
  medicaoGeralLeiteSchema,
  salvarParcelasOrdenhaSchema,
  type SalvarParcelasOrdenhaInput,
  type TanqueLeiteInput,
  type MedicaoGeralLeiteInput,
} from "./tanques.schemas.js";
import { conferirContextoParcelaTx, conferirSegregacaoParcelas, consultarContextoParcelasTx } from "./parcelas-contexto.js";
const dia = (data: string) => new Date(`${data}T00:00:00Z`);
export function tanqueDTO(t: TanqueLeite) {
  return {
    id: t.id,
    propriedadeId: t.propriedadeId,
    identidadeId: t.identidadeId,
    versao: t.versao,
    nome: t.nome,
    fabricante: t.fabricante,
    modelo: t.modelo,
    numeroSerie: t.numeroSerie,
    capacidadeLitros: t.capacidadeLitros.toNumber(),
    vigenteDesde: t.vigenteDesde.toISOString().slice(0, 10),
    ativo: t.ativo,
    tabelaConversao: pontoConversaoSchema.array().parse(t.tabelaConversao),
    referenciaTabela: t.referenciaTabela,
  };
}
export function medicaoGeralDTO(
  m: MedicaoGeralLeite & {
    tanque: TanqueLeite | null;
    entradasEstoque: { id: string; status: string }[];
  },
) {
  return {
    id: m.id,
    sessaoId: m.sessaoId,
    tanque: m.tanque ? tanqueDTO(m.tanque) : null,
    recipiente: m.recipiente ?? null,
    declaracaoDireta: m.declaracaoDireta ?? null,
    primeiraOrdenhaColostro: m.primeiraOrdenhaColostro ?? null,
    criterioColostroSnapshot: m.criterioColostroSnapshot ?? null,
    litros: m.litros.toNumber(),
    reguaMm: m.reguaMm?.toNumber() ?? null,
    origemLitros: m.origemLitros,
    natureza: m.natureza,
    animaisOrigem: m.animaisOrigem,
    responsavel: m.responsavel,
    observacao: m.observacao,
    versao: m.versao,
    entradaId:
      m.entradasEstoque.find((e) => e.status === "CONFIRMADA")?.id ?? null,
  };
}
export async function listarTanquesTx(
  tx: Prisma.TransactionClient,
  propriedadeId: number,
  data: Date,
) {
  const versoes = await tx.tanqueLeite.findMany({
    where: { propriedadeId, vigenteDesde: { lte: data } },
    orderBy: [{ identidadeId: "asc" }, { versao: "desc" }],
  });
  return [
    ...new Map(
      versoes
        .map((t) => t.identidadeId)
        .map((id) => [id, versoes.find((t) => t.identidadeId === id)!]),
    ).values(),
  ];
}
export async function registrarTanque(
  input: TanqueLeiteInput,
  usuarioId: number | null,
) {
  const dados = tanqueLeiteSchema.parse(input);
  return transacaoPecuaria((tx) =>
    operacaoIdempotenteTx(
      tx,
      dados,
      usuarioId,
      "VERSAO_TANQUE_LEITE",
      async () => {
        await conferirSitioLeiteTx(tx, dados.propriedadeId, true);
        await travarRotinaLeiteTx(tx, dados.propriedadeId);
        const ultima = await tx.tanqueLeite.findFirst({
          where: {
            propriedadeId: dados.propriedadeId,
            identidadeId: dados.identidadeId,
          },
          orderBy: { versao: "desc" },
        });
        if ((ultima?.versao ?? 0) !== dados.versaoEsperada)
          throw new RebanhoError(
            "CONFLITO",
            "O tanque mudou; recarregue a configuração",
          );
        if (ultima && dia(dados.vigenteDesde) <= ultima.vigenteDesde)
          throw new RebanhoError(
            "CONFLITO",
            "A nova versão deve ter vigência posterior à anterior",
          );
        if (
          await tx.medicaoGeralLeite.count({
            where: {
              tanque: {
                propriedadeId: dados.propriedadeId,
                identidadeId: dados.identidadeId,
              },
              sessao: {
                dia: { dataOperacional: { gte: dia(dados.vigenteDesde) } },
              },
            },
          })
        )
          throw new RebanhoError(
            "CONFLITO",
            "A vigência alcança aferições existentes; escolha uma data posterior",
          );
        const { chave: _chave, versaoEsperada: _versao, ...campos } = dados;
        const tanque = await tx.tanqueLeite.create({
          data: {
            ...campos,
            vigenteDesde: dia(dados.vigenteDesde),
            versao: dados.versaoEsperada + 1,
            tabelaConversao: [...dados.tabelaConversao].sort(
              (a, b) => a.mm - b.mm,
            ),
            criadoPorId: usuarioId,
          },
        });
        await auditar(tx, {
          entidade: "TanqueLeite",
          entidadeId: tanque.id,
          propriedadeId: dados.propriedadeId,
          usuarioId,
          acao: "NOVA_VERSAO",
          depois: tanque,
        });
        return tanqueDTO(tanque);
      },
    ),
  );
}
export async function consultarOrdenhasGerais(
  propriedadeId: number,
  dataOperacional: string,
) {
  const folha = await consultarFolha(propriedadeId, dataOperacional);
  const dados = await prisma.$transaction(
    async (tx) => {
      const tanques = await listarTanquesTx(
        tx,
        propriedadeId,
        dia(dataOperacional),
      );
      const medicoes = await tx.medicaoGeralLeite.findMany({
        where: {
          sessao: {
            dia: { propriedadeId, dataOperacional: dia(dataOperacional) },
          },
        },
        include: {
          tanque: true,
          entradasEstoque: { select: { id: true, status: true } },
        },
        orderBy: [{ sessaoId: "asc" }, { tanqueId: "asc" }],
      });
      return {
        tanques: tanques.map(tanqueDTO),
        medicoes: medicoes.map(medicaoGeralDTO),
        contexto: await consultarContextoParcelasTx(tx, propriedadeId, dia(dataOperacional), folha.configuracao),
        origensAutomaticas: await consultarOrigensAutomaticasGeraisTx(tx, propriedadeId, dia(dataOperacional)),
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  );
  return {
    ...dados,
    configuracao: folha.configuracao,
    sessoes: folha.sessoes.map((s) => ({
      id: s.id,
      posicaoId: s.posicaoId,
      nome: s.nome,
      ordem: s.ordem,
    })),
    animais: folha.animais.map((a) => ({
      animalId: a.animalId,
      brinco: a.brinco,
      nome: a.nome,
    })),
  };
}
const incluirMedicao = { tanque: true, entradasEstoque: { select: { id: true, status: true } } };
export async function salvarParcelasTx(tx: Prisma.TransactionClient, dados: SalvarParcelasOrdenhaInput,
  usuarioId: number | null, legado = false) {
  const data = dia(dados.dataOperacional);
  if (data > hojeFazendaDate()) throw new RebanhoError("VALIDACAO", "A ordenha deve ter data até hoje");
  const escopo = { sessao: { posicaoId: dados.posicaoId, dia: { propriedadeId: dados.propriedadeId, dataOperacional: data } } };
  // A composição lida antes das travas serve apenas de referência. Relida sob a trava da sessão.
  const referencias = await tx.medicaoGeralLeite.findMany({ where: escopo, include: incluirMedicao });
  const parcelas = dados.parcelas.map(p => {
    if (!legado || p.id || p.versaoEsperada === 0) return p;
    const encontradas = referencias.filter(r => r.tanqueId === p.tanqueId);
    if (encontradas.length !== 1) throw new RebanhoError("CONFLITO", "Identifique a parcela que deseja corrigir e recarregue a ordenha");
    return { ...p, id: encontradas[0].id };
  });
  const alteradas = new Set(parcelas.flatMap(p => p.id ? [p.id] : []));
  const anteriores = referencias.filter(r => alteradas.has(r.id));
  await travarAnimais(tx, [...new Set([...anteriores.flatMap(r => z.array(z.string()).parse(r.animaisOrigem)), ...parcelas.flatMap(p => p.animaisOrigem)])]);
  await travarRotinaLeiteTx(tx, dados.propriedadeId);
  await conferirSitioLeiteTx(tx, dados.propriedadeId, true);
  const identidade = { propriedadeId: dados.propriedadeId, dataOperacional: data };
  let registroDia = await tx.diaProducaoLeite.findUnique({ where: { propriedadeId_dataOperacional: identidade }, include: { configuracao: true } });
  const configuracao = registroDia?.configuracao ?? await garantirConfiguracaoLeiteTx(tx, dados.propriedadeId, data, usuarioId);
  if (configuracao.fonteProducao !== "GERAL") throw new RebanhoError("CONFLITO", "A configuração desta data usa produção individual. Publique a vigência da aferição geral antes de registrar.");
  if (!registroDia) {
    const completa = await garantirConfiguracaoLeiteTx(tx, dados.propriedadeId, data, usuarioId);
    registroDia = await tx.diaProducaoLeite.create({ data: { ...identidade, configuracaoId: completa.id, criadoPorId: usuarioId,
      sessoes: { create: completa.ordenhas.map(o => ({ posicaoId: o.posicaoId, nome: o.nome, ordem: o.ordem, horario: o.horario })) } }, include: { configuracao: true } });
  }
  const sessao = await tx.sessaoOrdenha.findUnique({ where: { diaId_posicaoId: { diaId: registroDia.id, posicaoId: dados.posicaoId } } });
  if (!sessao) throw new RebanhoError("VALIDACAO", "Ordenha não pertence à rotina desta data");
  await tx.$queryRaw`SELECT id FROM pecuaria."SessaoOrdenha" WHERE id=${sessao.id} FOR NO KEY UPDATE`;
  const atuais = await tx.medicaoGeralLeite.findMany({ where: { sessaoId: sessao.id }, include: incluirMedicao });
  const tanques = await listarTanquesTx(tx, dados.propriedadeId, data);
  conferirSegregacaoParcelas([...atuais.filter(r => !alteradas.has(r.id)), ...parcelas]);
  // Todas as parcelas são conferidas antes da primeira escrita. A transação também protege falhas de SQL.
  const preparadas = [];
  for (const p of parcelas) {
    const anterior = p.id ? atuais.find(r => r.id === p.id) : undefined;
    const ref = p.id ? referencias.find(r => r.id === p.id) : undefined;
    if (p.id && (!ref || !anterior || JSON.stringify(ref.animaisOrigem) !== JSON.stringify(anterior.animaisOrigem)))
      throw new RebanhoError("CONFLITO", "Os animais de origem mudaram; recarregue antes de salvar");
    if ((anterior?.versao ?? 0) !== p.versaoEsperada) throw new RebanhoError("CONFLITO", "A aferição mudou; recarregue antes de salvar");
    if (anterior?.entradasEstoque.some(e => e.status === "CONFIRMADA")) throw new RebanhoError("CONFLITO", "Regularize a entrada de estoque antes de corrigir a aferição");
    if (anterior && !p.motivoCorrecao) throw new RebanhoError("VALIDACAO", "Informe o motivo da correção");
    if (anterior && anterior.tanqueId !== (p.tanqueId ?? null)) throw new RebanhoError("CONFLITO", "Preserve o tanque histórico da parcela ao corrigir");
    const tanque = p.tanqueId ? tanques.find(t => t.id === p.tanqueId && t.ativo) : null;
    if (p.tanqueId && !tanque) throw new RebanhoError("VALIDACAO", "Tanque indisponível nesta data e sítio");
    const origemLitros = conferirConversaoTanque(p, tanque ? { capacidadeLitros: tanque.capacidadeLitros } : null);
    const contexto = await conferirContextoParcelaTx(tx, dados.propriedadeId, data, sessao.horario, configuracao, p, p.id);
    preparadas.push({ p, anterior, contexto, origemLitros });
  }
  const primeirasDoConjunto = new Set<string>();
  for (const { p, contexto } of preparadas) {
    if (p.primeiraOrdenhaColostro !== true) continue;
    for (const parto of contexto.snapshot.partos) {
      const identidadeParto = `${parto.animalId}:${parto.id}`;
      if (primeirasDoConjunto.has(identidadeParto)) throw new RebanhoError("CONFLITO", "A primeira ordenha do parto só pode ser declarada em uma parcela do conjunto", "primeiraOrdenhaColostro");
      primeirasDoConjunto.add(identidadeParto);
    }
  }
  const salvas = [];
  for (const { p, anterior, contexto, origemLitros } of preparadas) {
    const valores = { litros: new Prisma.Decimal(p.litros), reguaMm: p.reguaMm == null ? null : new Prisma.Decimal(p.reguaMm), origemLitros,
      natureza: p.natureza, animaisOrigem: p.animaisOrigem, recipiente: p.recipiente ?? null, responsavel: p.responsavel, observacao: p.observacao ?? null,
      declaracaoDireta: p.declaracaoDireta ?? Prisma.DbNull, primeiraOrdenhaColostro: p.primeiraOrdenhaColostro ?? null,
      criterioColostroSnapshot: contexto.snapshot };
    const salva = anterior
      ? await tx.medicaoGeralLeite.update({ where: { id: anterior.id, versao: p.versaoEsperada }, data: { ...valores, versao: { increment: 1 } }, include: incluirMedicao })
      : await tx.medicaoGeralLeite.create({ data: { ...valores, sessaoId: sessao.id, tanqueId: p.tanqueId ?? null, criadoPorId: usuarioId }, include: incluirMedicao });
    await auditar(tx, { entidade: "MedicaoGeralLeite", entidadeId: salva.id, propriedadeId: dados.propriedadeId, usuarioId,
      acao: anterior ? "CORRECAO" : "MEDICAO", antes: anterior, depois: { ...salva, motivoCorrecao: p.motivoCorrecao } });
    salvas.push(medicaoGeralDTO(salva));
  }
  return { sessaoId: sessao.id, parcelas: salvas };
}
export async function salvarParcelasOrdenha(input: SalvarParcelasOrdenhaInput, usuarioId: number | null) {
  const dados = salvarParcelasOrdenhaSchema.parse(input);
  return transacaoPecuaria(tx => operacaoIdempotenteTx(tx, dados, usuarioId, "PARCELAS_ORDENHA_LEITE", () => salvarParcelasTx(tx, dados, usuarioId)));
}
export async function salvarMedicaoGeral(input: MedicaoGeralLeiteInput, usuarioId: number | null) {
  const dados = medicaoGeralLeiteSchema.parse(input);
  return transacaoPecuaria(tx => operacaoIdempotenteTx(tx, dados, usuarioId, "MEDICAO_GERAL_LEITE", async () => {
    const { chave, propriedadeId, dataOperacional, posicaoId, ...parcela } = dados;
    return (await salvarParcelasTx(tx, { chave, propriedadeId, dataOperacional, posicaoId, parcelas: [parcela] }, usuarioId, true)).parcelas[0];
  }));
}
