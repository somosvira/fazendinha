import crypto from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "../../../db.js";
import { cadastrar } from "../rebanho/animais.js";
import { cadastrarAnimalSchema } from "../rebanho/schemas.js";
import { atribuirDieta, criarDieta, publicarDieta } from "./dietas.js";
import { confirmarConsumo, confirmarPeriodos, consumoAnimal, detalheFechamento, estornarFechamento, previaConsumo, previaPeriodos } from "./consumo.js";

const describeComBanco = process.env.PECUARIA_DB_INTEGRATION === "1" ? describe : describe.skip;
const run = crypto.randomUUID().slice(0, 8);
const ids = { propriedade: 0, animal: "", lote: "", produto: "", centro: "", dieta: "", vigencia: "", fechamento: "", categoria: "" };

afterAll(async () => {
  if (!ids.propriedade) return;
  const fechamentos = await prisma.fechamentoConsumo.findMany({ where: { loteId: ids.lote }, select: { id: true } });
  const fechamentoIds = fechamentos.map((f) => f.id);
  await prisma.auditoriaPecuaria.deleteMany({ where: { OR: [{ animalId: ids.animal }, { entidadeId: { in: [ids.dieta, ids.vigencia, ...fechamentoIds] } }] } });
  await prisma.itemFechamentoConsumo.deleteMany({ where: { fechamentoId: { in: fechamentoIds } } });
  await prisma.participacaoConsumoAnimal.deleteMany({ where: { fechamentoId: { in: fechamentoIds } } });
  await prisma.fechamentoConsumo.deleteMany({ where: { id: { in: fechamentoIds } } });
  await prisma.requisicaoPecuaria.deleteMany({ where: { propriedadeId: ids.propriedade } });
  await prisma.vigenciaDietaLote.deleteMany({ where: { id: ids.vigencia } });
  await prisma.itemDieta.deleteMany({ where: { dietaId: ids.dieta } });
  await prisma.dieta.deleteMany({ where: { id: ids.dieta } });
  await prisma.movimentoEstoque.deleteMany({ where: { produtoId: ids.produto } });
  await prisma.destinoAnimal.deleteMany({ where: { animalId: ids.animal } });
  await prisma.localizacaoAnimal.deleteMany({ where: { animalId: ids.animal } });
  await prisma.animal.deleteMany({ where: { id: ids.animal } });
  await prisma.lote.deleteMany({ where: { id: ids.lote } });
  await prisma.produto.deleteMany({ where: { id: ids.produto } });
  await prisma.categoria.deleteMany({ where: { id: ids.categoria } });
  await prisma.centroCusto.deleteMany({ where: { id: ids.centro } });
  await prisma.propriedade.deleteMany({ where: { id: ids.propriedade } });
});

