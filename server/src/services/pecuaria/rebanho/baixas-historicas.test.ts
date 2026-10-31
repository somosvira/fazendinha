import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import { reordenarChavesJson } from "../../../test/jsonb.js";
import { registrarBaixaTx, darBaixa } from "./animais.js";
import { regularizarBaixaHistoricaTx, revisarClassificacaoBaixaTx } from "./baixas-historicas.js";

vi.mock("../fatos.js", async (importar) => ({ ...await importar<typeof import("../fatos.js")>(), conferirFatosNaBaixa: vi.fn() }));
vi.mock("./papeis.js", async (importar) => ({ ...await importar<typeof import("./papeis.js")>(), papelReprodutivoNaDataTx: async () => ({ papel: "NENHUM" }) }));
const m = vi.hoisted(() => ({ carencias: { leite: { estado: "NAO_APLICAVEL" }, carne: { estado: "NAO_APLICAVEL" } } }));
vi.mock("../sanidade/aplicacoes.js", () => ({ carenciaAnimalTx: async () => m.carencias }));
const origem = { data: "2024-08-12", bancoOrigem: "IDEAGRI", chaveOrigem: "BAIXA:1", evidencia: "Extrato da fazenda com saída comprovada", motivo: "Tipo ausente no documento original" };
const revisao = { chave: "39ce15f7-bd59-4405-8757-45f5a627715c", tipo: "VENDA" as const, evidencia: "Nota de venda localizada pela fazenda", motivo: "Classificação comprovada posteriormente" };

function banco() {
  const estado: { baixa: Record<string, unknown> | null; local: { id: string; desde: Date; ate: Date | null; propriedadeId: number }; destino: { id: string; desde: Date; ate: Date | null }; auditorias: Record<string, unknown>[] } = {
    baixa: null, local: { id: "loc", desde: new Date("2024-01-01"), ate: null, propriedadeId: 3 }, destino: { id: "fim", desde: new Date("2024-01-01"), ate: null }, auditorias: [],
  };
  const tx = {
    $executeRaw: async () => 1,
    necessidadeSanitaria: { findMany: async () => [] },
    necessidadeProgramacaoSanitaria: { findMany: async () => [] },
    animal: { findUniqueOrThrow: async () => ({ id: "animal", localizacoes: [], baixas: estado.baixa ? [estado.baixa] : [] }), findUnique: async () => ({ id: "animal", dataEntrada: new Date("2024-01-01") }) },
    localizacaoAnimal: { findFirst: async () => estado.local, updateMany: async ({ data }: { data: { ate: Date } }) => { estado.local.ate = data.ate; return { count: 1 }; } },
    finalidadeAnimal: { findFirst: async () => estado.destino, updateMany: async ({ data }: { data: { ate: Date } }) => { estado.destino.ate = data.ate; return { count: 1 }; } },
    pesagem: { findFirst: async () => null },
    motivoBaixa: { findFirst: async () => null },
    baixaAnimal: {
      findFirst: async () => estado.baixa,
      findUnique: async () => estado.baixa,
      findUniqueOrThrow: async () => estado.baixa,
      create: async ({ data }: { data: Record<string, unknown> }) => (estado.baixa = { id: "baixa", ...data, regularizacaoHistoricaSnapshot: reordenarChavesJson(data.regularizacaoHistoricaSnapshot), estornadaEm: null }),
      updateMany: async ({ where, data }: { where: { tipo?: string }; data: Record<string, unknown> }) => {
        if (!estado.baixa || where.tipo && estado.baixa.tipo !== where.tipo) return { count: 0 };
        estado.baixa = { ...estado.baixa, ...data, regularizacaoHistoricaSnapshot: reordenarChavesJson(data.regularizacaoHistoricaSnapshot) }; return { count: 1 };
      },
    },
    auditoriaPecuaria: { create: async ({ data }: { data: Record<string, unknown> }) => { estado.auditorias.push(data); return data; } },
  } as unknown as Prisma.TransactionClient;
  return { tx, estado };
}

