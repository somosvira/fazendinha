import { Prisma } from "@prisma/client";
import { auditar, RebanhoError } from "../rebanho/regras.js";
import { registrarExameTx } from "../sanidade/exames.js";
import type { CorrecaoPartoAmpliadaInput } from "./partos.schemas.js";
export const TIPO_EXAME_ESCORE_PARTO = "b0841f3c-3f88-4c2d-9d0d-3ef33d49b841";
type AcaoEscore = NonNullable<CorrecaoPartoAmpliadaInput["escoreMatriz"]>;
function erro(mensagem: string): never { throw new RebanhoError("VALIDACAO", mensagem, "escoreMatriz"); }
export function validarEscalaEscore(valor: number, minimo: number, maximo: number) {
  if (![valor, minimo, maximo].every(Number.isFinite) || minimo >= maximo || valor < minimo || valor > maximo) erro("Informe escala mínima menor que máxima e escore dentro dos limites declarados");
}
export async function aplicarEscorePartoTx(tx: Prisma.TransactionClient, parto: Prisma.PartoAnimalGetPayload<Record<string, never>>, acao: AcaoEscore | undefined, usuarioId: number | null) {
  if (!acao) return;
  if (acao.acao !== "ANULAR") {
    validarEscalaEscore(acao.valor, acao.escalaMin, acao.escalaMax);
    if (new Date(acao.data) < parto.data) erro("Escore pós-parto não pode anteceder o parto");
  }
  const anteriores = await tx.exameAnimal.findMany({ where: { partoPosPartoId: parto.id, status: "VALIDO", finalidadePrincipal: "ESCORE_CORPORAL" }, include: { resultados: { where: { vigente: true } } } });
  if (acao.acao === "REGISTRAR" && anteriores.length) erro("Já há escore vigente; use substituição explícita com motivo");
  if (acao.acao !== "REGISTRAR") {
    const anterior = anteriores.find(e => e.id === acao.exameId);
    if (!anterior) erro("Escore vigente não encontrado neste parto");
    const anulado = await tx.exameAnimal.update({ where: { id: anterior.id }, data: { status: "ANULADO", anuladoEm: new Date(), motivoAnulacao: acao.motivo } });
    await auditar(tx, { entidade: "ExameAnimal", entidadeId: anterior.id, animalId: parto.animalId, propriedadeId: parto.propriedadeId, acao: "ANULACAO_ESCORE_PARTO", usuarioId, antes: anterior, depois: { ...anulado, motivo: acao.motivo } });
  }
  if (acao.acao === "ANULAR") return;
  const resultados: { campo: string; valor: string | number }[] = [
    { campo: "ESCORE", valor: acao.valor }, { campo: "ESCALA_MIN", valor: acao.escalaMin }, { campo: "ESCALA_MAX", valor: acao.escalaMax },
    ...(acao.escalaDescricao ? [{ campo: "ESCALA_DESCRICAO", valor: acao.escalaDescricao }] : []),
  ];
  const exame = await registrarExameTx(tx, { animalId: parto.animalId, propriedadeId: parto.propriedadeId!, data: acao.data, tipoExameId: TIPO_EXAME_ESCORE_PARTO, resultados, responsavel: acao.responsavel }, usuarioId);
  const snapshot = exame.formatoSnapshot as Prisma.JsonObject;
  const salvo = await tx.exameAnimal.update({ where: { id: exame.id }, data: { partoPosPartoId: parto.id, finalidades: ["ESCORE_CORPORAL"], finalidadePrincipal: "ESCORE_CORPORAL", formatoSnapshot: { ...snapshot, escala: { minimo: acao.escalaMin, maximo: acao.escalaMax, descricao: acao.escalaDescricao ?? null } } as Prisma.InputJsonValue } });
  await auditar(tx, { entidade: "ExameAnimal", entidadeId: salvo.id, animalId: parto.animalId, propriedadeId: parto.propriedadeId, acao: "VINCULO_ESCORE_PARTO", usuarioId, antes: exame, depois: salvo });
}
