import { validarObservacoesExame, type ObservacaoExame } from "./formatos.js";
import crypto from "node:crypto";
import { Prisma, type AvaliacaoReprodutiva } from "@prisma/client";
import { RebanhoError } from "../rebanho/regras.js";

export const TIPO_EXAME_REPRODUTIVO = "b0400000-0000-4000-8000-000000000001";
type DadosAvaliacao = Pick<AvaliacaoReprodutiva, "animalId" | "data" | "resultado"> &
  Partial<Omit<AvaliacaoReprodutiva, "animalId" | "data" | "resultado">> & { responsavel?: string | null; tipoExameId?: string; finalidade?: "DIAGNOSTICO" | "RECONFIRMACAO" | "SEXAGEM"; resultados?: ObservacaoExame[] };

/** Persiste somente a evidência e sua interpretação. Efeitos clínicos pertencem ao executor de domínio. */
export async function registrarEvidenciaAvaliacaoTx(tx: Prisma.TransactionClient, dados: DadosAvaliacao): Promise<AvaliacaoReprodutiva> {
  if (!["POSITIVO", "NEGATIVO", "RECONFIRMACAO", "SEXAGEM", "INCONCLUSIVO", "NAO_AVALIADO"].includes(dados.resultado)) throw new RebanhoError("VALIDACAO", "Resultado reprodutivo não reconhecido", "resultado");
  const tipoExameId = dados.tipoExameId ?? TIPO_EXAME_REPRODUTIVO;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`pec-tipo-exame:${tipoExameId}`}))`;
  const tipo = await tx.tipoExame.findUnique({ where: { id: tipoExameId } });
  if (!tipo || tipo.tipoResultado !== "MULTIPLO" || tipo.contexto === "SANITARIO" || (!tipo.ativo && (dados.origem ?? "MANUAL") !== "IDEAGRI"))
    throw new RebanhoError("VALIDACAO", "Selecione um tipo de exame reprodutivo ativo com formato compatível", "tipoExameId");
  const finalidade = dados.finalidade ?? (["RECONFIRMACAO", "SEXAGEM"].includes(dados.resultado) ? dados.resultado : "DIAGNOSTICO");
  const finalidades = dados.sexoFetal && finalidade !== "SEXAGEM" ? [finalidade, "SEXAGEM"] : [finalidade];
  const observacoes: ObservacaoExame[] = [];
  if (["POSITIVO", "NEGATIVO", "INCONCLUSIVO"].includes(dados.resultado)) observacoes.push({ campo: "CONCLUSAO_GESTACIONAL", valor: dados.resultado });
  if (dados.resultado === "RECONFIRMACAO") observacoes.push({ campo: "CONCLUSAO_GESTACIONAL", valor: "POSITIVO" });
  if (dados.resultados?.some(r => ["CONCLUSAO_GESTACIONAL", "SEXO_FETAL"].includes(r.campo))) throw new RebanhoError("VALIDACAO", "Informe conclusão e sexo nos campos próprios da avaliação", "resultados");
  observacoes.push(...(dados.resultados ?? []));
  if (dados.sexoFetal) observacoes.push({ campo: "SEXO_FETAL", valor: dados.sexoFetal });
  const resultados = validarObservacoesExame(tipo.campos, observacoes, dados.resultado !== "NAO_AVALIADO");
  const id = dados.id ?? crypto.randomUUID();
  await tx.exameAnimal.create({ data: {
    id, animalId: dados.animalId, propriedadeId: dados.propriedadeId, tipoExameId,
    data: dados.data, origem: dados.origem ?? "MANUAL", status: dados.status ?? "VALIDO",
    motivoAnulacao: dados.motivoAnulacao, anuladoEm: dados.anuladoEm,
    criadoEm: dados.criadoEm, criadoPorId: dados.criadoPorId, responsavel: dados.responsavel,
    formatoSnapshot: { nome: tipo.nome, tipoResultado: "MULTIPLO", versao: tipo.versaoFormato, campos: tipo.campos },
    finalidades, finalidadePrincipal: finalidade, realizacao: dados.resultado === "NAO_AVALIADO" ? "NAO_REALIZADO" : "REALIZADO",
    anotacaoOriginal: dados.anotacaoOriginal, observacao: dados.observacao,
    resultados: { create: resultados.map(r => ({ ...r, criadoPorId: dados.criadoPorId })) },
    interpretacao: { create: { id, referenciaExterna: dados.referenciaExterna,
      gestacaoCriada: dados.gestacaoCriada, restricaoId: dados.restricaoId,
      tentativaId: dados.tentativaId, gestacaoId: dados.gestacaoId,
      conduta: dados.conduta, motivo: dados.motivo, retornoEm: dados.retornoEm } },
  } });
  return tx.avaliacaoReprodutiva.findUniqueOrThrow({ where: { id } });
}

export async function anularEvidenciaAvaliacaoTx(tx: Prisma.TransactionClient, id: string, data: { status: "ANULADO"; motivoAnulacao: string; anuladoEm: Date }) {
  const interpretacao = await tx.interpretacaoReprodutiva.findUniqueOrThrow({ where: { id } });
  await tx.exameAnimal.update({ where: { id: interpretacao.exameId }, data });
  return tx.avaliacaoReprodutiva.findUniqueOrThrow({ where: { id } });
}
