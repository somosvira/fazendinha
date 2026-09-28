// Travas dos cadastros que valem para a fazenda inteira (lote, motivo de baixa, categoria):
// cada uma recusa a edição quando ela deixaria registros em uso inconsistentes. Prisma mockado;
// o SQL real (FOR UPDATE do lote) é exercitado em rebanho.integration.test.ts.

import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => {
  const tx = {
    $queryRaw: vi.fn(),
    localizacaoAnimal: { findMany: vi.fn() },
    baixaAnimal: { findMany: vi.fn() },
    lote: { update: vi.fn() },
    motivoBaixa: { findFirst: vi.fn(), update: vi.fn() },
    categoriaManualAnimal: { count: vi.fn() },
    categoriaAnimal: { update: vi.fn(), findFirst: vi.fn(), upsert: vi.fn(), findMany: vi.fn(), create: vi.fn() },
    auditoriaPecuaria: { create: vi.fn() },
  };
  const prisma = {
    lote: { findUnique: vi.fn() },
    localizacaoAnimal: { findMany: vi.fn() },
    baixaAnimal: { findMany: vi.fn() },
    motivoBaixa: { findUnique: vi.fn() },
    categoriaAnimal: { findUnique: vi.fn(), findMany: vi.fn(), findFirst: vi.fn() },
    animal: { findMany: vi.fn() },
    $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
  };
  return { tx, prisma };
});

vi.mock("../../../db.js", () => ({ prisma: m.prisma }));

import { editarLote } from "./lotes.js";
import { editarMotivoBaixa } from "./motivos.js";
import { CATEGORIAS_PADRAO, criarCategoria, editarCategoria, restaurarPadroes } from "./categorias.js";

beforeEach(() => {
  vi.clearAllMocks();
  m.tx.$queryRaw.mockResolvedValue([{ id: "lote-1" }]);
  m.tx.auditoriaPecuaria.create.mockResolvedValue({});
  m.prisma.localizacaoAnimal.findMany.mockResolvedValue([]);
  m.prisma.baixaAnimal.findMany.mockResolvedValue([]);
  m.tx.categoriaAnimal.findMany.mockResolvedValue([]);
});

describe("editarLote: desativar com animal ativo", () => {
  const lote = { id: "lote-1", nome: "Recria", propriedadeId: 1, ativo: true, observacao: null, propriedade: { id: 1, nome: "Sede" } };

  beforeEach(() => {
    m.prisma.lote.findUnique.mockResolvedValue(lote);
    m.tx.lote.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ ...lote, ...data }));
  });

  it("recusa com CONFLITO no campo ativo, contando só os animais ativos, e não grava", async () => {
    m.tx.localizacaoAnimal.findMany.mockResolvedValue([
      { loteId: "lote-1", animalId: "a1" }, { loteId: "lote-1", animalId: "a2" }, { loteId: "lote-1", animalId: "a3" },
    ]);
    m.tx.baixaAnimal.findMany.mockResolvedValue([{ animalId: "a3" }]); // baixado não conta

    await expect(editarLote("lote-1", { ativo: false }, 7)).rejects.toMatchObject({ code: "CONFLITO", campo: "ativo", message: expect.stringContaining("2 animais") });
    // trava a linha do lote antes de contar (espera quem está pondo animal nele)
    const [sql] = m.tx.$queryRaw.mock.calls[0] as [TemplateStringsArray];
    expect(sql.join("?")).toMatch(/FOR UPDATE/);
    expect(m.tx.localizacaoAnimal.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { ate: null, loteId: { in: ["lote-1"] } } }));
    expect(m.tx.lote.update).not.toHaveBeenCalled();
    expect(m.tx.auditoriaPecuaria.create).not.toHaveBeenCalled();
  });

  it("desativa quando os únicos animais do lote estão baixados", async () => {
    m.tx.localizacaoAnimal.findMany.mockResolvedValue([{ loteId: "lote-1", animalId: "a1" }]);
    m.tx.baixaAnimal.findMany.mockResolvedValue([{ animalId: "a1" }]);

    await expect(editarLote("lote-1", { ativo: false }, 7)).resolves.toMatchObject({ ativo: false });
    expect(m.tx.lote.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "lote-1" }, data: expect.objectContaining({ ativo: false }) }));
  });

  it("renomear não trava nem conta animais", async () => {
    await expect(editarLote("lote-1", { nome: "Recria 2" }, 7)).resolves.toMatchObject({ nome: "Recria 2" });
    expect(m.tx.$queryRaw).not.toHaveBeenCalled();
    expect(m.tx.localizacaoAnimal.findMany).not.toHaveBeenCalled();
  });

  it("lote de outro sítio é 'não encontrado'", async () => {
    await expect(editarLote("lote-1", { ativo: false }, 7, 2)).rejects.toMatchObject({ code: "NAO_ENCONTRADO" });
    expect(m.prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe("editarMotivoBaixa: trocar a classe com baixas em uso", () => {
  const motivo = { id: "mot-1", nome: "Baixa produção", classe: "DESCARTE_VOLUNTARIO", ativo: true };

  beforeEach(() => {
    m.prisma.motivoBaixa.findUnique.mockResolvedValue(motivo);
    m.tx.motivoBaixa.findFirst.mockResolvedValue(null);
    m.tx.motivoBaixa.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ ...motivo, ...Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined)) }));
  });

  it("recusa com CONFLITO no campo classe quando alguma baixa ativa não aceita a nova classe", async () => {
    m.tx.baixaAnimal.findMany.mockResolvedValue([{ tipo: "VENDA" }, { tipo: "ABATE" }]);

    await expect(editarMotivoBaixa("mot-1", { classe: "MORTE" }, 7)).rejects.toMatchObject({ code: "CONFLITO", campo: "classe", message: expect.stringContaining("2 baixa(s)") });
    // baixas estornadas não contam
    expect(m.tx.baixaAnimal.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { motivoId: "mot-1", estornadaEm: null } }));
    expect(m.tx.motivoBaixa.update).not.toHaveBeenCalled();
  });

  it("aceita classe compatível com todas as baixas em uso", async () => {
    m.tx.baixaAnimal.findMany.mockResolvedValue([{ tipo: "VENDA" }, { tipo: "DOACAO" }]);
    await expect(editarMotivoBaixa("mot-1", { classe: "DESCARTE_INVOLUNTARIO" }, 7)).resolves.toMatchObject({ classe: "DESCARTE_INVOLUNTARIO" });
    expect(m.tx.motivoBaixa.update).toHaveBeenCalledTimes(1);
  });

  it("sem baixa ativa, qualquer classe serve", async () => {
    m.tx.baixaAnimal.findMany.mockResolvedValue([]);
    await expect(editarMotivoBaixa("mot-1", { classe: "MORTE" }, 7)).resolves.toMatchObject({ classe: "MORTE" });
  });

  it("mesma classe não consulta as baixas", async () => {
    await editarMotivoBaixa("mot-1", { classe: "DESCARTE_VOLUNTARIO", nome: "Baixa produção de leite" }, 7);
    expect(m.tx.baixaAnimal.findMany).not.toHaveBeenCalled();
  });
});

