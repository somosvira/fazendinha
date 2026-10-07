import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  ocorrencias: vi.fn(), exames: vi.fn(), aplicacoes: vi.fn(), contarAplicacoes: vi.fn(), tarefas: vi.fn(), animais: vi.fn(), animal: vi.fn(), localizacao: vi.fn(),
}));
vi.mock("../../../db.js", () => ({ prisma: {
  ocorrenciaSanitaria: { findMany: mocks.ocorrencias },
  exameAnimal: { findMany: mocks.exames },
  aplicacaoProduto: { findMany: mocks.aplicacoes, count: mocks.contarAplicacoes },
  tarefaSanitaria: { findMany: mocks.tarefas },
  animal: { findMany: mocks.animais, findUnique: mocks.animal },
  localizacaoAnimal: { findFirst: mocks.localizacao },
} }));

import { consultaSanitariaSchema } from "./consulta.js";
import { listarOcorrencias } from "./ocorrencias.js";
import { listarExames } from "./exames.js";
import { carenciaAnimal, listarCarencias, listarAplicacoes, listarAplicacoesPaginadas } from "./aplicacoes.js";
import { listarTarefas } from "./protocolos.js";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.ocorrencias.mockResolvedValue([]);
  mocks.exames.mockResolvedValue([]);
  mocks.aplicacoes.mockResolvedValue([]);
  mocks.contarAplicacoes.mockResolvedValue(0);
  mocks.tarefas.mockResolvedValue([]);
  mocks.animais.mockResolvedValue([]);
  mocks.animal.mockResolvedValue({ sexo: "F", destinos: [{ aptidao: "LEITE" }] });
  mocks.localizacao.mockResolvedValue({ propriedadeId: 2 });
});