describeComBanco("fechamento nutricional com PostgreSQL", () => {
  it("calcula animal-dias, baixa consumo conferido e estorna sem duplicar custo financeiro", async () => {
    const propriedade = await prisma.propriedade.create({ data: { nome: `Pec V3 nutrição ${run}` } }); ids.propriedade = propriedade.id;
    const centro = await prisma.centroCusto.create({ data: { nome: `Pec V3 CC ${run}` } }); ids.centro = centro.id;
    const lote = await prisma.lote.create({ data: { nome: `Lote V3 ${run}`, propriedadeId: propriedade.id, centroCustoId: centro.id } }); ids.lote = lote.id;
    const animal = await cadastrar(cadastrarAnimalSchema.parse({ brinco: `NU${run}`, sexo: "F", origem: "COMPRADO", aptidao: "LEITE",
      dataNascimento: "2024-01-01", dataEntrada: "2026-08-01", propriedadeId: propriedade.id, loteId: lote.id }), null); ids.animal = animal.id;
    const categoria = await prisma.categoria.create({ data: { nome: `Nutrição V3 ${run}`, usoNutricional: true } }); ids.categoria = categoria.id;
    const produto = await prisma.produto.create({ data: { nome: `Ração V3 ${run}`, unidade: "KG", categoriaId: categoria.id, usoNutricional: true } }); ids.produto = produto.id;
    await prisma.movimentoEstoque.create({ data: { produtoId: produto.id, propriedadeId: propriedade.id,
      tipo: "ENTRADA", origem: "INVENTARIO_INICIAL", data: new Date("2026-08-30"), quantidade: 50, custoUnitario: 2, valorTotal: 100 } });
    const dieta = await criarDieta({ nome: `Dieta V3 ${run}`, itens: [{ produtoId: produto.id, quantidadeCabecaDia: 3 }] }, null); ids.dieta = dieta.id;
    await publicarDieta(dieta.id, null);
    const vigencia = await atribuirDieta({ loteId: lote.id, propriedadeId: propriedade.id, dietaId: dieta.id, desde: "2026-09-01" }, null); ids.vigencia = vigencia.id;
    const contexto = { loteId: lote.id, propriedadeId: propriedade.id, inicio: "2026-09-01", fim: "2026-09-10" };
    const previa = await previaConsumo(contexto);
    expect(previa.animalDias).toBe(10);
    expect(previa.itens[0].quantidadePrevista).toBe("30");
    const fechamento = await confirmarConsumo({ ...contexto, itens: [{ produtoId: produto.id, quantidadeConfirmada: 28,
      motivoAjuste: "Consumo real conferido", modoEstoque: "BAIXA_ESTOQUE" }] }, null);
    ids.fechamento = fechamento.id;
    expect(fechamento.itens[0].quantidadeConfirmada.toString()).toBe("28");
    const movimento = await prisma.movimentoEstoque.findUnique({ where: { id: fechamento.itens[0].movimentoEstoqueId! } });
    expect(movimento?.quantidade.toString()).toBe("28");
    const detalhe = await detalheFechamento(fechamento.id, propriedade.id, true);
    expect(detalhe.custoConhecido).toBe("56.00");
    expect(detalhe.participacoes[0].itens[0].quantidadeAtribuida).toBe("28.000");
    expect(detalhe.participacoes[0].itens[0].quantidadePorDia).toBe("2.800000");
    const individual = await consumoAnimal(animal.id, propriedade.id, { pagina: 1, limite: 25 }, false);
    expect(individual.total).toBe(1);
    expect(individual.itens[0].custoConhecido).toBeNull();
    expect(individual.itens[0].itens[0].custoConhecido).toBeNull();
    const local = await prisma.localizacaoAnimal.findFirstOrThrow({ where: { animalId: animal.id, loteId: lote.id } });
    await expect(prisma.localizacaoAnimal.update({ where: { id: local.id }, data: { desde: new Date("2026-09-05") } })).rejects.toThrow();
    await prisma.localizacaoAnimal.update({ where: { id: local.id }, data: { ate: new Date("2026-09-15") } });
    await prisma.localizacaoAnimal.update({ where: { id: local.id }, data: { ate: null } });
    await expect(confirmarConsumo({ ...contexto, itens: [{ produtoId: produto.id, modoEstoque: "BAIXA_ESTOQUE" }] }, null)).rejects.toThrow();
    await estornarFechamento(fechamento.id, propriedade.id, "Revisão do consumo registrado", null);
    expect((await prisma.fechamentoConsumo.findUnique({ where: { id: fechamento.id } }))?.status).toBe("ESTORNADO");
    expect((await detalheFechamento(fechamento.id, propriedade.id, true)).custoConhecido).toBe("56.00");
  });
  it("divide mês, aponta lacunas e confirma atomicamente sem duplicar no reenvio", async () => {
    const contexto = { loteId: ids.lote, propriedadeId: ids.propriedade, inicio: "2026-09-29", fim: "2026-10-02" };
    const previa = await previaPeriodos(contexto);
    expect(previa.lacunas).toEqual([]);
    expect(previa.periodos).toHaveLength(2);
    expect(previa.periodos.map((p) => p.itens[0].quantidadePrevista)).toEqual(["6", "6"]);
    const lacunas = await previaPeriodos({ ...contexto, inicio: "2026-08-30", fim: "2026-09-02" });
    expect(lacunas.lacunas).toEqual([{ inicio: "2026-08-30", fim: "2026-08-31" }]);
    const periodos = previa.periodos.map((p) => ({ inicio: p.inicio.toISOString().slice(0, 10), fim: p.fim.toISOString().slice(0, 10), itens: [{ produtoId: ids.produto, quantidadeConfirmada: 6, modoEstoque: "BAIXA_ESTOQUE" as const }] }));
    const antes = await prisma.fechamentoConsumo.count({ where: { loteId: ids.lote } });
    await expect(confirmarPeriodos({ ...contexto, chave: crypto.randomUUID(), revisao: "0".repeat(64), periodos }, null)).rejects.toThrow(/mudou desde a prévia/);
    expect(await prisma.fechamentoConsumo.count({ where: { loteId: ids.lote } })).toBe(antes);
    await expect(confirmarPeriodos({ ...contexto, chave: crypto.randomUUID(), revisao: previa.revisao, periodos: [periodos[0], { ...periodos[1], itens: [{ ...periodos[1].itens[0], quantidadeConfirmada: 999, motivoAjuste: "Saldo insuficiente intencional" }] }] }, null)).rejects.toThrow(/Saldo/);
    expect(await prisma.fechamentoConsumo.count({ where: { loteId: ids.lote } })).toBe(antes);
    const input = { ...contexto, chave: crypto.randomUUID(), revisao: previa.revisao, periodos };
    const resultado = await confirmarPeriodos(input, null);
    expect(resultado.fechamentos).toHaveLength(2);
    expect(await confirmarPeriodos(input, null)).toEqual(resultado);
    expect(await prisma.fechamentoConsumo.count({ where: { loteId: ids.lote } })).toBe(antes + 2);
  });
});
