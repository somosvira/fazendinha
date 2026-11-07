import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../../db.js";
import { exigirBancoIntegracaoPecuaria } from "../../../lib/banco-pecuaria-integration.fixture.js";

// Cada fixture é inteiramente revertida na própria transação; nunca limpa dados existentes.
const suite = process.env.PECUARIA_DB_INTEGRATION === "1" ? describe : describe.skip;
const dia = (data: string) => new Date(`${data}T00:00:00Z`);
class ReverterFixture extends Error {}
async function fixture(tx: Prisma.TransactionClient) {
  const sitio = await tx.propriedade.create({ data: { nome: `Conclusão ${randomUUID()}` } });
  const animal = await tx.animal.create({ data: { brinco: `C${randomUUID()}`, sexo: "F", origem: "COMPRADO", dataNascimento: dia("2024-01-01"), dataEntrada: dia("2025-01-01") } });
  await tx.localizacaoAnimal.create({ data: { animalId: animal.id, propriedadeId: sitio.id, desde: dia("2025-01-01") } });
  const tentativa = await tx.tentativaReprodutiva.create({ data: { animalId: animal.id, propriedadeId: sitio.id, data: dia("2026-01-01"), tipo: "IA", ciclo: 1, ordem: 1, origemMaterial: "DOCUMENTADA", geneticaSnapshot: { origem: "FIXTURE" } } });
  const gestacao = await tx.gestacaoAnimal.create({ data: { animalId: animal.id, propriedadeId: sitio.id, tentativaId: tentativa.id, confirmadaEm: dia("2026-01-03") } });
  const politica = await tx.politicaAcompanhamentoReprodutivo.create({ data: { propriedadeId: sitio.id, versao: 1, vigenteDesde: dia("2026-01-01"), parametros: { versao: 1, efeito: "ALERTA", diagnostico: { diasAposTentativa: 10 }, reconfirmacoes: [{ ocorrencia: 1, diasAposPrimeiroPositivo: 7 }, { ocorrencia: 2, diasAposPrimeiroPositivo: 17 }] } } });
  const demandas = [];
  for (const ocorrencia of [1, 2]) demandas.push(await tx.demandaAcompanhamentoReprodutivo.create({ data: { animalId: animal.id, propriedadeOrigemId: sitio.id, finalidade: "RECONFIRMACAO", gestacaoId: gestacao.id, ocorrencia, politicaId: politica.id, dataReferencia: dia("2026-01-03"), previstaPara: dia("2026-01-10"), regraSnapshot: { versao: 1, efeito: "ALERTA", politicaId: politica.id, politicaVersao: 1 } } }));
  const tipo = await tx.tipoExame.create({ data: { nome: `Conclusão ${randomUUID()}`, tipoResultado: "MULTIPLO", contexto: "REPRODUTIVO", campos: [{ codigo: "CONCLUSAO_GESTACIONAL", tipo: "OPCAO", opcoes: ["POSITIVO", "NEGATIVO", "INCONCLUSIVO"] }] } });
  const exame = await tx.exameAnimal.create({ data: { animalId: animal.id, propriedadeId: sitio.id, tipoExameId: tipo.id, data: dia("2026-01-25"), finalidades: ["RECONFIRMACAO"], finalidadePrincipal: "RECONFIRMACAO", formatoSnapshot: { nome: tipo.nome, tipoResultado: "MULTIPLO", versao: 1 }, interpretacao: { create: { gestacaoId: gestacao.id } }, resultados: { create: { campo: "CONCLUSAO_GESTACIONAL", valor: "POSITIVO" } } }, include: { resultados: true } });
  return { demandas, exame, resultado: exame.resultados[0], sitio, tipo };
}
async function vincular(tx: Prisma.TransactionClient, demandaId: string, resultadoId: string) {
  const v = await tx.vinculoConclusaoAcompanhamento.create({ data: { demandaId, fonte: "RESULTADO", resultadoId, valorSnapshot: "POSITIVO" } });
  await tx.demandaAcompanhamentoReprodutivo.update({ where: { id: demandaId }, data: { estado: "RESOLVIDA", vinculoConclusaoResolucaoId: v.id, resolvidaEm: dia("2026-01-25"), resolucaoSnapshot: { resultadoId } } });
  return v;
}
suite("conclusões: constraints SQL", () => {
  beforeAll(() => { exigirBancoIntegracaoPecuaria(); });
  it("aceita vínculo compatível e mantém a fixture isolada", async () => {
    await expect(prisma.$transaction(async tx => {
      const f = await fixture(tx); await vincular(tx, f.demandas[0].id, f.resultado.id);
      await tx.$executeRaw`SET CONSTRAINTS ALL IMMEDIATE`;
      throw new ReverterFixture();
    }, { timeout: 30_000 })).rejects.toBeInstanceOf(ReverterFixture);
  });
  it("não permite que a mesma conclusão resolva duas ocorrências", async () => {
    await expect(prisma.$transaction(async tx => {
      const f = await fixture(tx); await vincular(tx, f.demandas[0].id, f.resultado.id);
      await tx.$executeRaw`SET CONSTRAINTS ALL IMMEDIATE`;
      await tx.$executeRaw`SET CONSTRAINTS ALL DEFERRED`;
      await expect(vincular(tx, f.demandas[1].id, f.resultado.id)).rejects.toThrow();
      throw new ReverterFixture();
    }, { timeout: 30_000 })).rejects.toBeInstanceOf(ReverterFixture);
  });
  it("catálogo publicado impede alteração de seu formato e preserva fixtures", async () => {
    await expect(prisma.$transaction(async tx => {
      const f = await fixture(tx);
      await tx.catalogoAvaliacaoReprodutiva.create({data:{propriedadeId:f.sitio.id,versao:1,tipoExameId:f.tipo.id,itens:[{codigo:"DG",tipo:"DIAGNOSTICO"}],condutas:[]}});
      await tx.$executeRaw`SET CONSTRAINTS ALL IMMEDIATE`;
      await expect(tx.tipoExame.update({where:{id:f.tipo.id},data:{campos:[{codigo:"OUTRO",tipo:"TEXTO"}]}})).rejects.toThrow();
      throw new ReverterFixture();
    }, { timeout:30_000 })).rejects.toBeInstanceOf(ReverterFixture);
  });
  it("snapshot de itens não pode ser reescrito", async () => {
    await expect(prisma.$transaction(async tx => {
      const f = await fixture(tx);
      await tx.exameAnimal.update({where:{id:f.exame.id},data:{avaliacaoContextualSnapshot:{itens:[]}}});
      await tx.$executeRaw`SET CONSTRAINTS ALL IMMEDIATE`;
      await expect(tx.exameAnimal.update({where:{id:f.exame.id},data:{avaliacaoContextualSnapshot:{itens:[{codigo:"ALTERADO"}]}}})).rejects.toThrow();
      throw new ReverterFixture();
    }, { timeout:30_000 })).rejects.toBeInstanceOf(ReverterFixture);
  });
  it("recusa invalidar resultado sem reconciliar o vínculo na mesma transação", async () => {
    await expect(prisma.$transaction(async tx => {
      const f = await fixture(tx); await vincular(tx, f.demandas[0].id, f.resultado.id);
      await tx.$executeRaw`SET CONSTRAINTS ALL IMMEDIATE`;
      await tx.$executeRaw`SET CONSTRAINTS ALL DEFERRED`;
      await tx.resultadoExame.update({ where: { id: f.resultado.id }, data: { vigente: false, substituidoEm: new Date() } });
      await expect(tx.$executeRaw`SET CONSTRAINTS ALL IMMEDIATE`).rejects.toThrow();
      throw new ReverterFixture();
    }, { timeout: 30_000 })).rejects.toBeInstanceOf(ReverterFixture);
  });
});
