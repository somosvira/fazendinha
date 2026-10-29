import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { exigeArea } from "../../middleware/permissao.js";
import { uid } from "../../lib/uid.fixture.js";

const mocks = vi.hoisted(() => ({ leitura: vi.fn(), escrita: vi.fn(), painel: vi.fn(), tentativa: vi.fn(), avaliacao: vi.fn(), detalheVisita: vi.fn(), confirmar: vi.fn(), programacoes: vi.fn(), programar: vi.fn(), iniciar: vi.fn(), reprogramar: vi.fn(), executar: vi.fn(), agenda: vi.fn(), previaPlanner: vi.fn(), tarefaVisita: vi.fn(), emitir: vi.fn(), obterEmissao: vi.fn(), indicadores: vi.fn(), partos: vi.fn(), pesoSecagem: vi.fn(), encerrarLactacao: vi.fn() }));
vi.mock("../../services/propriedade.js", async original => ({ ...await original<typeof import("../../services/propriedade.js")>(), resolverEscopoLeitura: mocks.leitura, resolverEscopoEscrita: mocks.escrita }));
vi.mock("../../services/pecuaria/reproducao/registros.js", async original => ({ ...await original<typeof import("../../services/pecuaria/reproducao/registros.js")>(), painelReproducao: mocks.painel, criarTentativa: mocks.tentativa, criarAvaliacao: mocks.avaliacao, encerrarLactacao: mocks.encerrarLactacao }));
vi.mock("../../services/pecuaria/reproducao/visitas.js", async original => ({ ...await original<typeof import("../../services/pecuaria/reproducao/visitas.js")>(), detalheVisita: mocks.detalheVisita, confirmarAtividade: mocks.confirmar, tarefaParticipanteVisita: mocks.tarefaVisita }));
vi.mock("../../services/pecuaria/reproducao/iatf.js", async original => ({ ...await original<typeof import("../../services/pecuaria/reproducao/iatf.js")>(), listarProgramacoes: mocks.programacoes, criarProgramacao: mocks.programar, iniciarParticipante: mocks.iniciar, reprogramarTarefa: mocks.reprogramar, executarTarefa: mocks.executar }));
vi.mock("../../services/pecuaria/reproducao/planner.js", async original => ({ ...await original<typeof import("../../services/pecuaria/reproducao/planner.js")>(), consultarAgenda: mocks.agenda, previaGrupoPlanner: mocks.previaPlanner }));
vi.mock("../../services/pecuaria/reproducao/emissoes-relatorios.js", async original => ({ ...await original<typeof import("../../services/pecuaria/reproducao/emissoes-relatorios.js")>(), criarEmissaoReprodutiva: mocks.emitir, obterEmissaoReprodutiva: mocks.obterEmissao }));
vi.mock("../../services/pecuaria/reproducao/indicadores.js", async original => ({ ...await original<typeof import("../../services/pecuaria/reproducao/indicadores.js")>(), consultarIndicadoresReprodutivos: mocks.indicadores }));
vi.mock("../../services/pecuaria/reproducao/relatorio-partos.js", async original => ({ ...await original<typeof import("../../services/pecuaria/reproducao/relatorio-partos.js")>(), emitirRelatorioPartos: mocks.partos }));
vi.mock("../../services/pecuaria/reproducao/peso-secagem.js", async original => ({ ...await original<typeof import("../../services/pecuaria/reproducao/peso-secagem.js")>(), manterPesoSecagem: mocks.pesoSecagem }));
import { rebanhoRouter } from "./rebanho.js";
import { PropriedadeError } from "../../services/propriedade.js";
import { RebanhoError } from "../../services/pecuaria/rebanho/regras.js";

const usuario = { id: 7, dono: false, areas: ["pecuaria"], flags: ["lancar"], abas: [] };
const app = (u: typeof usuario | null = usuario) => new Hono().use("*", async (c, next) => { if (u) c.set("usuario" as never, u as never); await next(); }).use("*", exigeArea("pecuaria")).route("/", rebanhoRouter);
const json = { "content-type": "application/json" };
const base = { chave: uid(1), animalId: uid(2), propriedadeId: 2, data: "2026-10-01" };
const payloadTentativa = { ...base, tipo: "IA", materialId: uid(3), origem: "DOCUMENTADA", justificativaSemOrigem: "Material documentado na ficha" };
const usuarioFinanceiro = { ...usuario, areas: ["pecuaria", "financeiro"], flags: ["lancar", "verValores"] };