beforeEach(() => { m.carencias = { leite: { estado: "NAO_APLICAVEL" }, carne: { estado: "NAO_APLICAVEL" } }; });

describe("executor único de baixa", () => {
  it("recusa tipo não determinado fora da regularização, inclusive por chamada direta", async () => {
    const { tx, estado } = banco();
    await expect(registrarBaixaTx(tx, { animalId: "animal", data: origem.data, tipo: "NAO_DETERMINADO" }, 7)).rejects.toMatchObject({ code: "VALIDACAO", campo: "tipo" });
    await expect(darBaixa({ animalId: "animal", data: origem.data, tipo: "NAO_DETERMINADO" } as never, 7)).rejects.toMatchObject({ code: "VALIDACAO", campo: "tipo" });
    expect(estado.baixa).toBeNull();
  });
});

describe("regularização histórica", () => {
  it("cria uma saída com autoria/evidência, fecha as mesmas linhas e mantém IDs no reenvio", async () => {
    const { tx, estado } = banco();
    const primeira = await regularizarBaixaHistoricaTx(tx, "animal", origem, 7, 3);
    const segunda = await regularizarBaixaHistoricaTx(tx, "animal", origem, 7, 3);
    expect(primeira.id).toBe("baixa"); expect(segunda.id).toBe(primeira.id);
    expect(estado.baixa).toMatchObject({ tipo: "NAO_DETERMINADO", localizacaoFechadaId: "loc", destinoFechadoId: "fim", criadoPorId: 7 });
    expect(estado.local.ate).toEqual(new Date(origem.data));
    expect(estado.destino.ate).toEqual(new Date(origem.data));
    expect(estado.auditorias).toHaveLength(1);
    expect(estado.baixa?.regularizacaoHistoricaSnapshot).toMatchObject({ ...origem, usuarioId: 7 });
  });
  it("reenvio após estorno e transferência respeita o sítio original sem reativar a saída", async () => {
    const { tx, estado } = banco();
    await regularizarBaixaHistoricaTx(tx, "animal", origem, 7, 3);
    estado.baixa!.estornadaEm = new Date("2024-09-01");
    const localOriginal = { ...estado.local };
    tx.localizacaoAnimal.findFirst = (async (args: { where: { id?: string } }) => args.where.id === "loc" ? localOriginal : { ...estado.local, id: "nova", propriedadeId: 9 }) as unknown as typeof tx.localizacaoAnimal.findFirst;
    const resultado = await regularizarBaixaHistoricaTx(tx, "animal", origem, 7, 3);
    expect(resultado.id).toBe("baixa");
    expect(resultado.estornadaEm).toBe("2024-09-01T00:00:00.000Z");
    expect(estado.auditorias).toHaveLength(1);
  });

  it("a mesma origem com dados divergentes conflita sem sobrescrever", async () => {
    const { tx, estado } = banco();
    await regularizarBaixaHistoricaTx(tx, "animal", origem, 7, 3);
    await expect(regularizarBaixaHistoricaTx(tx, "animal", { ...origem, data: "2024-08-13" }, 7, 3)).rejects.toMatchObject({ code: "CONFLITO" });
    expect(estado.baixa?.data).toEqual(new Date(origem.data));
    expect(estado.auditorias).toHaveLength(1);
  });
  it("exige usuário real, evidência e sítio autorizado", async () => {
    const { tx, estado } = banco();
    await expect(regularizarBaixaHistoricaTx(tx, "animal", origem, 0, 3)).rejects.toMatchObject({ code: "VALIDACAO" });
    await expect(regularizarBaixaHistoricaTx(tx, "animal", origem, 7, 9)).rejects.toMatchObject({ code: "NAO_ENCONTRADO" });
    await expect(regularizarBaixaHistoricaTx(tx, "animal", { ...origem, evidencia: "" }, 7, 3)).rejects.toThrow();
    expect(estado.baixa).toBeNull();
  });
  it("não contorna cronologia ou ciência sanitária quando o tipo é desconhecido", async () => {
    const { tx, estado } = banco();
    await expect(regularizarBaixaHistoricaTx(tx, "animal", { ...origem, data: "2023-01-01" }, 7, 3)).rejects.toMatchObject({ code: "VALIDACAO" });
    m.carencias.leite.estado = "NAO_INFORMADO";
    await expect(regularizarBaixaHistoricaTx(tx, "animal", origem, 7, 3)).rejects.toMatchObject({ code: "VALIDACAO", campo: "justificativaSanitaria" });
    expect(estado.baixa).toBeNull();
  });
  it("revisão reenvia após JSONB reordenar recursivamente o snapshot, sem duplicar saída ou auditoria", async () => {
    const { tx, estado } = banco();
    await regularizarBaixaHistoricaTx(tx, "animal", origem, 7, 3);
    const antes = { ...estado.baixa };
    await revisarClassificacaoBaixaTx(tx, "animal", "baixa", revisao, 7, 3);
    await revisarClassificacaoBaixaTx(tx, "animal", "baixa", revisao, 7, 3);
    expect(estado.baixa).toMatchObject({ id: antes.id, data: antes.data, tipo: "VENDA", localizacaoFechadaId: antes.localizacaoFechadaId, destinoFechadoId: antes.destinoFechadoId });
    expect(estado.auditorias).toHaveLength(2);
    expect(estado.auditorias[1]).toMatchObject({ acao: "RECLASSIFICACAO", antes: expect.objectContaining({ tipo: "NAO_DETERMINADO" }), depois: expect.objectContaining({ tipo: "VENDA" }) });
    await expect(revisarClassificacaoBaixaTx(tx, "animal", "baixa", { ...revisao, chave: "6156f55c-4535-4ea1-bcfa-bfe235b42227", tipo: "MORTE" }, 7, 3)).rejects.toMatchObject({ code: "CONFLITO" });
  });
  it.each([
    ["dados", { ...revisao, evidencia: "Outro documento de venda comprovado" }, 7],
    ["autoria", revisao, 8],
    ["null explícito", { ...revisao, justificativaSanitaria: null }, 7],
  ] as const)("reenvio de revisão recusa %s diferentes após leitura JSONB", async (_caso, input, usuarioId) => {
    const { tx, estado } = banco();
    await regularizarBaixaHistoricaTx(tx, "animal", origem, 7, 3);
    await revisarClassificacaoBaixaTx(tx, "animal", "baixa", revisao, 7, 3);
    await expect(revisarClassificacaoBaixaTx(tx, "animal", "baixa", input, usuarioId, 3)).rejects.toMatchObject({ code: "CONFLITO" });
    expect(estado.baixa?.tipo).toBe("VENDA"); expect(estado.auditorias).toHaveLength(2);
  });
  it("revisão recusa baixa estornada e motivo de classe incompatível", async () => {
    const { tx, estado } = banco();
    await regularizarBaixaHistoricaTx(tx, "animal", origem, 7, 3);
    tx.motivoBaixa.findFirst = (async () => ({ id: "ab8efb36-6259-4624-893b-9fa60563c3cc", classe: "MORTE" })) as typeof tx.motivoBaixa.findFirst;
    await expect(revisarClassificacaoBaixaTx(tx, "animal", "baixa", { ...revisao, motivoId: "ab8efb36-6259-4624-893b-9fa60563c3cc" }, 7, 3)).rejects.toMatchObject({ code: "VALIDACAO" });
    estado.baixa!.estornadaEm = new Date();
    await expect(revisarClassificacaoBaixaTx(tx, "animal", "baixa", revisao, 7, 3)).rejects.toMatchObject({ code: "CONFLITO" });
    expect(estado.baixa?.tipo).toBe("NAO_DETERMINADO");
  });
});
