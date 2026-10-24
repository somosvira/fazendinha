// @vitest-environment jsdom
import { useState } from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { BuilderEtapasProtocolo, type AcaoBuilderEtapas } from "./BuilderEtapasProtocolo";
import { obterAcoesCadastro, type CadastroProtocoloMeta } from "./cadastros-api";

vi.mock("./cadastros-api", () => ({ obterAcoesCadastro: vi.fn() }));
type Acao = AcaoBuilderEtapas & { nome: string; dia: number };
const momento = { nome: "Preparação", ordem: 1, modoAtendimento: "MANUAL" as const };
const acao = (i: number): Acao => ({ chaveEdicao: `acao-${i}`, ordem: i + 1, nome: `Ação ${i + 1}`, dia: 0, momento: { ...momento } });
const origem: CadastroProtocoloMeta = { id: "p", nome: "Modelo", descricao: null, tipo: "SANITARIO", versao: 1, ativo: true, publicado: false, publicadoEm: null, atualizadoEm: "2026-10-23T12:00:00.000Z", totalEtapas: 11, utilizada: false };
const completo = vi.fn();
function Editor({ iniciais, fonte = null, indiceErro, aoMudar }: { iniciais: Acao[]; fonte?: CadastroProtocoloMeta | null; indiceErro?: number; aoMudar?: (itens: Acao[]) => void }) {
  const [itens, setItens] = useState(iniciais);
  return <BuilderEtapasProtocolo origem={fonte} itens={itens} onChange={novos => { setItens(novos); aoMudar?.(novos); }} converter={item => ({ ...item, chaveEdicao: `acao-${item.ordem! - 1}` })} onCompletoChange={completo} criarAcao={(m, referencia) => ({ ...acao(itens.length), dia: referencia?.dia ?? 0, momento: m })} indiceErro={indiceErro} renderizarCalendario={(item, indices) => <label>Intervalo da etapa<input type="number" value={item.dia} onChange={e => setItens(itens.map((v, i) => indices.includes(i) ? { ...v, dia: Number(e.target.value) } : v))} /></label>} renderizarAcao={(item, indice) => <label>Nome {item.chaveEdicao}<input value={item.nome} onChange={e => setItens(itens.map((v, i) => i === indice ? { ...v, nome: e.target.value } : v))} /></label>} />;
}
const editor = () => within(screen.getByRole("region", { name: "Etapa selecionada" }));
beforeEach(() => { vi.clearAllMocks(); });
afterEach(cleanup);

it("agrupa pelo momento explícito e sua ordem, nunca pela data coincidente", () => {
  render(<Editor iniciais={[{ ...acao(0), momento: { ...momento, nome: "Última", ordem: 4 } }, { ...acao(1), momento: { ...momento, nome: "Primeira", ordem: 2 } }, { ...acao(2), momento: null }, { ...acao(3), momento: null }]} />);
  const lista = within(screen.getByRole("region", { name: "Etapas do modelo" }));
  const etapas = lista.getAllByRole("button").filter(b => b.hasAttribute("aria-pressed"));
  expect(etapas).toHaveLength(4);
  expect(etapas[0].textContent).toContain("Primeira");
  expect(editor().getByLabelText("Nome acao-1")).toBeTruthy();
  expect(editor().queryByLabelText("Nome acao-0")).toBeNull();
  fireEvent.click(lista.getByRole("button", { name: /Ação legada 3/ }));
  expect(editor().queryByLabelText("Nome da etapa")).toBeNull();
  fireEvent.click(editor().getByRole("button", { name: "Organizar como etapa" }));
  expect(editor().getByLabelText("Nome da etapa")).toHaveProperty("value", "Etapa 5");
  expect(editor().getByRole("radio", { name: /Manual/ })).toHaveProperty("checked", true);
});

