// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AplicacoesTablet } from "./AplicacoesTablet";
import { reqSanidade } from "./api";
const fx = vi.hoisted(() => ({ propriedades: [{ id: 1, nome: "Sítio principal" }] }));
vi.mock("./api", () => ({ reqSanidade: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getUsuario: () => ({ id: 1, nome: "Fellipe", dono: true, flags: [] }) }));
vi.mock("@/api/propriedades", () => ({ usePropriedades: () => ({ data: fx.propriedades, loading: false }) }));
afterEach(() => { cleanup(); vi.resetAllMocks(); localStorage.clear(); fx.propriedades = [{ id: 1, nome: "Sítio principal" }]; });
it("atualiza templates ao abrir doenças sem perder a vaca selecionada", async () => {
  let atualizado = false;
  const animal = { id: "vaca", brinco: "1023", nome: "Vaca de teste" };
  const catalogo = [{ id: "med", nome: "Banamine", unidade: "ML", rastrearPartidas: false }];
  vi.mocked(reqSanidade).mockImplementation(async caminho => {
    if (caminho.startsWith("/tablet/opcoes")) return { catalogo, doencas: [{ id: "mastite", nome: "Mastite" }], partidas: [], templates: atualizado ? [{ doencaId: "mastite", produtoIds: ["med"], quantidades: { med: { quantidade: 2, unidade: "ML" } } }] : [] } as never;
    if (caminho.startsWith("/tablet/animais")) return [animal] as never;
    return [] as never;
  });
  render(<AplicacoesTablet sitio={1} caminho="/pecuaria/sanidade/tablet" />);
  for (const n of ["1", "0", "2", "3"]) fireEvent.click(screen.getByRole("button", { name: n }));
  fireEvent.click(screen.getByRole("button", { name: "Pesquisar" }));
  fireEvent.click(await screen.findByRole("button", { name: /1023.*Adicionar/ }));
  fireEvent.click(screen.getByRole("button", { name: "Próximo" }));
  const abrir = await screen.findByRole("button", { name: "Selecionar doença" });
  await waitFor(() => expect(abrir.hasAttribute("disabled")).toBe(false));
  atualizado = true;
  fireEvent.click(abrir);
  expect(await screen.findByRole("button", { name: "Mastite (1)" })).toBeTruthy();
  expect(screen.queryByText("Nenhum template cadastrado")).toBeNull();
  expect(screen.getByText("1023 · Vaca de teste")).toBeTruthy();
  expect(vi.mocked(reqSanidade).mock.calls.filter(([c]) => c.startsWith("/tablet/opcoes"))).toHaveLength(2);
  fireEvent.click(screen.getByRole("button", { name: "Mastite (1)" }));
  fireEvent.click(screen.getByRole("button", { name: "Usar itens marcados" }));
  const quantidade = screen.getByRole("textbox", { name: "Quantidade em mL de Banamine" }) as HTMLInputElement;
  expect(quantidade.value).toBe("2");
  fireEvent.change(quantidade, { target: { value: "7,5" } });
  fireEvent.click(screen.getByRole("button", { name: "Selecionar doença" }));
  fireEvent.click(await screen.findByRole("button", { name: "Mastite (1)" }));
  fireEvent.click(screen.getByRole("button", { name: "Usar itens marcados" }));
  expect((screen.getByRole("textbox", { name: "Quantidade em mL de Banamine" }) as HTMLInputElement).value).toBe("7,5");
  fireEvent.click(screen.getByRole("button", { name: "Revisar aplicações" }));
  expect(screen.getByText("7,5 mL")).toBeTruthy();
});

it("lembra o sítio após reabrir e usa a navegação compartilhada sem seletor diário", async () => {
  fx.propriedades = [{ id: 1, nome: "Sítio principal" }, { id: 2, nome: "Outro sítio" }];
  vi.mocked(reqSanidade).mockImplementation(async caminho => (caminho.startsWith("/tablet/opcoes") ? { catalogo: [], doencas: [], templates: [], partidas: [] } : []) as never);
  const primeira = render(<AplicacoesTablet sitio={null} caminho="/pecuaria/sanidade/tablet" />);
  fireEvent.change(screen.getByLabelText("Sítio"), { target: { value: "1" } });
  await waitFor(() => expect(localStorage.getItem("terrano:tablet:sitio:1")).toBe("1"));
  primeira.unmount();
  render(<AplicacoesTablet sitio={null} caminho="/pecuaria/sanidade/tablet" />);
  expect(screen.getByText("Sítio principal · Fellipe")).toBeTruthy();
  expect(screen.queryByLabelText("Sítio")).toBeNull();
  expect(screen.getByRole("tab", { name: "Tablet" }).getAttribute("aria-selected")).toBe("true");
});
it("não reutiliza um sítio lembrado que saiu dos acessos disponíveis", () => {
  localStorage.setItem("terrano:tablet:sitio:1", "1");
  fx.propriedades = [{ id: 2, nome: "Outro sítio" }];
  render(<AplicacoesTablet sitio={null} caminho="/pecuaria/sanidade/tablet" />);
  expect(screen.getByText("Escolha um sítio")).toBeTruthy();
  expect(vi.mocked(reqSanidade)).not.toHaveBeenCalled();
});