beforeEach(() => {
  vi.resetAllMocks(); mocks.leitura.mockResolvedValue(2); mocks.escrita.mockResolvedValue(2);
  mocks.painel.mockResolvedValue({ animais: [], tentativas: [{ id: uid(1), quantidade: "1", valorProdutoAtribuido: "42.50", valorServicoAtribuido: "20" }] });
  mocks.tentativa.mockResolvedValue({ id: uid(1), quantidade: "1", valorProdutoAtribuido: "42.50", valorServicoAtribuido: "20" });
});

describe("V4: autorização e exposição de custos", () => {
  it("exige sessão e área, inclusive nas consultas", async () => {
    expect((await app(null).request("/reproducao")).status).toBe(401);
    expect((await app({ ...usuario, areas: ["estoque"] }).request("/reproducao")).status).toBe(403);
    expect(mocks.painel).not.toHaveBeenCalled();
  });
  it("bloqueia lançamento e confirmação coletiva sem a ação existente", async () => {
    const somenteLeitura = app({ ...usuario, flags: [] });
    for (const rota of ["/reproducao/tentativas", `/visitas/${uid(5)}/atividades/${uid(6)}/confirmacao`]) {
      expect((await somenteLeitura.request(rota, { method: "POST", headers: json, body: JSON.stringify(payloadTentativa) })).status).toBe(403);
    }
    expect(mocks.tentativa).not.toHaveBeenCalled(); expect(mocks.confirmar).not.toHaveBeenCalled();
  });
  it("expõe custos atribuídos na leitura e resposta de gravação para usuários de Pecuária", async () => {
    for (const u of [usuario, { ...usuario, flags: ["lancar", "verValores"] }, { ...usuario, areas: ["pecuaria", "financeiro"] }]) {
      const leitura = await app(u).request("/reproducao");
      expect(await leitura.json()).toMatchObject({ tentativas: [{ quantidade: "1", valorProdutoAtribuido: "42.50", valorServicoAtribuido: "20" }] });
      const escrita = await app(u).request("/reproducao/tentativas", { method: "POST", headers: json, body: JSON.stringify(payloadTentativa) });
      expect(escrita.status).toBe(201);
      expect(await escrita.json()).toMatchObject({ quantidade: "1", valorProdutoAtribuido: "42.50", valorServicoAtribuido: "20" });
    }
    expect(await (await app(usuarioFinanceiro).request("/reproducao")).json()).toMatchObject({ tentativas: [{ valorProdutoAtribuido: "42.50" }] });
  });
  it("impede atribuir ou limpar custo sem permissão, inclusive nos dados coletivos", async () => {
    for (const valorServicoAtribuido of [20, 0, null]) {
      expect((await app().request("/reproducao/tentativas", { method: "POST", headers: json, body: JSON.stringify({ ...payloadTentativa, valorServicoAtribuido }) })).status).toBe(403);
    }
    const item = { participanteId: uid(9), dados: { ...payloadTentativa, valorServicoAtribuido: 20 } };
    expect((await app().request(`/visitas/${uid(5)}/atividades/${uid(6)}/confirmacao`, { method: "POST", headers: json, body: JSON.stringify({ propriedadeId: 2, chave: uid(8), itens: [item] }) })).status).toBe(403);
    expect(mocks.tentativa).not.toHaveBeenCalled(); expect(mocks.confirmar).not.toHaveBeenCalled();
  });
  it("transmite escopo resolvido e autoria ao serviço", async () => {
    await app().request("/reproducao/tentativas", { method: "POST", headers: json, body: JSON.stringify(payloadTentativa) });
    expect(mocks.escrita).toHaveBeenCalledWith(expect.anything(), 2);
    expect(mocks.tentativa).toHaveBeenCalledWith(expect.objectContaining({ propriedadeId: 2, animalId: uid(2) }), 7);
    await app().request(`/reproducao/animais/${uid(2)}`);
    expect(mocks.painel).toHaveBeenCalledWith(2, uid(2));
  });
  it("mantém estado clínico transversal sem expor custo do sítio anterior", async () => {
    mocks.painel.mockResolvedValue({
      animais: [{ ultimaTentativa: { propriedadeId: 3, valorProdutoAtribuido: "999.00", valorServicoAtribuido: "20.00", data: "2026-01-01" } }],
      tentativas: [{ propriedadeId: 2, valorProdutoAtribuido: "0.00", valorServicoAtribuido: null }],
    });
    for (const u of [{ ...usuario, flags: [] }, usuarioFinanceiro]) {
      const resposta = await app(u).request(`/reproducao/animais/${uid(2)}`);
      expect(resposta.status).toBe(200);
      expect(await resposta.json()).toEqual({
        animais: [{ ultimaTentativa: { propriedadeId: 3, valorProdutoAtribuido: null, valorServicoAtribuido: null, data: "2026-01-01" } }],
        tentativas: [{ propriedadeId: 2, valorProdutoAtribuido: "0.00", valorServicoAtribuido: null }],
      });
    }
  });
  it("recusa escopo inválido antes da escrita e não expõe fato de outro sítio", async () => {
    mocks.escrita.mockRejectedValue(new PropriedadeError("ESCOPO_INVALIDO", "Sítio inválido"));
    expect((await app().request("/reproducao/tentativas", { method: "POST", headers: json, body: JSON.stringify(payloadTentativa) })).status).toBe(400);
    expect(mocks.tentativa).not.toHaveBeenCalled();
    mocks.detalheVisita.mockRejectedValue(new RebanhoError("NAO_ENCONTRADO", "Visita não encontrada neste sítio"));
    expect((await app().request(`/visitas/${uid(5)}`)).status).toBe(404);
    expect(mocks.detalheVisita).toHaveBeenCalledWith(uid(5), 2);
  });
  it("mascara snapshots aninhados de visitas e conserva anotações e quantidades", async () => {
    mocks.detalheVisita.mockResolvedValue({ atividades: [{ contexto: { valorTotal: "500" }, participantes: [{ rascunho: { quantidade: 1, valorServicoAtribuido: "30", anotacaoOriginal: "P+" } }] }] });
    expect(await (await app().request(`/visitas/${uid(5)}`)).json()).toEqual({ atividades: [{ contexto: { valorTotal: null }, participantes: [{ rascunho: { quantidade: 1, valorServicoAtribuido: "30", anotacaoOriginal: "P+" } }] }] });
  });
  it("protege custos nas programações e responde 404 para uma programação ausente no escopo", async () => {
    mocks.programacoes.mockResolvedValue([{ id: uid(4), participantes: [{ tarefas: [{ realizado: { quantidade: 1, valorServicoAtribuido: "30" } }] }] }]);
    const resposta = await app().request(`/reproducao/programacoes/${uid(4)}`);
    expect(resposta.status).toBe(200);
    expect(await resposta.json()).toMatchObject({ participantes: [{ tarefas: [{ realizado: { quantidade: 1, valorServicoAtribuido: "30" } }] }] });
    expect(mocks.programacoes).toHaveBeenCalledWith(2, uid(4));
    mocks.programacoes.mockResolvedValue([]);
    expect((await app().request(`/reproducao/programacoes/${uid(4)}`)).status).toBe(404);
  });
  it("recusa resultados desconhecidos e lotes acima de 100 sem gravar", async () => {
    expect((await app().request("/reproducao/avaliacoes", { method: "POST", headers: json, body: JSON.stringify({ ...base, resultado: "IATFCL" }) })).status).toBe(422);
    expect(mocks.avaliacao).not.toHaveBeenCalled();
    const itens = Array.from({ length: 101 }, (_, i) => ({ participanteId: uid(100 + i), status: "NAO_ATENDIDO", motivo: "Animal ausente" }));
    expect((await app().request(`/visitas/${uid(5)}/atividades/${uid(6)}/confirmacao`, { method: "POST", headers: json, body: JSON.stringify({ propriedadeId: 2, chave: uid(8), itens }) })).status).toBe(422);
    expect(mocks.confirmar).not.toHaveBeenCalled();
  });
});

