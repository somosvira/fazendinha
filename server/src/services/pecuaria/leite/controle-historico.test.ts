import { expect, it } from "vitest";
import { controleHistoricoLeiteSchema, resumirControleHistorico } from "./controle-historico.calc.js";
const base = { tipo: "CONTROLE_PERIODICO", inicio: "2024-02-10", fim: "2024-02-10", animalId: "7be84110-86c2-49b0-bf27-70f666c711ee", propriedadeId: 1, contexto: "INTERNO", lactacaoId: null, total: 20, unidade: "L", referenciaUnidade: "Coluna em litros documentada pela fazenda", parcelas: [], evidencia: "Controle periódico do arquivo original", snapshotOrigem: { linha: 1 } };
it("aceita total sem ordenha/horário sem fabricar parcelas", () => {
  const registro = controleHistoricoLeiteSchema.parse(base);
  expect(registro.parcelas).toEqual([]);
  expect(resumirControleHistorico(registro)).toEqual({ totalDeclarado: "20", somaParcelas: null, diferenca: null, parcelasConhecidas: 0, parcelasAusentes: 0, unidade: "L" });
});
it("preserva total divergente e separa null de zero", () => {
  const registro = controleHistoricoLeiteSchema.parse({ ...base, parcelas: [{ rotulo: "Manhã", hora: null, quantidade: 10 }, { rotulo: null, hora: null, quantidade: 5 }, { rotulo: "Não informado", hora: null, quantidade: null }] });
  expect(resumirControleHistorico(registro)).toMatchObject({ totalDeclarado: "20", somaParcelas: "15", diferenca: "5", parcelasConhecidas: 2, parcelasAusentes: 1 });
  expect(resumirControleHistorico(controleHistoricoLeiteSchema.parse({ ...base, total: null })).totalDeclarado).toBeNull();
  expect(resumirControleHistorico(controleHistoricoLeiteSchema.parse({ ...base, total: 0 })).totalDeclarado).toBe("0");
});
it("peso não vira volume e unidade não comprovada é rejeitada", () => {
  expect(resumirControleHistorico(controleHistoricoLeiteSchema.parse({ ...base, unidade: "KG" })).unidade).toBe("KG");
  expect(controleHistoricoLeiteSchema.safeParse({ ...base, unidade: "DESCONHECIDA" }).success).toBe(false);
  expect(controleHistoricoLeiteSchema.safeParse({ ...base, referenciaUnidade: "" }).success).toBe(false);
});
it("agregado mensal é documental do mês inteiro, sem animal ou série diária presumida", () => {
  expect(controleHistoricoLeiteSchema.safeParse({ ...base, tipo: "AGREGADO_MENSAL", inicio: "2024-02-01", fim: "2024-02-29", animalId: null, origemColetiva: "Resumo da fazenda" }).success).toBe(true);
  expect(controleHistoricoLeiteSchema.safeParse({ ...base, tipo: "AGREGADO_MENSAL", inicio: "2024-02-01", fim: "2024-02-28", animalId: null, origemColetiva: "Resumo da fazenda" }).success).toBe(false);
});
it("histórico externo não ganha sítio ou lactação interna", () => {
  expect(controleHistoricoLeiteSchema.safeParse({ ...base, contexto: "EXTERNO", propriedadeId: 1 }).success).toBe(false);
  expect(controleHistoricoLeiteSchema.safeParse({ ...base, contexto: "EXTERNO", propriedadeId: null }).success).toBe(true);
});
