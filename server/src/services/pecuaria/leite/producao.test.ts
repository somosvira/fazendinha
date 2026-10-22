import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { ORDENHAS_INICIAIS } from "./producao.calc.js";
import type { SalvarFolhaInput } from "./schemas.js";
const guardaEstoque = vi.hoisted(() => vi.fn());
vi.mock("./estoque.js", () => ({ exigirSessaoLeiteEditavelTx: guardaEstoque }));

type EntradaEstoque = { id: string; status: string; movimento: { produtoId: string; quantidade: Prisma.Decimal }; classificacoes: { natureza: string }[] };
type Medicao = { origensEstoque?: { entrada: EntradaEstoque }[]; id: string; diaId: string; sessaoId: string; participanteId: string; estado: string; litros: Prisma.Decimal | null; motivo: string | null; versao: number };
type Participante = { id: string; diaId: string; animalId: string; brinco: string; nome: string | null; localizacaoId: string; lactacaoId: string | null; pendencias: string[]; excluidoEm: Date | null; motivoExclusao: string | null; medicoes: Medicao[] };
type Configuracao = { id: string; propriedadeId: number; vigenteDesde: Date; inicial: boolean; ordenhas: { posicaoId: string; nome: string; ordem: number; horario: string | null }[] };
type Dia = { id: string; propriedadeId: number; dataOperacional: Date; configuracaoId: string; configuracao: Configuracao; versao: number; sessoes: { id: string; diaId: string; posicaoId: string; nome: string; ordem: number; horario: string | null; versao: number; entradasEstoque?: EntradaEstoque[] }[]; participantes: Participante[] };
const { estado, db } = vi.hoisted(() => {
  const estado: { dia: Dia | null; configuracoes: Configuracao[]; contador: number; requisicoes: Map<string, Record<string, unknown>> } = { dia: null, configuracoes: [], contador: 0, requisicoes: new Map() };
  const id = () => `00000000-0000-4000-9000-${String(++estado.contador).padStart(12, "0")}`;
  const copiar = () => estado.dia && ({ ...estado.dia, configuracao: { ...estado.dia.configuracao, ordenhas: estado.dia.configuracao.ordenhas.map(o => ({ ...o })) }, sessoes: estado.dia.sessoes.map(s => ({ ...s })), participantes: estado.dia.participantes.map(p => ({ ...p, medicoes: p.medicoes.map(m => ({ ...m })) })) });
  const db = {
    $executeRaw: vi.fn().mockResolvedValue(0),
    $queryRaw: vi.fn().mockResolvedValue([]),
    propriedade: { findUnique: vi.fn().mockResolvedValue({ id: 1, ativo: true }) },
    animal: { findMany: vi.fn() }, lactacaoAnimal: { findMany: vi.fn() },
    requisicaoPecuaria: {
      findUnique: vi.fn(async ({ where }: { where: { chave: string } }) => estado.requisicoes.get(where.chave) ?? null),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> & { chave: string } }) => { estado.requisicoes.set(data.chave, data); return data; }),
    },
    auditoriaPecuaria: { create: vi.fn(async ({ data }: { data: unknown }) => data) },
    configuracaoOrdenha: {
      findFirst: vi.fn(async ({ where }: { where: { propriedadeId: number; vigenteDesde?: { lte: Date } } }) => {
        const c = estado.configuracoes.filter(c => c.propriedadeId === where.propriedadeId && (!where.vigenteDesde || c.vigenteDesde <= where.vigenteDesde.lte)).sort((a, b) => b.vigenteDesde.getTime() - a.vigenteDesde.getTime())[0];
        return c ? { ...c, ordenhas: c.ordenhas.map(o => ({ ...o })) } : null;
      }),
      findUniqueOrThrow: vi.fn(async ({ where }: { where: { id: string } }) => {
        const c = estado.configuracoes.find(c => c.id === where.id)!;
        return { ...c, ordenhas: c.ordenhas.map(o => ({ ...o })) };
      }),
      findMany: vi.fn(async () => estado.configuracoes),
      create: vi.fn(async ({ data }: { data: Omit<Configuracao, "id" | "ordenhas" | "inicial"> & { inicial?: boolean; ordenhas: { create: Configuracao["ordenhas"] } } }) => {
        const config: Configuracao = { ...data, id: id(), inicial: data.inicial ?? false, ordenhas: data.ordenhas.create };
        estado.configuracoes.push(config); return config;
      }),
    },
    diaProducaoLeite: {
      findUnique: vi.fn(async ({ where }: { where: { propriedadeId_dataOperacional?: { propriedadeId: number; dataOperacional: Date } } }) => {
        const identidade = where.propriedadeId_dataOperacional;
        return identidade && estado.dia && (estado.dia.propriedadeId !== identidade.propriedadeId || estado.dia.dataOperacional.getTime() !== identidade.dataOperacional.getTime()) ? null : copiar();
      }), findUniqueOrThrow: vi.fn(async () => copiar()), count: vi.fn(async ({ where }: { where: { dataOperacional: { gte: Date } } }) => estado.dia && estado.dia.dataOperacional >= where.dataOperacional.gte ? 1 : 0),
      create: vi.fn(async ({ data }: { data: { propriedadeId: number; dataOperacional: Date; configuracaoId: string; sessoes: { create: { posicaoId: string; nome: string; ordem: number; horario: string | null }[] } } }) => {
        const diaId = id(); const config = estado.configuracoes.find(c => c.id === data.configuracaoId)!;
        estado.dia = { ...data, id: diaId, configuracao: config, versao: 1, participantes: [], sessoes: data.sessoes.create.map(s => ({ ...s, id: id(), diaId, versao: 1 })) };
        return copiar();
      }),
      update: vi.fn(async () => { estado.dia!.versao++; return copiar(); }),
    },
    sessaoOrdenha: { updateMany: vi.fn(async ({ where }: { where: { id: { in: string[] } } }) => { estado.dia!.sessoes.filter(s => where.id.in.includes(s.id)).forEach(s => s.versao++); return { count: where.id.in.length }; }) },
    participanteProducaoLeite: {
      create: vi.fn(async ({ data }: { data: Omit<Participante, "id" | "medicoes" | "excluidoEm" | "motivoExclusao"> }) => {
        const p = { ...data, id: id(), medicoes: [], excluidoEm: null, motivoExclusao: null }; estado.dia!.participantes.push(p); return { ...p };
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<Participante> }) => {
        const p = estado.dia!.participantes.find(p => p.id === where.id)!; Object.assign(p, data); return { ...p };
      }),
    },
    medicaoLeite: {
      createMany: vi.fn(async ({ data }: { data: Pick<Medicao, "diaId" | "sessaoId" | "participanteId">[] }) => {
        for (const d of data) estado.dia!.participantes.find(p => p.id === d.participanteId)!.medicoes.push({ ...d, id: id(), estado: "PENDENTE", litros: null, motivo: null, versao: 1 });
        return { count: data.length };
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: { estado: string; litros: Prisma.Decimal | null; motivo: string | null } }) => {
        const m = estado.dia!.participantes.flatMap(p => p.medicoes).find(m => m.id === where.id)!;
        Object.assign(m, { estado: data.estado, litros: data.litros, motivo: data.motivo, versao: m.versao + 1 }); return { ...m };
      }),
    },
  };
  return { estado, db };
});
vi.mock("../transacao.js", () => ({ transacaoPecuaria: (executar: (tx: typeof db) => Promise<unknown>) => executar(db) }));
vi.mock("../../../db.js", () => ({ prisma: db }));
import { consultarFolha, listarCandidatos, salvarFolha } from "./producao.js";
import { criarConfiguracao } from "./configuracoes.js";
const uid = (numero: number) => `10000000-0000-4000-8000-${String(numero).padStart(12, "0")}`;
const data = (dia: string) => new Date(`${dia}T00:00:00Z`);
function entrada(chave: number, versaoEsperada: number, medicoes: SalvarFolhaInput["medicoes"] = []): SalvarFolhaInput {
  return { chave: uid(chave + 100), propriedadeId: 1, dataOperacional: "2026-10-01", versaoEsperada, medicoes, animaisAdicionar: [], animaisExcluir: [] };
}
const medicoes = (incluiNoite = true) => [[12, 10, 8], [9, 8, 7]].flatMap((litros, indice) => litros.flatMap((litros, posicao) => !incluiNoite && posicao === 2 ? [] : [{ animalId: uid(indice + 1), posicaoId: ORDENHAS_INICIAIS[posicao].posicaoId, estado: "MEDIDO" as const, litros }]));
const animais = [1, 2].map(n => ({ destinos: [{ id: uid(n + 500), aptidao: "LEITE", desde: data("2025-01-01"), ate: null }], id: uid(n), sexo: "F", brinco: String(n), nome: null, dataNascimento: data("2020-01-01"), dataEntrada: data("2025-01-01"), baixas: [], localizacoes: [{ id: uid(n + 10), propriedadeId: 1, desde: data("2025-01-01"), ate: null }] }));
beforeEach(() => {
  vi.clearAllMocks(); estado.dia = null; estado.configuracoes = []; estado.contador = 0; estado.requisicoes.clear();
  db.animal.findMany.mockResolvedValue(animais);
  guardaEstoque.mockReset();
  guardaEstoque.mockResolvedValue(undefined);
  db.$queryRaw.mockReset(); db.$queryRaw.mockResolvedValue([]);
  db.lactacaoAnimal.findMany.mockResolvedValue(animais.map((a, i) => ({ id: uid(i + 20), animalId: a.id, inicio: data("2026-01-01"), encerradaEm: null })));
});
describe("serviço de folha: fonte única, snapshots e retries", () => {
  it("expõe confirmação independente do produto e mantém null/listas vazias para medições livres", async () => {
    const previa = await consultarFolha(1, "2026-10-01");
    expect(previa.animais.every(a => a.medicoes.every(m => m.confirmacaoEstoque === null))).toBe(true);
    expect(previa.sessoes.every(s => s.entradasEstoque.length === 0)).toBe(true);
    await salvarFolha(entrada(1, 0, medicoes()), 7);
    const origem = { id: uid(800), status: "CONFIRMADA", movimento: { produtoId: uid(801), quantidade: new Prisma.Decimal(12) }, classificacoes: [{ natureza: "COLOSTRO" }] };
    estado.dia!.participantes[0].medicoes[0].origensEstoque = [{ entrada: origem }];
    estado.dia!.sessoes[0].entradasEstoque = [origem];
    const folha = await consultarFolha(1, "2026-10-01");
    expect(folha.animais[0].medicoes[0].confirmacaoEstoque).toEqual({ entradaId: origem.id, produtoId: uid(801), natureza: "COLOSTRO" });
    expect(folha.animais[1].medicoes[0].confirmacaoEstoque).toBeNull();
    expect(folha.sessoes[0].entradasEstoque).toEqual([{ entradaId: origem.id, produtoId: uid(801), natureza: "COLOSTRO", quantidadeLitros: 12, status: "CONFIRMADA" }]);
    expect(folha.sessoes[1].entradasEstoque).toEqual([]);
    expect(folha.totais.litros).toBe(54);
  });
  it("relê posições depois de travar a configuração antes de congelar a primeira folha", async () => {
    estado.configuracoes.push({ id: uid(900), propriedadeId: 1, vigenteDesde: data("1900-01-01"), inicial: true,
      ordenhas: ORDENHAS_INICIAIS.map(o => ({ ...o, horario: o.horario ?? null })) });
    db.$queryRaw.mockImplementationOnce(async () => {
      // Escrita da configuração livre concluiu entre a leitura inicial e a trava.
      estado.configuracoes[0].ordenhas = estado.configuracoes[0].ordenhas.slice(0, 2);
      return [{ id: uid(900) }];
    });
    const folha = await salvarFolha(entrada(1, 0), 7);
    expect(folha.sessoes).toHaveLength(2);
    expect(folha.configuracao.ordenhas).toHaveLength(2);
    expect(folha.totais.esperadas).toBe(4);
    expect(db.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(db.configuracaoOrdenha.findUniqueOrThrow.mock.invocationCallOrder[0]);
    expect(db.configuracaoOrdenha.findUniqueOrThrow.mock.invocationCallOrder[0]).toBeLessThan(db.diaProducaoLeite.create.mock.invocationCallOrder[0]);
  });
  it("sessão confirmada impede correção e população, preservando edição de outra ordenha", async () => {
    await salvarFolha(entrada(1, 0, medicoes(false)), 7);
    const manhaId = estado.dia!.sessoes[0].id;
    guardaEstoque.mockImplementation(async (_tx: unknown, sessaoId: string) => {
      if (sessaoId === manhaId) throw new Error("Regularize a sessão confirmada");
    });
    const noite = medicoes().filter(m => m.posicaoId === ORDENHAS_INICIAIS[2].posicaoId);
    expect((await salvarFolha(entrada(2, 1, noite), 7)).totais.litros).toBe(54);
    await expect(salvarFolha({ ...entrada(3, 2, [{ ...medicoes()[0], litros: 13 }]), motivoCorrecao: "Correção de leitura" }, 7)).rejects.toThrow(/Regularize/);
    await expect(salvarFolha({ ...entrada(4, 2), animaisExcluir: [uid(1)], motivoCorrecao: "Correção da população" }, 7)).rejects.toThrow(/Regularize/);
    expect(estado.dia!.versao).toBe(2);
  });
  it("guarda 54 L e repetir a mesma requisição não duplica fatos nem versões", async () => {
    const input = entrada(1, 0, medicoes());
    const salva = await salvarFolha(input, 7);
    expect(salva.totais).toMatchObject({ litros: 54, medidas: 6, completa: true });
    expect(salva.animais.map(a => a.totais.litros)).toEqual([30, 24]);
    expect(salva.sessoes.map(s => s.totais.litros)).toEqual([21, 18, 15]);
    const numeroAuditorias = db.auditoriaPecuaria.create.mock.calls.length;
    expect(await salvarFolha(input, 7)).toEqual(salva);
    expect(db.diaProducaoLeite.create).toHaveBeenCalledTimes(1);
    expect(db.medicaoLeite.update).toHaveBeenCalledTimes(6);
    expect(db.auditoriaPecuaria.create).toHaveBeenCalledTimes(numeroAuditorias);
    await expect(salvarFolha({ ...input, medicoes: [] }, 7)).rejects.toMatchObject({ code: "CONFLITO" });
  });
  it("salva por animal, retoma do servidor e recusa a outra aba com versão antiga", async () => {
    const input = entrada(71, 0, [medicoes()[0]]);
    await salvarFolha(input, 7);
    const retomada = await consultarFolha(1, "2026-10-01");
    expect(retomada.animais[0].medicoes[0]).toMatchObject({ estado: "MEDIDO", litros: 12 });
    expect(retomada.animais[1].medicoes[0]).toMatchObject({ estado: "PENDENTE", litros: null });
    await expect(salvarFolha(entrada(72, 0, [medicoes()[3]]), 7)).rejects.toMatchObject({ code: "CONFLITO" });
    expect(db.medicaoLeite.update).toHaveBeenCalledTimes(1);
    expect(guardaEstoque).not.toHaveBeenCalled();
  });
  it("rascunho sem noite informa 39 L parciais e só altera a versão da noite ao completá-la", async () => {
    expect((await salvarFolha(entrada(1, 0, medicoes(false)), 7)).totais).toMatchObject({ litros: 39, pendentes: 2, completa: false });
    const salva = await salvarFolha(entrada(2, 1, medicoes().filter(m => m.posicaoId === ORDENHAS_INICIAIS[2].posicaoId)), 7);
    expect(salva.totais).toMatchObject({ litros: 54, completa: true });
    expect(salva.versao).toBe(2); expect(salva.sessoes.map(s => s.versao)).toEqual([1, 1, 2]);
  });
  it("recusa edição com versão antiga e exige motivo ao trocar resolvido por pendente", async () => {
    await salvarFolha(entrada(1, 0, medicoes()), 7);
    await expect(salvarFolha(entrada(2, 0, []), 7)).rejects.toMatchObject({ code: "CONFLITO" });
    const celula = { ...medicoes()[0], estado: "PENDENTE" as const, litros: null };
    await expect(salvarFolha(entrada(3, 1, [celula]), 7)).rejects.toMatchObject({ campo: "motivoCorrecao" });
    const salva = await salvarFolha({ ...entrada(4, 1, [celula]), motivoCorrecao: "Leitura lançada no animal errado" }, 7);
    expect(salva.totais).toMatchObject({ litros: 42, pendentes: 1, completa: false });
    expect(db.auditoriaPecuaria.create.mock.calls.some(([p]) => JSON.stringify(p.data).includes("Leitura lançada no animal errado"))).toBe(true);
  });
  it("mudar rotina3→2 conserva três sessões e leituras históricas após transferência/secagem", async () => {
    const salva = await salvarFolha(entrada(1, 0, medicoes()), 7);
    await criarConfiguracao({ chave: uid(200), propriedadeId: 1, vigenteDesde: "2026-10-02", ordenhas: ORDENHAS_INICIAIS.slice(0, 2).map(o => ({ ...o })) }, 7);
    const nova = await consultarFolha(1, "2026-10-02"); expect(nova.id).toBeNull(); expect(nova.sessoes).toHaveLength(2);
    db.animal.findMany.mockResolvedValue([]); db.lactacaoAnimal.findMany.mockResolvedValue([]);
    const passada = await consultarFolha(1, "2026-10-01");
    expect(passada.sessoes).toHaveLength(3); expect(passada.totais.litros).toBe(54); expect(passada.id).toBe(salva.id);
    await expect(criarConfiguracao({ chave: uid(201), propriedadeId: 1, vigenteDesde: "2026-10-01", ordenhas: ORDENHAS_INICIAIS.slice(0, 2).map(o => ({ ...o })) }, 7)).rejects.toMatchObject({ code: "CONFLITO" });
  });
  it("exclusão e reinclusão conservam medições e exigem motivo e revisão", async () => {
    await salvarFolha(entrada(1, 0, medicoes()), 7);
    await expect(salvarFolha({ ...entrada(2, 1), animaisExcluir: [uid(1)] }, 7)).rejects.toMatchObject({ campo: "motivoCorrecao" });
    const excluida = await salvarFolha({ ...entrada(3, 1), animaisExcluir: [uid(1)], motivoCorrecao: "Animal incluído na folha indevida" }, 7);
    expect(excluida.totais.litros).toBe(24); expect(excluida.animaisExcluidos[0].totais.litros).toBe(30);
    expect(excluida.sessoes.map(s => s.versao)).toEqual([2, 2, 2]);
    const reincluida = await salvarFolha({ ...entrada(4, 2), animaisAdicionar: [uid(1)], motivoCorrecao: "Conciliação comprova inclusão correta" }, 7);
    expect(reincluida.totais.litros).toBe(54); expect(reincluida.animaisExcluidos).toHaveLength(0);
    expect(estado.dia?.participantes).toHaveLength(2);
  });
  it("inclui ausência simples de lactação só explicitamente e mantém a pendência", async () => {
    db.lactacaoAnimal.findMany.mockResolvedValue([]);
    const preview = await consultarFolha(1, "2026-10-01"); expect(preview.animais).toHaveLength(0);
    const salva = await salvarFolha({ ...entrada(1, 0, [medicoes()[0]]), animaisAdicionar: [uid(1)] }, 7);
    expect(salva.animais).toHaveLength(1); expect(salva.animais[0]).toMatchObject({ lactacaoId: null, pendencias: ["LACTACAO_NAO_INFORMADA"] });
    expect(salva.totais).toMatchObject({ litros: 12, pendentes: 2 });
  });
  it("busca candidatos por população histórica, preservando ausência e impedimento", async () => {
    db.lactacaoAnimal.findMany.mockResolvedValue([{ id: uid(20), animalId: uid(2), inicio: data("2026-01-01"), encerradaEm: data("2026-09-30") }]);
    const candidatos = await listarCandidatos(1, "2026-10-01");
    expect(candidatos.itens).toMatchObject([{ animalId: uid(1), lactacaoId: null, pendencias: ["LACTACAO_NAO_INFORMADA"] }]);
    expect(candidatos.impedimentos).toMatchObject([{ animalId: uid(2), motivo: expect.stringContaining("encerrada") }]);
    expect((await listarCandidatos(1, "2026-10-01", "2")).total).toBe(0);
    expect(db.diaProducaoLeite.create).not.toHaveBeenCalled();
  });
});

describe("finalidade temporal nos comandos da folha", () => {
  it("exclui Reprodução da população automática e explica sem derrubar a folha", async () => {
    db.animal.findMany.mockResolvedValue([{ ...animais[0], destinos: [{ ...animais[0].destinos[0], aptidao: "REPRODUCAO" }] }, animais[1]]);
    const folha = await consultarFolha(1, "2026-10-01");
    expect(folha.animais.map(a => a.animalId)).toEqual([animais[1].id]);
    expect(folha.impedimentos).toMatchObject([{ animalId: animais[0].id, codigo: "FINALIDADE_REPRODUCAO" }]);
    const candidatos = await listarCandidatos(1, "2026-10-01");
    expect(candidatos.impedimentos[0].motivo).toMatch(/Reprodução/);
    await expect(salvarFolha({ ...entrada(80, 0), animaisAdicionar: [animais[0].id] }, 7)).rejects.toMatchObject({ campo: "finalidade" });
    expect(db.medicaoLeite.update).not.toHaveBeenCalled();
  });
  it("não presume Leite em lacuna/sobreposição apesar de lactação aberta", async () => {
    for (const destinos of [[], [animais[0].destinos[0], { ...animais[0].destinos[0], id: uid(900) }]]) {
      db.animal.findMany.mockResolvedValue([{ ...animais[0], destinos }]);
      const folha = await consultarFolha(1, "2026-10-01");
      expect(folha.animais).toEqual([]);
      expect(folha.impedimentos).toHaveLength(1);
    }
  });
  it("mede no Leite histórico embora a finalidade atual seja Reprodução", async () => {
    const periodos = [{ ...animais[0].destinos[0], ate: data("2026-10-15") }, { id: uid(901), aptidao: "REPRODUCAO", desde: data("2026-10-15"), ate: null }];
    db.animal.findMany.mockResolvedValue([{ ...animais[0], destinos: periodos }]);
    const folha = await salvarFolha(entrada(81, 0, [medicoes()[0]]), 7);
    expect(folha.animais[0].finalidade).toMatchObject({ estado: "COMPROVADA", finalidadeId: periodos[0].id, dataOperacional: "2026-10-01" });
    expect(folha.totais.litros).toBe(12);
    db.animal.findMany.mockResolvedValue([{ ...animais[0], destinos: [] }]);
    expect(await salvarFolha(entrada(81, 0, [medicoes()[0]]), 7)).toEqual(folha);
  });
});

describe("regressões de revisão: baixa e conciliação explícita", () => {
  it("permite medir no dia da baixa vinculada à finalidade Leite, preservando a extremidade", async () => {
    const vaca = animais[0], dataBaixa = data("2026-10-01");
    db.animal.findMany.mockResolvedValue([{ ...vaca,
      destinos: [{ ...vaca.destinos[0], ate: dataBaixa }],
      localizacoes: [{ ...vaca.localizacoes[0], ate: dataBaixa }],
      baixas: [{ id: uid(990), data: dataBaixa, localizacaoFechadaId: vaca.localizacoes[0].id, destinoFechadoId: vaca.destinos[0].id }],
    }]);
    const folha = await salvarFolha(entrada(91, 0, [medicoes()[0]]), 7);
    expect(folha.animais[0].finalidade.estado).toBe("COMPROVADA");
    expect(folha.totais.litros).toBe(12);
    expect(db.participanteProducaoLeite.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ finalidadeSnapshot: expect.objectContaining({ ate: "2026-10-01", motivoExtremidade: "BAIXA_NO_DIA", baixaId: uid(990) }) }) }));
  });
  it("reinclusão concilia a finalidade válida atualizada sem alterar litros e preserva autoria/versões", async () => {
    await salvarFolha(entrada(1, 0, medicoes()), 7);
    const original = animais[0].destinos[0];
    await salvarFolha({ ...entrada(3, 1), animaisExcluir: [uid(1)], motivoCorrecao: "Animal incluído na folha indevida" }, 7);
    db.animal.findMany.mockResolvedValue([{ ...animais[0], destinos: [
      { ...original, ate: data("2026-09-20") },
      { id: uid(950), aptidao: "REPRODUCAO", desde: data("2026-09-20"), ate: data("2026-09-30") },
      { id: uid(951), aptidao: "LEITE", desde: data("2026-09-30"), ate: null },
    ] }, animais[1]]);
    const r = await salvarFolha({ ...entrada(4, 2), animaisAdicionar: [uid(1)], motivoCorrecao: "Conciliação comprova inclusão correta" }, 7);
    expect(r.animais.find(a => a.animalId === uid(1))!.finalidade).toMatchObject({ estado: "COMPROVADA", finalidadeId: uid(951) });
    expect(r.totais.litros).toBe(54);
    expect(r.versao).toBe(3);
    expect(r.sessoes.map(s => s.versao)).toEqual([3, 3, 3]);
    expect(db.auditoriaPecuaria.create.mock.calls.some(([p]) => JSON.stringify(p.data).includes("CONCILIACAO_REINCLUSAO") && JSON.stringify(p.data).includes(uid(951)))).toBe(true);
  });
});
