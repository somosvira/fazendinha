import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "../../../db.js";
import { buscarFicha, cadastrar, listar } from "./animais.js";
import { carregarRegras, SELECT_PARTOS_CATEGORIA, simularCategorias } from "./categorias.js";
import { buscarResumoLote } from "./lotes.js";
import { totalPartosCategoria } from "./partos.calc.js";
import { cadastrarAnimalSchema, listarFiltrosSchema } from "./schemas.js";
import { hojeFazenda, hojeFazendaDate } from "./regras.js";

const comBanco = process.env.PECUARIA_DB_INTEGRATION === "1" ? describe : describe.skip;
const propriedades: number[] = [];
const animais: string[] = [];
const diasAntes = (dias: number) => new Date(hojeFazendaDate().getTime() - dias * 86_400_000).toISOString().slice(0, 10);

afterAll(async () => {
  if (!propriedades.length) return;
  const animalId = { in: animais };
  await prisma.auditoriaPecuaria.deleteMany({ where: { animalId } });
  await prisma.partoAnimal.deleteMany({ where: { animalId } });
  await prisma.localizacaoAnimal.deleteMany({ where: { animalId } });
  await prisma.periodoReprodutivoAnimal.deleteMany({ where: { animalId } }); await prisma.destinoAnimal.deleteMany({ where: { animalId } });
  await prisma.animal.deleteMany({ where: { id: animalId } });
  await prisma.lote.deleteMany({ where: { propriedadeId: { in: propriedades } } });
  await prisma.propriedade.deleteMany({ where: { id: { in: propriedades } } });
});

comBanco("V4: partos e categorias em todos os consumidores", () => {
  it("aborto e natimorto contam; anulados e saldo histórico não duplicam a paridade", async () => {
    const sitio = await prisma.propriedade.create({ data: { nome: `Partos V4 ${randomUUID()}` } });
    propriedades.push(sitio.id);
    const lote = await prisma.lote.create({ data: { nome: "Matrizes", propriedadeId: sitio.id } });
    await expect(cadastrar(cadastrarAnimalSchema.parse({
      brinco: "CRIA-SEM-PARTO", sexo: "F", origem: "NASCIDO",
      dataNascimento: hojeFazenda(), dataEntrada: hojeFazenda(), propriedadeId: sitio.id, aptidao: "LEITE",
    }), null)).rejects.toThrow(/Registre o parto/);
    const regras = await carregarRegras();
    const vaca = regras.find((r) => r.nome === "Vaca")!;
    const novilha = regras.find((r) => r.nome === "Novilha")!;
    const casos = [
      { tipo: "NORMAL", saldo: 0, status: "VALIDO" as const, coberto: false, total: 1 },
      { tipo: "ABORTO", saldo: 0, status: "VALIDO" as const, coberto: false, total: 1 },
      { tipo: "NATIMORTO", saldo: 0, status: "VALIDO" as const, coberto: false, total: 1 },
      { tipo: "NORMAL", saldo: 0, status: "ANULADO" as const, coberto: false, total: 0 },
      { tipo: "NORMAL", saldo: 2, status: "VALIDO" as const, coberto: true, total: 2 },
    ];
    for (const [i, caso] of casos.entries()) {
      const animal = await cadastrar(cadastrarAnimalSchema.parse({
        brinco: `V4-${randomUUID().slice(0, 8)}-${i}`, sexo: "F", origem: "COMPRADO",
        dataNascimento: diasAntes(900), dataEntrada: diasAntes(100), propriedadeId: sitio.id,
        loteId: lote.id, aptidao: "LEITE", partosAntesDaEntrada: caso.saldo,
      }), null);
      animais.push(animal.id);
      await prisma.partoAnimal.create({ data: {
        animalId: animal.id, propriedadeId: sitio.id, data: new Date(diasAntes(10)),
        tipo: caso.tipo, status: caso.status, incluidoSaldoAnterior: caso.coberto,
        ...(caso.status === "ANULADO" ? { motivoAnulacao: "Correção documentada", anuladoEm: new Date() } : {}),
      } });
      const leitura = await prisma.animal.findUniqueOrThrow({ where: { id: animal.id }, include: { partos: SELECT_PARTOS_CATEGORIA } });
      expect(totalPartosCategoria(leitura, hojeFazendaDate())).toBe(caso.total);
      expect((await buscarFicha(animal.id, sitio.id)).categoria?.id).toBe(caso.total ? vaca.id : novilha.id);
    }
    const todas = await listar(listarFiltrosSchema.parse({ situacao: "ATIVO", propriedadeId: sitio.id }), sitio.id);
    expect(todas.painel.porCategoria.find((c) => c.categoria?.id === vaca.id)?.total).toBe(4);
    const filtradas = await listar(listarFiltrosSchema.parse({ situacao: "ATIVO", categoriaId: vaca.id, propriedadeId: sitio.id }), sitio.id);
    expect(filtradas.total).toBe(4);
    expect(filtradas.itens.map((a) => a.id).sort()).toEqual(animais.filter((_, i) => i !== 3).sort());
    const resumo = await buscarResumoLote(lote.id, null, sitio.id);
    expect(resumo.porCategoria.find((c) => c.categoriaId === vaca.id)?.qtd).toBe(4);
    expect(resumo.porCategoria.find((c) => c.categoriaId === novilha.id)?.qtd).toBe(1);
    expect((await simularCategorias(regras)).afetados).toBe(0);
    // A data de referência não deve antecipar um parto registrado depois dela.
    expect(totalPartosCategoria({ partosAntesDaEntrada: 1, partos: [{ data: new Date(hojeFazenda()) }] }, new Date(diasAntes(1)))).toBe(1);
  });
});
