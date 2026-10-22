import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { ORDENHAS_INICIAIS, resumirProducao, conferirCorrecaoMedicao, medicaoMudou } from "./producao.calc.js";
import { configuracaoOrdenhaSchema, dataLeiteSchema, medicaoLeiteSchema, salvarFolhaSchema } from "./schemas.js";
const animalId = "10000000-0000-4000-8000-000000000001";
const posicaoId = ORDENHAS_INICIAIS[0].posicaoId;
const chave = "20000000-0000-4000-8000-000000000001";
const medido = (litros: number) => ({ estado: "MEDIDO", litros });
describe("produção individual e cobertura", () => {
  it("soma os dois animais e conserva a ausência da noite como parcial", () => {
    expect(resumirProducao([12, 10, 8, 9, 8, 7].map(medido))).toMatchObject({ litros: 54, completa: true, medidas: 6 });
    expect(resumirProducao([12, 10, 9, 8].map(medido), 6)).toMatchObject({ litros: 39, completa: false, pendentes: 2 });
    expect(resumirProducao([12, 10, 8].map(medido)).litros).toBe(30);
    expect(resumirProducao([12, 9].map(medido)).litros).toBe(21);
  });
  it("distingue zero, pendência, não ordenhado e população vazia", () => {
    expect(resumirProducao([medido(0)])).toMatchObject({ litros: 0, completa: true });
    expect(resumirProducao([{ estado: "PENDENTE", litros: null }])).toMatchObject({ litros: null, pendentes: 1 });
    expect(resumirProducao([{ estado: "NAO_ORDENHADO", litros: null }])).toMatchObject({ litros: null, completa: true, naoOrdenhadas: 1 });
    expect(resumirProducao([])).toMatchObject({ litros: null, completa: false });
    expect(resumirProducao([medido(0.1), medido(0.2)]).litros).toBe(0.3);
  });
  it("exige motivo para apagar ou substituir um valor resolvido, inclusive zero", () => {
    expect(() => conferirCorrecaoMedicao({ estado: "MEDIDO" }, null)).toThrow("Explique");
    expect(() => conferirCorrecaoMedicao({ estado: "NAO_ORDENHADO" }, null)).toThrow("Explique");
    expect(() => conferirCorrecaoMedicao({ estado: "PENDENTE" }, null)).not.toThrow();
    expect(medicaoMudou({ estado: "MEDIDO", litros: new Prisma.Decimal(0), motivo: null }, { animalId, posicaoId, estado: "PENDENTE" })).toBe(true);
    expect(medicaoMudou({ estado: "MEDIDO", litros: new Prisma.Decimal("1.100"), motivo: null }, { animalId, posicaoId, estado: "MEDIDO", litros: 1.1 })).toBe(false);
  });
});
describe("contratos de captura", () => {
  it("valida calendário real, volumes explícitos e precisão sem arredondar", () => {
    expect(dataLeiteSchema.safeParse("2026-02-30").success).toBe(false);
    expect(dataLeiteSchema.safeParse("2024-02-29").success).toBe(true);
    for (const litros of [null, -1, 0.0001, Number.NaN, Number.POSITIVE_INFINITY])
      expect(medicaoLeiteSchema.safeParse({ animalId, posicaoId, estado: "MEDIDO", litros }).success).toBe(false);
    expect(medicaoLeiteSchema.safeParse({ animalId, posicaoId, estado: "MEDIDO", litros: 0 }).success).toBe(true);
    expect(medicaoLeiteSchema.safeParse({ animalId, posicaoId, estado: "PENDENTE", litros: 0 }).success).toBe(false);
    expect(medicaoLeiteSchema.safeParse({ animalId, posicaoId, estado: "NAO_ORDENHADO", motivo: "Animal em tratamento" }).success).toBe(true);
    expect(medicaoLeiteSchema.safeParse({ animalId, posicaoId, estado: "NAO_ORDENHADO" }).success).toBe(false);
  });
  it("permite quantidade e horário configuráveis com identidade/ordem únicas", () => {
    const base = { chave, propriedadeId: 1, vigenteDesde: "2026-10-01" };
    expect(configuracaoOrdenhaSchema.safeParse({ ...base, ordenhas: ORDENHAS_INICIAIS.slice(0, 2) }).success).toBe(true);
    expect(configuracaoOrdenhaSchema.safeParse({ ...base, ordenhas: [ORDENHAS_INICIAIS[0], ORDENHAS_INICIAIS[0]] }).success).toBe(false);
    expect(configuracaoOrdenhaSchema.safeParse({ ...base, ordenhas: [{ ...ORDENHAS_INICIAIS[0], horario: "24:00" }] }).success).toBe(false);
  });
  it("recusa células repetidas e inclusão/exclusão contraditória", () => {
    const celula = { animalId, posicaoId, estado: "MEDIDO", litros: 2 };
    const base = { chave, propriedadeId: 1, dataOperacional: "2026-10-01", versaoEsperada: 0 };
    expect(salvarFolhaSchema.safeParse({ ...base, medicoes: [celula, celula] }).success).toBe(false);
    expect(salvarFolhaSchema.safeParse({ ...base, medicoes: [], animaisAdicionar: [animalId], animaisExcluir: [animalId] }).success).toBe(false);
    expect(salvarFolhaSchema.parse({ ...base, medicoes: [] })).toMatchObject({ animaisAdicionar: [], animaisExcluir: [] });
  });
});
