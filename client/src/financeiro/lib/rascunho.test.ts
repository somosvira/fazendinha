import { describe, expect, it } from "vitest";
import type { RascunhoOperacao } from "../novo-api";
import { brl } from "../financeiro-ui";
import { quandoSalvo, resumoRascunho } from "./rascunho";

const rascunho = (dados: RascunhoOperacao["dados"]): RascunhoOperacao => ({ id: 1, versao: 1, updatedAt: "2026-09-14T12:00:00Z", documentos: [], dados });

describe("resumoRascunho", () => {
  it("usa a descrição, o tipo e o valor da operação", () => {
    expect(resumoRascunho(rascunho({ operacao: { tipo: "SERVICO", descricao: "Conserto do trator", valorTotal: 1250, itens: [] } }))).toEqual({
      titulo: "Conserto do trator",
      tipo: "Serviço",
      detalhe: `${brl(1250)} · Serviço`,
      atualizadoEm: "2026-09-14T12:00:00Z",
    });
  });

  it("soma os itens como o formulário, arredondando aos centavos", () => {
    const resumo = resumoRascunho(rascunho({ operacao: { tipo: "VENDA", descricao: "Venda de bezerros", itens: [
      { descricao: "Bezerro", quantidade: 3, valorUnitario: 10 / 3 },
      { descricao: "Novilha", quantidade: 2, valorUnitario: 12.5 },
    ] } }));
    expect(resumo.detalhe).toBe(`${brl(35)} · Venda`);
  });

  it("sem descrição, usa o primeiro item descrito e omite valor zerado", () => {
    const resumo = resumoRascunho(rascunho({ operacao: { tipo: "COMPRA_ESTOQUE", descricao: "  ", itens: [
      { descricao: "", quantidade: 1, valorUnitario: 0 },
      { descricao: "Ração 40 kg", quantidade: 1, valorUnitario: 0 },
    ] } }));
    expect(resumo.titulo).toBe("Ração 40 kg");
    expect(resumo.tipo).toBe("Compra para estoque");
    expect(resumo.detalhe).toBe("Compra para estoque");
  });

  it("recorre ao estado do formulário quando a operação não foi gravada", () => {
    const resumo = resumoRascunho(rascunho({ formulario: { tipo: "SERVICO", descricao: "Frete", valorOperacao: "80.5" } }));
    expect(resumo.titulo).toBe("Frete");
    expect(resumo.detalhe).toBe(`${brl(80.5)} · Serviço`);
  });

  it("tolera rascunho vazio ou malformado", () => {
    expect(resumoRascunho(rascunho({}))).toMatchObject({ titulo: "Nova operação", tipo: null, detalhe: "" });
    expect(resumoRascunho(rascunho({ operacao: { itens: "x", valorTotal: "abc", tipo: 3 } }))).toMatchObject({ titulo: "Nova operação", tipo: null, detalhe: "" });
    expect(resumoRascunho(rascunho({ operacao: { tipo: "INEXISTENTE" } })).tipo).toBeNull();
  });
});

describe("quandoSalvo", () => {
  const agora = new Date(2026, 8, 14, 15, 0).getTime();
  const salvoEm = (...data: [number, number, number, number, number, number?]) => new Date(...data).toISOString();

  it("fala em minutos e horas no mesmo dia", () => {
    expect(quandoSalvo(salvoEm(2026, 8, 14, 14, 59, 30), agora)).toBe("Rascunho salvo agora");
    expect(quandoSalvo(salvoEm(2026, 8, 14, 14, 55), agora)).toBe("Rascunho salvo há 5 min");
    expect(quandoSalvo(salvoEm(2026, 8, 14, 12, 0), agora)).toBe("Rascunho salvo há 3 h");
  });

  it("usa dias de calendário para ontem e datas mais antigas", () => {
    expect(quandoSalvo(salvoEm(2026, 8, 13, 20, 0), agora)).toBe("Rascunho salvo ontem");
    expect(quandoSalvo(salvoEm(2026, 8, 11, 9, 0), agora)).toBe("Rascunho salvo em 11/09");
  });

  it("não quebra com data inválida ou relógio adiantado", () => {
    expect(quandoSalvo("não é data", agora)).toBe("Rascunho salvo");
    expect(quandoSalvo(salvoEm(2026, 8, 14, 15, 3), agora)).toBe("Rascunho salvo agora");
  });
});
