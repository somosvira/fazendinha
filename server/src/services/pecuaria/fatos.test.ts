import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { conferirFinalidadesComProducaoTx, conferirAnimalNoFato, conferirFatosNaBaixa, conferirHistoricoDosFatos, conferirLocalizacoesComProducaoTx } from "./fatos.js";

const dia = (s: string) => new Date(s);
const animal = { id: "animal", sexo: "M", dataNascimento: dia("2024-01-01"), dataEntrada: dia("2026-08-01") };
const local = { id: "local", animalId: animal.id, propriedadeId: 1, desde: animal.dataEntrada, ate: null };
const db = {
  tentativaReprodutiva: { count: vi.fn(), findMany: vi.fn() },
  avaliacaoReprodutiva: { count: vi.fn(), findMany: vi.fn() },
  partoAnimal: { count: vi.fn(), findMany: vi.fn() },
  situacaoInicialReprodutiva: { count: vi.fn(), findMany: vi.fn() },
  restricaoReprodutiva: { count: vi.fn(), findMany: vi.fn() },
  gestacaoAnimal: { count: vi.fn(), findMany: vi.fn() },
  lactacaoAnimal: { count: vi.fn(), findMany: vi.fn() },
  criaParto: { count: vi.fn(), findMany: vi.fn() },
  participanteIatf: { count: vi.fn(), findMany: vi.fn() },
  participanteVisita: { count: vi.fn(), findMany: vi.fn() },
  participacaoExposicao: { count: vi.fn(), findMany: vi.fn() },
  periodoReprodutivoAnimal: { count: vi.fn(), findMany: vi.fn() },
  animal: { findUnique: vi.fn(), findMany: vi.fn() },
  localizacaoAnimal: { findFirst: vi.fn(), findMany: vi.fn() },
  baixaAnimal: { findFirst: vi.fn(), findMany: vi.fn() },
  aplicacaoProduto: { count: vi.fn(), findMany: vi.fn() },
  exameAnimal: { count: vi.fn(), findMany: vi.fn() },
  manejoAnimal: { count: vi.fn(), findMany: vi.fn() },
  ocorrenciaSanitaria: { count: vi.fn(), findMany: vi.fn() },
  fornecimentoColostro: { count: vi.fn(), findMany: vi.fn() },
  vinculoPesagemParto: { findMany: vi.fn() },
  finalidadeAnimal: { findMany: vi.fn() },
  medicaoGeralLeite: { count: vi.fn() },
  $queryRaw: vi.fn(),
  participanteProducaoLeite: { count: vi.fn(), findMany: vi.fn() },
  parcelaDestinoLeite: { count: vi.fn(), findMany: vi.fn() },
};
// Fronteira de mock: somente os métodos usados pelas guardas são necessários.
const tx = db as unknown as Prisma.TransactionClient;
beforeEach(() => {
  vi.resetAllMocks();
  db.animal.findUnique.mockResolvedValue(animal);
  db.animal.findMany.mockResolvedValue([animal]);
  db.localizacaoAnimal.findFirst.mockResolvedValue(local);
  db.localizacaoAnimal.findMany.mockResolvedValue([local]);
  db.baixaAnimal.findFirst.mockResolvedValue(null);
  db.baixaAnimal.findMany.mockResolvedValue([]);
  db.vinculoPesagemParto.findMany.mockResolvedValue([]);
  db.participanteProducaoLeite.count.mockResolvedValue(0);
  db.participanteProducaoLeite.findMany.mockResolvedValue([]);
  db.medicaoGeralLeite.count.mockResolvedValue(0);
  db.$queryRaw.mockResolvedValue([]);
  db.parcelaDestinoLeite.count.mockResolvedValue(0);
  db.parcelaDestinoLeite.findMany.mockResolvedValue([]);
  for (const modelo of [db.fornecimentoColostro, db.aplicacaoProduto, db.exameAnimal, db.manejoAnimal, db.ocorrenciaSanitaria, db.tentativaReprodutiva, db.avaliacaoReprodutiva, db.partoAnimal, db.situacaoInicialReprodutiva, db.restricaoReprodutiva, db.gestacaoAnimal, db.lactacaoAnimal, db.criaParto, db.participanteIatf, db.participanteVisita, db.participacaoExposicao, db.periodoReprodutivoAnimal]) {
    modelo.count.mockResolvedValue(0);
    modelo.findMany.mockResolvedValue([]);
  }
});