describe("filtros operacionais antes da paginação", () => {
  it("busca carências por brinco/nome, lote e sítio na seleção dos animais", async () => {
    const filtro = consultaSanitariaSchema.parse({ buscaAnimal: "GV3", loteId: "00000000-0000-4000-8000-000000000001", pagina: "3" });
    await listarCarencias(2, filtro);
    expect(mocks.animais).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ OR: expect.arrayContaining([{ brinco: { contains: "GV3", mode: "insensitive" } }]), localizacoes: { some: { propriedadeId: 2, ate: null } }, aplicacaoProdutos: { some: expect.objectContaining({ animal: expect.objectContaining({ localizacoes: expect.any(Object) }) }) } }) }));
    expect(mocks.animais.mock.calls[0][0]).not.toHaveProperty("skip");
  });
  it("consulta a carência e aptidão histórica na data da baixa", async () => {
    await carenciaAnimal("animal", 2, "2026-10-06");
    expect(mocks.aplicacoes).toHaveBeenCalledWith(expect.objectContaining({ where: { animalId: "animal", status: "VALIDO", data: { lte: new Date("2026-10-06T00:00:00Z") } } }));
    expect(mocks.animal).toHaveBeenCalledWith(expect.objectContaining({ select: expect.objectContaining({ destinos: expect.objectContaining({ where: expect.objectContaining({ desde: { lte: new Date("2026-10-06T00:00:00Z") } }) }) }) }));
  });
  it("combina busca insensível, lote e sítio antes da paginação em fatos e agenda", async () => {
    const filtro = consultaSanitariaSchema.parse({ buscaAnimal: " Mimosa ", loteId: "00000000-0000-4000-8000-000000000001", pagina: "2" });
    const busca = { OR: [{ brinco: { contains: "Mimosa", mode: "insensitive" } }, { nome: { contains: "Mimosa", mode: "insensitive" } }] };
    await listarAplicacoes(undefined, 2, filtro);
    await listarOcorrencias(undefined, 2, filtro);
    await listarExames(undefined, 2, filtro);
    for (const mock of [mocks.aplicacoes, mocks.ocorrencias, mocks.exames]) {
      expect(mock).toHaveBeenCalledWith(expect.objectContaining({ skip: 50, take: 50, where: expect.objectContaining({ propriedadeId: 2, animal: expect.objectContaining({ ...busca, localizacoes: expect.any(Object) }) }) }));
    }
    await listarTarefas(2, undefined, filtro);
    expect(mocks.tarefas).toHaveBeenCalledWith(expect.objectContaining({ skip: 50, where: expect.objectContaining({ execucao: expect.objectContaining({ animal: expect.objectContaining({ ...busca, localizacoes: { some: { ate: null, propriedadeId: 2, loteId: filtro.loteId } } }) }) }) }));
  });
  it("conta todos os fatos filtrados e devolve identificação do animal na página", async () => {
    const animal = { id: "animal", brinco: "GV3-01", nome: "Mimosa" };
    mocks.aplicacoes.mockResolvedValue([{ id: "fato", animal, movimentoEstoque: null }]);
    mocks.contarAplicacoes.mockResolvedValue(51);
    const filtro = consultaSanitariaSchema.parse({ pagina: "2", situacao: "ORIGEM_PENDENTE" });
    expect(await listarAplicacoesPaginadas(undefined, 2, filtro)).toMatchObject({ total: 51, pagina: 2, porPagina: 50, itens: [{ id: "fato", animal }] });
    expect(mocks.contarAplicacoes.mock.calls[0][0].where).toEqual(mocks.aplicacoes.mock.calls[0][0].where);
    expect(mocks.aplicacoes).toHaveBeenCalledWith(expect.objectContaining({ skip: 50, take: 50, include: expect.objectContaining({ animal: { select: { id: true, brinco: true, nome: true } } }) }));
  });
  it("separa ocorrência aberta de encerrada no banco", async () => {
    await listarOcorrencias(undefined, 2, consultaSanitariaSchema.parse({ situacao: "ABERTA", pagina: "3" }));
    expect(mocks.ocorrencias).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ fim: null, status: "VALIDO", propriedadeId: 2 }), skip: 100, take: 50 }));
    await listarOcorrencias(undefined, 2, consultaSanitariaSchema.parse({ situacao: "ENCERRADA" }));
    expect(mocks.ocorrencias).toHaveBeenLastCalledWith(expect.objectContaining({ where: expect.objectContaining({ fim: { not: null } }) }));
  });

  it("distingue coleta sem resultado de resultado informado", async () => {
    await listarExames(undefined, 2, consultaSanitariaSchema.parse({ situacao: "AGUARDANDO_RESULTADO" }));
    expect(mocks.exames).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ resultadoTexto: null, resultadoNumero: null, resultadoOpcao: null }) }));
    await listarExames(undefined, 2, consultaSanitariaSchema.parse({ situacao: "RESULTADO_INFORMADO" }));
    expect(mocks.exames).toHaveBeenLastCalledWith(expect.objectContaining({ where: expect.objectContaining({ OR: expect.arrayContaining([{ resultadoNumero: { not: null } }]) }) }));
  });

  it("limita a origem pendente e tarefas atrasadas antes de buscar a página", async () => {
    await listarAplicacoes(undefined, 2, consultaSanitariaSchema.parse({ situacao: "ORIGEM_PENDENTE" }));
    expect(mocks.aplicacoes).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ origemInsumo: "SEM_ORIGEM_JUSTIFICADA", status: "VALIDO" }) }));
    await listarTarefas(2, undefined, consultaSanitariaSchema.parse({ situacao: "ATRASADA" }));
    expect(mocks.tarefas).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ AND: expect.arrayContaining([{ previstaPara: { lt: expect.any(Date) } }]) }) }));
  });

  it("combina OR dentro de animais, lotes e situações, mantendo AND entre os campos", async () => {
    const ids = ["00000000-0000-4000-8000-000000000001", "00000000-0000-4000-8000-000000000002"];
    const filtro = consultaSanitariaSchema.parse({ animalIds: ids.join(","), loteIds: ids.join(","), situacoes: "ABERTA,ENCERRADA", pagina: "2" });
    await listarOcorrencias(undefined, 2, filtro);
    expect(mocks.ocorrencias).toHaveBeenCalledWith(expect.objectContaining({ skip: 50, take: 50, where: expect.objectContaining({
      animalId: { in: ids }, animal: { localizacoes: { some: { loteId: { in: ids } } } }, propriedadeId: 2,
      OR: [{ status: "VALIDO", fim: null }, { status: "VALIDO", fim: { not: null } }],
    }) }));
    await listarTarefas(2, undefined, { ...filtro, situacoes: ["PENDENTE", "REALIZADA"] });
    expect(mocks.tarefas).toHaveBeenCalledWith(expect.objectContaining({ skip: 50, where: expect.objectContaining({ OR: expect.any(Array), execucao: expect.objectContaining({ animalId: { in: ids }, animal: expect.objectContaining({ localizacoes: { some: { ate: null, propriedadeId: 2, loteId: { in: ids } } } }) }) }) }));
  });

  it("filtra situação de carência e ordena brinco naturalmente antes de paginar sem consultas por animal", async () => {
    const animais = ["RN10", "RN2", "RN1"].map((brinco) => ({ id: brinco, brinco, nome: null, sexo: "F", destinos: [{ aptidao: "LEITE" }] }));
    mocks.animais.mockResolvedValue(animais);
    mocks.aplicacoes.mockResolvedValue(animais.map((a) => ({ animalId: a.id, data: new Date("2026-09-01"), aplicadaEm: null, precisaoTemporal: "DIA", carenciaLeiteHoras: a.id === "RN1" ? 0 : null, carenciaCarneHoras: 0, estadoCarenciaLeite: a.id === "RN1" ? "INFORMADO" : "NAO_INFORMADO", estadoCarenciaCarne: "INFORMADO", aptidaoCarenciaSnapshot: "LEITE" })));
    const resultado = await listarCarencias(2, consultaSanitariaSchema.parse({ situacoes: "CARÊNCIA_DESCONHECIDA", porPagina: "1" }));
    expect(resultado.map((r) => r.animal.brinco)).toEqual(["RN2"]);
    expect(mocks.aplicacoes).toHaveBeenCalledTimes(1);
    expect(mocks.animal).not.toHaveBeenCalled();
  });

  it("preserva aliases singulares e rejeita valores inválidos nas listas", () => {
    expect(consultaSanitariaSchema.parse({ animalId: "00000000-0000-4000-8000-000000000001", situacao: "ABERTA" }).situacao).toBe("ABERTA");
    expect(consultaSanitariaSchema.safeParse({ animalIds: "animal-invalido" }).success).toBe(false);
    expect(consultaSanitariaSchema.safeParse({ situacoes: "ABERTA,INEXISTENTE" }).success).toBe(false);
  });
});