it("pagina 11 procedimentos em 10+1 e conserva edições e página ao trocar de etapa", () => {
  render(<Editor iniciais={[...Array.from({ length: 11 }, (_, i) => acao(i)), { ...acao(11), momento: { ...momento, nome: "Final", ordem: 2 } }]} />);
  expect(editor().getAllByLabelText(/^Nome acao-/)).toHaveLength(10);
  fireEvent.change(editor().getByLabelText("Nome acao-0"), { target: { value: "Preservada" } });
  fireEvent.click(within(editor().getByRole("navigation", { name: "Paginação de procedimentos da etapa" })).getByRole("button", { name: "Próxima" }));
  expect(editor().getAllByLabelText(/^Nome acao-/)).toHaveLength(1);
  fireEvent.change(editor().getByLabelText("Nome acao-10"), { target: { value: "Última editada" } });
  fireEvent.click(screen.getByRole("button", { name: /Final 1 procedimento/ }));
  fireEvent.click(screen.getByRole("button", { name: /Preparação 11 procedimentos/ }));
  expect(editor().getByLabelText("Nome acao-10")).toHaveProperty("value", "Última editada");
  fireEvent.click(editor().getByRole("button", { name: "Anterior" }));
  expect(editor().getByLabelText("Nome acao-0")).toHaveProperty("value", "Preservada");
});

it("mantém o nó e o foco da ação vizinha ao remover pelo teclado", () => {
  render(<Editor iniciais={[acao(0), acao(1), acao(2)]} />);
  const vizinha = screen.getByLabelText("Nome acao-1");
  const remover = screen.getByRole("button", { name: "Remover procedimento 1" });
  remover.focus();
  // Click é o evento nativo de ativação do botão também produzido por Enter/Espaço.
  fireEvent.click(remover);
  expect(screen.getByLabelText("Nome acao-1")).toBe(vizinha);
  expect(document.activeElement).toBe(vizinha);
  expect(editor().getAllByLabelText(/^Nome acao-/)).toHaveLength(2);
});

it("remove só a etapa selecionada e move o foco para sua vizinha", () => {
  render(<Editor iniciais={[acao(0), acao(1), { ...acao(2), momento: { ...momento, ordem: 2, nome: "Final" } }]} />);
  fireEvent.click(editor().getByRole("button", { name: "Remover esta etapa" }));
  const vizinha = screen.getByRole("button", { name: /Final 1 procedimento/ });
  expect(document.activeElement).toBe(vizinha);
  expect(editor().getByLabelText("Nome acao-2")).toBeTruthy();
  expect(screen.queryByLabelText("Nome acao-0")).toBeNull();
});

it("pagina 11 etapas, adiciona com modo manual e foca o nome", () => {
  render(<Editor iniciais={Array.from({ length: 11 }, (_, i) => ({ ...acao(i), momento: { ...momento, nome: `Etapa ${i + 1}`, ordem: i + 1 } }))} />);
  const lista = within(screen.getByRole("region", { name: "Etapas do modelo" }));
  expect(lista.getAllByRole("button").filter(b => b.hasAttribute("aria-pressed"))).toHaveLength(10);
  fireEvent.click(lista.getByRole("button", { name: "Próxima" }));
  expect(lista.getAllByRole("button").filter(b => b.hasAttribute("aria-pressed"))).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: "Adicionar etapa" }));
  expect(editor().getByLabelText("Nome da etapa")).toHaveProperty("value", "Etapa 12");
  expect(document.activeElement).toBe(editor().getByLabelText("Nome da etapa"));
  expect(editor().getByRole("radio", { name: /Manual/ })).toHaveProperty("checked", true);
});

it("bloqueia inclusões no teto de cem sem fracionar o modelo", () => {
  render(<Editor iniciais={Array.from({ length: 100 }, (_, i) => acao(i))} />);
  expect(screen.getByRole("button", { name: "Adicionar etapa" })).toHaveProperty("disabled", true);
  expect(screen.getByRole("button", { name: "Adicionar procedimento" })).toHaveProperty("disabled", true);
  expect(screen.getByText("1 etapa · 100 de 100 procedimentos")).toBeTruthy();
  expect(completo).toHaveBeenLastCalledWith(true);
});