describe("datas e sítio dos fatos pecuários", () => {
  it("fornecimento de leite comum protege entrada, sítio e baixa de bezerro macho", async () => {
    db.parcelaDestinoLeite.findMany.mockResolvedValue([{ animalId: animal.id, destino: { propriedadeId: 1, data: dia("2026-09-15") } }]);
    await expect(conferirHistoricoDosFatos(tx, [animal.id])).resolves.toBeUndefined();
    db.parcelaDestinoLeite.count.mockResolvedValue(1);
    await expect(conferirFatosNaBaixa(tx, animal.id, dia("2026-09-10"))).rejects.toMatchObject({ code: "CONFLITO" });
    db.parcelaDestinoLeite.findMany.mockResolvedValue([{ animalId: animal.id, destino: { propriedadeId: 2, data: dia("2026-09-15") } }]);
    await expect(conferirHistoricoDosFatos(tx, [animal.id])).rejects.toThrow(/sítio de fatos/);
    db.parcelaDestinoLeite.findMany.mockResolvedValue([{ animalId: animal.id, destino: { propriedadeId: 1, data: dia("2026-07-15") } }]);
    await expect(conferirHistoricoDosFatos(tx, [animal.id])).rejects.toThrow(/anteriores/);
  });
  it("não permite apagar origem de folha, mesmo após excluir o participante", async () => {
    db.participanteProducaoLeite.count.mockResolvedValue(1);
    await expect(conferirLocalizacoesComProducaoTx(tx, [local.id])).rejects.toMatchObject({ code: "CONFLITO" });
    expect(db.participanteProducaoLeite.count).toHaveBeenCalledWith({ where: { localizacaoId: { in: [local.id] } } });
  });
  it("protege produção resolvida ao retroagir baixa, sexo, entrada e localização", async () => {
    db.participanteProducaoLeite.count.mockResolvedValue(1);
    await expect(conferirFatosNaBaixa(tx, animal.id, dia("2026-09-10"))).rejects.toMatchObject({ code: "CONFLITO" });
    db.participanteProducaoLeite.findMany.mockResolvedValue([{ animalId: animal.id, dia: { propriedadeId: 1, dataOperacional: dia("2026-09-15") } }]);
    await expect(conferirHistoricoDosFatos(tx, [animal.id])).rejects.toMatchObject({ campo: "sexo" });
    db.animal.findMany.mockResolvedValue([{ ...animal, sexo: "F" }]);
    await expect(conferirHistoricoDosFatos(tx, [animal.id])).resolves.toBeUndefined();
    db.participanteProducaoLeite.findMany.mockResolvedValue([{ animalId: animal.id, dia: { propriedadeId: 2, dataOperacional: dia("2026-09-15") } }]);
    await expect(conferirHistoricoDosFatos(tx, [animal.id])).rejects.toThrow(/sítio de fatos/);
    db.participanteProducaoLeite.findMany.mockResolvedValue([{ animalId: animal.id, dia: { propriedadeId: 1, dataOperacional: dia("2026-07-15") } }]);
    await expect(conferirHistoricoDosFatos(tx, [animal.id])).rejects.toThrow(/anteriores/);
  });
  it("aceita fato retroativo de animal baixado e consulta a localização na data", async () => {
    db.baixaAnimal.findFirst.mockResolvedValue({ data: dia("2026-09-20"), localizacaoFechadaId: local.id });
    await expect(conferirAnimalNoFato(tx, animal.id, 1, dia("2026-09-10"))).resolves.toEqual(animal);
    expect(db.localizacaoAnimal.findFirst).toHaveBeenCalledWith({ where: { animalId: animal.id, propriedadeId: 1, desde: { lte: dia("2026-09-10") }, OR: [{ ate: null }, { ate: { gt: dia("2026-09-10") } }] } });
    await conferirAnimalNoFato(tx, animal.id, 1, dia("2026-09-20"));
    expect(db.localizacaoAnimal.findFirst.mock.lastCall?.[0].where.OR).toContainEqual({ id: local.id });
    await expect(conferirAnimalNoFato(tx, animal.id, 1, dia("2026-09-21"))).rejects.toThrow(/após a baixa/);
  });
  it("recusa fato antes da entrada, no futuro ou sem localização comprovada", async () => {
    await expect(conferirAnimalNoFato(tx, animal.id, 1, dia("2026-07-31"))).rejects.toThrow(/anteceder/);
    await expect(conferirAnimalNoFato(tx, animal.id, 1, dia("2099-01-01"))).rejects.toThrow(/até hoje/);
    db.localizacaoAnimal.findFirst.mockResolvedValue(null);
    await expect(conferirAnimalNoFato(tx, animal.id, 2, dia("2026-09-10"))).rejects.toThrow(/não estava/);
  });
  it("protege uma baixa retroativa contra fatos posteriores", async () => {
    db.exameAnimal.count.mockResolvedValue(1);
    await expect(conferirFatosNaBaixa(tx, animal.id, dia("2026-09-10"))).rejects.toThrow(/antecede fatos/);
    expect(db.exameAnimal.count).toHaveBeenCalledWith({ where: { animalId: animal.id, status: "VALIDO", data: { gt: dia("2026-09-10") } } });
  });
  it("baixa considera colostro válido da cria e não o atribui à matriz", async () => {
    db.fornecimentoColostro.count.mockResolvedValue(1);
    await expect(conferirFatosNaBaixa(tx, animal.id, dia("2026-09-10"))).rejects.toMatchObject({ code: "CONFLITO", campo: "data" });
    expect(db.fornecimentoColostro.count).toHaveBeenCalledWith({ where: {
      cria: { animalId: animal.id }, status: "VALIDO", data: { gt: dia("2026-09-10") },
    } });
  });
  it.each(["colostro", "peso"])("confere sítio e entrada do %s sem exigir que a cria seja fêmea", async origem => {
    const configurar = (propriedadeId: number, data: Date) => {
      if (origem === "colostro") db.fornecimentoColostro.findMany.mockResolvedValue([{ cria: { animalId: animal.id }, propriedadeId, data }]);
      else db.vinculoPesagemParto.findMany.mockResolvedValue([{ pesagem: { animalId: animal.id, data }, parto: { propriedadeId } }]);
    };
    configurar(1, dia("2026-09-10"));
    await expect(conferirHistoricoDosFatos(tx, [animal.id])).resolves.toBeUndefined();
    configurar(2, dia("2026-09-10"));
    await expect(conferirHistoricoDosFatos(tx, [animal.id])).rejects.toThrow(/sítio de fatos/);
    configurar(1, dia("2026-07-31"));
    await expect(conferirHistoricoDosFatos(tx, [animal.id])).rejects.toThrow(/anteriores ao nascimento\/entrada/);
    expect(db.fornecimentoColostro.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { cria: { animalId: { in: [animal.id] } }, status: "VALIDO" } }));
    expect(db.vinculoPesagemParto.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { revogadoEm: null, pesagem: { animalId: { in: [animal.id] } } } }));
  });
  it("protege sítio e entrada contra correções que alterariam fatos já realizados", async () => {
    db.exameAnimal.findMany.mockResolvedValue([{ animalId: animal.id, propriedadeId: 2, data: dia("2026-09-10"), origem: "MANUAL" }]);
    await expect(conferirHistoricoDosFatos(tx, [animal.id])).rejects.toThrow(/sítio de fatos/);
    db.exameAnimal.findMany.mockResolvedValue([{ animalId: animal.id, propriedadeId: 1, data: dia("2026-07-10"), origem: "MANUAL" }]);
    await expect(conferirHistoricoDosFatos(tx, [animal.id])).rejects.toThrow(/anteriores/);
  });
  it("preserva sítio desconhecido e permite fato no dia da baixa sem mudar ocupação", async () => {
    db.localizacaoAnimal.findMany.mockResolvedValue([{ ...local, ate: dia("2026-09-20") }]);
    db.baixaAnimal.findMany.mockResolvedValue([{ animalId: animal.id, data: dia("2026-09-20"), localizacaoFechadaId: local.id }]);
    db.exameAnimal.findMany.mockResolvedValue([
      { animalId: animal.id, propriedadeId: 1, data: dia("2026-09-20"), origem: "MANUAL" },
      { animalId: animal.id, propriedadeId: null, data: dia("2026-07-10"), origem: "IDEAGRI" },
    ]);
    await expect(conferirHistoricoDosFatos(tx, [animal.id])).resolves.toBeUndefined();
  });
  it("impede mudar para fêmea quando existe castração válida", async () => {
    db.animal.findMany.mockResolvedValue([{ ...animal, sexo: "F" }]);
    db.manejoAnimal.findMany.mockResolvedValue([{ animalId: animal.id, propriedadeId: 1, tipo: "CASTRACAO", data: dia("2026-09-10"), origem: "MANUAL" }]);
    await expect(conferirHistoricoDosFatos(tx, [animal.id])).rejects.toThrow(/mudar para fêmea/);
  });
});

