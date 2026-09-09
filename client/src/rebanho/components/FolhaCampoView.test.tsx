// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { FolhaCampoDTO } from "../api";
import { FolhaCampoView } from "./FolhaCampoView";

const folha: FolhaCampoDTO = {
  id: 20, nome: "Toque julho", templateId: "ia-periodo", status: "AGUARDANDO_LANCAMENTO", filtros: {},
  config: { colunasSistema: ["animal", "data"], camposPapel: ["resultado_dg", "data_evento", "metodo_dg", "observacao"] },
  modeloId: null, totalLinhas: 2, linhasProntas: 0, propriedadeId: 7, geradoEm: "2026-08-03T10:00:00Z", concluidoEm: null,
  linhas: [
    { id: 1, ordem: 0, animalId: 5, eventoOrigemId: 11, status: "PENDENTE", respostas: null, motivoNaoRealizado: null, eventoGeradoId: null, snapshot: { numero: "150", nome: "Lua", categoria: "VACA", grupo: "Alta", setor: null, data: "2026-07-20", valores: {} } },
    { id: 2, ordem: 1, animalId: 8, eventoOrigemId: 12, status: "PENDENTE", respostas: null, motivoNaoRealizado: null, eventoGeradoId: null, snapshot: { numero: "184", nome: "Estrela", categoria: "VACA", grupo: "Alta", setor: null, data: "2026-07-23", valores: {} } },
  ],
};
const campos = [
  { chave: "resultado_dg", rotulo: "Resultado do toque", tipoUi: "opcoes", obrigatorio: true, eventoAlvo: "DIAGNOSTICO", opcoes: [{ valor: "positivo", rotulo: "Prenhe" }, { valor: "negativo", rotulo: "Vazia" }] },
  { chave: "data_evento", rotulo: "Data do procedimento", tipoUi: "data", obrigatorio: true, eventoAlvo: "DIAGNOSTICO" },
  { chave: "metodo_dg", rotulo: "Método", tipoUi: "opcoes", obrigatorio: false, eventoAlvo: "DIAGNOSTICO", opcoes: [{ valor: "Palpação", rotulo: "Palpação" }, { valor: "Ultrassom", rotulo: "Ultrassom" }] },
  { chave: "observacao", rotulo: "Observação", tipoUi: "texto", obrigatorio: false, eventoAlvo: "DIAGNOSTICO" },
];

function stubFetch() {
  return vi.fn(async (url: string, init?: RequestInit) => {
    if (url.includes("/campos")) return new Response(JSON.stringify(campos), { status: 200, headers: { "content-type": "application/json" } });
    if (url.endsWith("/concluir")) return new Response(JSON.stringify({ ...folha, status: "CONCLUIDA", linhasProntas: 2 }), { status: 200, headers: { "content-type": "application/json" } });
    if (init?.method === "PATCH") return new Response(JSON.stringify(folha), { status: 200, headers: { "content-type": "application/json" } });
    return new Response(JSON.stringify(folha), { status: 200, headers: { "content-type": "application/json" } });
  });
}

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("digitação da folha de campo", () => {
  it("mantém concluir bloqueado com pendência e habilita ao resolver tudo", async () => {
    vi.stubGlobal("fetch", stubFetch());
    render(<FolhaCampoView folhaInicial={folha} onVoltar={() => {}} onAtualizada={() => {}} />);
    await screen.findByLabelText("Resultado do toque do animal 150");
    const concluir = screen.getByRole("button", { name: /Concluir e registrar/ });
    expect((concluir as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(screen.getByLabelText("Resultado do toque do animal 150"), { target: { value: "positivo" } });
    fireEvent.change(screen.getByLabelText("Data do procedimento do animal 150"), { target: { value: "2026-08-03" } });
    fireEvent.change(screen.getByLabelText("Situação da linha do animal 184"), { target: { value: "NAO_REALIZADO" } });
    fireEvent.change(screen.getByLabelText("Motivo de não realizar no animal 184"), { target: { value: "Animal ausente" } });

    await waitFor(() => expect((concluir as HTMLButtonElement).disabled).toBe(false));
  });

  it("envia rascunho tipado e conclui os eventos", async () => {
    const fetch = stubFetch();
    vi.stubGlobal("fetch", fetch);
    const onAtualizada = vi.fn();
    render(<FolhaCampoView folhaInicial={folha} onVoltar={() => {}} onAtualizada={onAtualizada} />);
    await screen.findByLabelText("Resultado do toque do animal 150");
    fireEvent.change(screen.getByLabelText("Resultado do toque do animal 150"), { target: { value: "positivo" } });
    fireEvent.change(screen.getByLabelText("Data do procedimento do animal 150"), { target: { value: "2026-08-03" } });
    fireEvent.change(screen.getByLabelText("Situação da linha do animal 184"), { target: { value: "NAO_REALIZADO" } });
    fireEvent.change(screen.getByLabelText("Motivo de não realizar no animal 184"), { target: { value: "Animal ausente" } });

    fireEvent.click(screen.getByRole("button", { name: "Salvar rascunho" }));
    await waitFor(() => expect(fetch.mock.calls.some(([url, init]) => String(url).endsWith("/linhas") && init?.method === "PATCH")).toBe(true));
    fireEvent.click(screen.getByRole("button", { name: /Concluir e registrar/ }));
    await waitFor(() => expect(fetch.mock.calls.some(([url]) => String(url).endsWith("/concluir"))).toBe(true));
    expect(onAtualizada).toHaveBeenCalledWith(expect.objectContaining({ status: "CONCLUIDA" }));
  });
});
