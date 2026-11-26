// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { camposPartoPayload, dadosPartoVazios, validarDadosParto } from "./PartoCampos";
describe("ECC opcional no parto", () => {
  it("omite rascunho inválido quando desligado", () => {
    const dados = { ...dadosPartoVazios(), escoreValor: "inválido" };
    expect(validarDadosParto(dados)).toBeNull();
    expect(camposPartoPayload(dados, "2026-10-07")).not.toHaveProperty("escoreMatriz");
  });
  it.each([["0", 0], ["3,25", 3.25]])("aceita %s e envia somente valor", (valor, esperado) => {
    const dados = { ...dadosPartoVazios(), escoreAtivo: true, escoreValor: valor as string };
    expect(validarDadosParto(dados)).toBeNull();
    expect(camposPartoPayload(dados, "2026-10-07").escoreMatriz).toEqual({ acao: "REGISTRAR", valor: esperado });
  });
  it.each(["", " ", "1,2,3", "Infinity"])("rejeita valor inválido %s", valor => {
    expect(validarDadosParto({ ...dadosPartoVazios(), escoreAtivo: true, escoreValor: valor })).toMatch(/valor numérico/);
  });
});
