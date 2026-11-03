import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import { reordenarChavesJson } from "../../../test/jsonb.js";
import { pesagemHistoricaSchema, prepararPesagemHistoricaTx, registrarPesagemHistoricaTx, validarContextoHistoricoAnimalTx } from "./pesagens.js";

const animalId = "3df406be-0a8e-4fa1-957e-03c008887804";
const outraAnimalId = "118ad719-f94c-442c-bf44-b641682b5d07";
const input = { animalId, data: "2024-08-12", pesoKg: 420.5, tipo: "ROTINA" as const, origem: "MANUAL" as const, precisao: "ESTIMADO" as const, contexto: "INTERNO" as const, propriedadeId: 3, bancoOrigem: "IDEAGRI", chaveOrigem: "PESO:1", evidencia: "Planilha fornecida pela fazenda" };
function banco() {
  const estado = {
    animal: { id: animalId, dataNascimento: new Date("2020-01-01"), dataEntrada: new Date("2024-01-01") },
    usuario: { id: 7 } as { id: number } | null,
    baixa: null as { data: Date; localizacaoFechadaId: string } | null,
    locais: [{ id: "local1", propriedadeId: 3, desde: new Date("2024-01-01"), ate: null as Date | null }],
    registros: [] as Array<Record<string, unknown>>,
    auditorias: [] as Array<Record<string, unknown>>,
  };
  const chamadas = { trava: vi.fn(async () => 1), criar: vi.fn(), auditar: vi.fn() };
  const tx = {
    $executeRaw: chamadas.trava,
    usuario: { findUnique: async () => estado.usuario },
    animal: { findUnique: async () => estado.animal },
    baixaAnimal: { findFirst: async () => estado.baixa },
    localizacaoAnimal: { findMany: async ({ where }: { where: { desde: { lte: Date }; OR: Array<{ id?: string }> } }) => estado.locais.filter(l => l.desde <= where.desde.lte && (l.ate === null || l.ate > where.desde.lte || where.OR.some(o => o.id === l.id))) },
    pesagem: {
      findUnique: async ({ where }: { where: { referenciaHistorica: string } }) => estado.registros.find(p => p.referenciaHistorica === where.referenciaHistorica) ?? null,
      create: async ({ data }: { data: Record<string, unknown> }) => { chamadas.criar(data); const criada = { id: "pesagem1", ...data, provenienciaHistoricaSnapshot: reordenarChavesJson(data.provenienciaHistoricaSnapshot) }; estado.registros.push(criada); return criada; },
    },
    auditoriaPecuaria: { create: async ({ data }: { data: Record<string, unknown> }) => { chamadas.auditar(data); estado.auditorias.push(data); return data; } },
  } as unknown as Prisma.TransactionClient;
  return { tx, estado, chamadas };
}
beforeEach(() => vi.useRealTimers());

