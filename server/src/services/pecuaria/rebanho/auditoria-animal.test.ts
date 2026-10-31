import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const tx = {
    fechamentoConsumo: { findMany: vi.fn() },
    auditoriaPecuaria: { count: vi.fn(), findMany: vi.fn() },
  };
  const prisma = {
    animal: { findUnique: vi.fn() }, localizacaoAnimal: { findFirst: vi.fn() },
    $transaction: vi.fn(async (fn: (db: typeof tx) => unknown) => fn(tx)),
  };
  return { tx, prisma };
});
vi.mock("../../../db.js", () => ({ prisma: mocks.prisma }));
import { auditoriaAnimalQuerySchema } from "./schemas.js";
import { consultarAuditoriaAnimal } from "./auditoria-animal.js";
import { buscarAuditoriaAnimal } from "./animais.js";

const em = new Date("2026-10-18T14:30:00Z");
const entrada = {
  id: "audit-1", animalId: "animal-1", propriedadeId: 1, entidade: "ExameAnimal", entidadeId: "exame-1", acao: "RESULTADO_CORRIGIDO", em,
  usuarioId: 7, usuario: { nome: "Ana" },
  antes: { resultadoNumero: "3", valorServicoAtribuido: "150.00", observacao: null },
  depois: { resultadoNumero: 0, valorServicoAtribuido: "170.00", observacao: "Laudo conferido", segredo: "SEGREDO" },
};
const opcoes = [
  { acao: "RESULTADO_CORRIGIDO", usuarioId: 7, usuario: { nome: "Ana" } },
  { acao: "ESTORNO", usuarioId: 8, usuario: { nome: "Joana" } },
  { acao: "REGISTRO", usuarioId: null, usuario: null },
];
beforeEach(() => {
  vi.clearAllMocks();
  mocks.prisma.animal.findUnique.mockResolvedValue({ id: "animal-1" });
  mocks.prisma.localizacaoAnimal.findFirst.mockResolvedValue({ propriedadeId: 1 });
  mocks.tx.fechamentoConsumo.findMany.mockResolvedValue([{ id: "consumo-do-animal" }]);
  mocks.tx.auditoriaPecuaria.count.mockResolvedValue(45);
  mocks.tx.auditoriaPecuaria.findMany.mockImplementation(async (q) => q.include ? [entrada] : opcoes);
});

