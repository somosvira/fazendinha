// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { navegarPara } from "./router";
import { registrarGuardaNavegacao } from "./navegacaoGuardada";
import { App } from "./App";
import { getPropriedadeAtiva, setPropriedadeAtiva } from "./propriedadeScope";
import { setSessao, type UsuarioSessao } from "./lib/auth";

vi.mock("./components/AppSidebar", () => ({
  AppSidebar: (props: { propAtiva: number | null; onTrocarProp: (id:number|null) => void; onNav: (tab: "gerencial" | "config") => void }) => <aside>
    <span>Sítio ativo: {props.propAtiva ?? "consolidado"}</span>
    <button onClick={() => props.onTrocarProp(2)}>Selecionar sítio 2</button>
    <button onClick={() => props.onTrocarProp(null)}>Selecionar consolidado</button>
    <button onClick={() => props.onNav("gerencial")}>Abrir painel</button>
    <button onClick={() => props.onNav("config")}>Abrir configurações</button>
  </aside>,
}));
vi.mock("./pecuaria/rebanho/nutricao/Nutricao", () => ({ Nutricao: () => <div>
  <p>Nutrição de origem</p>
  <button onClick={() => navegarPara('/pecuaria/bezerreiro?aba=alimentacao&propriedadeId=1&data=2026-10-26&animalId=cria-1')}>Abrir oferta no Bezerreiro</button>
</div> }));
vi.mock("./pecuaria/rebanho/bezerreiro/BezerreiroModulo", () => ({ BezerreiroModulo: () => <p>Bezerreiro sítio: {getPropriedadeAtiva() ?? 'consolidado'}</p> }));
vi.mock("./gerencial/PainelGerencial", () => ({
  PainelGerencial: ({ propriedadeId }: { propriedadeId: number | null }) => <p>Painel sítio: {propriedadeId ?? "consolidado"}</p>,
}));
vi.mock("./components/ConfiguracoesHub", () => ({ ConfiguracoesHub: () => <p>Configurações abertas</p> }));
vi.mock("./financeiro/FinanceiroContent", () => ({ FinanceiroContent: ({ tab }: { tab: string }) => <p>Financeiro aberto: {tab}</p> }));
vi.mock("./estoque/ProdutoEstoqueDetalhe", () => ({ ProdutoEstoqueDetalhe: () => <p>Origem de estoque</p> }));
vi.mock("./api/auth", () => ({ fetchMe: vi.fn(() => new Promise(() => {})), logout: vi.fn() }));
vi.mock("./financeiro/rascunhoAtivo", async original => ({
  ...await original<typeof import("./financeiro/rascunhoAtivo")>(),
  useRascunhoAtivo: () => ({ rascunho: null, conhecido: true, editando: false, recuperacao: null }),
}));
vi.mock("./financeiro/rascunhoRelatorioAtivo", async original => ({
  ...await original<typeof import("./financeiro/rascunhoRelatorioAtivo")>(),
  useRascunhoRelatorioAtivo: () => ({ rascunho: null, conhecido: true, editando: false, recuperacao: null }),
}));
vi.mock("./components/CommandPalette", () => ({ CommandPalette: () => null }));
vi.mock("./components/ChatWidget", () => ({ ChatWidget: () => null }));

const usuario: UsuarioSessao = {
  id: 5, nome: "Gestor", email: "gestor@example.test", papel: "proprietario", dono: true,
  abas: ["dashboard"], areas: ["pecuaria", "financeiro"], flags: [], status: "ATIVO",
};

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  setSessao("token-teste", usuario);
  setPropriedadeAtiva(2);
  window.history.replaceState(null, "", "/configuracoes");
});
afterEach(() => { cleanup(); localStorage.clear(); setPropriedadeAtiva(null); });

describe("App — contexto do painel administrativo", () => {
  it("mantém o sítio selecionado ao entrar pelo menu e ao voltar pelo histórico", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir painel" }));
    await screen.findByText("Painel sítio: 2");
    await waitFor(() => expect(new URLSearchParams(location.search).get("propriedadeId")).toBe("2"));
    expect(getPropriedadeAtiva()).toBe(2);

    fireEvent.click(screen.getByRole("button", { name: "Abrir configurações" }));
    await screen.findByText("Configurações abertas");
    await act(async () => { window.history.back(); });
    await screen.findByText("Painel sítio: 2");
    expect(new URLSearchParams(location.search).get("propriedadeId")).toBe("2");
    expect(getPropriedadeAtiva()).toBe(2);
  });

  it("interpreta acesso direto sem sítio como consolidado mesmo após outra seleção", async () => {
    window.history.replaceState(null, "", "/gerencial");
    render(<App />);
    await screen.findByText("Painel sítio: consolidado");
    expect(getPropriedadeAtiva()).toBeNull();
  });

  it("restaura o sítio explícito da URL ao carregar o painel", async () => {
    window.history.replaceState(null, "", "/gerencial?propriedadeId=1");
    render(<App />);
    await screen.findByText("Painel sítio: 1");
    expect(getPropriedadeAtiva()).toBe(1);
  });

  it("não altera a inicialização do escopo de outras páginas", async () => {
    window.history.replaceState(null, "", "/configuracoes?propriedadeId=1");
    render(<App />);
    await screen.findByText("Sítio ativo: 2");
    expect(getPropriedadeAtiva()).toBe(2);
  });

  it("restaura o sítio do link de origem em uma carga completa do detalhe de estoque", async () => {
    setPropriedadeAtiva(null);
    window.history.replaceState(null, "", "/estoque/produtos/produto-teste?propriedadeId=1");
    render(<App />);
    await screen.findByText("Origem de estoque");
    expect(getPropriedadeAtiva()).toBe(1);
    expect(screen.getByText("Sítio ativo: 1")).toBeTruthy();
  });

  it("abre compromissos no sítio do link do painel em uma carga completa", async () => {
    setPropriedadeAtiva(null);
    setSessao("token-teste", { ...usuario, abas: ["dashboard", "gastos"] });
    window.history.replaceState(null, "", "/financeiro/compromissos?situacao=pagar&propriedadeId=1");
    render(<App />);
    await screen.findByText("Financeiro aberto: gastos");
    expect(getPropriedadeAtiva()).toBe(1);
    expect(screen.getByText("Sítio ativo: 1")).toBeTruthy();
    expect(new URLSearchParams(location.search).get("situacao")).toBe("pagar");
    expect(new URLSearchParams(location.search).get("propriedadeId")).toBe("1");
  });
});