describe("categorias: troca de sexo com categoria manual aberta", () => {
  const novilha = {
    id: "cat-nov", ideagriId: 6, chavePadrao: "F_NOVILHA", nome: "Novilha", sexo: "F", automatica: true,
    idadeMinMeses: 12, idadeMaxMeses: null, partos: "SEM", ordem: 30, ativo: true,
  };

  beforeEach(() => {
    m.prisma.categoriaAnimal.findUnique.mockResolvedValue(novilha);
    m.tx.categoriaAnimal.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ ...novilha, ...data }));
  });

  it("editarCategoria recusa trocar o sexo com manual aberta (CONFLITO em sexo) e não grava", async () => {
    m.tx.categoriaManualAnimal.count.mockResolvedValue(3);
    await expect(editarCategoria("cat-nov", { sexo: "M" }, 7)).rejects.toMatchObject({ code: "CONFLITO", campo: "sexo", message: expect.stringContaining("3 animal(is)") });
    expect(m.tx.categoriaManualAnimal.count).toHaveBeenCalledWith({ where: { categoriaId: "cat-nov", ate: null } });
    expect(m.tx.categoriaAnimal.update).not.toHaveBeenCalled();
  });

  it("editarCategoria recusa desativar com manual aberta (CONFLITO em ativo)", async () => {
    m.tx.categoriaManualAnimal.count.mockResolvedValue(1);
    await expect(editarCategoria("cat-nov", { ativo: false }, 7)).rejects.toMatchObject({ code: "CONFLITO", campo: "ativo" });
    expect(m.tx.categoriaAnimal.update).not.toHaveBeenCalled();
  });

  it("editarCategoria troca o sexo quando não há manual aberta (e partos vira QUALQUER no macho)", async () => {
    m.tx.categoriaManualAnimal.count.mockResolvedValue(0);
    await editarCategoria("cat-nov", { sexo: "M" }, 7);
    expect(m.tx.categoriaAnimal.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ sexo: "M", partos: "QUALQUER" }) }));
  });

  it("editarCategoria com manual aberta ainda aceita renomear", async () => {
    m.tx.categoriaManualAnimal.count.mockResolvedValue(3);
    await expect(editarCategoria("cat-nov", { nome: "Novilha jovem" }, 7)).resolves.toMatchObject({ nome: "Novilha jovem" });
  });

  describe("restaurarPadroes", () => {
    // o padrão "Vaca" (F) foi editado para macho; restaurar o devolveria a fêmea
    const linhas = CATEGORIAS_PADRAO.map((p) => ({
      id: `id-${p.chavePadrao}`, ideagriId: p.ideagriId, chavePadrao: p.chavePadrao, nome: p.nome,
      sexo: p.chavePadrao === "F_VACA" ? "M" : p.sexo, automatica: p.automatica, idadeMinMeses: p.idadeMinMeses,
      idadeMaxMeses: p.idadeMaxMeses, partos: p.partos, ordem: p.ordem, ativo: true,
    }));

    beforeEach(() => {
      m.prisma.categoriaAnimal.findMany.mockResolvedValue(linhas);
      m.prisma.animal.findMany.mockResolvedValue([]);
      m.tx.categoriaAnimal.findFirst.mockResolvedValue(null);
      m.tx.categoriaAnimal.upsert.mockResolvedValue({});
    });

    it("recusa com CONFLITO em sexo se o padrão mudaria de sexo e há manual aberta nele", async () => {
      m.tx.categoriaManualAnimal.count.mockResolvedValue(2);
      await expect(restaurarPadroes(false, 7)).rejects.toMatchObject({ code: "CONFLITO", campo: "sexo", message: expect.stringContaining("Vaca") });
      expect(m.tx.categoriaManualAnimal.count).toHaveBeenCalledWith({ where: { categoriaId: "id-F_VACA", ate: null } });
      expect(m.tx.categoriaAnimal.upsert).not.toHaveBeenCalled();
    });

    it("só simular não esbarra na trava (nada é gravado)", async () => {
      m.tx.categoriaManualAnimal.count.mockResolvedValue(2);
      await expect(restaurarPadroes(true, 7)).resolves.toMatchObject({ afetados: 0 });
      expect(m.prisma.$transaction).not.toHaveBeenCalled();
    });

    it("sem manual aberta, restaura os 7 padrões", async () => {
      m.tx.categoriaManualAnimal.count.mockResolvedValue(0);
      await restaurarPadroes(false, 7);
      expect(m.tx.categoriaAnimal.upsert).toHaveBeenCalledTimes(CATEGORIAS_PADRAO.length);
      expect(m.tx.categoriaAnimal.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { chavePadrao: "F_VACA" }, update: expect.objectContaining({ sexo: "F" }) }));
    });
  });
});