it("IATF aceita somente data nos quatro fluxos HTTP e preserva autoria e escopo", async()=>{
  for(const f of [mocks.programar,mocks.iniciar,mocks.reprogramar,mocks.executar])f.mockResolvedValue({id:uid(8)});
  const entradas = [
    {rota:"/reproducao/programacoes",corpo:{chave:uid(1),propriedadeId:2,protocoloId:uid(3),nome:"Programação",inicioPrevisto:"2026-10-01",animais:[{animalId:uid(2)}]}},
    {rota:`/reproducao/participantes-iatf/${uid(3)}/inicio`,corpo:{propriedadeId:2,inicioEfetivo:"2026-10-01"}},
    {rota:`/reproducao/tarefas-iatf/${uid(3)}/reprogramacao`,corpo:{propriedadeId:2,previstaEm:"2026-10-01",motivo:"Agenda revisada pela equipe"}},
    {rota:`/reproducao/tarefas-iatf/${uid(3)}/execucao`,corpo:{chave:uid(1),propriedadeId:2,realizadaEm:"2026-10-01",dados:{}}},
  ];
  for(const {rota,corpo} of entradas){
    const r=await app().request(rota,{method:"POST",headers:json,body:JSON.stringify(corpo)});
    expect(r.status).toBeLessThan(300);
  }
  expect(mocks.programar).toHaveBeenCalledWith(expect.objectContaining({inicioPrevisto:"2026-10-01",propriedadeId:2}),7);
  expect(mocks.iniciar).toHaveBeenCalledWith(uid(3),2,"2026-10-01",7,undefined);
  expect(mocks.executar).toHaveBeenCalledWith(uid(3),expect.objectContaining({realizadaEm:"2026-10-01",propriedadeId:2}),7);
});

