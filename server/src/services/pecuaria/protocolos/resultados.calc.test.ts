import { describe, expect, it } from "vitest";
import {
  faseEtapaReprodutiva,
  resumirPreparo,
  resumirDiagnostico,
  taxaResultado,
} from "./resultados.calc.js";
describe("execução e resultados factuais", () => {
  it("separa DG, reconfirmação e sexagem pelo contrato estruturado, sem interpretar nomes", () => {
    for (const tipo of ["DIAGNOSTICO", "RECONFIRMACAO", "SEXAGEM"])
      expect(
        faseEtapaReprodutiva({ tipo: "AVALIACAO", planoAvaliacao: { tipo } }),
      ).toBe("RESULTADOS");
    expect(
      faseEtapaReprodutiva({ tipo: "APLICACAO", nome: "Diagnóstico" }),
    ).toBe("EXECUCAO");
    expect(faseEtapaReprodutiva({ tipo: "EXAME", nome: "DG" })).toBe(
      "EXECUCAO",
    );
  });
  it("preparo concluído não fabrica tentativa; tentativa interna pendente impede encerrar execução", () => {
    expect(
      resumirPreparo([{ tipo: "APLICACAO", situacao: "ATENDIDO" }], false),
    ).toMatchObject({ situacao: "CONCLUIDO", execucaoEncerrada: true });
    expect(
      resumirPreparo(
        [
          { tipo: "APLICACAO", situacao: "ATENDIDO" },
          { tipo: "TENTATIVA", situacao: "SEM_REGISTRO" },
        ],
        false,
      ),
    ).toMatchObject({ situacao: "CONCLUIDO", execucaoEncerrada: false });
  });
  it("dispensa explícita encerra trabalho sem declarar preparo atendido; dispensa sem motivo não encerra", () => {
    expect(
      resumirPreparo(
        [
          {
            tipo: "RETIRADA",
            situacao: "DISPENSADO",
            motivoDispensa: "Exceção conferida",
          },
        ],
        false,
      ),
    ).toMatchObject({
      situacao: "DISPENSADO",
      atendidas: 0,
      execucaoEncerrada: true,
    });
    expect(
      resumirPreparo([{ tipo: "RETIRADA", situacao: "DISPENSADO" }], false)
        .execucaoEncerrada,
    ).toBe(false);
    expect(resumirPreparo([], false)).toMatchObject({
      situacao: "SEM_ETAPAS",
      execucaoEncerrada: false,
    });
  });
  it("ausência de DG é aguardando; inconclusivo não vira negativo; preserva primeiro exame e perda separada", () => {
    expect(resumirDiagnostico([], false)).toMatchObject({
      primeiroDg: null,
      conclusao: "AGUARDANDO_DIAGNOSTICO",
    });
    const exame = {
      id: "e1",
      data: "2026-01-01",
      finalidades: ["DIAGNOSTICO"],
      resultado: "INCONCLUSIVO",
      conduta: null,
      retornoEm: null,
    };
    expect(
      resumirDiagnostico([{ ...exame, resultado: null }], false),
    ).toMatchObject({ primeiroDg: null, conclusao: "AGUARDANDO_DIAGNOSTICO" });
    expect(resumirDiagnostico([exame], false).conclusao).toBe("INCONCLUSIVO");
    const positivo = {
      ...exame,
      id: "e2",
      data: "2026-01-10",
      resultado: "POSITIVO",
    };
    expect(resumirDiagnostico([exame, positivo], true)).toMatchObject({
      primeiroDg: exame,
      conclusao: "POSITIVO",
      perdaPosterior: true,
      posteriores: [positivo],
    });
  });
  it("taxa sem denominador é desconhecida e mantém bases distintas", () => {
    expect(taxaResultado(0, 0)).toEqual({
      numerador: 0,
      denominador: 0,
      percentual: null,
    });
    expect(taxaResultado(3, 4).percentual).toBe(75);
    expect(taxaResultado(3, 6).percentual).toBe(50);
  });
});
