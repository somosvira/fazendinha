import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { hashExecucaoProtocolo, paginaExecucao } from "./execucao.calc.js";

describe("identidade e páginas de uma execução de protocolo", () => {
  it("conserva a identidade ao reordenar propriedades e normalizar Decimal/data", () => {
    const original = { dose: new Prisma.Decimal("2.000"), data: new Date("2026-10-01T12:00:00Z"), origem: { lote: "lote-1", opcional: undefined } };
    const reenviado = { origem: { lote: "lote-1" }, data: "2026-10-01T12:00:00.000Z", dose: "2" };
    expect(hashExecucaoProtocolo(original)).toBe(hashExecucaoProtocolo(reenviado));
  });

  it("alterar dose, origem, data, resultado ou valor nulo muda a identidade", () => {
    const referencia = { dose: "2", origem: "BAIXA_ESTOQUE", data: "2026-10-01", resultado: null };
    const hash = hashExecucaoProtocolo(referencia);
    for (const alteracao of [{ dose: "3" }, { origem: "INCLUSO_SERVICO" }, { data: "2026-10-02" }, { resultado: "POSITIVO" }, { resultado: undefined }]) {
      expect(hashExecucaoProtocolo({ ...referencia, ...alteracao })).not.toBe(hash);
    }
  });

  it.each([0, 1, 10, 11, 21, 100])("pagina %i registros sem perder identidades ou exceder dez por página", (total) => {
    const itens = Array.from({ length: total }, (_, n) => `tarefa-${n}`);
    const quantidadePaginas = Math.max(1, Math.ceil(total / 10));
    const lidos = Array.from({ length: quantidadePaginas }, (_, n) => paginaExecucao(itens, n + 1));
    expect(lidos.flatMap(p => p.itens)).toEqual(itens);
    for (const pagina of lidos) {
      expect(pagina.total).toBe(total);
      expect(pagina.itens.length).toBeLessThanOrEqual(10);
    }
    expect(paginaExecucao(itens, 1000).pagina).toBe(quantidadePaginas);
  });

  it("rejeita tamanho acima de dez, zero e páginas fracionárias", () => {
    for (const [pagina, tamanho] of [[1, 11], [1, 0], [0, 10], [1.5, 10], [1, 2.5]]) {
      expect(() => paginaExecucao([], pagina, tamanho)).toThrow();
    }
  });
});
