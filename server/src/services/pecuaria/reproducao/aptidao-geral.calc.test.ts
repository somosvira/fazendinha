import { describe, expect, it } from "vitest";
import { calcularElegibilidadeNaData, type EntradaElegibilidade } from "./elegibilidade.calc.js";
const dia = (d: string) => new Date(`${d}T00:00:00Z`);
function entrada(): EntradaElegibilidade {
  return { animalId: "a", propriedadeId: 1, referencia: dia("2026-11-04"), sexo: "F", propriedadeNaData: 1, localizacaoConflitante: false, baixaEm: null,
    ciclo: null, vinculo: null, politica: null, decisoes: [], papel: null, papelConflitante: false, descarte: false, restricoes: [], situacaoReprodutiva: "VAZIA", perdaGestacionalEm: null,
    toques: [{ id: "exame", animalId: "a", propriedadeId: 1, data: dia("2026-10-01"), atualizadoEm: dia("2026-10-01"), status: "VALIDO", finalidadePrincipal: "APTIDAO_REPRODUTIVA", resultadoOpcao: "APTO", retornoEm: null }] };
}
describe("aptidão geral", () => {
  it("o exame apto da novilha basta sem decisão por ação ou ciclo artificial", () => {
    expect(calcularElegibilidadeNaData(entrada()).aptidao.estado).toBe("APTA");
  });
  it("falta de exame e exame inconclusivo são pendências, não inaptidão", () => {
    expect(calcularElegibilidadeNaData({ ...entrada(), toques: [] }).aptidao.estado).toBe("PENDENTE");
    const i = entrada(); i.toques![0].resultadoOpcao = "INCONCLUSIVO";
    expect(calcularElegibilidadeNaData(i).aptidao.estado).toBe("PENDENTE");
    i.toques![0].resultadoOpcao = "NAO_APTO";
    expect(calcularElegibilidadeNaData(i).aptidao.estado).toBe("NAO_APTA");
  });
  it("restrição ativa impede, encerrada exige novo exame posterior", () => {
    const i = entrada(); i.restricoes = [{ id: "r", data: dia("2026-10-05"), ate: null, status: "VALIDO" }];
    expect(calcularElegibilidadeNaData(i).aptidao.estado).toBe("NAO_APTA");
    i.restricoes[0].ate = dia("2026-10-20");
    expect(calcularElegibilidadeNaData(i).aptidao.estado).toBe("PENDENTE");
    i.toques![0].data = dia("2026-10-21");
    expect(calcularElegibilidadeNaData(i).aptidao.estado).toBe("APTA");
  });
  it("parto e aborto invalidam exame do ciclo anterior", () => {
    for (const aborto of [false, true]) {
      const i = entrada(); i.ciclo = { chaveCiclo: "PARTO:p", inicioCiclo: dia("2026-10-15"), partoId: "p", aborto, paridade: 1, aptaDesdeInicial: null };
      expect(calcularElegibilidadeNaData(i).aptidao.estado).toBe("PENDENTE");
    }
  });
  it("diagnóstico pendente não reaproveita aptidão para nova tentativa", () => {
    expect(calcularElegibilidadeNaData({ ...entrada(), situacaoReprodutiva: "AGUARDANDO_DIAGNOSTICO" }).aptidao.estado).toBe("PENDENTE");
    expect(calcularElegibilidadeNaData({ ...entrada(), situacaoReprodutiva: "GESTANTE" }).aptidao.estado).toBe("NAO_APTA");
  });
  it("o mesmo exame pode ter DG negativo e aptidão sem converter o DG em aptidão", () => {
    const i = entrada(); i.toques![0] = { ...i.toques![0], finalidadePrincipal: "DIAGNOSTICO", resultadoOpcao: null, resultadoAptidao: "APTO" };
    expect(calcularElegibilidadeNaData(i).aptidao.estado).toBe("APTA");
    i.toques![0].resultadoAptidao = null;
    expect(calcularElegibilidadeNaData(i).aptidao.estado).toBe("PENDENTE");
  });
});

it("novo toque posterior à anulação no mesmo dia recompõe aptidão, sem ressuscitar o anterior", () => {
 const i = entrada(); const anterior = { ...i.toques![0], id: "anulado", status: "ANULADO", atualizadoEm: new Date("2026-10-01T10:00:00Z") };
 i.toques!.push(anterior);
 expect(calcularElegibilidadeNaData(i).aptidao.estado).toBe("PENDENTE");
 i.toques![0].atualizadoEm = new Date("2026-10-01T11:00:00Z");
 expect(calcularElegibilidadeNaData(i).aptidao.estado).toBe("APTA");
});

it("encerrar bloqueio legado preserva o registro e exige exame posterior", () => {
 const i = entrada(); const bloqueio = { id: "b", data: dia("2026-10-10"), tipo: "BLOQUEAR", aptaDesde: null, status: "VALIDO", criadoEm: dia("2026-10-10") };
 i.decisoes = [bloqueio]; expect(calcularElegibilidadeNaData(i).aptidao.estado).toBe("NAO_APTA");
 i.decisoes = [bloqueio, { ...bloqueio, id: "fim", tipo: "RETOMAR_POLITICA", data: dia("2026-10-20") }];
 expect(calcularElegibilidadeNaData(i).aptidao.estado).toBe("PENDENTE");
 i.toques![0].data = dia("2026-10-21"); expect(calcularElegibilidadeNaData(i).aptidao.estado).toBe("APTA");
 expect(bloqueio.status).toBe("VALIDO");
});
