import crypto from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "../../../db.js";
import { atribuirDieta, corrigirVigencia } from "./dietas.js";

const comBanco = process.env.PECUARIA_DB_INTEGRATION === "1" ? describe : describe.skip;
let propriedadeId = 0;
let loteId = "";
let dietaId = "";

afterAll(async () => {
  if (!propriedadeId) return;
  await prisma.auditoriaPecuaria.deleteMany({ where: { propriedadeId } });
  await prisma.vigenciaDietaLote.deleteMany({ where: { loteId } });
  await prisma.lote.delete({ where: { id: loteId } });
  await prisma.dieta.delete({ where: { id: dietaId } });
  await prisma.propriedade.delete({ where: { id: propriedadeId } });
});

comBanco("correção de vigências contíguas no PostgreSQL", () => {
  it("adia e antecipa a troca mantendo a fronteira, auditoria e ausência de consumo", async () => {
    const nome = `QA vigências ${crypto.randomUUID()}`;
    propriedadeId = (await prisma.propriedade.create({ data: { nome } })).id;
    loteId = (await prisma.lote.create({ data: { nome, propriedadeId } })).id;
    dietaId = (await prisma.dieta.create({ data: { nome, versao: 1, publicadaEm: new Date() } })).id;
    const primeira = await atribuirDieta({ loteId, propriedadeId, dietaId, desde: "2026-09-01" }, null);
    const segunda = await atribuirDieta({ loteId, propriedadeId, dietaId, desde: "2026-09-06" }, null);

    for (const desde of ["2026-09-07", "2026-09-06"]) {
      await corrigirVigencia(segunda.id, propriedadeId, { desde, motivo: "Ajuste da programação" }, null);
      const anterior = await prisma.vigenciaDietaLote.findUniqueOrThrow({ where: { id: primeira.id } });
      const atual = await prisma.vigenciaDietaLote.findUniqueOrThrow({ where: { id: segunda.id } });
      expect(anterior.ate?.toISOString().slice(0, 10)).toBe(desde);
      expect(atual.desde.toISOString().slice(0, 10)).toBe(desde);
    }
    expect(await prisma.auditoriaPecuaria.count({ where: { propriedadeId, acao: "VIGENCIA_CORRIGIDA" } })).toBe(4);
    expect(await prisma.fechamentoConsumo.count({ where: { loteId } })).toBe(0);
    await expect(corrigirVigencia(segunda.id, propriedadeId, { desde: "2026-09-01", motivo: "Troca inválida de teste" }, null)).rejects.toThrow("vigências vizinhas");
  });
});
