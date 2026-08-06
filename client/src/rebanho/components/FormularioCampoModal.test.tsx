// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { FiltrosRelatorioRebanho, ResultadoRelatorioRebanhoDTO } from "../api";
import { FormularioCampoModal } from "./FormularioCampoModal";

const exportacoes = vi.hoisted(() => ({ exportarFormularioCampoPdf: vi.fn(async () => {}) }));
vi.mock("./formularioCampoExport", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./formularioCampoExport")>()),
  exportarFormularioCampoPdf: exportacoes.exportarFormularioCampoPdf,
}));

const relatorio: ResultadoRelatorioRebanhoDTO = {
  templateId: "ia-periodo", titulo: "Inseminações no período", descricao: "Uma linha por tentativa.", granularidade: "evento",
  colunas: [{ chave: "reprodutor", rotulo: "Touro / sêmen", tipo: "texto" }, { chave: "protocolo", rotulo: "Protocolo", tipo: "texto" }],
  acao: { tipoEvento: "DIAGNOSTICO", rotulo: "Registrar DG" },
  linhas: [{ animalId: 5, numero: "150", nome: "Lua", categoria: "VACA", grupo: "Alta", setor: "Compost", eventoId: 11, data: "2026-07-20", celulas: ["Lance", "IATF"] }],
  total: 1, truncado: false, meta: { geradoEm: "2026-08-03T10:00:00Z", periodo: { inicio: "2026-07-01", fim: "2026-07-31" }, propriedadeId: 7 },
};
const filtros: FiltrosRelatorioRebanho = { templateId: "ia-periodo", dataInicio: "2026-07-01", dataFim: "2026-07-31", status: "ATIVO" };
const campos = [
  { chave: "resultado_dg", rotulo: "Resultado do toque", tipoUi: "opcoes", obrigatorio: true, eventoAlvo: "DIAGNOSTICO", opcoes: [{ valor: "positivo", rotulo: "Prenhe" }, { valor: "negativo", rotulo: "Vazia" }] },
  { chave: "data_evento", rotulo: "Data do procedimento", tipoUi: "data", obrigatorio: true, eventoAlvo: "DIAGNOSTICO" },
  { chave: "metodo_dg", rotulo: "Método", tipoUi: "opcoes", obrigatorio: false, eventoAlvo: "DIAGNOSTICO", opcoes: [{ valor: "Ultrassom", rotulo: "Ultrassom" }] },
];

function stubFetch() {
  return vi.fn(async (url: string, init?: RequestInit) => {
    if (url.includes("/campos")) return new Response(JSON.stringify(campos), { status: 200, headers: { "content-type": "application/json" } });
    if (url.includes("/modelos") && !init?.method) return new Response(JSON.stringify([]), { status: 200, headers: { "content-type": "application/json" } });
    if (url.endsWith("/folhas") && init?.method === "POST") return new Response(JSON.stringify({ id: 20, nome: "Toque julho", templateId: "ia-periodo", status: "EM_CAMPO", filtros, config: JSON.parse(String(init.body)).config, modeloId: null, totalLinhas: 1, linhasProntas: 0, propriedadeId: 7, geradoEm: "2026-08-03T10:00:00Z", concluidoEm: null, linhas: [] }), { status: 200, headers: { "content-type": "application/json" } });
    return new Response(JSON.stringify({ id: 4 }), { status: 200, headers: { "content-type": "application/json" } });
  });
}

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe("montador de formulário de campo", () => {
  it("mostra colunas e atualiza a prévia ao desmarcar um campo", async () => {
    vi.stubGlobal("fetch", stubFetch());
    render(<FormularioCampoModal relatorio={relatorio} filtros={filtros} onClose={() => {}} onCriada={() => {}} />);

    expect(await screen.findByRole("heading", { name: "Montar formulário de campo" })).toBeTruthy();
    expect(screen.getByLabelText("Touro / sêmen")).toBeTruthy();
    const metodo = screen.getByLabelText("Método");
    expect(screen.getAllByText(/Ultrassom/).length).toBeGreaterThan(0);

    fireEvent.click(metodo);
    await waitFor(() => expect(screen.queryByText(/☐ Ultrassom/)).toBeNull());
  });

  it("cria a folha com a configuração visível e inicia o PDF", async () => {
    const fetch = stubFetch();
    vi.stubGlobal("fetch", fetch);
    const onCriada = vi.fn();
    render(<FormularioCampoModal relatorio={relatorio} filtros={filtros} onClose={() => {}} onCriada={onCriada} />);
    await screen.findByLabelText("Resultado do toque");
    fireEvent.change(screen.getByLabelText("Nome da folha"), { target: { value: "Toque julho" } });

    fireEvent.click(screen.getByRole("button", { name: "Criar folha e imprimir" }));

    await waitFor(() => expect(onCriada).toHaveBeenCalledWith(expect.objectContaining({ id: 20 })));
    const chamada = fetch.mock.calls.find(([url, init]) => String(url).endsWith("/folhas") && init?.method === "POST");
    expect(JSON.parse(String(chamada?.[1]?.body))).toMatchObject({
      nome: "Toque julho",
      filtros,
      config: { colunasSistema: ["animal", "grupo_setor", "data", "reprodutor", "protocolo"], camposPapel: ["resultado_dg", "data_evento", "metodo_dg"] },
    });
    expect(exportacoes.exportarFormularioCampoPdf).toHaveBeenCalled();
  });

  it("mantém campos e prévia disponíveis quando apenas os modelos salvos falham", async () => {
    const fetch = stubFetch();
    fetch.mockImplementation(async (url: string) => {
      if (url.includes("/campos")) return new Response(JSON.stringify(campos), { status: 200, headers: { "content-type": "application/json" } });
      return new Response(JSON.stringify({ error: "falha temporária" }), { status: 500, headers: { "content-type": "application/json" } });
    });
    vi.stubGlobal("fetch", fetch);

    render(<FormularioCampoModal relatorio={relatorio} filtros={filtros} onClose={() => {}} onCriada={() => {}} />);

    expect(await screen.findByLabelText("Resultado do toque")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toContain("ainda pode montar uma nova folha");
    expect(screen.getAllByText(/Resultado do toque/).length).toBeGreaterThan(1);
  });
});
