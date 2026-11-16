import { Prisma } from "@prisma/client";
/** Evidência fictícia explícita para cenários cujo objeto é outra operação; não é cadastro operacional. */
export async function criarAptidaoFixture(tx: Prisma.TransactionClient, animalId: string, propriedadeId: number, data: Date) {
  const tipo = await tx.tipoExame.create({ data: { nome: `Aptidão fixture ${crypto.randomUUID()}`, contexto: "COMPARTILHADO", tipoResultado: "OPCAO", opcoes: ["APTO", "NAO_APTO", "INCONCLUSIVO"] } });
  const exame = await tx.exameAnimal.create({ data: { animalId, propriedadeId, data, tipoExameId: tipo.id, finalidadePrincipal: "APTIDAO_REPRODUTIVA", finalidades: ["APTIDAO_REPRODUTIVA"], resultadoOpcao: "APTO", responsavel: "Veterinária fictícia do teste", formatoSnapshot: { nome: tipo.nome, tipoResultado: "OPCAO", opcoes: tipo.opcoes } } });
  return exame;
}
/** Limpeza limitada às identidades da suíte e ao formato exclusivo desta fixture. */
export async function limparAptidaoFixture(tx: Prisma.TransactionClient, animalIds: string[]) {
  const exames = await tx.exameAnimal.findMany({ where: { animalId: { in: animalIds }, tipoExame: { nome: { startsWith: "Aptidão fixture " } } }, select: { id: true, tipoExameId: true } });
  await tx.exameAnimal.deleteMany({ where: { id: { in: exames.map(e => e.id) } } });
  await tx.tipoExame.deleteMany({ where: { id: { in: exames.map(e => e.tipoExameId) } } });
}
