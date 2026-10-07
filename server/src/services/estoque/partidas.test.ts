import { describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { nomeLotePadrao, prepararPartidasTx, validadeVencida } from "./partidas.js";

describe("contrato de agrupamento por validade", () => {
  it("nome padrão usa Produto e dia legível, inclusive validade desconhecida", () => {
    expect(nomeLotePadrao("Vacina", new Date("2026-10-03"))).toBe("Vacina — validade 03/10/2026");
    expect(nomeLotePadrao("Vacina", null)).toBe("Vacina — validade não informada");
  });
  it("o dia de validade inteiro continua válido, mesmo na última hora", () => {
    expect(validadeVencida(new Date("2026-10-03"), new Date("2026-10-03T23:59:59Z"))).toBe(false);
    expect(validadeVencida(new Date("2026-10-03"), new Date("2026-10-04T00:00:00Z"))).toBe(true);
  });
  it("entrada sem escolha explícita da validade não cria lote", async () => {
    const criar = vi.fn();
    const tx = { $executeRaw: vi.fn(), partidaProduto: { create: criar } } as unknown as Prisma.TransactionClient;
    await expect(prepararPartidasTx(tx, { produtoId: "produto", rastrearPartidas: true, propriedadeId: 1, tipo: "ENTRADA", quantidade: new Prisma.Decimal(10), partidas: [{ quantidade: 10, nome: "Nome" }] })).rejects.toThrow(/validade/);
    expect(criar).not.toHaveBeenCalled();
  });
  it("data inexistente não cria lote", async () => {
    const criar = vi.fn();
    const tx = { $executeRaw: vi.fn(), partidaProduto: { create: criar } } as unknown as Prisma.TransactionClient;
    await expect(prepararPartidasTx(tx, { produtoId: "produto", rastrearPartidas: true, propriedadeId: 1, tipo: "ENTRADA", quantidade: new Prisma.Decimal(10), partidas: [{ quantidade: 10, validade: "2026-02-31" }] })).rejects.toThrow(/validade válida/);
    expect(criar).not.toHaveBeenCalled();
  });
});