describe("App — sítio do atalho Nutrição → Bezerreiro", () => {
  it("adota o sítio explícito ao abrir a oferta por SPA a partir do consolidado e conserva filtros", async () => {
    setPropriedadeAtiva(null);
    window.history.replaceState(null, '', '/pecuaria/nutricao');
    render(<App/>);
    await screen.findByText('Nutrição de origem');
    expect(screen.getByText('Sítio ativo: consolidado')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', {name:'Abrir oferta no Bezerreiro'}));
    await screen.findByText('Bezerreiro sítio: 1');
    expect(screen.getByText('Sítio ativo: 1')).toBeTruthy(); expect(getPropriedadeAtiva()).toBe(1);
    expect(Object.fromEntries(new URLSearchParams(location.search))).toEqual({aba:'alimentacao',propriedadeId:'1',data:'2026-10-26',animalId:'cria-1'});
  });
  it.each(['', '?propriedadeId=invalido', '?propriedadeId=0', '?propriedadeId=-1', '?propriedadeId=2147483648'])("preserva o sítio selecionado quando o destino não especifica sítio válido: %s", async query => {
    window.history.replaceState(null, '', '/pecuaria/nutricao'); render(<App/>); await screen.findByText('Nutrição de origem');
    act(() => navegarPara('/pecuaria/bezerreiro'+query));
    await screen.findByText('Bezerreiro sítio: 2'); expect(getPropriedadeAtiva()).toBe(2);
  });
  it("aguarda a guarda antes de adotar o sítio e mantém o contexto quando a saída é recusada", async () => {
    setPropriedadeAtiva(null); window.history.replaceState(null, '', '/pecuaria/nutricao'); render(<App/>); await screen.findByText('Nutrição de origem');
    let concluir!: (ok:boolean) => void;
    const guarda=vi.fn(()=>new Promise<boolean>(resolve=>{concluir=resolve;})), remover=registrarGuardaNavegacao(guarda);
    try {
      fireEvent.click(screen.getByRole('button',{name:'Abrir oferta no Bezerreiro'}));
      await waitFor(()=>expect(guarda).toHaveBeenCalledOnce());
      expect(getPropriedadeAtiva()).toBeNull(); expect(screen.getByText('Nutrição de origem')).toBeTruthy();
      await act(async()=>{concluir(false);});
      expect(getPropriedadeAtiva()).toBeNull(); expect(screen.getByText('Sítio ativo: consolidado')).toBeTruthy();
    } finally {remover();}
  });
  it("sincroniza o sítio do link quando o shell muda a seleção sem perder os demais filtros", async () => {
    window.history.replaceState(null, '', '/pecuaria/bezerreiro?aba=alimentacao&propriedadeId=1&data=2026-10-26&animalId=cria-1'); render(<App/>); await screen.findByText('Bezerreiro sítio: 1');
    fireEvent.click(screen.getByRole('button',{name:'Selecionar sítio 2'})); await screen.findByText('Bezerreiro sítio: 2');
    expect(Object.fromEntries(new URLSearchParams(location.search))).toEqual({aba:'alimentacao',propriedadeId:'2',data:'2026-10-26',animalId:'cria-1'});
    act(()=>navegarPara(location.pathname+location.search+'&pagina=2')); await screen.findByText('Bezerreiro sítio: 2'); expect(getPropriedadeAtiva()).toBe(2);
    fireEvent.click(screen.getByRole('button',{name:'Selecionar consolidado'})); await screen.findByText('Bezerreiro sítio: consolidado');
    expect(new URLSearchParams(location.search).has('propriedadeId')).toBe(false); expect(new URLSearchParams(location.search).get('data')).toBe('2026-10-26');
  });
  it("também aguarda a guarda em troca de sítio por URL dentro da própria aba Bezerreiro", async () => {
    window.history.replaceState(null, '', '/pecuaria/bezerreiro?propriedadeId=1'); render(<App/>); await screen.findByText('Bezerreiro sítio: 1');
    let concluir!: (ok:boolean) => void;
    const guarda=vi.fn(()=>new Promise<boolean>(resolve=>{concluir=resolve;})), remover=registrarGuardaNavegacao(guarda);
    try {
      act(()=>navegarPara('/pecuaria/bezerreiro?aba=alimentacao&propriedadeId=2&data=2026-10-26'));
      await waitFor(()=>expect(guarda).toHaveBeenCalledOnce()); expect(getPropriedadeAtiva()).toBe(1);
      await act(async()=>{concluir(true);});
      await screen.findByText('Bezerreiro sítio: 2'); expect(screen.getByText('Sítio ativo: 2')).toBeTruthy();
    } finally {remover();}
  });
});
