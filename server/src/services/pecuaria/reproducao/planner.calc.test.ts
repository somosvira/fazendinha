import { describe, expect, it } from "vitest";
import { fingerprintGrupoPlanner, identidadeGrupoProtocolo, janelaPlanner, paginarPlanner } from "./planner.calc.js";
import { grupoPlannerSchema, incluirGrupoPlannerSchema } from "./planner.schemas.js";
const base = { protocoloId: "protocolo", versao: 1, tipo: "REPRODUTIVO", programacaoId: "turma-a", participacaoId: "individual", etapaId: "etapa",
  previstaPara: new Date("2026-10-14T00:00:00Z"), precisaoTemporal: "DIA" as const, previsaoPendente: false };
describe("grupos e calendário do planner", () => {
  it("separa dia, anteriores, futuros e previsão indefinida inclusive com hora em São Paulo", () => {
    expect(janelaPlanner(base.previstaPara, "DIA", false, "2026-10-14")).toBe("DIA");
    expect(janelaPlanner(base.previstaPara, "DIA", false, "2026-10-15")).toBe("ANTERIOR");
    expect(janelaPlanner(base.previstaPara, "DIA", false, "2026-10-13")).toBe("FUTURA");
    expect(janelaPlanner(base.previstaPara, "DIA", true, "2026-10-15")).toBe("SEM_PREVISAO");
    expect(janelaPlanner(new Date("2026-10-15T01:00:00Z"), "HORA", false, "2026-10-14")).toBe("DIA");
  });
  it("agrupa a mesma turma/versão/etapa/previsão e distingue turma, versão, participação legada e precisão", () => {
    const id = identidadeGrupoProtocolo(base);
    expect(identidadeGrupoProtocolo({ ...base, participacaoId: "outro-animal" })).toBe(id);
    for (const troca of [{ programacaoId: "turma-b" }, { versao: 2 }, { etapaId: "etapa-b" }, { precisaoTemporal: "HORA" as const }, { previstaPara: new Date("2026-10-15") }, { previsaoPendente: true }])
      expect(identidadeGrupoProtocolo({ ...base, ...troca })).not.toBe(id);
    expect(identidadeGrupoProtocolo({ ...base, programacaoId: null, participacaoId: "a" })).not.toBe(identidadeGrupoProtocolo({ ...base, programacaoId: null, participacaoId: "b" }));
  });
  it("não inventa previsão por data base quando a previsão está indefinida", () => {
    expect(identidadeGrupoProtocolo({ ...base, previsaoPendente: true })).toBe(identidadeGrupoProtocolo({ ...base, previsaoPendente: true, previstaPara: new Date("2027-01-01") }));
  });
  it("paginação não limita o conjunto e fingerprint detecta alteração fora da página", () => {
    const membros = Array.from({ length: 1201 }, (_, i) => ({ animalId: String(i), contexto: { del: i } }));
    expect(paginarPlanner(membros, 7, 200)).toEqual([membros[1200]]);
    expect(paginarPlanner(membros, 8, 200)).toEqual([]);
    const assinatura = fingerprintGrupoPlanner(base, 1, "2026-10-14", membros);
    expect(fingerprintGrupoPlanner(base, 2, "2026-10-14", membros)).not.toBe(assinatura);
    expect(fingerprintGrupoPlanner(base, 1, "2026-10-15", membros)).not.toBe(assinatura);
    expect(fingerprintGrupoPlanner(base, 1, "2026-10-14", [...membros.slice(0, -1), { ...membros[1200], contexto: { del: 9999 } }])).not.toBe(assinatura);
  });
  it("grupo extra valida tipo, critérios e contexto; inclusão não admite lista de IDs confiada ao cliente", () => {
    const grupo = { origem: "EXTRA", nome: "Avaliar matrizes", criterios: { versao: 1, todas: [], qualquer: [], ordenacao: [{ campo: "BRINCO", direcao: "ASC" }], politicaDesconhecidos: "EXCLUIR" } };
    expect(grupoPlannerSchema.parse(grupo)).toMatchObject({ tipo: "AVALIACAO_REPRODUTIVA", contexto: {} });
    expect(() => incluirGrupoPlannerSchema.parse({ chave: "0a3f887e-0b89-47a6-9511-52ca5a231ad3", propriedadeId: 1, fingerprint: "a".repeat(64), grupo, animais: [] })).toThrow();
  });
});
