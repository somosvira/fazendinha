import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { AlertaError } from "./erros.js";
import type { AutorAlerta, PublicacaoAlerta } from "./contratos.js";
import { exigirTipoRegistrado, validarResumoRegistrado } from "./registro.js";
export function serializarEstavel(v: unknown): string {
  if (v instanceof Date) return JSON.stringify(v.toISOString());
  if (Array.isArray(v)) return `[${v.map(serializarEstavel).join(",")}]`;
  if (v !== null && typeof v === "object") return `{${Object.entries(v).filter(([, x]) => x !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([k, x]) => `${JSON.stringify(k)}:${serializarEstavel(x)}`).join(",")}}`;
  return JSON.stringify(v) ?? "null";
}
export const hashConteudo = (v: unknown) => createHash("sha256").update(serializarEstavel(v)).digest("hex");
/** Só produtores internos, dentro da mesma transação do fato. Lock protege inclusive primeira publicação concorrente. */
export async function publicarAlertaTx(tx: Prisma.TransactionClient, entrada: PublicacaoAlerta, autor: AutorAlerta) {
  exigirTipoRegistrado(entrada.produtor, entrada.tipo, entrada.versaoContrato);
  validarResumoRegistrado(entrada.tipo,entrada.resumo);
  if (!Number.isInteger(entrada.revisaoOrigem) || entrada.revisaoOrigem < 1 || (!autor.tecnico && (!autor.usuarioId || autor.usuarioId < 1))) throw new AlertaError("VALIDACAO", "Revisão e autoria válidas são obrigatórias");
  const { proprietario, produtor, tipo, chaveOcorrencia } = entrada;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`${proprietario}:${produtor}:${tipo}:${chaveOcorrencia}`}, 0))`;
  const atual = await tx.alerta.findUnique({ where: { proprietario_produtor_tipo_chaveOcorrencia: { proprietario, produtor, tipo, chaveOcorrencia } } });
  const hash = hashConteudo(entrada);
  if (atual) {
    const evento = await tx.eventoAlerta.findUnique({ where: { alertaId_revisao: { alertaId: atual.id, revisao: entrada.revisaoOrigem } } });
    if (evento) {
      if (evento.hash !== hash) throw new AlertaError("CONFLITO", "A revisão do alerta já foi publicada com outro conteúdo");
      return { alertaId: atual.id, revisao: atual.revisao, resultado: "SEM_ALTERACAO" as const };
    }
    if (entrada.revisaoOrigem <= atual.revisao) throw new AlertaError("CONFLITO", "Publicação anterior à revisão vigente");
    if (atual.ciclo !== "ABERTO" && entrada.comando === "PUBLICAR") throw new AlertaError("CONFLITO", "Reabrir um alerta exige comando explícito");
  } else if (entrada.comando !== "PUBLICAR") throw new AlertaError("CONFLITO", "Alerta ainda não publicado");
  const ciclo = entrada.comando === "ENCERRAR" ? "ENCERRADO" : entrada.comando === "INVALIDAR" ? "INVALIDADO" : "ABERTO";
  const dados = { revisao: entrada.revisaoOrigem, ciclo, situacao: entrada.situacao, propriedadeId: entrada.propriedadeId, origemId: entrada.origemId, sujeitoTipo: entrada.sujeitoTipo, sujeitoId: entrada.sujeitoId, chaveAgrupamento: entrada.chaveAgrupamento, titulo: entrada.titulo, motivo: entrada.motivo, resumo: entrada.resumo, dataReferencia: entrada.dataReferencia ?? null, visivelDesde: entrada.visivelDesde ?? null, prazo: entrada.prazo ?? null };
  const alerta = atual ? await tx.alerta.update({ where: { id: atual.id }, data: dados }) : await tx.alerta.create({ data: { ...dados, proprietario, produtor, tipo, chaveOcorrencia, snapshotInicial: JSON.parse(serializarEstavel(entrada)) as Prisma.InputJsonObject } });
  await tx.eventoAlerta.create({ data: { alertaId: alerta.id, revisao: entrada.revisaoOrigem, eventoId: entrada.eventoId, comando: entrada.comando, hash, payload: JSON.parse(serializarEstavel(entrada)) as Prisma.InputJsonObject, autorUsuarioId: autor.usuarioId ?? null, autorTecnico: autor.tecnico ?? null } });
  return { alertaId: alerta.id, revisao: alerta.revisao, resultado: atual ? "ATUALIZADO" as const : "CRIADO" as const };
}
