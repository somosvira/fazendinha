import { conferirConclusaoAptidaoTx } from "./elegibilidade.js";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { registrarExameTx, criarTipoExameTx, corrigirExameTx } from "../sanidade/exames.js";
import { conferirAnimalNoFato } from "../fatos.js";
import { transacaoPecuaria } from "../transacao.js";
import { auditar, travarAnimais, RebanhoError } from "../rebanho/regras.js";
import { operacaoIdempotenteTx } from "./operacoes.js";
import { registrarToqueAptidaoSchema } from "./toque-aptidao.schemas.js";
import { FINALIDADE_APTIDAO } from "./toque-aptidao.calc.js";
export const NOME_TIPO = "Toque de aptidão reprodutiva";
/** Mesmo núcleo de exames, com conclusão direta de aptidão e sem interpretação gestacional. */
export function registrarToqueAptidao(input: z.infer<typeof registrarToqueAptidaoSchema>, usuarioId: number | null) {
  return transacaoPecuaria(async tx => {
    await travarAnimais(tx, [input.animalId]);
    await conferirAnimalNoFato(tx, input.animalId, input.propriedadeId, new Date(`${input.data}T00:00:00Z`));
    return operacaoIdempotenteTx(tx, input, usuarioId, "TOQUE_APTIDAO", async () => {
      return registrarToqueAptidaoTx(tx, input, usuarioId);
    });
  });
}

export async function garantirTipoToqueAptidaoTx(tx: Prisma.TransactionClient, usuarioId: number | null) {
  const existente = await tx.tipoExame.findUnique({ where: { nome: NOME_TIPO } });
  if (existente) return existente;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('pec-tipo-toque-aptidao'))`;
  const concorrente = await tx.tipoExame.findUnique({ where: { nome: NOME_TIPO } });
  return concorrente ?? criarTipoExameTx(tx, { nome: NOME_TIPO, tipoResultado: "OPCAO", opcoes: ["APTO", "NAO_APTO", "INCONCLUSIVO"] }, usuarioId, "COMPARTILHADO");
}
export async function corrigirToqueAptidao(id: string, input: { chave: string; propriedadeId: number; motivo: string; resultado?: "APTO" | "NAO_APTO" | "INCONCLUSIVO"; retornoEm?: string | null; anular?: boolean }, usuarioId: number | null) {
  return transacaoPecuaria(async tx => {
    const where = { id, propriedadeId: input.propriedadeId, OR: [{ finalidadePrincipal: FINALIDADE_APTIDAO }, { interpretacao: { resultadoAptidao: { not: null } } }] };
    const referencia = await tx.exameAnimal.findFirst({ where, include: { interpretacao: true } });
    if (!referencia) throw new RebanhoError("NAO_ENCONTRADO", "Toque de aptidão não encontrado neste sítio");
    await travarAnimais(tx, [referencia.animalId]);
    const origem = await tx.exameAnimal.findFirst({ where, include: { interpretacao: true } });
    if (!origem) throw new RebanhoError("CONFLITO", "Exame já anulado; atualize a consulta");
    await conferirAnimalNoFato(tx, origem.animalId, input.propriedadeId, origem.data);
    return operacaoIdempotenteTx(tx, { id, ...input }, usuarioId, "CORRECAO_TOQUE_APTIDAO", async () => {
      if (origem.status !== "VALIDO") throw new RebanhoError("CONFLITO", "Exame já anulado; atualize a consulta");
      if (input.retornoEm && new Date(input.retornoEm) <= origem.data) throw new RebanhoError("VALIDACAO", "Retorno deve ser posterior ao exame", "retornoEm");
      if (origem.finalidadePrincipal !== FINALIDADE_APTIDAO) {
        if (input.anular) throw new RebanhoError("CONFLITO", "Para anular o exame combinado, revise a avaliação e seus vínculos gestacionais");
        const avaliacao = await tx.avaliacaoReprodutiva.findUniqueOrThrow({ where: { id: origem.interpretacao!.id } });
        await conferirConclusaoAptidaoTx(tx, { animalId: origem.animalId, propriedadeId: input.propriedadeId, data: origem.data, resultadoAptidao: input.resultado, resultadoGestacional: avaliacao.resultado });
        const salvo = await tx.exameAnimal.update({ where: { id }, data: { atualizadoEm: new Date(), interpretacao: { update: {
          ...(input.resultado !== undefined ? { resultadoAptidao: input.resultado } : {}),
          ...(input.retornoEm !== undefined ? { retornoAptidaoEm: input.retornoEm ? new Date(`${input.retornoEm}T00:00:00Z`) : null } : {}),
        } } }, include: { interpretacao: true } });
        await auditar(tx, { entidade: "ExameAnimal", entidadeId: id, animalId: origem.animalId, propriedadeId: input.propriedadeId,
          acao: "REVISAO_APTIDAO_EXAME_COMBINADO", usuarioId, antes: origem, depois: { ...salvo, motivo: input.motivo } });
        return salvo;
      }
      if (!input.anular) await conferirConclusaoAptidaoTx(tx, { animalId: origem.animalId, propriedadeId: input.propriedadeId, data: origem.data, resultadoAptidao: input.resultado });
      const salvo = await corrigirExameTx(tx, id, input.propriedadeId, { motivo: input.motivo, resultadoOpcao: input.resultado, anular: input.anular }, usuarioId, undefined, true);
      const interpretacao = input.retornoEm !== undefined ? await tx.interpretacaoReprodutiva.update({ where: { exameId: id }, data: { retornoEm: input.retornoEm ? new Date(`${input.retornoEm}T00:00:00Z`) : null } }) : origem.interpretacao;
      await auditar(tx, { entidade: "ExameAnimal", entidadeId: id, animalId: origem.animalId, propriedadeId: input.propriedadeId,
        acao: "REVISAO_TOQUE_APTIDAO", usuarioId, antes: origem, depois: { ...salvo, interpretacao, motivo: input.motivo } });
      // A projeção usa a evidência corrigida; a auditoria conserva o valor anterior.
      return salvo;
    });
  });
}

export async function registrarToqueAptidaoTx(tx: Prisma.TransactionClient, input: Omit<z.infer<typeof registrarToqueAptidaoSchema>, "chave">, usuarioId: number | null) {
      await travarAnimais(tx, [input.animalId]);
      const animal = await conferirAnimalNoFato(tx, input.animalId, input.propriedadeId, new Date(`${input.data}T00:00:00Z`));
      if (animal.sexo !== "F") throw new RebanhoError("VALIDACAO", "Toque de aptidão exige fêmea", "animalId");
      await conferirConclusaoAptidaoTx(tx, { animalId: input.animalId, propriedadeId: input.propriedadeId, data: new Date(`${input.data}T00:00:00Z`), resultadoAptidao: input.resultado });
      const tipo = await garantirTipoToqueAptidaoTx(tx, usuarioId);
      const exame = await registrarExameTx(tx, { ...input, tipoExameId: tipo.id, resultadoOpcao: input.resultado }, usuarioId);
      const depois = await tx.exameAnimal.update({ where: { id: exame.id }, data: { finalidades: [FINALIDADE_APTIDAO], finalidadePrincipal: FINALIDADE_APTIDAO,
        interpretacao: { create: { retornoEm: input.retornoEm ? new Date(`${input.retornoEm}T00:00:00Z`) : null } } } });
      await auditar(tx, { entidade: "ExameAnimal", entidadeId: exame.id, animalId: input.animalId, propriedadeId: input.propriedadeId, acao: "TOQUE_APTIDAO", usuarioId, antes: exame, depois });
      return depois;
}
