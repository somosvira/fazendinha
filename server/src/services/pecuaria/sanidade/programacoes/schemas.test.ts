import { describe, expect, it } from "vitest";
import { cadastroProgramacaoSchema } from "./schemas.js";
const input = { propriedadeId: 1, nome: "Atividade fictícia", tipo: "VERIFICACAO", meses: [2], precisao: "MES", recorrencia: "JANELA_ELEGIBILIDADE", publico: {}, sujeitoTipo: "SITIO" };
describe("cadastro de programação", () => {
  it("aceita planejamento incompleto sem inventar produto, ano, dia ou execução", () => {
    expect(cadastroProgramacaoSchema.parse(input)).toMatchObject({ ano: null, dia: null, produtoId: null, executor: null, publicoConferido: false });
  });
  it("recusa mês fora do calendário, repetido e campos clínicos não contratados", () => {
    for (const extra of [{ meses: [0] }, { meses: [13] }, { meses: [2,2] }, { peso: 200 }, { ativo: true }, { publico: { pesoMinimo: 200 } }]) expect(cadastroProgramacaoSchema.safeParse({ ...input, ...extra }).success).toBe(false);
  });
  it("não confunde precisão mensal e diária", () => {
    expect(cadastroProgramacaoSchema.safeParse({ ...input, dia: 10 }).success).toBe(false);
    expect(cadastroProgramacaoSchema.safeParse({ ...input, precisao: "DIA" }).success).toBe(false);
  });
});
