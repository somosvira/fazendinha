import { describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import { uid } from "../../../lib/uid.fixture.js";
vi.mock("../../../db.js", () => ({ prisma: {} }));
vi.mock("../fatos.js", () => ({ conferirAnimalNoFato: vi.fn(async () => ({ sexo: "F" })) }));
import { corrigirPartoTx } from "./registros.js";
import { correcaoPartoAmpliadaSchema } from "./partos.schemas.js";

function fixture(tipo = "ABORTO", observacao: string | null = null) {
  const parto = { id: uid(1), animalId: uid(2), propriedadeId: 7, status: "VALIDO", tipo,
    desfecho: tipo === "ABORTO" ? "ABORTO" : "NASCIMENTO", data: new Date("2025-01-01T00:00:00Z"),
    versao: 1, gestacaoId: null, observacao, responsavel: null, retencaoPlacenta: null };
  const db = {
    $executeRaw: vi.fn().mockResolvedValue(1),
    partoAnimal: { findFirst: vi.fn(async () => structuredClone(parto)), findUniqueOrThrow: vi.fn(async () => structuredClone(parto)),
      update: vi.fn(async ({ data }) => { Object.assign(parto, data, { versao: parto.versao + 1 }); return structuredClone(parto); }) },
    criaParto: { findMany: vi.fn().mockResolvedValue([]) }, ocorrenciaSanitaria: { count: vi.fn().mockResolvedValue(0) },
    demandaAcompanhamentoReprodutivo: { findMany: vi.fn().mockResolvedValue([]) },
    auditoriaPecuaria: { create: vi.fn(async ({ data }) => data) },
  };
  return { tx: db as unknown as Prisma.TransactionClient, db, parto };
}
describe("correções independentes preservam a ausência de explicação de abortos legados", () => {
  it("corrige o responsável sem inventar observação no aborto histórico e audita o antes/depois", async () => {
    const f = fixture();
    const input = correcaoPartoAmpliadaSchema.parse({ propriedadeId: 7, motivo: "Responsável conferido na folha original", responsavel: "José" });
    const salvo = await corrigirPartoTx(f.tx, f.parto.id, input, 7);
    expect(salvo).toMatchObject({ id: uid(1), tipo: "ABORTO", observacao: null, responsavel: "José", versao: 2 });
    expect(f.db.auditoriaPecuaria.create).toHaveBeenCalledWith({ data: expect.objectContaining({ usuarioId: 7,
      antes: expect.objectContaining({ observacao: null, responsavel: null }),
      depois: expect.objectContaining({ observacao: null, responsavel: "José" }) }) });
  });
  it("repetir o tipo histórico no payload não transforma correção independente em novo aborto", async () => {
    const f = fixture();
    const input = correcaoPartoAmpliadaSchema.parse({ propriedadeId: 7, tipo: "ABORTO", responsavel: "José", motivo: "Responsável conferido na folha original" });
    expect(await corrigirPartoTx(f.tx, f.parto.id, input, 7)).toMatchObject({ tipo: "ABORTO", observacao: null, responsavel: "José" });
  });
  it("converter nascimento em aborto sem explicação continua bloqueado antes de gravar", async () => {
    const f = fixture("NORMAL");
    const input = correcaoPartoAmpliadaSchema.parse({ propriedadeId: 7, motivo: "Desfecho revisto no histórico", desfecho: "ABORTO" });
    await expect(corrigirPartoTx(f.tx, f.parto.id, input, 7)).rejects.toMatchObject({ code: "VALIDACAO", campo: "observacao" });
    expect(f.db.partoAnimal.update).not.toHaveBeenCalled();
    expect(f.db.auditoriaPecuaria.create).not.toHaveBeenCalled();
  });
  it.each([null, "", "   ", "abc"])("alterar a observação do aborto para %s exige explicação suficiente", async observacao => {
    const f = fixture("ABORTO", "Aborto observado; causa desconhecida");
    const input = correcaoPartoAmpliadaSchema.parse({ propriedadeId: 7, motivo: "Observação revisada no histórico", observacao });
    await expect(corrigirPartoTx(f.tx, f.parto.id, input, 7)).rejects.toMatchObject({ code: "VALIDACAO", campo: "observacao" });
    expect(f.db.partoAnimal.update).not.toHaveBeenCalled();
  });
  it.each([null, ""])("conserva a ausência histórica %s quando o payload não altera a observação", async observacao => {
    const f = fixture("ABORTO", observacao);
    const input = correcaoPartoAmpliadaSchema.parse({ propriedadeId: 7, motivo: "Responsável conferido na folha original", observacao, responsavel: "José" });
    expect(await corrigirPartoTx(f.tx, f.parto.id, input, 7)).toMatchObject({ observacao, responsavel: "José" });
  });
  it.each(["NORMAL", "ABORTO"])("explicação conferida permite corrigir o desfecho %s para aborto", async tipo => {
    const f = fixture(tipo);
    const input = correcaoPartoAmpliadaSchema.parse({ propriedadeId: 7, motivo: "Contexto fetal conferido na folha original", desfecho: "ABORTO", observacao: "Aborto observado; causa desconhecida" });
    expect(await corrigirPartoTx(f.tx, f.parto.id, input, 7)).toMatchObject({ tipo: "ABORTO", observacao: "Aborto observado; causa desconhecida" });
  });
});
