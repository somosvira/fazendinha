// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Iatf } from "./Iatf";
import { listarCadastrosProtocolos, obterCadastroProtocolo, obterAcoesCadastro, type CadastroProtocoloMeta } from "../protocolos/cadastros-api";
import { reqV4 } from "./api";
import { setPropriedadeAtiva } from "../../../propriedadeScope";
vi.mock("../protocolos/cadastros-api", () => ({ listarCadastrosProtocolos: vi.fn(), obterCadastroProtocolo: vi.fn(), obterAcoesCadastro: vi.fn() }));
beforeEach(() => { vi.mocked(listarCadastrosProtocolos).mockResolvedValue({ itens: [], total: 0, pagina: 1, porPagina: 10 }); });
vi.mock("./api",()=>({reqV4:vi.fn()}));
vi.mock("../protocolos/api", async original => ({ ...await original<typeof import("../protocolos/api")>(), obterCabecalhoProtocolo: vi.fn().mockImplementation(async (contexto: { programacaoId: string }) => ({ id: contexto.programacaoId, nome: contexto.programacaoId === "um" ? "Primeira programação" : "Segunda programação", modo: "COLETIVO", tipo: "REPRODUTIVO", protocolo: { id: "p", nome: "Protocolo", versao: 1 }, contagens: {}, inicioReferencia: "2026-10-19", precisaoTemporal: "DIA" })), reqProtocolo: vi.fn().mockResolvedValue({ itens: [], total: 0, pagina: 1, porPagina: 10 }), obterEtapasProtocolo: vi.fn().mockResolvedValue({ itens: [], total: 0, pagina: 1, porPagina: 10 }) }));
vi.mock("../protocolos/ProcedimentosProtocolo", () => ({ ProcedimentosProtocolo: () => null }));
vi.mock("../../../estoque/api",()=>({listarProdutos:vi.fn().mockResolvedValue([])}));
vi.mock("../api",()=>({listarMaterialGenetico:vi.fn().mockResolvedValue([])}));
afterEach(() => { cleanup(); setPropriedadeAtiva(null); });
it("abre programação de outro retorno por popstate sem remontar",async()=>{
  vi.mocked(reqV4).mockImplementation(async path=>path.endsWith("/um") ? {id:"um",nome:"Primeira programação",participantes:[]} : path.endsWith("/dois") ? {id:"dois",nome:"Segunda programação",participantes:[]} : []);
  window.history.replaceState(null,"","/pecuaria/reproducao?programacaoId=um");
  render(<Iatf animais={[]} painel={{animais:[],tentativas:[],avaliacoes:[],partos:[],restricoes:[]}} podeLancar={false} />);
  await screen.findByText(/Primeira programação/);
  window.history.pushState(null,"","/pecuaria/reproducao?programacaoId=dois");
  fireEvent(window,new PopStateEvent("popstate"));
  expect(await screen.findByText(/Segunda programação/)).toBeTruthy();
});

it.each(["Editar rascunho","Nova versão"])("%s envia apenas parâmetros editáveis e preserva exame planejado",async acao=>{
  vi.clearAllMocks();
  const etapas=[{nome:"Avaliação",tipo:"AVALIACAO",intervalo:30,unidade:"DIAS",planoAvaliacao:{tipo:"DIAGNOSTICO",tipoExameId:"exame"},referencias:{tipoExameNome:"Exame congelado"}}];
  vi.mocked(reqV4).mockImplementation(async(_path,body)=>_path.startsWith("/reproducao/biblioteca")?[]:body?{}:[{id:"protocolo",nome:"Modelo",versao:1,publicado:false,ativo:true,etapas}]);
  const meta: CadastroProtocoloMeta = { id: "protocolo", nome: "Modelo", tipo: "REPRODUTIVO", versao: 1, publicado: false, publicadoEm: null, ativo: true, descricao: null, atualizadoEm: "2026-10-21T12:00:00.000Z", totalEtapas: 1, utilizada: false, proximaVersao: 2 };
  vi.mocked(listarCadastrosProtocolos).mockResolvedValue({ itens: [meta], total: 1, pagina: 1, porPagina: 10 });
  vi.mocked(obterCadastroProtocolo).mockResolvedValue(meta);
  vi.mocked(obterAcoesCadastro).mockResolvedValue({ itens: etapas.map((e, i) => ({ ...e, ordem: i + 1 })), total: 1, pagina: 1, porPagina: 10 });
  render(<Iatf modo="cadastros" podeLancar propriedadeId={7}/>);
  fireEvent.click(await screen.findByRole("button",{name:acao}));
  await waitFor(() => expect(screen.getByRole("button", { name: "Salvar" })).toHaveProperty("disabled", false));
  fireEvent.click(screen.getByRole("button",{name:"Salvar"}));
  await waitFor(()=>expect(vi.mocked(reqV4).mock.calls.some(([,body])=>!!body)).toBe(true));
  const [path,body,method]=vi.mocked(reqV4).mock.calls.find(([,body])=>!!body)!;
  expect(path).toBe(acao==="Editar rascunho"?"/reproducao/protocolos/protocolo":"/reproducao/protocolos");
  expect(method).toBe(acao==="Editar rascunho"?"PATCH":"POST");
  expect(body).toMatchObject({versao:acao==="Editar rascunho"?1:2,etapas:[{nome:"Avaliação",tipo:"AVALIACAO",intervalo:30,unidade:"DIAS",planoAvaliacao:{tipo:"DIAGNOSTICO",tipoExameId:"exame"}}]});
  expect(JSON.stringify(body)).not.toContain("referencias");
});

it.each([
  { propriedadeId: undefined, sitioEsperado: 7 },
  { propriedadeId: 9, sitioEsperado: 9 },
])("copia a referência no sítio $sitioEsperado usando o contexto disponível", async ({ propriedadeId, sitioEsperado }) => {
  vi.clearAllMocks();
  setPropriedadeAtiva(7);
  window.history.replaceState(null, "", "/configuracoes/pecuaria/reproducao/protocolos");
  const referencia = {
    id: "referencia", nome: "Referência técnica", familia: "Família", versaoReferencia: "1",
    fonte: { titulo: "Publicação técnica", url: "https://example.org/referencia", pagina: 1, data: "2026-01-01", consultadaEm: "2026-10-16" },
    objetivo: "Conferir manejo", populacaoIndicada: "Matrizes", camposACompletar: ["Produtos e doses"], observacoes: [],
  };
  vi.mocked(reqV4).mockImplementation(async path => path === "/reproducao/biblioteca" ? [referencia] : []);
  render(<Iatf modo="cadastros" podeLancar propriedadeId={propriedadeId} />);
  await screen.findByText("Referência técnica");
  fireEvent.click(screen.getByText("Biblioteca de referências reprodutivas"));
  fireEvent.change(screen.getByLabelText("Nome do novo rascunho"), { target: { value: "Manejo da fazenda" } });
  fireEvent.change(screen.getByLabelText("Versão do novo rascunho"), { target: { value: "1" } });
  fireEvent.click(screen.getByRole("button", { name: "Copiar como rascunho" }));
  await waitFor(() => expect(reqV4).toHaveBeenCalledWith(
    "/reproducao/biblioteca/referencia/copiar",
    expect.objectContaining({ propriedadeId: sitioEsperado, nome: "Manejo da fazenda", versao: 1 }),
    "POST", sitioEsperado,
  ));
  expect(screen.queryByText("Selecione um sítio para registrar a autoria da cópia.")).toBeNull();
});
