import { apurarVolumeGeral } from "./leite.js";
import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../../db.js";
import { AssistenteError, type ContextoAssistente } from "../tipos.js";
import {
  conferirEtapasMedicao,
  avaliarMeta,
  definicaoSchema,
  indicadoresPermitidos,
  medicaoSchema,
  podeEditarMetas,
  salvarMetaSchema,
  type DefinicaoMeta,
} from "./regras.js";
export class MetasAcessoError extends Error {}
interface Evento {
  metaId: string;
  revisao: number;
  operacaoId: string;
  hashPedido: string;
  propriedadeId: number;
  usuarioId: number;
  dominio: string;
  tipo: "definicao" | "medicao";
  conteudo: DefinicaoMeta | Medicao;
  criadoEm: Date;
}
type Medicao = Omit<z.infer<typeof medicaoSchema>, "operacaoId" | "versaoBase">;
export function catalogoMetas(ctx: ContextoAssistente) {
  return {
    indicadores: indicadoresPermitidos(ctx.usuario),
    podeEditar: podeEditarMetas(ctx.usuario),
  };
}
function dominios(ctx: ContextoAssistente) {
  return [...new Set(indicadoresPermitidos(ctx.usuario).map((i) => i.dominio))];
}
export function apresentarMeta(eventos: Evento[]) {
  const definicoes = eventos.filter((e) => e.tipo === "definicao");
  const atual = definicoes.at(-1)!;
  // Uma redefinição inicia uma nova série; medições anteriores continuam no histórico.
  const medicoes = eventos
    .filter((e) => e.tipo === "medicao" && e.revisao > atual.revisao)
    .map((e) => ({
      ...(e.conteudo as Medicao),
      revisao: e.revisao,
      usuarioId: e.usuarioId,
      criadoEm: e.criadoEm.toISOString(),
    }))
    .sort((a, b) => a.data.localeCompare(b.data) || a.revisao - b.revisao);
  const definicao = atual.conteudo as DefinicaoMeta;
  return {
    id: atual.metaId,
    propriedadeId: atual.propriedadeId,
    revisao: eventos.at(-1)!.revisao,
    definicao,
    medicoes,
    situacao: avaliarMeta(definicao, medicoes.at(-1) ?? null),
    historico: eventos.map((e) => ({
      revisao: e.revisao,
      tipo: e.tipo,
      conteudo: e.conteudo,
      usuarioId: e.usuarioId,
      criadoEm: e.criadoEm.toISOString(),
    })),
  };
}
export async function listarMetas(ctx: ContextoAssistente) {
  const ds = dominios(ctx);
  if (!ds.length) return { metas: [], podeEditar: false, limite: 100 };
  const escopo =
    ctx.propriedadeId === null
      ? Prisma.sql`TRUE`
      : Prisma.sql`"propriedadeId" = ${ctx.propriedadeId}`;
  const eventos = await prisma.$queryRaw<Evento[]>(
    Prisma.sql`SELECT e.* FROM public."EventoMetaAssistente" e JOIN (SELECT "metaId" FROM public."EventoMetaAssistente" WHERE ${escopo} AND "dominio" IN (${Prisma.join(ds)}) GROUP BY "metaId" ORDER BY max("criadoEm") DESC LIMIT 100) m ON m."metaId"=e."metaId" WHERE e."dominio" IN (${Prisma.join(ds)}) AND ${ctx.propriedadeId === null ? Prisma.sql`TRUE` : Prisma.sql`e."propriedadeId"=${ctx.propriedadeId}`} ORDER BY e."metaId",e."revisao"`,
  );
  const grupos = new Map<string, Evento[]>();
  for (const e of eventos)
    grupos.set(e.metaId, [...(grupos.get(e.metaId) ?? []), e]);
  return {
    metas: [...grupos.values()].map(apresentarMeta),
    podeEditar: podeEditarMetas(ctx.usuario),
    limite: 100,
  };
}
export async function gravarMeta(
  id: string,
  entrada: unknown,
  tipo: "definicao" | "medicao",
  ctx: ContextoAssistente,
) {
  id = id.toLowerCase();
  if (!podeEditarMetas(ctx.usuario))
    throw new MetasAcessoError("Sem permissão para lançar metas.");
  if (ctx.propriedadeId === null)
    throw new AssistenteError(
      "VALIDACAO",
      "Selecione uma fazenda para registrar a meta.",
    );
  const input =
    tipo === "definicao"
      ? salvarMetaSchema.parse(entrada)
      : medicaoSchema.parse(entrada);
  const permitidos = indicadoresPermitidos(ctx.usuario);
  if (
    !permitidos.length ||
    ("definicao" in input &&
      !permitidos.some((i) => i.id === input.definicao.indicadorId))
  )
    throw new MetasAcessoError("Indicador indisponível neste acesso.");
  const hash = createHash("sha256")
    .update(
      JSON.stringify([id, tipo, input, ctx.propriedadeId, ctx.usuario.id]),
    )
    .digest("hex");
  return prisma.$transaction(async (tx) => {
    // Serializa a sequência de cada meta. Colisões do hash apenas serializam metas distintas.
    await tx.$queryRaw`WITH operacao AS MATERIALIZED (SELECT pg_advisory_xact_lock(hashtextextended(${input.operacaoId}, 1))::text) SELECT pg_advisory_xact_lock(hashtextextended(${id}, 0))::text FROM operacao`;
    const anteriores = await tx.$queryRaw<
      Evento[]
    >`SELECT * FROM public."EventoMetaAssistente" WHERE "metaId"=${id}::uuid ORDER BY "revisao"`;
    const atual = anteriores.filter((e) => e.tipo === "definicao").at(-1);
    if (
      atual &&
      (atual.propriedadeId !== ctx.propriedadeId ||
        !permitidos.some((i) => i.dominio === atual.dominio))
    )
      throw new MetasAcessoError("Meta indisponível neste acesso e fazenda.");
    const repeticao = anteriores.find((e) => e.operacaoId === input.operacaoId);
    if (repeticao) {
      if (repeticao.hashPedido !== hash)
        throw new AssistenteError(
          "CONFLITO",
          "Esta operação já foi usada com outros dados.",
        );
      return apresentarMeta(
        anteriores.filter((e) => e.revisao <= repeticao.revisao),
      );
    }
    const operacaoUsada = await tx.$queryRaw<
      Array<{ metaId: string }>
    >`SELECT "metaId" FROM public."EventoMetaAssistente" WHERE "operacaoId"=${input.operacaoId}::uuid`;
    if (operacaoUsada.length)
      throw new AssistenteError(
        "CONFLITO",
        "Esta operação já foi usada. Atualize a consulta antes de tentar novamente.",
      );
    if ((anteriores.at(-1)?.revisao ?? 0) !== input.versaoBase)
      throw new AssistenteError(
        "CONFLITO",
        "A meta mudou em outra aba. Atualize a consulta antes de salvar.",
      );
    let conteudo: DefinicaoMeta | Medicao;
    let dominio: string;
    if ("definicao" in input) {
      const i = permitidos.find((i) => i.id === input.definicao.indicadorId);
      if (!i)
        throw new MetasAcessoError("Indicador indisponível neste acesso.");
      if (atual && (atual.conteudo as DefinicaoMeta).indicadorId !== i.id)
        throw new AssistenteError(
          "VALIDACAO",
          "O indicador é fixo. Crie outra meta para acompanhar um indicador diferente.",
        );
      conteudo = definicaoSchema.parse(input.definicao);
      dominio = i.dominio;
    } else {
      if (!atual)
        throw new AssistenteError(
          "VALIDACAO",
          "Crie a meta antes de registrar uma medição.",
        );
      const d = atual.conteudo as DefinicaoMeta;
      try {
        conferirEtapasMedicao(d, input);
      } catch (e) {
        throw new AssistenteError(
          "VALIDACAO",
          e instanceof Error ? e.message : "Confira as etapas.",
        );
      }
      const automatica = d.fonte === "automatica";
      if (automatica && (input.valor !== null || input.concluido !== null))
        throw new AssistenteError(
          "VALIDACAO",
          "A apuração automática não aceita valor informado.",
        );
      if (
        !automatica &&
        (d.tipo === "marco"
          ? input.concluido === null || input.valor !== null
          : input.valor === null || input.concluido !== null)
      )
        throw new AssistenteError(
          "VALIDACAO",
          "Informe conclusão para marco ou valor para indicador numérico.",
        );
      if (
        d.indicadorId !== "resultado_financeiro" &&
        input.valor !== null &&
        input.valor < 0
      )
        throw new AssistenteError(
          "VALIDACAO",
          "O valor deste indicador não pode ser negativo.",
        );
      if (
        ["mortalidade", "taxa_prenhez"].includes(d.indicadorId) &&
        input.valor !== null &&
        input.valor > 100
      )
        throw new AssistenteError(
          "VALIDACAO",
          "Taxas devem estar entre 0 e 100%.",
        );
      if (
        input.data >
        new Intl.DateTimeFormat("en-CA", {
          timeZone: "America/Sao_Paulo",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(ctx.agora)
      )
        throw new AssistenteError(
          "VALIDACAO",
          "Medições não podem ter data futura.",
        );
      conteudo = automatica
        ? {
            data: input.data,
            concluido: null,
            ...(await apurarVolumeGeral(tx, ctx.propriedadeId!, input.data)),
          }
        : {
            data: input.data,
            valor: input.valor,
            concluido: input.concluido,
            observacao: input.observacao,
            ...(input.etapasConcluidas === undefined
              ? {}
              : { etapasConcluidas: input.etapasConcluidas }),
          };
      dominio = atual.dominio;
    }
    const revisao = input.versaoBase + 1;
    await tx.$executeRaw`INSERT INTO public."EventoMetaAssistente" ("metaId","revisao","operacaoId","hashPedido","propriedadeId","usuarioId","dominio","tipo","conteudo") VALUES (${id}::uuid,${revisao},${input.operacaoId}::uuid,${hash},${ctx.propriedadeId},${ctx.usuario.id},${dominio},${tipo},${JSON.stringify(conteudo)}::jsonb)`;
    return apresentarMeta([
      ...anteriores,
      {
        metaId: id,
        revisao,
        operacaoId: input.operacaoId,
        hashPedido: hash,
        propriedadeId: ctx.propriedadeId!,
        usuarioId: ctx.usuario.id,
        dominio,
        tipo,
        conteudo,
        criadoEm: ctx.agora,
      },
    ]);
  });
}
