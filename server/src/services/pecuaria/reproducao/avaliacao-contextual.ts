import { Prisma } from "@prisma/client";
import { prisma } from "../../../db.js";
import { camposExameSchema, conferirFormatoReprodutivo } from "../exames/formatos.js";
import { travarTiposExame } from "../sanidade/exames.js";
import { auditar, RebanhoError } from "../rebanho/regras.js";
import { transacaoPecuaria } from "../transacao.js";
import { hashDados, operacaoIdempotenteTx } from "./operacoes.js";
import { condutaCatalogoAvaliacaoSchema, itemCatalogoAvaliacaoSchema, type CriarCatalogoAvaliacaoInput } from "./avaliacao-contextual.schemas.js";
import type { AvaliacaoInput } from "./schemas.js";
import { z } from "zod";

function erro(mensagem: string, campo: string): never { throw new RebanhoError("VALIDACAO", mensagem, campo); }
const json = (v: unknown): Prisma.InputJsonValue => JSON.parse(JSON.stringify(v));
const itensSchema = z.array(itemCatalogoAvaliacaoSchema);
const condutasSchema = z.array(condutaCatalogoAvaliacaoSchema);

export async function catalogoAvaliacao(propriedadeId: number, contexto?: string) {
  const catalogo = await prisma.catalogoAvaliacaoReprodutiva.findFirst({ where: { propriedadeId }, orderBy: { versao: "desc" } });
  if (!catalogo) return { catalogo: null, sugeridos: [] };
  const itens = itensSchema.parse(catalogo.itens);
  return { catalogo: { ...catalogo, itens, condutas: condutasSchema.parse(catalogo.condutas) }, sugeridos: itens.filter(i => contexto && i.contextos.includes(contexto as typeof i.contextos[number])).map(i => i.codigo) };
}
export function criarCatalogoAvaliacao(input: CriarCatalogoAvaliacaoInput, usuarioId: number | null) {
  return transacaoPecuaria(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`pec-catalogo-avaliacao:${input.propriedadeId}`}))`;
    return operacaoIdempotenteTx(tx, input, usuarioId, "CATALOGO_AVALIACAO_REPRODUTIVA", async () => {
      const atual = await tx.catalogoAvaliacaoReprodutiva.findFirst({ where: { propriedadeId: input.propriedadeId }, orderBy: { versao: "desc" } });
      if ((atual?.versao ?? 0) !== input.versaoEsperada) throw new RebanhoError("CONFLITO", "O catálogo mudou; atualize antes de publicar");
      await travarTiposExame(tx, [input.tipoExameId]);
      const tipo = await tx.tipoExame.findUnique({ where: { id: input.tipoExameId } });
      if (!tipo || !tipo.ativo || tipo.contexto === "SANITARIO") erro("Tipo de exame reprodutivo ativo não encontrado", "tipoExameId");
      conferirFormatoReprodutivo(tipo.tipoResultado, tipo.campos);
      const campos = camposExameSchema.parse(tipo.campos);
      for (const item of input.itens) if (item.campo && (!campos.some(c => c.codigo === item.campo) || ["CONCLUSAO_GESTACIONAL", "SEXO_FETAL"].includes(item.campo)))
        erro("Item deve referenciar campo adicional do tipo de exame", "itens");
      const salvo = await tx.catalogoAvaliacaoReprodutiva.create({ data: { propriedadeId: input.propriedadeId, versao: (atual?.versao ?? 0) + 1, tipoExameId: tipo.id, itens: json(input.itens), condutas: json(input.condutas), criadoPorId: usuarioId } });
      await auditar(tx, { entidade: "CatalogoAvaliacaoReprodutiva", entidadeId: salvo.id, propriedadeId: input.propriedadeId, acao: "PUBLICACAO", usuarioId, depois: salvo });
      return salvo;
    });
  });
}

/** Assina a proposta e as projeções consultadas; a confirmação recalcula sob trava. */
export function revisaoAvaliacaoContextual(input: AvaliacaoInput, resumo: unknown) {
  const { revisaoContextual: _revisao, ...dados } = input;
  return hashDados({ dados, resumo });
}

/** Examina a configuração e os dados sem criar fatos ou inferir resultados clínicos. */
export async function prepararContextoAvaliacaoTx(tx: Prisma.TransactionClient, input: AvaliacaoInput) {
  if (!input.avaliacaoContextual) return null;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`pec-catalogo-avaliacao:${input.propriedadeId}`}))`;
  const catalogo = await tx.catalogoAvaliacaoReprodutiva.findFirst({ where: { propriedadeId: input.propriedadeId }, orderBy: { versao: "desc" } });
  if (!catalogo || catalogo.id !== input.avaliacaoContextual.catalogoId) throw new RebanhoError("CONFLITO", "O catálogo mudou; atualize e revise a avaliação");
  if (catalogo.tipoExameId !== input.tipoExameId) erro("Tipo de exame difere do catálogo selecionado", "tipoExameId");
  const itens = itensSchema.parse(catalogo.itens), condutas = condutasSchema.parse(catalogo.condutas);
  const tiposNecessarios = [
    ...(input.resultado === "RECONFIRMACAO" || input.resultado === "INCONCLUSIVO" && input.finalidade === "RECONFIRMACAO" ? ["RECONFIRMACAO"] : []),
    ...(["POSITIVO", "NEGATIVO", "INCONCLUSIVO"].includes(input.resultado) && input.finalidade !== "RECONFIRMACAO" && input.finalidade !== "SEXAGEM" ? ["DIAGNOSTICO"] : []),
    ...(input.sexoFetal || input.resultado === "INCONCLUSIVO" && input.finalidade === "SEXAGEM" ? ["SEXAGEM"] : []), ...(input.resultadoAptidao ? ["APTIDAO"] : []),
  ];
  for (const tipo of tiposNecessarios) if (!itens.some(i => i.tipo === tipo)) erro("O catálogo não contém o item clínico informado", "avaliacaoContextual.itens");
  const preenchidos = new Map(input.avaliacaoContextual.itens.map(i => [i.codigo, i]));
  for (const item of input.avaliacaoContextual.itens) if (!itens.some(i => i.codigo === item.codigo)) erro("Item não pertence ao catálogo", "avaliacaoContextual.itens");
  for (const resultado of input.resultados ?? []) if (!itens.some(i => i.campo === resultado.campo)) erro("Observação não pertence aos itens configurados", "resultados");
  const estados = itens.map(item => {
    const preenchido = preenchidos.get(item.codigo), estado = preenchido?.estado ?? "NAO_AVALIADO";
    const valor = item.campo ? input.resultados?.find(r => r.campo === item.campo)?.valor : item.tipo === "APTIDAO" ? input.resultadoAptidao : item.tipo === "SEXAGEM" ? input.sexoFetal ?? (input.resultado === "INCONCLUSIVO" && input.finalidade === "SEXAGEM" ? "INCONCLUSIVO" : null) : item.tipo === "RECONFIRMACAO" ? (input.resultado === "RECONFIRMACAO" ? "POSITIVO" : input.resultado === "INCONCLUSIVO" && input.finalidade === "RECONFIRMACAO" ? "INCONCLUSIVO" : null) : item.tipo === "DIAGNOSTICO" ? (["POSITIVO", "NEGATIVO", "INCONCLUSIVO"].includes(input.resultado) && input.finalidade !== "RECONFIRMACAO" && input.finalidade !== "SEXAGEM" ? input.resultado : null) : null;
    const conclusivo = valor !== null && valor !== undefined && valor !== "INCONCLUSIVO";
    const inconclusivo = valor === "INCONCLUSIVO";
    if (estado === "CONCLUSIVO" && !conclusivo || estado === "INCONCLUSIVO" && conclusivo || estado === "NAO_AVALIADO" && (conclusivo || inconclusivo)) erro("Estado do item diverge do resultado informado", "avaliacaoContextual.itens");
    if (inconclusivo && estado !== "INCONCLUSIVO") erro("Resultado inconclusivo deve manter o estado correspondente", "avaliacaoContextual.itens");
    return { ...item, estado, observacao: preenchido?.observacao ?? null };
  });
  if (!estados.some(i => i.estado !== "NAO_AVALIADO")) erro("Informe ao menos um item efetivamente avaliado", "avaliacaoContextual.itens");
  if (input.resultado === "NAO_AVALIADO" && !input.realizadoSemDG) erro("Informe que a avaliação foi realizada sem DG", "realizadoSemDG");
  const selecionadas = input.avaliacaoContextual.condutas.map(c => {
    const modelo = condutas.find(m => m.codigo === c.codigo);
    if (!modelo) erro("Conduta não pertence ao catálogo", "avaliacaoContextual.condutas");
    if (modelo.tipo === "RETORNO" && (!c.retornoEm || c.retornoEm < input.data)) erro("Retorno não pode anteceder a avaliação", "avaliacaoContextual.condutas");
    if (["INDICAR_TENTATIVA", "INDICAR_PROTOCOLO", "NAO_PROSSEGUIR"].includes(modelo.tipo) && !c.destino) erro("Informe o destino da conduta", "avaliacaoContextual.condutas");
    if (modelo.exigeRevisao && (!c.revisaoEm || c.revisaoEm < input.data)) erro("Conduta exige data de revisão não anterior à avaliação", "avaliacaoContextual.condutas");
    return { ...modelo, ...c };
  });
  const retornos = selecionadas.filter(c => c.tipo === "RETORNO");
  if (retornos.length > 1) erro("Registre somente um retorno por avaliação", "avaliacaoContextual.condutas");
  if (retornos[0]?.retornoEm && input.retornoEm && retornos[0].retornoEm !== input.retornoEm) erro("A data de retorno diverge da conduta selecionada", "retornoEm");
  return { catalogoId: catalogo.id, versao: catalogo.versao, tipoExameId: catalogo.tipoExameId, itens: estados, condutas: selecionadas };

}

/** Leitura autorizada pelo sítio factual, inclusive histórico anulado. */
export async function obterAvaliacaoContextual(id: string, propriedadeId: number) {
  const exame = await prisma.exameAnimal.findFirst({ where: { id, propriedadeId, avaliacaoContextualSnapshot: { not: Prisma.DbNull } },
    select: { id: true, animalId: true, propriedadeId: true, data: true, status: true, realizacao: true, responsavel: true,
      avaliacaoContextualSnapshot: true, resultados: { where: { vigente: true }, select: { id: true, campo: true, valor: true, unidade: true } },
      interpretacao: { select: { tentativaId: true, gestacaoId: true, resultadoAptidao: true, retornoAptidaoEm: true, retornoEm: true, condutasContextuais: true } } } });
  if (!exame) throw new RebanhoError("NAO_ENCONTRADO", "Avaliação contextual não encontrada neste sítio");
  return exame;
}
