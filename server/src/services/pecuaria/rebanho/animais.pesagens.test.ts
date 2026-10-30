import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => {
  const db = {
    $executeRaw: vi.fn(),
    $transaction: vi.fn(),
    animal: { findUnique: vi.fn(), findFirst: vi.fn(), count: vi.fn(), update: vi.fn() },
    localizacaoAnimal: { findMany: vi.fn(), update: vi.fn() },
    finalidadeAnimal: { findMany: vi.fn(), update: vi.fn() },
    pesagem: { findMany: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn(), update: vi.fn(), delete: vi.fn() },
    vinculoPesagemParto: { findMany: vi.fn(), count: vi.fn() },
    vinculoPesagemSecagem: { findFirst: vi.fn(), count: vi.fn() },
    baixaAnimal: { findMany: vi.fn(), findFirst: vi.fn() },
    categoriaManualAnimal: { findMany: vi.fn(), findFirst: vi.fn() },
    categoriaAnimal: { findMany: vi.fn() },
    composicaoRacial: { findMany: vi.fn() },
    periodoReprodutivoAnimal: { findMany: vi.fn() },
    vinculoImportacaoPecuaria: { findMany: vi.fn() },
    auditoriaPecuaria: { create: vi.fn() },
  };
  return { db, conferirHistorico: vi.fn() };
});

vi.mock("../../../db.js", () => ({ prisma: m.db }));
vi.mock("../transacao.js", () => ({ transacaoPecuaria: async (executar: (tx: typeof m.db) => Promise<unknown>) => executar(m.db) }));
vi.mock("../fatos.js", () => ({ conferirHistoricoDosFatos: m.conferirHistorico }));

import { buscarFicha, editar, editarPesagem, excluirPesagem } from "./animais.js";
import { RebanhoError } from "./regras.js";

const animal = {
  id: "animal", brinco: "123", nome: null, sexo: "M", origem: "COMPRADO",
  dataNascimento: new Date("2024-01-10"), dataEntrada: new Date("2025-01-10"),
  maeId: null, paiId: null, maeExternaId: null, paiExternoId: null, partosAntesDaEntrada: 0, partos: [],
};
const peso = {
  id: "peso-fonte", animalId: animal.id, data: animal.dataEntrada, pesoKg: 300,
  tipo: "ENTRADA", origem: "MANUAL", precisao: "MEDIDO", contextoHistorico: "INTERNO",
  ideagriId: null, referenciaHistorica: null, provenienciaHistoricaSnapshot: null,
  vinculosParto: [], vinculosSecagem: [],
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-29T12:00:00Z"));
  m.db.animal.findUnique.mockResolvedValue(animal);
  m.db.animal.findFirst.mockResolvedValue(null);
  m.db.animal.count.mockResolvedValue(0);
  m.db.animal.update.mockResolvedValue(animal);
  m.db.localizacaoAnimal.findMany.mockResolvedValue([]);
  m.db.finalidadeAnimal.findMany.mockResolvedValue([]);
  m.db.pesagem.findMany.mockResolvedValue([]);
  m.db.pesagem.findUnique.mockResolvedValue(peso);
  m.db.pesagem.update.mockResolvedValue(peso);
  m.db.vinculoPesagemParto.findMany.mockResolvedValue([]);
  m.db.vinculoPesagemParto.count.mockResolvedValue(0);
  m.db.vinculoPesagemSecagem.findFirst.mockResolvedValue(null);
  m.db.vinculoPesagemSecagem.count.mockResolvedValue(0);
  m.db.baixaAnimal.findMany.mockResolvedValue([]);
  m.db.baixaAnimal.findFirst.mockResolvedValue(null);
  m.db.categoriaManualAnimal.findMany.mockResolvedValue([]);
  m.db.categoriaManualAnimal.findFirst.mockResolvedValue(null);
  m.db.categoriaAnimal.findMany.mockResolvedValue([]);
  m.db.composicaoRacial.findMany.mockResolvedValue([]);
  m.db.periodoReprodutivoAnimal.findMany.mockResolvedValue([]);
  m.db.vinculoImportacaoPecuaria.findMany.mockResolvedValue([]);
  m.db.$transaction.mockImplementation(async (executar: (tx: typeof m.db) => Promise<unknown>) => executar(m.db));
});