it("mantém o estado vazio recuperável e impede salvar sem procedimentos", () => {
  render(<Editor iniciais={[]} />);
  expect(completo).toHaveBeenLastCalledWith(false);
  expect(screen.getByRole("button", { name: "Adicionar etapa" })).toHaveProperty("disabled", false);
  fireEvent.click(screen.getByRole("button", { name: "Adicionar etapa" }));
  expect(completo).toHaveBeenLastCalledWith(true);
  fireEvent.click(editor().getByRole("button", { name: "Remover esta etapa" }));
  expect(completo).toHaveBeenLastCalledWith(false);
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Adicionar etapa" }));
});

it("carrega páginas de dez explicitamente e preserva edição e revisão ao anexar", async () => {
  vi.mocked(obterAcoesCadastro).mockImplementation(async (_origem, pagina) => ({ itens: Array.from({ length: pagina === 1 ? 10 : 1 }, (_, i) => acao((pagina - 1) * 10 + i)), total: 11, pagina, porPagina: 10, revisao: origem.atualizadoEm }));
  const aoMudar = vi.fn();
  render(<Editor iniciais={[]} fonte={origem} aoMudar={aoMudar} />);
  await screen.findByLabelText("Nome acao-0");
  expect(obterAcoesCadastro).toHaveBeenCalledTimes(1);
  expect(completo).toHaveBeenLastCalledWith(false);
  expect(screen.getByRole("button", { name: "Adicionar etapa" })).toHaveProperty("disabled", true);
  fireEvent.change(editor().getByLabelText("Nome acao-0"), { target: { value: "Editada durante carga" } });
  fireEvent.change(editor().getByLabelText("Nome da etapa"), { target: { value: "Etapa renomeada" } });
  fireEvent.change(editor().getByLabelText("Instruções gerais da etapa (opcional)"), { target: { value: "Orientação editada" } });
  fireEvent.click(editor().getByRole("radio", { name: /Automatizada/ }));
  fireEvent.click(screen.getByRole("button", { name: "Carregar próximos 10 procedimentos" }));
  await waitFor(() => expect(completo).toHaveBeenLastCalledWith(true));
  expect(obterAcoesCadastro).toHaveBeenLastCalledWith(origem, 2);
  expect(editor().getByLabelText("Nome acao-0")).toHaveProperty("value", "Editada durante carga");
  expect(screen.getByText("1 etapa · 11 de 100 procedimentos")).toBeTruthy();
  const ultimos = aoMudar.mock.lastCall?.[0] as Acao[];
  expect(ultimos).toHaveLength(11);
  expect(ultimos.every(item => item.momento?.nome === "Etapa renomeada" && item.momento.instrucoesGerais === "Orientação editada" && item.momento.modoAtendimento === "AUTOMATIZADA")).toBe(true);
});

it("adiciona procedimento à etapa atual e preserva os campos das outras etapas", () => {
  const aoMudar = vi.fn();
  render(<Editor iniciais={[acao(0), { ...acao(1), momento: { ...momento, nome: "Outra", ordem: 2 } }]} aoMudar={aoMudar} />);
  fireEvent.click(editor().getByRole("button", { name: "Adicionar procedimento" }));
  expect(editor().getAllByLabelText(/^Nome acao-/)).toHaveLength(2);
  expect(document.activeElement).toBe(editor().getByLabelText("Nome acao-2"));
  const ultimos = aoMudar.mock.lastCall?.[0] as Acao[];
  expect(ultimos[1].momento).toEqual(momento);
  expect(ultimos[2].momento?.nome).toBe("Outra");
});

