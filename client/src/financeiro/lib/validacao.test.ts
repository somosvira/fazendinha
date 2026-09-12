import { describe, expect, it } from "vitest";
import { formatarDocumento, formatarValorMonetario, validarCnpj, validarConta, validarCpf, validarDocumento, validarEmail, validarParceiro, valorMonetario } from "./validacao";

describe("validação de cadastros financeiros", () => {
  it("valida CPF com dígitos verificadores", () => {
    expect(validarCpf("52998224725")).toBe(true);
    expect(validarCpf("52998224726")).toBe(false);
    expect(validarCpf("11111111111")).toBe(false);
  });

  it("valida CNPJ com dígitos verificadores", () => {
    expect(validarCnpj("11222333000181")).toBe(true);
    expect(validarCnpj("11222333000182")).toBe(false);
    expect(validarCnpj("00000000000000")).toBe(false);
  });

  it("validarDocumento aceita vazio e mascarado, rejeita tamanho errado", () => {
    expect(validarDocumento("")).toBeNull();
    expect(validarDocumento("529.982.247-25")).toBeNull();
    expect(validarDocumento("11.222.333/0001-81")).toBeNull();
    expect(validarDocumento("123")).toMatch(/11 dígitos/);
    expect(validarDocumento("52998224726")).toBe("CPF inválido");
  });

  it("formata CPF e CNPJ para exibição e devolve o resto intacto", () => {
    expect(formatarDocumento("52998224725")).toBe("529.982.247-25");
    expect(formatarDocumento("11222333000181")).toBe("11.222.333/0001-81");
    expect(formatarDocumento("abc")).toBe("abc");
    expect(formatarDocumento(null)).toBe("");
  });

  it("valida e-mail simples", () => {
    expect(validarEmail("")).toBeNull();
    expect(validarEmail("a@b.co")).toBeNull();
    expect(validarEmail("abc")).toBe("E-mail inválido");
  });

  it("validarConta acusa nome curto, saldo não numérico e data ausente", () => {
    const erros = validarConta({ nome: "A", saldoAbertura: "x", dataSaldoAbertura: "" }, { aberturaEditavel: true });
    expect(Object.keys(erros).sort()).toEqual(["dataSaldoAbertura", "nome", "saldoAbertura"]);
    expect(validarConta({ nome: "Ok", saldoAbertura: "x", dataSaldoAbertura: "" }, { aberturaEditavel: false })).toEqual({});
  });

  it("valida os dados mínimos de banco e titular sem números", () => {
    expect(validarConta({ nome: "Banco", tipo: "BANCO", instituicao: "Sicoob", agencia: "", numeroConta: "", titular: "João 2", saldoAbertura: "0,00", dataSaldoAbertura: "2026-09-12" }, { aberturaEditavel: true }))
      .toEqual({ agencia: "Informe a agência", numeroConta: "Informe o número da conta", titular: "O titular não pode conter números" });
    expect(validarConta({ nome: "Banco", tipo: "BANCO", instituicao: "Sicoob", agencia: "1", numeroConta: "2", titular: "João Silva", saldoAbertura: "0,00", dataSaldoAbertura: "2026-09-12" }, { aberturaEditavel: true })).toEqual({});
  });

  it("normaliza moeda brasileira com duas casas decimais", () => {
    expect(valorMonetario("123,45")).toBe(123.45);
    expect(valorMonetario("1.000,25")).toBe(1000.25);
    expect(valorMonetario("1.000")).toBe(1000);
    expect(formatarValorMonetario("1234.5")).toBe("1.234,50");
    expect(validarConta({ nome: "Caixa", saldoAbertura: "1,23", dataSaldoAbertura: "2026-09-12" }, { aberturaEditavel: true })).toEqual({});
    expect(validarConta({ nome: "Caixa", saldoAbertura: "1,2345", dataSaldoAbertura: "2026-09-12" }, { aberturaEditavel: true })).toMatchObject({ saldoAbertura: "Use um valor em reais com até 2 casas decimais" });
  });

  it("validarParceiro agrega erros por campo", () => {
    expect(validarParceiro({ nome: "Zé", documento: "123", email: "x" })).toEqual({ documento: expect.stringMatching(/dígitos/), email: "E-mail inválido" });
    expect(validarParceiro({ nome: "Zé", documento: "", email: "" })).toEqual({});
  });
});