describe("manejo: consultas disponíveis ao leitor e emissão autorizada", () => {
  it("consulta planner, tarefa futura específica, indicadores e partos sem lançar", async () => {
    const leitor = app({ ...usuario, flags: [] });
    mocks.previaPlanner.mockResolvedValue({ total: 1, animais: [] });
    mocks.tarefaVisita.mockResolvedValue({ origem: "REPRODUTIVA", tarefa: { valorServicoAtribuido: 42, quantidade: 1 } });
    mocks.indicadores.mockResolvedValue({ periodos: [] });
    mocks.partos.mockResolvedValue({ partos: [] });
    const grupo = { origem: "PROTOCOLO", identidade: "a".repeat(64) };
    const consulta = new URLSearchParams({ grupo: JSON.stringify(grupo), propriedadeId: "999", data: "2026-10-14" });
    expect((await leitor.request(`/visitas/planner/previa?${consulta}`)).status).toBe(200);
    expect(mocks.previaPlanner).toHaveBeenCalledWith(expect.objectContaining({ propriedadeId: 2, grupo }));
    const tarefa = await leitor.request(`/visitas/${uid(1)}/participantes/${uid(2)}/tarefa?propriedadeId=999`);
    expect(tarefa.status).toBe(200);
    expect(await tarefa.json()).toMatchObject({ tarefa: { valorServicoAtribuido: 42, quantidade: 1 } });
    expect(mocks.tarefaVisita).toHaveBeenCalledWith(uid(1), uid(2), 2);
    expect((await leitor.request("/reproducao/indicadores?inicio=2026-01-01&fim=2026-01-21&corte=2026-03-01")).status).toBe(200);
    expect((await leitor.request("/reproducao/relatorios/partos?inicio=2026-01-01&fim=2026-01-21")).status).toBe(200);
  });
  it("recusa prévia malformada e protege snapshots por sítio sem recalcular", async () => {
    expect((await app().request("/visitas/planner/previa?data=2026-10-14&grupo=%7B")).status).toBe(422);
    expect(mocks.previaPlanner).not.toHaveBeenCalled();
    mocks.obterEmissao.mockRejectedValue(new RebanhoError("NAO_ENCONTRADO", "Emissão não encontrada neste sítio"));
    expect((await app({ ...usuario, flags: [] }).request(`/reproducao/relatorios/emissoes/${uid(8)}`)).status).toBe(404);
    expect(mocks.obterEmissao).toHaveBeenCalledWith(uid(8), 2);
    expect(mocks.indicadores).not.toHaveBeenCalled(); expect(mocks.partos).not.toHaveBeenCalled();
  });
  it("salvar emissão exige lançamento, autoria e escopo de escrita", async () => {
    const body = { chave: uid(3), propriedadeId: 2, tipo: "PARTOS", filtros: { inicio: "2026-01-01", fim: "2026-01-21" } };
    const request = { method: "POST", headers: json, body: JSON.stringify(body) };
    expect((await app({ ...usuario, flags: [] }).request("/reproducao/relatorios/emissoes", request)).status).toBe(403);
    expect(mocks.emitir).not.toHaveBeenCalled();
    mocks.emitir.mockResolvedValue({ id: uid(8) });
    expect((await app().request("/reproducao/relatorios/emissoes", request)).status).toBe(201);
    expect(mocks.emitir).toHaveBeenCalledWith(body, 7);
  });
});

