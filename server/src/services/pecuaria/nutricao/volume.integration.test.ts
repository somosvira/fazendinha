import crypto from "node:crypto";
import { performance } from "node:perf_hooks";
import { afterAll, describe, expect, it, vi } from "vitest";
import { prisma } from "../../../db.js";
import { listarDietas, listarVigencias } from "./dietas.js";
import { consultarResumo } from "./resumo.js";
import { listarFechamentos } from "./consumo.js";

const medidas = vi.hoisted(() => ({ consultas: [] as number[] }));
vi.mock("../../../db.js", async () => {
  const { PrismaClient } = await import("@prisma/client");
  const { PrismaPg } = await import("@prisma/adapter-pg");
  const client = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }), log: [{ emit: "event", level: "query" }] });
  client.$on("query", evento => medidas.consultas.push(evento.duration));
  return { prisma: client };
});
const habilitado = process.env.PECUARIA_DB_INTEGRATION === "1" && process.env.NUTRICAO_VOLUME_INTEGRATION === "1";
const suite = habilitado ? describe : describe.skip;
afterAll(async () => { if (habilitado) await prisma.$disconnect(); });
const id = () => crypto.randomUUID();
const data = (i: number) => new Date(Date.UTC(2010, 0, 1 + i));
async function medir<T>(nome: string, consultar: () => Promise<T>) {
  medidas.consultas.length = 0;
  const inicio = performance.now();
  const resultado = await consultar();
  console.log(JSON.stringify({ medicao: nome, ms: +(performance.now() - inicio).toFixed(2), consultasSql: medidas.consultas.length,
    msSql: medidas.consultas.reduce((s, n) => s + n, 0), bytesJson: Buffer.byteLength(JSON.stringify(resultado)) }));
  return resultado;
}
suite("volume nutricional exclusivamente em banco descartável", () => {
  it("preserva uso atual, sítio, null e paginação com milhares de fatos", async () => {
    const url = new URL(process.env.DATABASE_URL!);
    expect(["127.0.0.1", "localhost"]).toContain(url.hostname);
    expect(url.pathname).toMatch(/^\/qa_volume_[a-f0-9]+$/);
    const p = await prisma.propriedade.create({ data: { nome: "Volume autorizado" } });
    const outro = await prisma.propriedade.create({ data: { nome: "Volume externo" } });
    const centro = await prisma.centroCusto.create({ data: { nome: "Volume" } });
    const produto = await prisma.produto.create({ data: { nome: "Volume nutricional", unidade: "KG", usoNutricional: true } });
    const lotes = Array.from({ length: 1200 }, (_, i) => ({ id: id(), nome: `Lote ${i}`, propriedadeId: i < 1000 ? p.id : outro.id }));
    const dietas = lotes.map((_, i) => ({ id: id(), nome: `Receita ${i}`, versao: 1, publicadaEm: new Date() }));
    await prisma.lote.createMany({ data: lotes });
    const animais = lotes.map((_, i) => ({ id: id(), brinco: `VOL${i}`, sexo: "F" as const, origem: "NASCIDO" as const, dataNascimento: new Date("2009-01-01"), dataEntrada: new Date("2009-01-01") }));
    await prisma.animal.createMany({ data: animais });
    await prisma.localizacaoAnimal.createMany({ data: lotes.map((l, i) => ({ animalId: animais[i].id, loteId: l.id, propriedadeId: l.propriedadeId, desde: new Date("2009-01-01") })) });
    await prisma.dieta.createMany({ data: dietas });
    await prisma.itemDieta.createMany({ data: dietas.map(d => ({ dietaId: d.id, produtoId: produto.id, quantidadeCabecaDia: 1, unidade: "KG" })) });
    const vigencias = lotes.map((l, i) => ({ id: id(), loteId: l.id, dietaId: dietas[i].id, desde: new Date("2025-01-01") }));
    const historicas = Array.from({ length: 1000 }, (_, i) => ({ id: id(), loteId: lotes[0].id, dietaId: dietas[0].id, desde: data(i), ate: data(i + 1) }));
    await prisma.vigenciaDietaLote.createMany({ data: [...vigencias, ...historicas] });
    const fechamentos = [...lotes.map((l, i) => ({ id: id(), loteId: l.id, propriedadeId: l.propriedadeId, vigenciaId: vigencias[i].id,
      inicio: new Date("2025-01-01"), fim: new Date("2025-01-01"), centroCustoId: centro.id, animalDias: 1 })),
    ...historicas.map((v, i) => ({ id: id(), loteId: lotes[0].id, propriedadeId: p.id, vigenciaId: v.id,
      inicio: data(i), fim: data(i), centroCustoId: centro.id, animalDias: 1 }))];
    await prisma.fechamentoConsumo.createMany({ data: fechamentos });
    const animalPorLote = new Map(lotes.map((l, i) => [l.id, animais[i].id]));
    await prisma.participacaoConsumoAnimal.createMany({ data: fechamentos.map(f => ({ fechamentoId: f.id, animalId: animalPorLote.get(f.loteId)!, dias: 1 })) });
    await prisma.itemFechamentoConsumo.createMany({ data: fechamentos.map((f, i) => ({ fechamentoId: f.id, produtoId: produto.id,
      quantidadePrevista: 1, quantidadeConfirmada: i === 0 ? 0 : 1, baseQuantidade: "ANIMAL_DIAS", unidade: "KG",
      modoEstoque: "SEM_BAIXA_JUSTIFICADA", justificativaSemBaixa: "Fixture descartável de volume", situacaoCusto: "DESCONHECIDO" })) });
    await prisma.fechamentoConsumo.create({ data: { ...fechamentos[0], id: id(), status: "ESTORNADO", motivoEstorno: "Fixture", estornadoEm: new Date(), participacoes: { create: { animalId: animais[0].id, dias: 1 } } } });
    const vazio = await prisma.lote.create({ data: { nome: "Sem histórico", propriedadeId: p.id } });
    console.log(JSON.stringify({ fixture: { lotes: 1201, animais: 1200, participacoes: 2201, receitas: 1200, ingredientes: 1200, vigencias: 2200, fechamentos: 2201, itensFechamento: 2200, sitios: 2 } }));
    const receitas = await medir("dietas-sitio-1000-usos", () => listarDietas(p.id));
    expect(receitas).toHaveLength(1200);
    expect(receitas.reduce((s, d) => s + d.lotesEmUso.length, 0)).toBe(1000);
    expect(receitas.flatMap(d => d.lotesEmUso).every(l => l.propriedade.id === p.id)).toBe(true);
    const global = await medir("dietas-global-1200-usos", () => listarDietas(null));
    expect(global.reduce((s, d) => s + d.lotesEmUso.length, 0)).toBe(1200);
    const resumo = await medir("resumo-sitio-2000-confirmados", () => consultarResumo(undefined, p.id, true));
    expect(resumo.lotes).toHaveLength(1001);
    expect(resumo.lotes.reduce((s, l) => s + l.custos.fechamentos, 0)).toBe(2000);
    expect(resumo.lotes.find(l => l.loteId === lotes[0].id)?.custos).toMatchObject({ fechamentos: 1001, custoConhecido: "0.00", coberturaCustoCompleta: false });
    expect(resumo.lotes.find(l => l.loteId === lotes[1].id)?.custos.custoConhecido).toBeNull();
    expect(resumo.lotes.find(l => l.loteId === vazio.id)?.custos.custoConhecido).toBe("0.00");
    const restrito = await medir("resumo-sem-valores", () => consultarResumo(undefined, p.id, false));
    expect(restrito.lotes.every(l => l.custos.custoConhecido === null && l.custos.custoPorAnimalDia === null)).toBe(true);
    const pagina = await medir("fechamentos-pagina80-confirmados", () => listarFechamentos(undefined, p.id, { pagina: 80, limite: 25 }, false, undefined, "CONFIRMADO"));
    expect(pagina.total).toBe(2000); expect(pagina.itens).toHaveLength(25);
    expect(pagina.itens.every(f => f.propriedadeId === p.id && f.custoConhecido === null && f.status === "CONFIRMADO")).toBe(true);
    const estornados = await medir("fechamentos-estornados", () => listarFechamentos(undefined, p.id, { pagina: 1, limite: 25 }, true, undefined, "ESTORNADO"));
    expect(estornados.total).toBe(1);
    const vigenciasPagina = await medir("vigencias-pagina40-historico", () => listarVigencias(lotes[0].id, p.id, { pagina: 40, limite: 25 }));
    expect(vigenciasPagina.total).toBe(1001); expect(vigenciasPagina.itens).toHaveLength(25);
    expect(vigenciasPagina.vigente?.id).toBe(vigencias[0].id);
    await expect(consultarResumo(lotes[1000].id, p.id, true)).rejects.toThrow("neste sítio");
  }, 60000);
});
