// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import { RelatoriosTab } from "./RelatoriosTab";

const exportacoes = vi.hoisted(() => ({
  baixarRelatorioCsv: vi.fn(),
  exportarRelatorioPdf: vi.fn(async () => {}),
}));
vi.mock("./relatorioExport", () => exportacoes);

const templates = [
  { id: "ia-periodo", titulo: "Inseminações no período", descricao: "Uma linha por tentativa.", fase: "Serviços", granularidade: "evento", filtrosEspecificos: ["reprodutor", "protocolo"] },
  { id: "gestantes-atual", titulo: "Gestantes atualmente", descricao: "Foto atual.", fase: "Gestação", granularidade: "animal", filtrosEspecificos: [] },
];

function stubFetch() {
  const spy = vi.fn(async (url: string) => {
    if (url.includes("/templates")) return new Response(JSON.stringify(templates), { status: 200, headers: { "content-type": "application/json" } });
    if (url.includes("/grupos")) return new Response(JSON.stringify([{ id: 4, nome: "Alta" }]), { status: 200, headers: { "content-type": "application/json" } });
    if (url.includes("/setores")) return new Response(JSON.stringify(["Compost"]), { status: 200, headers: { "content-type": "application/json" } });
    if (url.includes("/formularios/folhas")) return new Response(JSON.stringify([]), { status: 200, headers: { "content-type": "application/json" } });
    return new Response(JSON.stringify({
      templateId: "ia-periodo", titulo: "Inseminações no período", descricao: "Uma linha por tentativa.", granularidade: "evento",
      colunas: [{ chave: "reprodutor", rotulo: "Touro / sêmen", tipo: "texto" }],
      acao: { tipoEvento: "DIAGNOSTICO", rotulo: "Registrar DG" },
      linhas: [{ animalId: 5, numero: "150", nome: "Lua", categoria: "VACA", grupo: "Alta", setor: "Compost", eventoId: 11, data: "2026-06-20", celulas: ["Lance"] }],
      total: 1, truncado: false, meta: { geradoEm: "2026-07-31T10:00:00Z", periodo: { inicio: "2026-06-01", fim: "2026-06-30" }, propriedadeId: 7 },
    }), { status: 200, headers: { "content-type": "application/json" } });
  });
  vi.stubGlobal("fetch", spy);
  return spy;
}

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe("RelatoriosTab", () => {
  it("monta o formulário com templates e não consulta antes de Gerar", async () => {
    const spy = stubFetch();
    render(<RelatoriosTab onAbrirFicha={() => {}} onRegistrar={() => {}} />);
    expect(screen.getByRole("heading", { name: "Relatórios" })).toBeTruthy();
    expect(await screen.findByRole("option", { name: "Inseminações no período" })).toBeTruthy();
    expect(spy.mock.calls.some(([url]) => String(url).includes("/rebanho/relatorios?"))).toBe(false);
  });

  it("gera uma lista operacional e encaminha ficha e ação", async () => {
    const onAbrirFicha = vi.fn();
    const onRegistrar = vi.fn();
    stubFetch();
    render(<RelatoriosTab onAbrirFicha={onAbrirFicha} onRegistrar={onRegistrar} />);
    await screen.findByRole("option", { name: "Inseminações no período" });
    fireEvent.click(screen.getByRole("button", { name: "Gerar relatório" }));
    expect(await screen.findByText("Lua")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Abrir ficha.*150/i }));
    expect(onAbrirFicha).toHaveBeenCalledWith("5");
    fireEvent.click(screen.getByRole("button", { name: "Registrar DG" }));
    expect(onRegistrar).toHaveBeenCalledWith(expect.objectContaining({ linha: expect.objectContaining({ animalId: 5 }), acao: { tipoEvento: "DIAGNOSTICO", rotulo: "Registrar DG" } }));
  });

  it("mostra filtros específicos do template escolhido", async () => {
    stubFetch();
    render(<RelatoriosTab onAbrirFicha={() => {}} onRegistrar={() => {}} />);
    await screen.findByRole("option", { name: "Inseminações no período" });
    expect(screen.getByLabelText("Touro ou sêmen")).toBeTruthy();
    expect(screen.getByLabelText("Protocolo")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Modelo de relatório"), { target: { value: "gestantes-atual" } });
    await waitFor(() => expect(screen.queryByLabelText("Touro ou sêmen")).toBeNull());
  });

  it("exporta o PDF diretamente a partir do resultado do relatório", async () => {
    stubFetch();
    render(<RelatoriosTab onAbrirFicha={() => {}} onRegistrar={() => {}} />);
    await screen.findByRole("option", { name: "Inseminações no período" });
    fireEvent.click(screen.getByRole("button", { name: "Gerar relatório" }));
    await screen.findByText("Lua");

    fireEvent.click(screen.getByRole("button", { name: "↓ PDF" }));

    await waitFor(() => expect(exportacoes.exportarRelatorioPdf).toHaveBeenCalledWith(
      expect.objectContaining({
        templateId: "ia-periodo",
        linhas: [expect.objectContaining({ animalId: 5, numero: "150", nome: "Lua" })],
      }),
      ["animal", "categoria", "grupo", "setor", "data", "d:reprodutor"],
    ));
  });

  it("permite remover e reordenar colunas antes de exportar", async () => {
    stubFetch();
    render(<RelatoriosTab onAbrirFicha={() => {}} onRegistrar={() => {}} />);
    await screen.findByRole("option", { name: "Inseminações no período" });
    fireEvent.click(screen.getByRole("button", { name: "Gerar relatório" }));
    await screen.findByText("Lua");

    fireEvent.click(screen.getByLabelText("Mover Touro / sêmen para a esquerda"));
    fireEvent.click(screen.getByLabelText("Mover Touro / sêmen para a esquerda"));
    fireEvent.click(screen.getByLabelText("Mover Touro / sêmen para a esquerda"));
    fireEvent.click(screen.getByLabelText("Mover Touro / sêmen para a esquerda"));
    fireEvent.click(screen.getByLabelText("Mover Touro / sêmen para a esquerda"));
    fireEvent.click(screen.getAllByLabelText("Categoria").find((elemento) => elemento.getAttribute("type") === "checkbox")!);
    fireEvent.click(screen.getByRole("button", { name: "↓ CSV" }));

    expect(exportacoes.baixarRelatorioCsv).toHaveBeenCalledWith(expect.any(Object), ["d:reprodutor", "animal", "grupo", "setor", "data"]);
  });
});