describe("guardas de finalidade contra reclassificação da ordenha", () => {
  it("bloqueia finalidade incompatível e aceita mudança posterior que preserva a data do leite", async () => {
    db.participanteProducaoLeite.findMany.mockResolvedValue([{ finalidadeId: "leite", dia: { dataOperacional: dia("2026-10-14") } }]);
    db.finalidadeAnimal.findMany.mockResolvedValue([{ id: "reproducao", aptidao: "REPRODUCAO", desde: dia("2026-10-01"), ate: null }]);
    await expect(conferirFinalidadesComProducaoTx(tx, animal.id)).rejects.toMatchObject({ campo: "finalidade" });
    db.finalidadeAnimal.findMany.mockResolvedValue([{ id: "leite", aptidao: "LEITE", desde: dia("2026-10-01"), ate: dia("2026-10-15") }, { id: "r", aptidao: "REPRODUCAO", desde: dia("2026-10-15"), ate: null }]);
    await expect(conferirFinalidadesComProducaoTx(tx, animal.id)).resolves.toBeUndefined();
  });
  it("recorta a faixa alterada e não exige conciliar fatos antigos não atingidos", async () => {
    await conferirFinalidadesComProducaoTx(tx, animal.id, dia("2026-10-15"), dia("2026-10-20"));
    expect(db.participanteProducaoLeite.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { animalId: animal.id, excluidoEm: null, dia: { dataOperacional: { gte: dia("2026-10-15"), lt: dia("2026-10-20") } } } }));
  });
});

