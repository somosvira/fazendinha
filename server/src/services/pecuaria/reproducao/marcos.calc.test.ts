import { describe, expect, it } from "vitest";
import { construirMarcosReprodutivos } from "./marcos.calc.js";
import type { DadosAcompanhamentoIndicadores } from "./acompanhamento-indicadores.calc.js";
function dados(parto = true): DadosAcompanhamentoIndicadores {
  return { partos: [], ciclos: [{ id: "c", chaveCiclo: parto ? "PARTO:p" : "INICIAL", animalId: "a", inicio: "2026-11-04", partoId: parto ? "p" : null, partoEm: parto ? "2026-11-04" : null, localInicio: { propriedadeId: 1 }, localCorte: { propriedadeId: 1 }, candidatosLiberacao: [], restricoes: [], servicos: [{ id: "ia", data: "2026-11-04", tipo: "IA", valido: true, propriedadeId: 1 }] }], gestacoes: [{ id: "g", animalId: "a", valida: true, confirmadaEm: "2026-11-04", localConfirmacao: { propriedadeId: 1 }, primeiroDgPositivo: { id: "dg", data: "2026-11-04", local: { propriedadeId: 1 } }, encerramento: null, coberturaSeguimento: [], evidencias: [] }] };
}
describe("marcos do ciclo atual", () => {
  it("não carrega IA e DG do dia do parto para o novo ciclo", () => {
    const r = construirMarcosReprodutivos(dados(), "a", "VAZIA", "2026-11-04");
    expect(r.marcos.filter(m => ["PRIMEIRO_SERVICO", "DG_POSITIVO"].includes(m.id)).every(m => m.data === null)).toBe(true);
    expect(r.intervalos.find(i => i.rotulo === "Parto até primeiro serviço")?.dias).toBeNull();
    expect(r.eventos.map(e => e.id)).not.toContain("ia");
    expect(r.eventos.map(e => e.id)).not.toContain("dg");
  });
  it("mantém serviço posterior ao parto e início informado inclusivo", () => {
    const d = dados(); d.ciclos[0].servicos[0].data = "2026-11-05";
    expect(construirMarcosReprodutivos(d, "a", "VAZIA", "2026-11-05").intervalos.find(i => i.rotulo === "Parto até primeiro serviço")?.dias).toBe(1);
    const r = construirMarcosReprodutivos(dados(false), "a", "GESTANTE", "2026-11-04");
    expect(r.marcos.find(m => m.id === "PRIMEIRO_SERVICO")?.data).toBe("2026-11-04");
    expect(r.marcos.find(m => m.id === "DG_POSITIVO")?.data).toBe("2026-11-04");
  });
});