describe("edição e exclusão operacional de pesagem histórica", () => {
  it.each(["referenciaHistorica", "ideagriId", "vinculoImportacao"])("exige reconciliação para histórico por %s em ambos os comandos", async (proveniencia) => {
    m.db.pesagem.findUnique.mockResolvedValue({ ...peso,
      referenciaHistorica: proveniencia === "referenciaHistorica" ? "IDEAGRI:PESO:1" : null,
      ideagriId: proveniencia === "ideagriId" ? 123 : null,
    });
    if (proveniencia === "vinculoImportacao") m.db.vinculoImportacaoPecuaria.findMany.mockResolvedValue([{ destinoId: peso.id }]);

    await expect(editarPesagem(peso.id, { pesoKg: 400 }, 7)).rejects.toMatchObject({ code: "CONFLITO", message: expect.stringContaining("reconciliação") });
    await expect(excluirPesagem(peso.id, 7)).rejects.toMatchObject({ code: "CONFLITO", message: expect.stringContaining("reconciliação") });
    expect(m.db.pesagem.update).not.toHaveBeenCalled();
    expect(m.db.pesagem.delete).not.toHaveBeenCalled();
    expect(m.db.auditoriaPecuaria.create).not.toHaveBeenCalled();
  });

  it("permite editar e excluir peso comum sem proveniência histórica", async () => {
    await expect(editarPesagem(peso.id, { pesoKg: 400 }, 7)).resolves.toMatchObject({ id: peso.id });
    await expect(excluirPesagem(peso.id, 7)).resolves.toBeUndefined();
    expect(m.db.pesagem.update).toHaveBeenCalled();
    expect(m.db.pesagem.delete).toHaveBeenCalled();
  });
});
afterEach(() => vi.useRealTimers());

describe("edição cadastral conserva fatos de pesagem", () => {
  it("confere o contexto histórico após aplicar cadastro/localização sob a trava e aborta o fluxo incompatível", async () => {
    m.db.localizacaoAnimal.findMany.mockResolvedValue([{ id: "local", desde: animal.dataEntrada, ate: null }]);
    m.db.pesagem.findMany.mockResolvedValue([{
      ...peso, data: new Date("2025-01-05"), tipo: "ROTINA", contextoHistorico: "EXTERNO",
      referenciaHistorica: "IDEAGRI:PESO:1", propriedadeId: null,
    }]);
    m.conferirHistorico.mockRejectedValue(new RebanhoError("CONFLITO", "A alteração invalida a pesagem peso-fonte: fato externo contradiz localização interna", "contexto"));

    await expect(editar(animal.id, { dataEntrada: "2025-01-01" }, 7)).rejects.toMatchObject({ code: "CONFLITO", campo: "contexto" });
    expect(m.db.localizacaoAnimal.update).toHaveBeenCalledWith({ where: { id: "local" }, data: { desde: new Date("2025-01-01") } });
    expect(m.conferirHistorico).toHaveBeenCalledWith(m.db, [animal.id]);
    expect(m.db.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(m.db.animal.update.mock.invocationCallOrder[0]);
    expect(m.db.animal.update.mock.invocationCallOrder[0]).toBeLessThan(m.conferirHistorico.mock.invocationCallOrder[0]);
    expect(m.db.localizacaoAnimal.update.mock.invocationCallOrder[0]).toBeLessThan(m.conferirHistorico.mock.invocationCallOrder[0]);
    expect(m.db.pesagem.updateMany).not.toHaveBeenCalled();
    expect(m.db.auditoriaPecuaria.create).not.toHaveBeenCalled();
  });

  it.each(["NASCIMENTO", "ENTRADA"])("não desloca %s histórico nem seu snapshot ao antecipar o cadastro", async (tipo) => {
    const original = { ...peso, tipo, data: tipo === "NASCIMENTO" ? animal.dataNascimento : animal.dataEntrada,
      referenciaHistorica: "[\"IDEAGRI\",\"PESO:1\"]", provenienciaHistoricaSnapshot: { pesoKg: 300, evidencia: "PESO:1" } };
    const antes = structuredClone(original);
    m.db.pesagem.findMany.mockResolvedValue([original]);

    await editar(animal.id, { dataNascimento: "2024-01-01", dataEntrada: "2025-01-01" }, 7);

    expect(m.db.animal.update).toHaveBeenCalled();
    expect(m.db.pesagem.findMany).toHaveBeenCalledWith(expect.objectContaining({ select: expect.objectContaining({ referenciaHistorica: true, ideagriId: true }) }));
    expect(m.db.pesagem.updateMany).not.toHaveBeenCalled();
    expect(original).toEqual(antes);
    expect(m.db.auditoriaPecuaria.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ depois: expect.objectContaining({ historicoAjustado: expect.objectContaining({ pesagens: [] }) }) }) }));
  });

  it("protege carga anterior identificada apenas pelo vínculo de importação", async () => {
    m.db.pesagem.findMany.mockResolvedValue([peso]);
    m.db.vinculoImportacaoPecuaria.findMany.mockResolvedValue([{ destinoId: peso.id }]);

    await editar(animal.id, { dataEntrada: "2025-01-01" }, 7);

    expect(m.db.vinculoImportacaoPecuaria.findMany).toHaveBeenCalledWith({
      where: { entidadeDestino: "Pesagem", destinoId: { in: [peso.id] } }, select: { destinoId: true },
    });
    expect(m.db.pesagem.updateMany).not.toHaveBeenCalled();
    expect(m.db.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(m.db.vinculoImportacaoPecuaria.findMany.mock.invocationCallOrder[0]);
  });

  it.each(["referenciaHistorica", "vinculoImportacao"])("recusa conflito com peso histórico por %s antes de qualquer escrita", async (proveniencia) => {
    m.db.pesagem.findMany.mockResolvedValue([{ ...peso, referenciaHistorica: proveniencia === "referenciaHistorica" ? "IDEAGRI:PESO:1" : null }]);
    if (proveniencia === "vinculoImportacao") m.db.vinculoImportacaoPecuaria.findMany.mockResolvedValue([{ destinoId: peso.id }]);

    await expect(editar(animal.id, { dataEntrada: "2025-02-01" }, 7)).rejects.toMatchObject({
      code: "VALIDACAO", campo: "dataEntrada", message: expect.stringContaining(peso.id),
    });
    expect(m.db.animal.update).not.toHaveBeenCalled();
    expect(m.db.localizacaoAnimal.update).not.toHaveBeenCalled();
    expect(m.db.finalidadeAnimal.update).not.toHaveBeenCalled();
    expect(m.db.pesagem.updateMany).not.toHaveBeenCalled();
    expect(m.db.auditoriaPecuaria.create).not.toHaveBeenCalled();
  });

  it.each(["vinculosParto", "vinculosSecagem"])("não desloca peso de entrada reutilizado em %s", async (vinculo) => {
    m.db.pesagem.findMany.mockResolvedValue([{ ...peso, [vinculo]: [{ id: "vinculo" }] }]);
    await editar(animal.id, { dataEntrada: "2025-01-01" }, 7);
    expect(m.db.pesagem.findMany).toHaveBeenCalledWith(expect.objectContaining({ select: expect.objectContaining({ [vinculo]: { select: { id: true }, take: 1 } }) }));
    expect(m.db.pesagem.updateMany).not.toHaveBeenCalled();
  });

  it("mantém o ajuste de pesagem cadastral comum sem proveniência ou vínculos", async () => {
    m.db.pesagem.findMany.mockResolvedValue([peso]);
    await editar(animal.id, { dataEntrada: "2025-01-01" }, 7);
    expect(m.db.pesagem.updateMany).toHaveBeenCalledWith({ where: { id: { in: [peso.id] } }, data: { data: new Date("2025-01-01") } });
  });
});

