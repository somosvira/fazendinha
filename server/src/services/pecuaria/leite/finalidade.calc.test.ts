import { describe, expect, it } from "vitest";
import { evidenciaFinalidadeLeite, exigirFinalidadeLeite, resolverFinalidadeLeite } from "./finalidade.calc.js";
const d = (s: string) => new Date(s);
const periodos = [{ id: "leite1", aptidao: "LEITE", desde: d("2026-10-01"), ate: d("2026-10-15") },
  { id: "reproducao", aptidao: "REPRODUCAO", desde: d("2026-10-15"), ate: d("2026-10-20") },
  { id: "leite2", aptidao: "LEITE", desde: d("2026-10-20"), ate: null }];
describe("finalidade leiteira temporal", () => {
  it("preserva Leite anterior e retorno, excluindo Reprodução desde o dia da mudança", () => {
    expect(exigirFinalidadeLeite(periodos, d("2026-10-14")).finalidadeId).toBe("leite1");
    expect(resolverFinalidadeLeite(periodos, d("2026-10-15"))).toMatchObject({ elegivel: false, codigo: "FINALIDADE_REPRODUCAO" });
    expect(exigirFinalidadeLeite(periodos, d("2026-10-20")).finalidadeId).toBe("leite2");
  });
  it("não presume Leite em lacuna, sobreposição ou Corte", () => {
    expect(resolverFinalidadeLeite([], d("2026-10-14")).codigo).toBe("FINALIDADE_AUSENTE");
    expect(resolverFinalidadeLeite([...periodos, periodos[0]], d("2026-10-14")).codigo).toBe("FINALIDADE_CONFLITANTE");
    expect(resolverFinalidadeLeite([{ ...periodos[2], aptidao: "CORTE" }], d("2026-10-20")).codigo).toBe("FINALIDADE_CORTE");
  });
  it("distingue evidência histórica e legado sem apagar litros nem usar finalidade atual", () => {
    const e = exigirFinalidadeLeite(periodos, d("2026-10-14"));
    expect(evidenciaFinalidadeLeite(e, "2026-10-14").estado).toBe("COMPROVADA");
    expect(evidenciaFinalidadeLeite({}, "2026-10-14").estado).toBe("PENDENTE_CONCILIACAO");
    expect(evidenciaFinalidadeLeite(e, "2026-10-15").estado).toBe("PENDENTE_CONCILIACAO");
  });
});

describe("extremidade comprovada da baixa no próprio dia", () => {
  const encerrada = [{ id: "leite", aptidao: "LEITE", desde: d("2026-01-01"), ate: d("2026-10-15") }];
  const baixas = [{ id: "baixa", data: d("2026-10-15"), destinoFechadoId: "leite" }];
  it("mantém o dia, registra a razão no snapshot e exclui o dia seguinte", () => {
    const contexto = exigirFinalidadeLeite(encerrada, d("2026-10-15"), baixas);
    expect(contexto.finalidadeSnapshot).toMatchObject({ ate: "2026-10-15", motivoExtremidade: "BAIXA_NO_DIA", baixaId: "baixa" });
    expect(evidenciaFinalidadeLeite(contexto, "2026-10-15").estado).toBe("COMPROVADA");
    expect(resolverFinalidadeLeite(encerrada, d("2026-10-16"), baixas).elegivel).toBe(false);
  });
  it("não converte fim por mudança, outra finalidade, baixa de outra data ou conflito em Leite", () => {
    expect(resolverFinalidadeLeite(encerrada, d("2026-10-15")).elegivel).toBe(false);
    expect(resolverFinalidadeLeite(encerrada, d("2026-10-15"), [{ ...baixas[0], destinoFechadoId: "outra" }]).elegivel).toBe(false);
    expect(resolverFinalidadeLeite(encerrada, d("2026-10-15"), [{ ...baixas[0], data: d("2026-10-14") }]).elegivel).toBe(false);
    expect(resolverFinalidadeLeite([{ ...encerrada[0], aptidao: "REPRODUCAO" }], d("2026-10-15"), baixas).codigo).toBe("FINALIDADE_REPRODUCAO");
    expect(resolverFinalidadeLeite([...encerrada, { ...encerrada[0], id: "outra", desde: d("2026-10-15"), ate: null }], d("2026-10-15"), baixas).codigo).toBe("FINALIDADE_CONFLITANTE");
  });
});