describe("agenda e seleção livre autorizadas",()=>{
 it("mantém agenda exclusiva em consulta de leitura",async()=>{
  mocks.agenda.mockResolvedValue({grupos:[],totalGrupos:0,totais:{animaisUnicos:0,procedimentos:0}});
  const r=await app({...usuario,flags:[]}).request("/visitas/agenda?data=2026-10-14");expect(r.status).toBe(200);expect(mocks.agenda).toHaveBeenCalledWith(expect.objectContaining({propriedadeId:2,data:"2026-10-14"}));
 });
 it("prévia livre é leitura mesmo com POST e nunca aceita outro sítio",async()=>{
  const grupo={origem:"LIVRE",nome:"Grupo teste",tipo:"AVALIACAO_REPRODUTIVA",criterios:{versao:2,todas:[],qualquer:[],ordenacao:[{campo:"BRINCO",direcao:"ASC"}],politicaDesconhecidos:"EXCLUIR"}};
  mocks.previaPlanner.mockResolvedValue({total:0,animais:[]});const leitor=app({...usuario,flags:[]});
  expect((await leitor.request("/visitas/selecoes/previa",{method:"POST",headers:json,body:JSON.stringify({propriedadeId:2,data:"2026-10-14",grupo})})).status).toBe(200);
  expect(mocks.escrita).not.toHaveBeenCalled();mocks.previaPlanner.mockClear();
  expect((await leitor.request("/visitas/selecoes/previa",{method:"POST",headers:json,body:JSON.stringify({propriedadeId:3,data:"2026-10-14",grupo})})).status).toBe(422);expect(mocks.previaPlanner).not.toHaveBeenCalled();
  expect((await app(null).request("/visitas/selecoes/previa",{method:"POST",headers:json,body:"{}"})).status).toBe(401);
 });
});

it("participações da ficha exigem animal válido e sessão, aplicam escopo e apresentam custos atribuídos", async () => {
  const caminho = `/reproducao/participacoes?animalId=${uid(2)}`;
  expect((await app(null).request(caminho)).status).toBe(401);
  expect((await app({ ...usuario, areas: ["estoque"] }).request(caminho)).status).toBe(403);
  expect((await app().request("/reproducao/participacoes?animalId=invalido")).status).toBe(422);
  expect(mocks.programacoes).not.toHaveBeenCalled();
  mocks.programacoes.mockResolvedValue([{ id:uid(4),participantes:[{animalId:uid(2),tarefas:[{realizadoSnapshot:{valorServicoAtribuido:"30"}}]}] }]);
  const resposta = await app().request(caminho);
  expect(resposta.status).toBe(200);
  expect(mocks.programacoes).toHaveBeenCalledWith(2,undefined,uid(2));
  expect(await resposta.json()).toMatchObject([{participantes:[{tarefas:[{realizadoSnapshot:{valorServicoAtribuido:"30"}}]}]}]);
});

describe("peso da secagem: rota e contrato autorizado", () => {
  const caminho = `/reproducao/lactacoes/${uid(2)}/peso-secagem`;
  const input = { chave: uid(1), propriedadeId: 2, motivo: "Vincular peso conferido no encerramento", pesoSecagem: { acao: "VINCULAR", pesagemId: uid(3) } };
  it("conserva sessão/área/lançar, escopo e autoria reais no envelope", async () => {
    expect((await app(null).request(caminho,{method:"POST",headers:json,body:JSON.stringify(input)})).status).toBe(401);
    expect((await app({...usuario,flags:[]}).request(caminho,{method:"POST",headers:json,body:JSON.stringify(input)})).status).toBe(403);
    expect(mocks.pesoSecagem).not.toHaveBeenCalled();
    mocks.pesoSecagem.mockResolvedValue({id:uid(2),vinculosPesagemSecagem:[]});
    expect((await app().request(caminho,{method:"POST",headers:json,body:JSON.stringify(input)})).status).toBe(200);
    expect(mocks.pesoSecagem).toHaveBeenCalledWith(uid(2),expect.objectContaining(input),7);
  });
  it("valida chave e preserva conflito de associação como 409", async () => {
    expect((await app().request(caminho,{method:"POST",headers:json,body:JSON.stringify({...input,chave:undefined})})).status).toBe(422);
    expect(mocks.pesoSecagem).not.toHaveBeenCalled();
    mocks.pesoSecagem.mockRejectedValue(new RebanhoError("CONFLITO","Outro peso ativo neste encerramento","pesoSecagem"));
    expect((await app().request(caminho,{method:"POST",headers:json,body:JSON.stringify(input)})).status).toBe(409);
  });
  it("encerramento encaminha a opção opcional de peso e a chave sem mudar sua identidade", async () => {
    mocks.encerrarLactacao.mockResolvedValue({id:uid(2)});
    const r=await app().request(`/reproducao/lactacoes/${uid(2)}/encerramento`,{method:"POST",headers:json,body:JSON.stringify({...input,data:"2026-10-20"})});
    expect(r.status).toBe(200);
    expect(mocks.encerrarLactacao).toHaveBeenCalledWith(uid(2),2,"2026-10-20",input.motivo,7,{chave:uid(1),pesoSecagem:input.pesoSecagem});
  });
});
