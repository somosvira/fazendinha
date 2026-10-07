import crypto from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "../../../db.js";
import { cadastrar } from "../rebanho/animais.js";
import { cadastrarAnimalSchema } from "../rebanho/schemas.js";
import { alterarEstadoDieta, anularVigencia, atribuirDieta, corrigirVigencia, criarDieta, criarVersaoDieta, excluirDieta, listarVigencias, previaAlteracaoVigencia, publicarDieta } from "./dietas.js";
import { confirmarConsumo, detalheFechamento, estornarFechamento, listarFechamentos, previaConsumo, resumoMensal } from "./consumo.js";

const comBanco = process.env.PECUARIA_DB_INTEGRATION === "1" ? describe : describe.skip;
const run = crypto.randomUUID();
const nome = `Dieta Redesign ${run}`;
let propriedadeId = 0; let loteId = ""; let produtoId = ""; let categoriaId = ""; let centroId = ""; let animalId = "";
let dietaId = ""; let versaoId = ""; let vigenciaId = ""; let fechamentoId = "";

afterAll(async () => {
  if (!propriedadeId) return;
  const dietas = await prisma.dieta.findMany({ where: { nome: { contains: run, mode: "insensitive" } }, select: { id: true } });
  await prisma.auditoriaPecuaria.deleteMany({ where: { OR: [{ propriedadeId }, { entidadeId: { in: dietas.map((d) => d.id) } }] } });
  await prisma.itemFechamentoConsumo.deleteMany({ where: { fechamento: { loteId } } });
  await prisma.participacaoConsumoAnimal.deleteMany({ where: { fechamento: { loteId } } });
  await prisma.fechamentoConsumo.deleteMany({ where: { loteId } });
  await prisma.vigenciaDietaLote.deleteMany({ where: { loteId } });
  await prisma.itemDieta.deleteMany({ where: { dietaId: { in: dietas.map((d) => d.id) } } });
  await prisma.dieta.deleteMany({ where: { id: { in: dietas.map((d) => d.id) } } });
  await prisma.destinoAnimal.deleteMany({ where: { animalId } });
  await prisma.localizacaoAnimal.deleteMany({ where: { animalId } });
  await prisma.animal.deleteMany({ where: { id: animalId } });
  await prisma.lote.deleteMany({ where: { id: loteId } });
  await prisma.produto.deleteMany({ where: { id: produtoId } });
  await prisma.categoria.deleteMany({ where: { id: categoriaId } });
  await prisma.centroCusto.deleteMany({ where: { id: centroId } });
  await prisma.propriedade.deleteMany({ where: { id: propriedadeId } });
});

