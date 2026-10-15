import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { consultarPlannerTx, incluirGrupoPlannerTx, previaGrupoPlannerTx } from "./planner.js";
import { consultaPlannerSchema, incluirGrupoPlannerSchema, previaGrupoPlannerSchema } from "./planner.schemas.js";

const mocks = vi.hoisted(() => ({ contextos: new Map<string, Record<string, unknown>>(), adicionar: vi.fn() }));
vi.mock("./visitas.js", () => ({
  carregarContextosVisitaTx: vi.fn(async () => ({})),
  contextoAnimalVisitaTx: vi.fn(async (_tx: unknown, id: string) => mocks.contextos.get(id)),
  adicionarAtividadeTx: mocks.adicionar,
}));
type Tx = Prisma.TransactionClient;
function fonte(quantidade = 2) {
  const animais = Array.from({ length: quantidade }, (_, i) => ({ id: randomUUID(), brinco: String(i + 1) }));
  for (const a of animais) mocks.contextos.set(a.id, { animalId: a.id, sexo: "F", brinco: a.brinco, del: 50, situacao: "VAZIA", propriedadeId: 1, lote: null });
  const protocoloId = randomUUID(), etapaId = randomUUID(), rodadaId = randomUUID();
  const tarefas = animais.map(a => ({ id: randomUUID(), previstaPara: new Date("2026-10-14"), precisaoTemporal: "DIA", previsaoPendente: false, etapaId, parametros: {},
    etapa: { id: etapaId, nome: "Diagnóstico", tipo: "AVALIACAO", ordem: 0 }, execucao: { id: randomUUID(), animalId: a.id, rodadaId, inicio: new Date("2026-10-01"), inicioEfetivo: null, precisaoInicioEfetivo: null,
      protocolo: { id: protocoloId, nome: "Protocolo de diagnóstico", tipo: "REPRODUTIVO", versao: 1 }, rodada: { id: rodadaId, nome: "Turma A" } } }));
  const requisicoes = new Map<string, Record<string, unknown>>();
  const visita = { id: randomUUID(), propriedadeId: 1, data: new Date("2026-10-14"), encerradaEm: null, nome: "Visita" };
  const tx = {
    localizacaoAnimal: { findMany: vi.fn(async () => animais.map(a => ({ animalId: a.id }))) },
    tarefaProtocolo: { findMany: vi.fn(async () => tarefas) },
    participanteVisita: { findMany: vi.fn(async () => []) }, atividadeVisita: { findMany: vi.fn(async () => []) },
    avaliacaoReprodutiva: { findMany: vi.fn(async () => []) }, selecaoVisita: { findMany: vi.fn(async () => []) },
    visitaVeterinaria: { findMany: vi.fn(async () => []), findFirst: vi.fn(async () => visita), findFirstOrThrow: vi.fn(async () => visita) },
    requisicaoPecuaria: { findUnique: vi.fn(async ({ where }: { where: { chave: string } }) => requisicoes.get(where.chave) ?? null),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => { requisicoes.set(String(data.chave), data); return data; }) },
    auditoriaPecuaria: { create: vi.fn(async () => ({})) }, $executeRaw: vi.fn(async () => 1), $queryRaw: vi.fn(async () => []),
  };
  mocks.adicionar.mockImplementation(async (_tx: Tx, _id: string, input: { participantes: { animalId: string; motivos: string[] }[] }) => ({ id: randomUUID(), participantes: input.participantes }));
  return { tx: tx as unknown as Tx, leitor: tx, visita, animais, tarefas };
}
const consulta = consultaPlannerSchema.parse({ propriedadeId: 1, data: "2026-10-14" });
beforeEach(() => { vi.clearAllMocks(); mocks.contextos.clear(); });
describe("planner completo, prévia e inclusão", () => {
  it("consulta grupo acima de 500 e pagina acima de 1000 conservando total/fingerprint completos", async () => {
    const { tx, leitor } = fonte(1201);
    const planner = await consultarPlannerTx(tx, consulta);
    expect(planner).toMatchObject({ totalGrupos: 1, totais: { animaisUnicos: 1201, procedimentos: 1201 }, grupos: [{ totalAnimais: 1201, totalProcedimentos: 1201 }] });
    const grupo = planner.grupos[0].grupo;
    const pagina1 = await previaGrupoPlannerTx(tx, previaGrupoPlannerSchema.parse({ ...consulta, grupo, tamanhoPagina: 200 }));
    const pagina7 = await previaGrupoPlannerTx(tx, previaGrupoPlannerSchema.parse({ ...consulta, grupo, pagina: 7, tamanhoPagina: 200 }));
    expect(pagina1.animais).toHaveLength(200);
    expect(pagina7.animais).toHaveLength(1);
    expect(pagina7.total).toBe(1201);
    expect(pagina7.fingerprint).toBe(pagina1.fingerprint);
    expect(leitor.tarefaProtocolo.findMany).toHaveBeenCalledWith(expect.not.objectContaining({ take: expect.anything() }));
    expect(leitor.localizacaoAnimal.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ propriedadeId: 1, desde: { lte: new Date("2026-10-14") } }) }));
  });
  it("inclui o conjunto completo em atividades até 1000; reenvio recupera resultado sem adicionar novamente", async () => {
    const { tx, visita } = fonte(1001);
    const planner = await consultarPlannerTx(tx, consulta), grupo = planner.grupos[0].grupo;
    const previa = await previaGrupoPlannerTx(tx, previaGrupoPlannerSchema.parse({ ...consulta, grupo }));
    const input = incluirGrupoPlannerSchema.parse({ propriedadeId: 1, chave: randomUUID(), grupo, fingerprint: previa.fingerprint });
    const resultado = await incluirGrupoPlannerTx(tx, visita.id, input, null);
    expect(resultado).toMatchObject({ totalAnimais: 1001, totalProcedimentos: 1001 });
    expect(resultado.atividades.map(a => a.participantes.length)).toEqual([1000, 1]);
    expect(mocks.adicionar).toHaveBeenCalledTimes(2);
    expect(await incluirGrupoPlannerTx(tx, visita.id, input, null)).toEqual(JSON.parse(JSON.stringify(resultado)));
    expect(mocks.adicionar).toHaveBeenCalledTimes(2);
    await expect(incluirGrupoPlannerTx(tx, visita.id, { ...input, excluidos: [resultado.atividades[0].participantes[0].animalId] }, null)).rejects.toMatchObject({ code: "CONFLITO" });
  });
  it("um animal com duas tarefas conta uma vez e gera dois procedimentos em atividades compatíveis", async () => {
    const { tx, tarefas, visita } = fonte(1);
    tarefas.push({ ...tarefas[0], id: randomUUID() });
    const planner = await consultarPlannerTx(tx, consulta), grupo = planner.grupos[0].grupo;
    expect(planner.totais).toEqual({ animaisUnicos: 1, procedimentos: 2 });
    const previa = await previaGrupoPlannerTx(tx, previaGrupoPlannerSchema.parse({ ...consulta, grupo }));
    const resultado = await incluirGrupoPlannerTx(tx, visita.id, incluirGrupoPlannerSchema.parse({ propriedadeId: 1, chave: randomUUID(), grupo, fingerprint: previa.fingerprint }), null);
    expect(resultado).toMatchObject({ totalAnimais: 1, totalProcedimentos: 2 });
    expect(resultado.atividades).toHaveLength(2);
  });
  it("contexto alterado fora da página invalida a inclusão antes de gravar atividade", async () => {
    const { tx, animais, visita } = fonte(201);
    const planner = await consultarPlannerTx(tx, consulta), grupo = planner.grupos[0].grupo;
    const previa = await previaGrupoPlannerTx(tx, previaGrupoPlannerSchema.parse({ ...consulta, grupo }));
    mocks.contextos.set(animais[200].id, { ...mocks.contextos.get(animais[200].id), del: 51 });
    await expect(incluirGrupoPlannerTx(tx, visita.id, incluirGrupoPlannerSchema.parse({ propriedadeId: 1, chave: randomUUID(), grupo, fingerprint: previa.fingerprint }), null)).rejects.toMatchObject({ code: "CONFLITO", campo: "fingerprint" });
    expect(mocks.adicionar).not.toHaveBeenCalled();
  });
  it("exclusões precisam pertencer ao grupo e não cortam os demais animais", async () => {
    const { tx, animais, visita } = fonte(3);
    const planner = await consultarPlannerTx(tx, consulta), grupo = planner.grupos[0].grupo;
    const previa = await previaGrupoPlannerTx(tx, previaGrupoPlannerSchema.parse({ ...consulta, grupo }));
    const input = incluirGrupoPlannerSchema.parse({ propriedadeId: 1, chave: randomUUID(), grupo, fingerprint: previa.fingerprint, excluidos: [animais[0].id] });
    expect(await incluirGrupoPlannerTx(tx, visita.id, input, null)).toMatchObject({ totalAnimais: 2, totalProcedimentos: 2 });
    await expect(incluirGrupoPlannerTx(tx, visita.id, { ...input, chave: randomUUID(), excluidos: [randomUUID()] }, null)).rejects.toMatchObject({ code: "VALIDACAO", campo: "excluidos" });
  });
  it("exposição do contexto não inclui payload financeiro, custos nem IDs de fatos de outro sítio", async () => {
    const { tx, animais } = fonte(1);
    mocks.contextos.set(animais[0].id, { ...mocks.contextos.get(animais[0].id), ultimaTentativa: { id: "outro-sitio", valorServicoAtribuido: "999" }, custoTotal: "999" });
    const planner = await consultarPlannerTx(tx, consulta), grupo = planner.grupos[0].grupo;
    const previa = await previaGrupoPlannerTx(tx, previaGrupoPlannerSchema.parse({ ...consulta, grupo }));
    expect(previa.animais[0]).not.toHaveProperty("ultimaTentativa");
    expect(previa.animais[0]).not.toHaveProperty("custoTotal");
  });
});
