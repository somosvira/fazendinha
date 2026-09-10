import { describe, expect, it, vi } from "vitest";
import { exigirContaAtiva, exigirParceiroAtivo, FinanceiroError } from "./regras.js";

describe("cadastros disponíveis em novas operações", () => {
  it("exige conta ativa no escopo da propriedade", async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    await expect(exigirContaAtiva({ contaFinanceira: { findFirst } } as never, 4, 7)).rejects.toEqual(expect.objectContaining<Partial<FinanceiroError>>({ code: "NAO_ENCONTRADO" }));
    expect(findFirst).toHaveBeenCalledWith({ where: { id: 4, propriedadeId: 7, ativo: true } });
  });

  it("exige parceiro ativo para um novo vínculo", async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    await expect(exigirParceiroAtivo({ parceiro: { findFirst } } as never, 5)).rejects.toEqual(expect.objectContaining<Partial<FinanceiroError>>({ code: "NAO_ENCONTRADO" }));
    expect(findFirst).toHaveBeenCalledWith({ where: { id: 5, ativo: true } });
  });
});