describe("auditoria individual: filtros, cobertura e projeção", () => {
  it("valida o par entidade/id e recusa identificador inválido", () => {
    expect(auditoriaAnimalQuerySchema.safeParse({ entidade: "Pesagem" }).success).toBe(false);
    expect(auditoriaAnimalQuerySchema.safeParse({ entidadeId: "00000000-0000-4000-8000-000000000001" }).success).toBe(false);
    expect(auditoriaAnimalQuerySchema.safeParse({ entidade: "Pesagem", entidadeId: "outro" }).success).toBe(false);
    expect(auditoriaAnimalQuerySchema.safeParse({ entidade: "Pesagem", entidadeId: "00000000-0000-4000-8000-000000000001" }).success).toBe(true);
  });
  it.each(["DestinoAnimal", "FinalidadeAnimal"])("filtra %s pela identidade e conserva o vínculo autorizado com animal", async entidade => {
    await consultarAuditoriaAnimal("animal-1", { page: 3, pageSize: 20, entidade, entidadeId: "finalidade-1" }, false);
    const pagina = mocks.tx.auditoriaPecuaria.findMany.mock.calls.find(([q]) => q.include)![0];
    expect(pagina.where.AND[0].OR).toContainEqual({ animalId: "animal-1" });
    expect(pagina.where.AND[1]).toEqual({ entidade: { in: ["FinalidadeAnimal", "DestinoAnimal"] }, entidadeId: "finalidade-1" });
    expect(mocks.tx.auditoriaPecuaria.count).toHaveBeenCalledWith({ where: pagina.where });
    expect(pagina).toMatchObject({ skip: 40, take: 20 });
  });
  it("projeção original independe da página e não retorna valores ou campos arbitrários", async () => {
    mocks.tx.auditoriaPecuaria.findMany.mockImplementation(async q => q.include ? [entrada] : q.select?.antes ? [{
      entidade: "FinalidadeAnimal", entidadeId: "finalidade-1", antes: { aptidao: "CORTE", segredo: "SEGREDO", custo: "99999" }, depois: { aptidao: "LEITE", usuarioId: 88 },
    }] : opcoes);
    const r = await consultarAuditoriaAnimal("animal-1", { page: 5, pageSize: 20, eixo: "SANIDADE" }, false);
    expect(r.transicoes).toEqual([{ entidade: "FinalidadeAnimal", entidadeId: "finalidade-1", antes: { aptidao: "CORTE" }, depois: { aptidao: "LEITE" } }]);
    const projecao = mocks.tx.auditoriaPecuaria.findMany.mock.calls.find(([q]) => q.select?.antes)![0];
    expect(projecao.skip).toBeUndefined(); expect(projecao.take).toBeUndefined();
    expect(projecao.where.AND[0].OR).toContainEqual({ animalId: "animal-1" });
    expect(JSON.stringify(r.transicoes)).not.toMatch(/SEGREDO|99999|usuarioId/);
  });

  it.each(["DestinoAnimal", "FinalidadeAnimal"])("conserva leitura e filtros da finalidade registrada como %s", async entidade => {
    mocks.tx.auditoriaPecuaria.findMany.mockImplementation(async q => q.include ? [{
      ...entrada, entidade, acao: "MUDANCA_DESTINO", antes: { aptidao: "LEITE" }, depois: { aptidao: "REPRODUCAO" },
    }] : opcoes);
    const r = await consultarAuditoriaAnimal("animal-1", { page: 1, pageSize: 20, eixo: "REBANHO", busca: "Finalidade" }, false);
    expect(r.itens[0]).toMatchObject({ entidade, eixo: "REBANHO", registro: "Finalidade", resumo: "Mudança de finalidade", alteracoes: [
      { campo: "aptidao", rotulo: "Finalidade", antes: "Leite", depois: "Reprodução" },
    ] });
    const pagina = mocks.tx.auditoriaPecuaria.findMany.mock.calls.find(([q]) => q.include)![0];
    expect(pagina.where.AND[1]).toEqual({ entidade: { in: expect.arrayContaining(["DestinoAnimal", "FinalidadeAnimal"]) } });
    expect(pagina.where.AND[2].OR).toContainEqual({ entidade: { in: expect.arrayContaining(["DestinoAnimal", "FinalidadeAnimal"]) } });
  });

  it("filtra a consulta inteira antes de count/skip/take e usa desempate estável", async () => {
    const inicio = "2026-09-19T00:00:00-03:00"; const fim = "2026-10-18T23:59:59-03:00";
    const r = await buscarAuditoriaAnimal("animal-1", 1, 3, 20, { inicio, fim, eixo: "SANIDADE", acao: "RESULTADO_CORRIGIDO", responsavel: 7, busca: "Exame" });
    const pagina = mocks.tx.auditoriaPecuaria.findMany.mock.calls.find(([q]) => q.include)![0];
    expect(pagina).toMatchObject({ skip: 40, take: 20, orderBy: [{ em: "desc" }, { id: "desc" }] });
    expect(pagina.where.AND).toEqual(expect.arrayContaining([
      { em: { gte: new Date(inicio), lte: new Date(fim) } },
      { entidade: { in: expect.arrayContaining(["ExameAnimal", "AplicacaoProduto"]) } },
      { acao: "RESULTADO_CORRIGIDO" }, { usuarioId: 7 },
      { OR: expect.arrayContaining([{ entidadeId: { contains: "Exame", mode: "insensitive" } }, { entidade: { in: ["ExameAnimal"] } }]) },
    ]));
    expect(mocks.tx.auditoriaPecuaria.count).toHaveBeenCalledWith({ where: pagina.where });
    expect(r.total).toBe(45);
    expect(mocks.prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "RepeatableRead" });
  });

  it("opções de ação e responsável incluem entradas além da página carregada", async () => {
    const r = await consultarAuditoriaAnimal("animal-1", { page: 1, pageSize: 1 }, false);
    expect(r.itens).toHaveLength(1);
    expect(r.filtros.acoes).toContainEqual({ valor: "ESTORNO", rotulo: "Estorno" });
    expect(r.filtros.responsaveis).toContainEqual({ id: 8, nome: "Joana" });
    expect(r.filtros.semResponsavel).toBe(true);
    const facetas = mocks.tx.auditoriaPecuaria.findMany.mock.calls.find(([q]) => q.select)![0];
    expect(facetas.take).toBeUndefined(); expect(facetas.skip).toBeUndefined();
    expect(facetas.select).toEqual({ acao: true, usuarioId: true, usuario: { select: { nome: true } } });
  });

  it("inclui somente auditorias nutricionais com participação persistida do animal", async () => {
    await consultarAuditoriaAnimal("animal-1", { page: 1, pageSize: 20, eixo: "NUTRICAO" }, false);
    expect(mocks.tx.fechamentoConsumo.findMany).toHaveBeenCalledWith({ where: { participacoes: { some: { animalId: "animal-1" } } }, select: { id: true } });
    const pagina = mocks.tx.auditoriaPecuaria.findMany.mock.calls.find(([q]) => q.include)![0];
    expect(pagina.where.AND[0]).toEqual({ OR: [
      { animalId: "animal-1" }, { entidade: "FechamentoConsumo", entidadeId: { in: ["consumo-do-animal"] } },
    ] });
    expect(pagina.where.AND[1]).toEqual({ entidade: { in: ["FechamentoConsumo"] } });
  });

  it("mascara valores por padrão, preserva resultado clínico zero e nunca devolve snapshots crus", async () => {
    const r = await buscarAuditoriaAnimal("animal-1", 1);
    expect(r.itens[0]).toMatchObject({ eixo: "SANIDADE", registro: "Exame", usuarioNome: "Ana", alteracoes: [
      { campo: "observacao", rotulo: "Observação", antes: null, depois: "Laudo conferido" },
      { campo: "resultadoNumero", rotulo: "Resultado numérico", antes: "3", depois: "0" },
    ] });
    expect(JSON.stringify(r)).not.toMatch(/150|170|SEGREDO|valorServicoAtribuido/);
    expect(r.itens[0]).not.toHaveProperty("antes"); expect(r.itens[0]).not.toHaveProperty("depois");
    expect(mocks.tx.auditoriaPecuaria.count.mock.calls[0][0].where).not.toHaveProperty("antes");
  });

  it("valores autorizados entram como campos conhecidos, mantendo relações e JSON arbitrário fora", async () => {
    const r = await buscarAuditoriaAnimal("animal-1", 1, 1, 20, {}, true);
    expect(r.itens[0].alteracoes).toContainEqual({ campo: "valorServicoAtribuido", rotulo: "Valor do serviço", antes: "150", depois: "170" });
    expect(JSON.stringify(r)).not.toContain("SEGREDO");
  });
  it("não expõe custo do sítio anterior na auditoria clínica do animal transferido", async () => {
    mocks.tx.auditoriaPecuaria.findMany.mockImplementation(async q => q.include ? [{ ...entrada, propriedadeId: 2 }] : opcoes);
    const r = await buscarAuditoriaAnimal("animal-1", 1, 1, 20, {}, true);
    expect(r.itens[0].alteracoes).toContainEqual({ campo: "resultadoNumero", rotulo: "Resultado numérico", antes: "3", depois: "0" });
    expect(r.itens[0].alteracoes.some(c => c.campo === "valorServicoAtribuido")).toBe(false);
    expect(JSON.stringify(r)).not.toMatch(/150|170|SEGREDO/);
  });

  it("snapshot coletivo nutricional mostra apenas fechamento, sem expor itens ou outros animais", async () => {
    mocks.tx.auditoriaPecuaria.findMany.mockImplementation(async (q) => q.include ? [{ ...entrada, entidade: "FechamentoConsumo", acao: "CONFIRMACAO", usuario: null, antes: null,
      depois: { fechamento: { inicio: "2026-10-01", fim: "2026-10-10", status: "CONFIRMADO", participacoes: [{ animalId: "OUTRO-ANIMAL" }], custoTotal: "99999.99" }, itens: [{ valorTotal: "99999.99", segredo: "SEGREDO" }] },
    }] : opcoes);
    const r = await consultarAuditoriaAnimal("animal-1", { page: 1, pageSize: 20 }, false);
    expect(r.itens[0]).toMatchObject({ eixo: "NUTRICAO", usuarioNome: null });
    expect(r.itens[0].alteracoes).toContainEqual({ campo: "inicio", rotulo: "Início do consumo", antes: null, depois: "01/10/2026" });
    expect(JSON.stringify(r)).not.toMatch(/OUTRO-ANIMAL|99999|SEGREDO/);
  });

  it("sem autoria filtra usuarioId null e conserva autor ausente", async () => {
    mocks.tx.auditoriaPecuaria.findMany.mockImplementation(async (q) => q.include ? [{ ...entrada, usuario: null }] : opcoes);
    const r = await consultarAuditoriaAnimal("animal-1", { page: 1, pageSize: 20, responsavel: "sem" }, false);
    const pagina = mocks.tx.auditoriaPecuaria.findMany.mock.calls.find(([q]) => q.include)![0];
    expect(pagina.where.AND).toContainEqual({ usuarioId: null });
    expect(r.itens[0].usuarioNome).toBeNull();
  });

  it("preserva justificativa histórica da exceção racial já exibida na ficha", async () => {
    mocks.tx.auditoriaPecuaria.findMany.mockImplementation(async (q) => q.include ? [{ ...entrada, entidade: "ComposicaoRacial", acao: "SUBSTITUICAO", antes: null,
      depois: { justificativaExcecao: "Conferência do registro de origem", composicao: [{ segredo: "SEGREDO" }] },
    }] : opcoes);
    const r = await consultarAuditoriaAnimal("animal-1", { page: 1, pageSize: 20 }, false);
    expect(r.itens[0].resumo).toBe("Exceção na composição racial");
    expect(r.itens[0].alteracoes).toEqual([{ campo: "justificativaExcecao", rotulo: "Justificativa", antes: null, depois: "Conferência do registro de origem" }]);
    expect(JSON.stringify(r)).not.toContain("SEGREDO");
  });

  it("traduz entidades reprodutivas conhecidas sem reconstruir snapshots ausentes", async () => {
    mocks.tx.auditoriaPecuaria.findMany.mockImplementation(async (q) => q.include ? [
      { ...entrada, entidade: "DemandaAcompanhamentoReprodutivo", antes: null, depois: null },
      { ...entrada, id: "audit-2", entidade: "VinculoPoliticaCiclo", acao: "VINCULO_POLITICA_CICLO", antes: null, depois: null },
    ] : opcoes);
    const r = await consultarAuditoriaAnimal("animal-1", { page: 1, pageSize: 20, eixo: "REPRODUCAO" }, false);
    expect(r.itens).toMatchObject([
      { eixo: "REPRODUCAO", registro: "Demanda de acompanhamento reprodutivo", alteracoes: [] },
      { eixo: "REPRODUCAO", registro: "Política reprodutiva aplicada", acaoRotulo: "Vínculo de política reprodutiva", alteracoes: [] },
    ]);
    expect(r.itens[0].resumo).toBe("Demanda de acompanhamento reprodutivo · Correção de resultado");
    expect(r.itens[1].resumo).toBe("Política reprodutiva aplicada · Vínculo de política reprodutiva");
    const pagina = mocks.tx.auditoriaPecuaria.findMany.mock.calls.find(([q]) => q.include)![0];
    expect(pagina.where.AND[1]).toEqual({ entidade: { in: expect.arrayContaining(["DemandaAcompanhamentoReprodutivo", "VinculoPoliticaCiclo"]) } });
  });

  it("custos têm nome legível e eixo ausente sem inferir finalidade; filtro acha todos os não classificados", async () => {
    mocks.tx.auditoriaPecuaria.findMany.mockImplementation(async (q) => q.include ? [{ ...entrada, entidade: "ClassificacaoCustoPecuaria", depois: { finalidade: "REPRODUCAO" } }] : opcoes);
    const r = await consultarAuditoriaAnimal("animal-1", { page: 1, pageSize: 20, eixo: "NAO_CLASSIFICADO" }, false);
    expect(r.itens[0]).toMatchObject({ eixo: null, registro: "Classificação de custo" });
    const pagina = mocks.tx.auditoriaPecuaria.findMany.mock.calls.find(([q]) => q.include)![0];
    expect(pagina.where.AND[1].entidade.notIn).toContain("VinculoPoliticaCiclo");
    expect(pagina.where.AND[1].entidade.notIn).not.toContain("ClassificacaoCustoPecuaria");
    expect(mocks.tx.auditoriaPecuaria.count).toHaveBeenCalledWith({ where: pagina.where });
  });

  it("ações de inclusão têm rótulos distintos e conservam códigos exatos para o filtro", async () => {
    const codigos = ["CADASTRO", "REGISTRO", "REGISTRO_MANEJO", "CRIACAO", "EDICAO", "EDITAR"];
    mocks.tx.auditoriaPecuaria.findMany.mockImplementation(async (q) => q.include ? [entrada] : codigos.map((acao) => ({ acao, usuarioId: null, usuario: null })));
    const r = await consultarAuditoriaAnimal("animal-1", { page: 1, pageSize: 20, acao: "REGISTRO_MANEJO" }, false);
    expect(r.filtros.acoes.map((a) => a.valor).sort()).toEqual(codigos.sort());
    expect(new Set(r.filtros.acoes.map((a) => a.rotulo)).size).toBe(codigos.length);
    const pagina = mocks.tx.auditoriaPecuaria.findMany.mock.calls.find(([q]) => q.include)![0];
    expect(pagina.where.AND).toContainEqual({ acao: "REGISTRO_MANEJO" });
  });

  it("acentua ação conhecida sem modificar texto livre dos snapshots", async () => {
    mocks.tx.auditoriaPecuaria.findMany.mockImplementation(async (q) => q.include ? [{ ...entrada,
      acao: "INICIO_EFETIVO", antes: null, depois: { observacao: "Inicio efetivo do ciclo informado no documento" },
    }] : [{ acao: "INICIO_EFETIVO", usuarioId: null, usuario: null }]);
    const r = await consultarAuditoriaAnimal("animal-1", { page: 1, pageSize: 20 }, false);
    expect(r.itens[0].acaoRotulo).toBe("Início efetivo");
    expect(r.filtros.acoes).toEqual([{ valor: "INICIO_EFETIVO", rotulo: "Início efetivo" }]);
    expect(r.itens[0].alteracoes).toEqual([{ campo: "observacao", rotulo: "Observação", antes: null, depois: "Inicio efetivo do ciclo informado no documento" }]);
  });

  it("outro sítio e animal inexistente falham antes de consultar auditoria ou facetas", async () => {
    await expect(buscarAuditoriaAnimal("animal-1", 2)).rejects.toMatchObject({ code: "NAO_ENCONTRADO" });
    mocks.prisma.animal.findUnique.mockResolvedValue(null);
    await expect(buscarAuditoriaAnimal("animal-inexistente", null)).rejects.toMatchObject({ code: "NAO_ENCONTRADO" });
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
    expect(mocks.tx.auditoriaPecuaria.findMany).not.toHaveBeenCalled();
    expect(mocks.tx.fechamentoConsumo.findMany).not.toHaveBeenCalled();
  });
});
