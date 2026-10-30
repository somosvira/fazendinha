import { describe, expect, it } from "vitest";
import type { AnimalResumo } from "../types";
import type { DemandaManejo, ElegibilidadeNaData } from "./elegibilidade-api";
import { incorporarAptidaoManejo } from "./manejo-aptidao";
import type { LinhaManejo } from "./manejo-reprodutivo";
const hoje = "2026-10-29";
function animal(id = "a"): AnimalResumo {
  return { id, brinco: id, nome: null, sexo: "F", categoria: null, categoriaOrigem: "SEM_CATEGORIA", categoriaCalculada: null, idadeMeses: 36, idadeNaBaixa: false, dataNascimento: "2023-01-01", dataEntrada: "2024-01-01", origem: "NASCIDO", propriedade: { id: 3, nome: "Sítio" }, lote: null, aptidao: "LEITE", papelReprodutivo: null, composicaoRotulo: "", ultimoPeso: null, situacao: "ATIVO", gmdRecente: null, noLocalDesde: null, baixa: null };
}
function demanda(id = "r1", patch: Partial<DemandaManejo> = {}): DemandaManejo {
  return { id, finalidade: "RECONFIRMACAO", ocorrencia: 1, tentativaId: null, gestacaoId: "gestacao", dataReferencia: "2026-09-01", previstaPara: "2026-10-10", pendencias: [], ...patch };
}
function elegibilidade(demandasAcompanhamento: DemandaManejo[], id = "a"): ElegibilidadeNaData {
  return { animalId: id, propriedadeId: 3, dataReferencia: hoje, estado: "NAO_ELEGIVEL", baseElegivel: false, elegivel: false, aptaDesde: null, ciclo: null, vinculoCicloId: null, politicaId: null, politicaVersao: null, metodologia: "IDEAGRI_IILB_BASE_V1", decisaoId: null, motivos: ["GESTACAO_CONFIRMADA"], alertas: [], restricaoIds: [], demandasAcompanhamento };
}
const base = { liberadas: [], diagnostico: [], pendencias: [] };
describe("demandas clínicas na mesma fila de diagnóstico e reconfirmação", () => {
  it("gestante entra com a reconfirmação pendente e sua previsão factual", () => {
    const filas = incorporarAptidaoManejo(base, [elegibilidade([demanda()])], [animal()], hoje);
    expect(filas.diagnostico).toMatchObject([{ animalId: "a", data: "2026-10-10", dias: 19, demandasAcompanhamento: [{ id: "r1", finalidade: "RECONFIRMACAO", gestacaoId: "gestacao", ocorrencia: 1 }] }]);
    expect(filas.liberadas).toEqual([]);
  });
  it("diagnóstico legado e demanda da mesma fêmea geram uma única linha", () => {
    const legado: LinhaManejo = { animalId: "a", brinco: "a", nome: null, lote: null, data: "2026-09-01", dias: 58, motivos: [] };
    const dg = demanda("dg", { finalidade: "DIAGNOSTICO", tentativaId: "tentativa", gestacaoId: null });
    const filas = incorporarAptidaoManejo({ ...base, diagnostico: [legado] }, [elegibilidade([dg])], [animal()], hoje);
    expect(filas.diagnostico).toHaveLength(1);
    expect(filas.diagnostico[0]).toMatchObject({ data: "2026-10-10", demandasAcompanhamento: [{ id: "dg", tentativaId: "tentativa" }] });
  });
  it("preserva ocorrências distintas e deduplica somente a identidade repetida", () => {
    const r1 = demanda(), r2 = demanda("r2", { ocorrencia: 2, previstaPara: "2026-11-10" });
    const filas = incorporarAptidaoManejo(base, [elegibilidade([r2, r1, r1])], [animal()], hoje);
    expect(filas.diagnostico).toHaveLength(1);
    expect(filas.diagnostico[0].demandasAcompanhamento).toEqual([r1, r2]);
  });
  it("sem previsão mantém a demanda explícita sem inventar data ou prazo", () => {
    const filas = incorporarAptidaoManejo(base, [elegibilidade([demanda("r", { previstaPara: null, pendencias: ["EXAME_ORIGEM_INVALIDO"] })])], [animal()], hoje);
    expect(filas.diagnostico).toMatchObject([{ data: null, dias: null, demandasAcompanhamento: [{ id: "r", previstaPara: null, pendencias: ["EXAME_ORIGEM_INVALIDO"] }] }]);
  });
  it("não inclui demanda sem animal ativo do conjunto autorizado e mantém legado sem política", () => {
    const legado: LinhaManejo = { animalId: "legado", brinco: "legado", nome: null, lote: null, data: null, dias: null, motivos: [] };
    const filas = incorporarAptidaoManejo({ ...base, diagnostico: [legado] }, [elegibilidade([demanda()])], [animal("legado")], hoje);
    expect(filas.diagnostico).toEqual([legado]);
  });
});