comBanco("nutrição redesign no PostgreSQL isolado", () => {
  it("bloqueia criação concorrente por nome normalizado e cria versão somente pela ação explícita", async () => {
    propriedadeId = (await prisma.propriedade.create({ data: { nome } })).id;
    centroId = (await prisma.centroCusto.create({ data: { nome } })).id;
    loteId = (await prisma.lote.create({ data: { nome, propriedadeId, centroCustoId: centroId } })).id;
    categoriaId = (await prisma.categoria.create({ data: { nome } })).id;
    produtoId = (await prisma.produto.create({ data: { nome, categoriaId, unidade: "KG", usoNutricional: true } })).id;
    animalId = (await cadastrar(cadastrarAnimalSchema.parse({ brinco: `NR${run.slice(0, 8)}`, sexo: "F", origem: "COMPRADO", aptidao: "LEITE", dataNascimento: "2024-01-01", dataEntrada: "2026-08-01", propriedadeId, loteId }), null)).id;
    const itens = [{ produtoId, quantidadeCabecaDia: 2 }];
    const concorrentes = await Promise.allSettled([criarDieta({ nome, itens }, null), criarDieta({ nome: `  ${nome.toUpperCase().replace("DIETA", "DIÉTA")}  `, itens }, null)]);
    const criadas = concorrentes.filter((r) => r.status === "fulfilled");
    expect(criadas).toHaveLength(1);
    expect(concorrentes.filter((r) => r.status === "rejected")).toHaveLength(1);
    if (criadas[0].status !== "fulfilled") throw new Error("Dieta não criada");
    dietaId = criadas[0].value.id;
    expect(criadas[0].value.versao).toBe(1);
    await expect(criarDieta({ nome: `${nome} `, itens }, null)).rejects.toThrow(/Nova versão/);
    versaoId = (await criarVersaoDieta(dietaId, null)).id;
    expect(await prisma.dieta.findUnique({ where: { id: versaoId } })).toMatchObject({ versao: 2, publicadaEm: null });
    await publicarDieta(dietaId, null); await publicarDieta(versaoId, null);
  });

  it("corrige dieta e início com prévia e recusa revisão desatualizada", async () => {
    await atribuirDieta({ loteId, propriedadeId, dietaId, desde: "2026-09-01" }, null);
    vigenciaId = (await atribuirDieta({ loteId, propriedadeId, dietaId: versaoId, desde: "2026-09-06" }, null)).id;
    const input = { desde: "2026-09-07", dietaId, motivo: "Corrigir atribuição do lote" };
    const previa = await previaAlteracaoVigencia(vigenciaId, propriedadeId, input);
    expect(previa.bloqueada).toBe(false);
    const anteriorId = vigenciaId;
    vigenciaId = (await corrigirVigencia(vigenciaId, propriedadeId, { ...input, revisao: previa.revisao }, null)).id;
    expect(vigenciaId).not.toBe(anteriorId);
    expect(await prisma.vigenciaDietaLote.findUnique({ where: { id: anteriorId } })).toMatchObject({ status: "ANULADO", dietaId: versaoId });
    await expect(corrigirVigencia(vigenciaId, propriedadeId, { ...input, revisao: previa.revisao }, null)).rejects.toThrow(/mudou desde a prévia/);
    expect(await prisma.vigenciaDietaLote.findUnique({ where: { id: vigenciaId } })).toMatchObject({ dietaId, desde: new Date("2026-09-07") });
    const global = await listarVigencias(undefined, propriedadeId, { pagina: 1, limite: 1, loteIds: [loteId], status: ["VALIDO"] });
    expect(global.total).toBe(2); expect(global.itens).toHaveLength(1); expect(global.itens[0].propriedadeId).toBe(propriedadeId);
  });

  it("consumo diário sem baixa mantém custo desconhecido e resumo mensal não cria novo movimento", async () => {
    const contexto = { loteId, propriedadeId, inicio: "2026-09-08", fim: "2026-09-08" };
    const previa = await previaConsumo(contexto); expect(previa.animalDias).toBe(1);
    fechamentoId = (await confirmarConsumo({ ...contexto, itens: [{ produtoId, modoEstoque: "SEM_BAIXA_JUSTIFICADA", justificativaSemBaixa: "Alimentação recebida sem entrada física" }] }, null)).id;
    await expect(confirmarConsumo({ ...contexto, itens: [{ produtoId, modoEstoque: "SEM_BAIXA_JUSTIFICADA", justificativaSemBaixa: "Alimentação recebida sem entrada física" }] }, null)).rejects.toThrow(/já confirmado/);
    const movimentosAntes = await prisma.movimentoEstoque.count({ where: { produtoId } });
    for (let i = 0; i < 2; i++) {
      const resumo = await resumoMensal({ mes: "2026-09", loteIds: [loteId] }, propriedadeId, true);
      expect(resumo).toMatchObject({ fechamentos: 1, animalDias: 1, custoConhecido: null, coberturaCustoCompleta: false, itens: [{ quantidadeConfirmada: "2.000" }] });
    }
    expect(await prisma.movimentoEstoque.count({ where: { produtoId } })).toBe(movimentosAntes);
    expect((await listarFechamentos(undefined, propriedadeId, { pagina: 1, limite: 1, loteIds: [loteId], status: ["CONFIRMADO"] })).total).toBe(1);
    const input = { motivo: "Atribuição lançada por engano" };
    const previaAnulacao = await previaAlteracaoVigencia(vigenciaId, propriedadeId, { ...input, anular: true });
    expect(previaAnulacao).toMatchObject({ bloqueada: true, fechamentosAfetados: [{ id: fechamentoId }] });
    await expect(anularVigencia(vigenciaId, propriedadeId, { ...input, revisao: previaAnulacao.revisao }, null)).rejects.toThrow(/Estorne/);
    await expect(corrigirVigencia(vigenciaId, propriedadeId, { desde: "2026-09-07", dietaId: versaoId, motivo: "Trocar receita confirmada" }, null)).rejects.toThrow(/Estorne/);
  });

  it("após estorno anula com histórico e lacuna; dieta usada somente inativa e versão sem uso pode ser excluída", async () => {
    await estornarFechamento(fechamentoId, propriedadeId, "Revisar consumo e atribuição", null);
    const troca = { desde: "2026-09-07", dietaId: versaoId, motivo: "Corrigir receita após estorno" };
    const previaTroca = await previaAlteracaoVigencia(vigenciaId, propriedadeId, troca);
    vigenciaId = (await corrigirVigencia(vigenciaId, propriedadeId, { ...troca, revisao: previaTroca.revisao }, null)).id;
    expect((await detalheFechamento(fechamentoId, propriedadeId, true)).vigencia.dieta.versao).toBe(1);
    expect(await prisma.vigenciaDietaLote.findUnique({ where: { id: vigenciaId } })).toMatchObject({ dietaId: versaoId, status: "VALIDO" });
    const input = { motivo: "Atribuição lançada por engano" };
    const previa = await previaAlteracaoVigencia(vigenciaId, propriedadeId, { ...input, anular: true });
    await anularVigencia(vigenciaId, propriedadeId, { ...input, revisao: previa.revisao }, null);
    expect(await prisma.vigenciaDietaLote.findUnique({ where: { id: vigenciaId } })).toMatchObject({ status: "ANULADO", motivoAnulacao: input.motivo });
    await expect(previaConsumo({ loteId, propriedadeId, inicio: "2026-09-08", fim: "2026-09-08" })).rejects.toThrow(/Não há dieta/);
    await expect(excluirDieta(dietaId, null)).rejects.toThrow(/inativada/);
    expect((await alterarEstadoDieta(dietaId, false, null)).ativo).toBe(false);
    const semUso = await criarVersaoDieta(versaoId, null);
    await excluirDieta(semUso.id, null);
    expect(await prisma.dieta.findUnique({ where: { id: semUso.id } })).toBeNull();
    expect(await prisma.auditoriaPecuaria.count({ where: { entidadeId: semUso.id, acao: "EXCLUSAO" } })).toBe(1);
    await prisma.auditoriaPecuaria.deleteMany({ where: { entidadeId: semUso.id } });
    expect((await resumoMensal({ mes: "2026-09", loteIds: [loteId] }, propriedadeId, false)).fechamentos).toBe(0);
  });
});
