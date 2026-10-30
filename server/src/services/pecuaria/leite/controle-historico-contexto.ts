import type { Prisma } from "@prisma/client";
import { validarContextoHistoricoAnimalTx } from "../importacao/pesagens.js";
import { hojeFazendaDate, RebanhoError } from "../rebanho/regras.js";
import type { ControleHistoricoLeiteInput } from "./controle-historico.calc.js";

type ContextoControle = Pick<ControleHistoricoLeiteInput,
  "animalId" | "propriedadeId" | "contexto" | "inicio" | "fim" | "lactacaoId" | "evidencia">;

/** A criação e as guardas inversas conservam as mesmas regras na data factual. */
export async function validarContextoControleHistoricoLeiteTx(tx: Prisma.TransactionClient, dados: ContextoControle) {
  if (new Date(dados.fim) > hojeFazendaDate())
    throw new RebanhoError("VALIDACAO", "Histórico não pode estar no futuro");
  if (dados.animalId) {
    await validarContextoHistoricoAnimalTx(tx, {
      animalId: dados.animalId, data: dados.inicio, contexto: dados.contexto,
      propriedadeId: dados.propriedadeId, evidencia: dados.evidencia,
    });
    const animal = await tx.animal.findUnique({ where: { id: dados.animalId }, select: { sexo: true } });
    if (animal?.sexo !== "F")
      throw new RebanhoError("VALIDACAO", "Controle individual exige fêmea", "sexo");
  }
  let lactacao = null;
  if (dados.lactacaoId) {
    lactacao = await tx.lactacaoAnimal.findUnique({ where: { id: dados.lactacaoId } });
    if (!lactacao || dados.contexto !== "INTERNO" || lactacao.animalId !== dados.animalId ||
        lactacao.propriedadeId !== dados.propriedadeId || lactacao.inicio > new Date(dados.inicio) ||
        lactacao.encerradaEm && lactacao.encerradaEm <= new Date(dados.fim))
      throw new RebanhoError("VALIDACAO", "Lactação não comprova vínculo no período do controle", "lactacaoId");
  }
  return lactacao;
}

/** Chamador mantém a trava do animal e a transação que alterou seu contexto.
 * Coletivos não dependem de animais; externos não recebem entrada/sítio interno. */
export async function conferirControlesHistoricosLeiteTx(tx: Prisma.TransactionClient, animalIds: string[]) {
  const controles = await tx.controleHistoricoLeite.findMany({ where: { animalId: { in: animalIds } } });
  for (const controle of controles) {
    try {
      await validarContextoControleHistoricoLeiteTx(tx, {
        ...controle, contexto: controle.contextoHistorico as "INTERNO" | "EXTERNO",
        inicio: controle.inicio.toISOString().slice(0, 10), fim: controle.fim.toISOString().slice(0, 10),
        evidencia: "Contexto do controle documental preservado",
      });
    } catch (erro) {
      if (!(erro instanceof RebanhoError)) throw erro;
      throw new RebanhoError("CONFLITO", `A alteração invalida o controle histórico de leite ${controle.id}: ${erro.message}. Reconcilie o documento antes`, erro.campo);
    }
  }
}
