import crypto from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../../db.js";
import { resumoLote, visaoGeral } from "./consultas.js";
import { listarDietas } from "./dietas.js";
import { listarFechamentos } from "./consumo.js";

const comBanco = process.env.PECUARIA_DB_INTEGRATION === "1" ? describe : describe.skip;
const sufixo = crypto.randomUUID().slice(0, 8);
const sitios: number[] = [];
const lotes: string[] = [];
const produtos: string[] = [];
const animais: string[] = [];
let categoriaId = ""; let centroId = ""; let dietaId = "";
comBanco("consulta geral e custos históricos da nutrição", () => {
  beforeAll(async () => {
    categoriaId = (await prisma.categoria.create({ data: { nome: `Nutrição QA ${sufixo}`, usoNutricional: true } })).id;
    centroId = (await prisma.centroCusto.create({ data: { nome: `Nutrição QA ${sufixo}` } })).id;
    for (const nome of ["Ração", "Mineral"]) produtos.push((await prisma.produto.create({ data: { nome: `${nome} QA ${sufixo}`, unidade: "KG", categoriaId, usoNutricional: true } })).id);
    dietaId = (await prisma.dieta.create({ data: { nome: `Dieta QA ${sufixo}`, versao: 1, publicadaEm: new Date() } })).id;
    for (const nome of ["A", "B"]) {
      const propriedade = await prisma.propriedade.create({ data: { nome: `Sítio ${nome} QA ${sufixo}`, ativo: true } }); sitios.push(propriedade.id);
      const lote = await prisma.lote.create({ data: { nome: `Lote QA ${sufixo}`, propriedadeId: propriedade.id, centroCustoId: centroId } }); lotes.push(lote.id);
      const participantes: string[] = [];
      for (let n = 0; n < 6; n++) {
        const animal = await prisma.animal.create({ data: { brinco: `QA${sufixo}${nome}${n}`, sexo: "F", origem: "COMPRADO", dataNascimento: new Date("2022-01-01"), dataEntrada: new Date("2024-01-01"), localizacoes: { create: { propriedadeId: propriedade.id, loteId: lote.id, desde: new Date("2024-01-01"), ate: new Date("2024-02-01") } } } });
        animais.push(animal.id); participantes.push(animal.id);
      }
      const vigencia = await prisma.vigenciaDietaLote.create({ data: { loteId: lote.id, dietaId, desde: new Date("2024-01-01") } });
      for (let n = 0; n < (nome === "A" ? 28 : 1); n++) {
        const data = new Date(Date.UTC(2024, 0, n + 1));
        const movimento = await prisma.movimentoEstoque.create({ data: { produtoId: produtos[0], propriedadeId: propriedade.id, centroCustoId: centroId, tipo: "SAIDA", origem: "NUTRICAO", data, quantidade: 1, custoUnitario: n === 0 ? 18 : 6, valorTotal: n === 0 ? 18 : 6 } });
        await prisma.fechamentoConsumo.create({ data: { loteId: lote.id, propriedadeId: propriedade.id, vigenciaId: vigencia.id, centroCustoId: centroId, inicio: data, fim: data, animalDias: n === 0 ? 3 : 6, status: n === 27 ? "ESTORNADO" : "CONFIRMADO", participacoes: { create: participantes.slice(0, n === 0 ? 3 : 6).map((animalId) => ({ animalId, dias: 1 })) }, itens: { create: [
          { produtoId: produtos[0], quantidadePrevista: 1, quantidadeConfirmada: 1, unidade: "KG", baseQuantidade: "PREVISTA", modoEstoque: "BAIXA_ESTOQUE", situacaoCusto: nome === "A" ? "CONHECIDO" : "SEM_BASE", movimentoEstoqueId: movimento.id },
          { produtoId: produtos[1], quantidadePrevista: 1, quantidadeConfirmada: 0, unidade: "KG", baseQuantidade: "CONFERIDA", modoEstoque: "BAIXA_ESTOQUE", situacaoCusto: "NAO_APURADO" },
        ] } } });
      }
    }
  });
  afterAll(async () => {
    if (!sitios.length) return;
    await prisma.itemFechamentoConsumo.deleteMany({ where: { fechamento: { propriedadeId: { in: sitios } } } });
    await prisma.participacaoConsumoAnimal.deleteMany({ where: { fechamento: { propriedadeId: { in: sitios } } } });
    await prisma.fechamentoConsumo.deleteMany({ where: { propriedadeId: { in: sitios } } });
    await prisma.vigenciaDietaLote.deleteMany({ where: { loteId: { in: lotes } } });
    await prisma.localizacaoAnimal.deleteMany({ where: { animalId: { in: animais } } });
    await prisma.animal.deleteMany({ where: { id: { in: animais } } });
    await prisma.lote.deleteMany({ where: { id: { in: lotes } } });
    await prisma.movimentoEstoque.deleteMany({ where: { produtoId: { in: produtos } } });
    await prisma.dieta.deleteMany({ where: { id: dietaId } });
    await prisma.produto.deleteMany({ where: { id: { in: produtos } } });
    await prisma.categoria.deleteMany({ where: { id: categoriaId } });
    await prisma.centroCusto.deleteMany({ where: { id: centroId } });
    await prisma.propriedade.deleteMany({ where: { id: { in: sitios } } });
  });
  it("agrega mais de 25 fechamentos, não multiplica dias por ingrediente e exclui estornos", async () => {
    const resumo = await resumoLote(lotes[0], sitios[0], true);
    expect(resumo.custos).toEqual({ fechamentos: 27, animalDias: 159, custoConhecido: "174.00", custoPorAnimalDia: "1.09", coberturaCustoCompleta: true });
    const pagina = await listarFechamentos(lotes[0], sitios[0], { pagina: 1, limite: 25 }, true);
    expect(pagina.itens).toHaveLength(25); expect(pagina.total).toBe(28);
    const confirmados = await listarFechamentos(lotes[0], sitios[0], { pagina: 1, limite: 25 }, true, undefined, "CONFIRMADO");
    expect(confirmados.total).toBe(27); expect(confirmados.itens.every((f) => f.status === "CONFIRMADO")).toBe(true);
  });
  it("aplica sítio e permissão a todos os resumos e permite contexto consolidado", async () => {
    const local = await visaoGeral(sitios[0], false);
    expect(local.lotes).toHaveLength(1); expect(local.lotes[0].lote.id).toBe(lotes[0]);
    expect(local.lotes[0].custos).toMatchObject({ custoConhecido: null, custoPorAnimalDia: null });
    await expect(resumoLote(lotes[1], sitios[0], true)).rejects.toThrow("Lote não encontrado");
    const receitas = await listarDietas(sitios[0]);
    expect(receitas.find((d) => d.id === dietaId)?.lotesEmUso.map((l) => l.id)).toEqual([lotes[0]]);
    expect((await listarDietas(null)).find((d) => d.id === dietaId)?.lotesEmUso.map((l) => l.id)).toEqual(expect.arrayContaining(lotes));
    const geral = await visaoGeral(null, true);
    expect(geral.lotes.map((r) => r.lote.id)).toEqual(expect.arrayContaining(lotes));
  });
  it("não trata valor de movimento SEM_BASE como custo apurado nem o zero do outro ingrediente como cobertura completa", async () => {
    const resumo = await resumoLote(lotes[1], sitios[1], true);
    expect(resumo.custos).toMatchObject({ custoConhecido: "0.00", custoPorAnimalDia: "0.00", coberturaCustoCompleta: false });
    await prisma.itemFechamentoConsumo.deleteMany({ where: { produtoId: produtos[1], fechamento: { loteId: lotes[1] } } });
    expect((await resumoLote(lotes[1], sitios[1], true)).custos).toMatchObject({ custoConhecido: null, custoPorAnimalDia: null, coberturaCustoCompleta: false });
  });
});