const geral = (animaisOrigem = [animal.id], data = "2026-10-20", propriedadeId = 1) => ({
  animalId: animaisOrigem[0] ?? "sem-origem", propriedadeId, data: dia(data), entradaId: null, evidencia: null,
});
describe("origens identificadas da produção geral", () => {
  beforeEach(() => {
    db.animal.findMany.mockResolvedValue([{ ...animal, sexo: "F" }]);
    db.$queryRaw.mockResolvedValue([geral()]);
    db.finalidadeAnimal.findMany.mockResolvedValue([
      { id: "leite", aptidao: "LEITE", desde: dia("2026-01-01"), ate: dia("2026-10-19") },
      { id: "corte", aptidao: "CORTE", desde: dia("2026-10-19"), ate: null },
    ]);
  });
  it.each([false, true])("reproduz finalidade Corte desde 19/10 incompatível com origem geral em 20/10, confirmação=%s e sem controle individual", async confirmada => {
    if (confirmada) db.$queryRaw.mockResolvedValue([{ ...geral(), entradaId: "entrada", evidencia: { animalId: animal.id, finalidadeId: "leite", localizacaoId: local.id, lactacaoId: null } }]);
    await expect(conferirFinalidadesComProducaoTx(tx, animal.id, dia("2026-10-19"))).rejects.toMatchObject({ code: "CONFLITO", campo: "finalidade" });
    expect(db.participanteProducaoLeite.findMany).toHaveBeenCalled();
  });
  it("permite finalidade Leite na data e recorta a consulta ao intervalo afetado", async () => {
    db.finalidadeAnimal.findMany.mockResolvedValue([{ id: "leite", aptidao: "LEITE", desde: dia("2026-01-01"), ate: dia("2026-10-21") }]);
    await expect(conferirFinalidadesComProducaoTx(tx, animal.id, dia("2026-10-19"), dia("2026-10-21"))).resolves.toBeUndefined();
    const consulta = db.$queryRaw.mock.lastCall?.[0] as Prisma.Sql;
    expect(consulta.sql).toContain('d."dataOperacional">=');
    expect(consulta.sql).toContain('d."dataOperacional"<');
    expect(consulta.values).toEqual([[animal.id], dia("2026-10-19"), dia("2026-10-21")]);
  });
  it.each([{ animais: [] }, { animais: ["outro-animal"] }])("não infere vínculos nem bloqueia animal ausente da origem $animais", async ({ animais }) => {
    db.$queryRaw.mockResolvedValue([geral(animais)]);
    await expect(conferirFinalidadesComProducaoTx(tx, animal.id)).resolves.toBeUndefined();
  });
  it("preserva localização congelada mesmo quando a troca manteria o mesmo sítio", async () => {
    db.$queryRaw.mockResolvedValue([{ ...geral(), entradaId: "entrada", evidencia: { animalId: animal.id, finalidadeId: "leite", localizacaoId: "local-original", lactacaoId: null } }]);
    await expect(conferirHistoricoDosFatos(tx, [animal.id])).rejects.toThrow(/localização comprovada/);
  });
  it("preserva evidência da finalidade de uma entrada confirmada", async () => {
    db.finalidadeAnimal.findMany.mockResolvedValue([{ id: "outra-leite", aptidao: "LEITE", desde: dia("2026-01-01"), ate: null }]);
    db.$queryRaw.mockResolvedValue([{ ...geral(), entradaId: "entrada", evidencia: { animalId: animal.id, finalidadeId: "leite", localizacaoId: local.id, lactacaoId: null } }]);
    await expect(conferirFinalidadesComProducaoTx(tx, animal.id)).rejects.toMatchObject({ campo: "finalidade" });
  });
  it("baixa, sexo, entrada e sítio também conservam a origem geral", async () => {
    db.medicaoGeralLeite.count.mockResolvedValue(1);
    await expect(conferirFatosNaBaixa(tx, animal.id, dia("2026-10-19"))).rejects.toMatchObject({ code: "CONFLITO" });
    expect(db.medicaoGeralLeite.count).toHaveBeenCalledWith({ where: { animaisOrigem: { array_contains: [animal.id] }, sessao: { dia: { dataOperacional: { gt: dia("2026-10-19") } } } } });
    await expect(conferirHistoricoDosFatos(tx, [animal.id])).resolves.toBeUndefined();
    db.animal.findMany.mockResolvedValue([animal]);
    await expect(conferirHistoricoDosFatos(tx, [animal.id])).rejects.toMatchObject({ campo: "sexo" });
    db.animal.findMany.mockResolvedValue([{ ...animal, sexo: "F", dataEntrada: dia("2026-10-21") }]);
    await expect(conferirHistoricoDosFatos(tx, [animal.id])).rejects.toThrow(/anteriores/);
    db.animal.findMany.mockResolvedValue([{ ...animal, sexo: "F" }]);
    db.$queryRaw.mockResolvedValue([geral([animal.id], "2026-10-20", 2)]);
    await expect(conferirHistoricoDosFatos(tx, [animal.id])).rejects.toThrow(/sítio de fatos/);
  });
});