it("insere procedimento após a última ação da etapa atual antes da próxima etapa", () => {
  const aoMudar = vi.fn();
  render(<Editor iniciais={[acao(0), acao(1), { ...acao(2), dia: 10, momento: { ...momento, nome: "D10", ordem: 2 } }]} aoMudar={aoMudar} />);
  fireEvent.click(editor().getByRole("button", { name: "Adicionar procedimento" }));
  const ultimos = aoMudar.mock.lastCall?.[0] as Acao[];
  expect(ultimos.map(item => item.chaveEdicao)).toEqual(["acao-0", "acao-1", "acao-3", "acao-2"]);
  expect(ultimos.map(item => item.dia)).toEqual([0, 0, 0, 10]);
  expect(document.activeElement).toBe(editor().getByLabelText("Nome acao-3"));
});

it("abre a segunda página e foca o procedimento inserido na borda de dez", () => {
  const aoMudar = vi.fn();
  render(<Editor iniciais={[...Array.from({ length: 10 }, (_, i) => ({ ...acao(i), dia: 9 })), { ...acao(10), dia: 10, momento: { ...momento, ordem: 2, nome: "D10" } }]} aoMudar={aoMudar} />);
  fireEvent.click(editor().getByRole("button", { name: "Adicionar procedimento" }));
  const ultimos = aoMudar.mock.lastCall?.[0] as Acao[];
  expect(ultimos[10].chaveEdicao).toBe("acao-11");
  expect(ultimos[10].dia).toBe(9);
  expect(ultimos[11].chaveEdicao).toBe("acao-10");
  expect(editor().getAllByLabelText(/^Nome acao-/)).toHaveLength(1);
  expect(document.activeElement).toBe(editor().getByLabelText("Nome acao-11"));
});

it("renumera ordens esparsas apenas no rascunho ao criar etapa além do teto", () => {
  const aoMudar = vi.fn();
  const primeira = { ...acao(0), momento: { ...momento, ordem: 100, instrucoesGerais: "Preservar" } };
  const legado = { ...acao(1), momento: null };
  render(<Editor iniciais={[primeira, legado]} aoMudar={aoMudar} />);
  fireEvent.click(screen.getByRole("button", { name: "Adicionar etapa" }));
  const ultimos = aoMudar.mock.lastCall?.[0] as Acao[];
  expect(ultimos[0]).toEqual({ ...primeira, momento: { ...primeira.momento, ordem: 1 } });
  expect(ultimos[1]).toBe(legado);
  expect(ultimos[1].momento).toBeNull();
  expect(ultimos[2].momento).toEqual({ nome: "Etapa 2", ordem: 2, modoAtendimento: "MANUAL" });
  expect(primeira.momento.ordem).toBe(100);
  expect(document.activeElement).toBe(editor().getByLabelText("Nome da etapa"));
});

it("mantém o salvamento incompleto quando a revisão muda entre páginas", async () => {
  vi.mocked(obterAcoesCadastro).mockResolvedValue({ itens: Array.from({ length: 10 }, (_, i) => acao(i)), total: 11, pagina: 1, porPagina: 10, revisao: origem.atualizadoEm });
  render(<Editor iniciais={[]} fonte={origem} />);
  await screen.findByLabelText("Nome acao-0");
  vi.mocked(obterAcoesCadastro).mockRejectedValueOnce(new Error("Esta versão mudou. Reabra o modelo."));
  fireEvent.click(screen.getByRole("button", { name: "Carregar próximos 10 procedimentos" }));
  expect(await screen.findByText("Esta versão mudou. Reabra o modelo.")).toBeTruthy();
  expect(completo).toHaveBeenLastCalledWith(false);
  expect(editor().getAllByLabelText(/^Nome acao-/)).toHaveLength(10);
});

it("leva ao procedimento com erro em outra página e coloca foco no campo", async () => {
  const { rerender } = render(<Editor iniciais={Array.from({ length: 11 }, (_, i) => acao(i))} />);
  rerender(<Editor iniciais={[]} indiceErro={10} />);
  await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText("Nome acao-10")));
});