describe("pesagem histórica documentada", () => {
  it("exige precisão explícita, evidência, data válida e coerência de origem", () => {
    const { precisao: _precisao, ...semPrecisao } = input;
    expect(pesagemHistoricaSchema.safeParse(semPrecisao).success).toBe(false);
    expect(pesagemHistoricaSchema.safeParse({ ...input, evidencia: "sim" }).success).toBe(false);
    expect(pesagemHistoricaSchema.safeParse({ ...input, data: "2099-01-01" }).success).toBe(false);
    expect(pesagemHistoricaSchema.safeParse({ ...input, origem: "BALANCA" }).success).toBe(false);
    expect(pesagemHistoricaSchema.safeParse({ ...input, origem: "BALANCA", precisao: "MEDIDO" }).success).toBe(true);
    expect(pesagemHistoricaSchema.safeParse({ ...input, precisao: "NAO_INFORMADO" }).success).toBe(true);
  });
  it("prévia somente lê e retorna referência determinística sem gravar ou travar", async () => {
    const { tx, estado, chamadas } = banco();
    expect(await prepararPesagemHistoricaTx(tx, input, 7)).toEqual({ acao: "CRIAR", dados: { ...input, observacao: null }, referencia: '["IDEAGRI","PESO:1"]', pesagemId: null });
    expect(chamadas.trava).not.toHaveBeenCalled();
    expect(estado.registros).toHaveLength(0); expect(estado.auditorias).toHaveLength(0);
  });
  it("grava pelo núcleo único, com precisão, contexto, snapshot e auditoria", async () => {
    const { tx, estado, chamadas } = banco();
    expect(await registrarPesagemHistoricaTx(tx, input, 7)).toMatchObject({ id: "pesagem1" });
    expect(chamadas.trava).toHaveBeenCalled();
    expect(estado.registros).toHaveLength(1);
    expect(estado.registros[0]).toMatchObject({ animalId, data: new Date("2024-08-12"), tipo: "ROTINA", origem: "MANUAL", precisao: "ESTIMADO", contextoHistorico: "INTERNO", propriedadeId: 3, criadoPorId: 7, referenciaHistorica: '["IDEAGRI","PESO:1"]', provenienciaHistoricaSnapshot: { dados: { ...input, observacao: null }, usuarioId: 7 } });
    expect(Number(estado.registros[0].pesoKg)).toBe(420.5);
    expect(estado.auditorias).toHaveLength(1);
    expect(estado.auditorias[0]).toMatchObject({ entidade: "Pesagem", entidadeId: "pesagem1", acao: "REGISTRO", usuarioId: 7 });
  });
  it("pré-entrada externa comprovada conserva entrada e não recebe sítio atual", async () => {
    const { tx, estado } = banco();
    await registrarPesagemHistoricaTx(tx, { ...input, data: "2022-05-01", contexto: "EXTERNO", propriedadeId: null, precisao: "INFORMADO" }, 7);
    expect(estado.registros[0]).toMatchObject({ contextoHistorico: "EXTERNO", propriedadeId: null, precisao: "INFORMADO" });
    expect(estado.animal.dataEntrada).toEqual(new Date("2024-01-01"));
    expect(estado.locais).toHaveLength(1);
  });
  it.each(["ausente", "outro", "sobreposto"])("recusa contexto interno %s sem inventar localização", async cenario => {
    const { tx, estado } = banco();
    if (cenario === "ausente") estado.locais = [];
    if (cenario === "outro") estado.locais[0].propriedadeId = 9;
    if (cenario === "sobreposto") estado.locais.push({ ...estado.locais[0], id: "local2" });
    await expect(prepararPesagemHistoricaTx(tx, input, 7)).rejects.toMatchObject({ code: "VALIDACAO", campo: "propriedadeId" });
    expect(estado.registros).toHaveLength(0);
  });
  it("recusa externo contraditório com localização na data, inclusive no dia da baixa", async () => {
    const { tx, estado } = banco();
    const externo = { ...input, contexto: "EXTERNO" as const, propriedadeId: null };
    await expect(prepararPesagemHistoricaTx(tx, externo, 7)).rejects.toMatchObject({ code: "VALIDACAO", campo: "contexto" });
    estado.baixa = { data: new Date(input.data), localizacaoFechadaId: "local1" };
    estado.locais[0].ate = new Date(input.data);
    await expect(prepararPesagemHistoricaTx(tx, externo, 7)).rejects.toMatchObject({ code: "VALIDACAO", campo: "contexto" });
    await expect(prepararPesagemHistoricaTx(tx, input, 7)).resolves.toMatchObject({ acao: "CRIAR" });
  });
  it("valida nascimento e baixa na prévia e na gravação", async () => {
    const { tx, estado } = banco();
    await expect(prepararPesagemHistoricaTx(tx, { ...input, data: "2019-12-31", contexto: "EXTERNO", propriedadeId: null }, 7)).rejects.toMatchObject({ code: "VALIDACAO", campo: "data" });
    estado.baixa = { data: new Date("2024-08-01"), localizacaoFechadaId: "local1" };
    await expect(registrarPesagemHistoricaTx(tx, input, 7)).rejects.toMatchObject({ code: "VALIDACAO", campo: "data" });
    expect(estado.registros).toHaveLength(0);
  });
  it("reenvio idêntico conserva ID e autoria, sem outra auditoria mesmo após alteração de contexto", async () => {
    const { tx, estado } = banco();
    const primeira = await registrarPesagemHistoricaTx(tx, input, 7);
    estado.locais = [];
    expect(await prepararPesagemHistoricaTx(tx, input, 7)).toMatchObject({ acao: "REUTILIZAR", pesagemId: primeira.id });
    expect(await registrarPesagemHistoricaTx(tx, input, 7)).toMatchObject({ id: primeira.id });
    expect(estado.registros).toHaveLength(1); expect(estado.auditorias).toHaveLength(1);
    await expect(registrarPesagemHistoricaTx(tx, { ...input, pesoKg: 430 }, 7)).rejects.toMatchObject({ code: "CONFLITO" });
    await expect(registrarPesagemHistoricaTx(tx, { ...input, observacao: "Observação diferente de null" }, 7)).rejects.toMatchObject({ code: "CONFLITO" });
    await expect(registrarPesagemHistoricaTx(tx, input, 8)).rejects.toMatchObject({ code: "CONFLITO" });
    await expect(registrarPesagemHistoricaTx(tx, { ...input, animalId: outraAnimalId }, 7)).rejects.toMatchObject({ code: "CONFLITO" });
    expect(estado.registros).toHaveLength(1);
  });
  it("a gravação revalida a localização após obter a trava", async () => {
    const { tx, estado, chamadas } = banco();
    await prepararPesagemHistoricaTx(tx, input, 7);
    chamadas.trava.mockImplementation(async () => { estado.locais = []; return 1; });
    await expect(registrarPesagemHistoricaTx(tx, input, 7)).rejects.toMatchObject({ code: "VALIDACAO" });
    expect(estado.registros).toHaveLength(0);
  });
  it("exige usuário identificado e existente antes de aceitar a prévia", async () => {
    const { tx, estado } = banco();
    await expect(prepararPesagemHistoricaTx(tx, input, 0)).rejects.toMatchObject({ code: "VALIDACAO" });
    estado.usuario = null;
    await expect(prepararPesagemHistoricaTx(tx, input, 7)).rejects.toMatchObject({ code: "VALIDACAO" });
    expect(estado.registros).toHaveLength(0);
  });
  it("helper comum exige evidência e sítio coerente também fora da pesagem", async () => {
    const { tx } = banco();
    await expect(validarContextoHistoricoAnimalTx(tx, { animalId, data: input.data, contexto: "INTERNO", propriedadeId: null, evidencia: input.evidencia })).rejects.toThrow();
    await expect(validarContextoHistoricoAnimalTx(tx, { animalId, data: "2022-05-01", contexto: "EXTERNO", propriedadeId: 3, evidencia: input.evidencia })).rejects.toThrow();
    await expect(validarContextoHistoricoAnimalTx(tx, { animalId, data: "2022-05-01", contexto: "EXTERNO", propriedadeId: null, evidencia: "" })).rejects.toThrow();
  });
});