describe("categorias: faixas sobrepostas", () => {
  const linha = (extra: Record<string, unknown>) => ({
    ideagriId: null, chavePadrao: null, automatica: true, ativo: true, idadeMinMeses: null, idadeMaxMeses: null, partos: "QUALQUER", ...extra,
  });
  const novilha = linha({ id: "cat-nov", chavePadrao: "F_NOVILHA", nome: "Novilha", sexo: "F", idadeMinMeses: 12, partos: "SEM", ordem: 30 });
  const emCrescimento = linha({ id: "cat-ec", chavePadrao: "F_EM_CRESCIMENTO", nome: "Em crescimento", sexo: "F", idadeMaxMeses: 12, partos: "SEM", ordem: 20 });

  beforeEach(() => {
    m.tx.categoriaAnimal.findMany.mockResolvedValue([emCrescimento, novilha]);
    m.tx.categoriaManualAnimal.count.mockResolvedValue(0);
    m.prisma.categoriaAnimal.findFirst.mockResolvedValue({ ordem: 70 });
  });

  it("criarCategoria recusa uma faixa que cruza com outra ativa do mesmo sexo e não grava", async () => {
    await expect(criarCategoria({ nome: "Novilha jovem", sexo: "F", automatica: true, idadeMinMeses: 12, idadeMaxMeses: 18, partos: "SEM" } as never, 7))
      .rejects.toMatchObject({ code: "VALIDACAO", campo: "idadeMinMeses", message: expect.stringContaining('se sobrepõe à de "Novilha"') });
    expect(m.tx.categoriaAnimal.create).not.toHaveBeenCalled();
  });

  it("criarCategoria aceita faixa sem interseção (ex.: com parto)", async () => {
    m.tx.categoriaAnimal.create.mockResolvedValue({ id: "nova", nome: "Primípara" });
    await criarCategoria({ nome: "Primípara", sexo: "F", automatica: true, idadeMinMeses: null, idadeMaxMeses: 36, partos: "COM" } as never, 7);
    expect(m.tx.categoriaAnimal.create).toHaveBeenCalled();
  });

  it("editarCategoria recusa estender a faixa para dentro da outra", async () => {
    m.prisma.categoriaAnimal.findUnique.mockResolvedValue(emCrescimento);
    await expect(editarCategoria("cat-ec", { idadeMaxMeses: 18 }, 7)).rejects.toMatchObject({ code: "VALIDACAO", message: expect.stringContaining('"Em crescimento"') });
    expect(m.tx.categoriaAnimal.update).not.toHaveBeenCalled();
  });

  it("editarCategoria só renomeando não checa faixa (sobreposição antiga não trava outras edições)", async () => {
    m.prisma.categoriaAnimal.findUnique.mockResolvedValue(novilha);
    m.tx.categoriaAnimal.update.mockResolvedValue({ ...novilha, nome: "Novilhas" });
    m.tx.categoriaAnimal.findMany.mockResolvedValue([novilha, linha({ id: "velha", nome: "Sobreposta antiga", sexo: "F", idadeMinMeses: 12, ordem: 40 })]);
    await editarCategoria("cat-nov", { nome: "Novilhas" }, 7);
    expect(m.tx.categoriaAnimal.update).toHaveBeenCalled();
  });
});