describe("ficha calcula os indicadores a partir da mesma série", () => {
  it.each(["ESTIMADO", "INFORMADO", "EXTERNO"])("ignora peso %s intermediário em todos os GMDs e conserva o histórico", async (excluido) => {
    m.db.pesagem.findMany.mockResolvedValue([
      { ...peso, id: "ultimo", data: new Date("2026-10-20"), pesoKg: 340 },
      { ...peso, id: "intermediario", data: new Date("2026-10-10"), pesoKg: 335,
        precisao: excluido === "EXTERNO" ? "MEDIDO" : excluido, contextoHistorico: excluido === "EXTERNO" ? "EXTERNO" : "INTERNO" },
      { ...peso, id: "anterior", data: new Date("2026-09-30"), pesoKg: 300 },
    ]);
    const ficha = await buscarFicha(animal.id, null);
    expect(ficha).toMatchObject({
      ultimoPeso: { kg: 340, data: "2026-10-20" }, gmdRecente: 2,
      peso: { ultimo: { kg: 340, data: "2026-10-20" }, gmdRecente: 2, gmdDesdeEntrada: 2, gmdPeriodo: { valor: 2, pesagens: 2 } },
    });
    expect(ficha.historicoPesagens.map(p => p.id)).toEqual(["ultimo", "intermediario", "anterior"]);
  });

  it("descarta estimativa mais recente e usa as duas medidas anteriores", async () => {
    m.db.pesagem.findMany.mockResolvedValue([
      { ...peso, id: "estimado", data: new Date("2026-10-25"), pesoKg: 350, precisao: "ESTIMADO" },
      { ...peso, id: "ultimo", data: new Date("2026-10-20"), pesoKg: 340 },
      { ...peso, id: "anterior", data: new Date("2026-09-30"), pesoKg: 300 },
    ]);
    expect(await buscarFicha(animal.id, null)).toMatchObject({
      ultimoPeso: { kg: 340, data: "2026-10-20" }, gmdRecente: 2, peso: { gmdRecente: 2 },
    });
  });

  it.each([false, true])("aplica o mesmo corte temporal nos indicadores da ficha (baixado=%s)", async (baixado) => {
    m.db.pesagem.findMany.mockResolvedValue([
      { ...peso, id: "fora-corte", data: new Date(baixado ? "2026-10-25" : "2026-10-30"), pesoKg: 500 },
      { ...peso, id: "ultimo", data: new Date("2026-10-20"), pesoKg: 340 },
      { ...peso, id: "anterior", data: new Date("2026-09-30"), pesoKg: 300 },
    ]);
    if (baixado) m.db.baixaAnimal.findMany.mockResolvedValue([{
      id: "baixa", data: new Date("2026-10-20"), tipo: "MORTE", estornadaEm: null,
      localizacaoFechada: null, destinoFechado: null, motivo: null, criadoPor: null,
    }]);
    const ficha = await buscarFicha(animal.id, null);
    expect(ficha).toMatchObject({ ultimoPeso: { kg: 340 }, gmdRecente: 2, peso: { ultimo: { kg: 340 }, gmdRecente: 2 } });
    expect(ficha.historicoPesagens).toHaveLength(3);
  });
});
