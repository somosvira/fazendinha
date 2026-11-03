// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConfiguracaoAcompanhamento } from "./ConfiguracaoAcompanhamento";

const mocks = vi.hoisted(() => ({ req: vi.fn() }));
vi.mock("./api", () => ({ reqV4: mocks.req }));
const politica = { id: "p1", versao: 1, vigenteDesde: "2026-10-01", parametros: { versao: 1, efeito: "ALERTA", diagnostico: { diasAposTentativa: 0 }, reconfirmacoes: [] } };
const tipos = [
  { id: "reprodutivo", nome: "Diagnóstico reprodutivo", ativo: true, contexto: "REPRODUTIVO" },
  { id: "compartilhado", nome: "Exame compartilhado", ativo: true, contexto: "COMPARTILHADO" },
  { id: "sanitario", nome: "Exame sanitário", ativo: true, contexto: "SANITARIO" },
  { id: "inativo", nome: "Exame inativo", ativo: false, contexto: "REPRODUTIVO" },
];
const escritas = () => mocks.req.mock.calls.filter(([, body]) => body !== undefined);
beforeEach(() => {
  vi.resetAllMocks();
  mocks.req.mockImplementation(async (path, body) => {
    if (path.endsWith("tipos-exame")) return tipos;
    return body ? { id: "p2" } : [politica];
  });
});
afterEach(cleanup);

describe("formulário da política de acompanhamento", () => {
  it("conserva rascunho e chave no retry, alterando a chave quando os parâmetros mudam", async () => {
    let tentativa = 0;
    mocks.req.mockImplementation(async (path, body) => {
      if (path.endsWith("tipos-exame")) return tipos;
      if (body) { if (tentativa++ === 0) throw new Error("Conferência recusada"); return { id: "p2" }; }
      return [politica];
    });
    render(<ConfiguracaoAcompanhamento propriedadeId={1} podeLancar />);
    await screen.findByText(/Versão 1/);
    fireEvent.click(screen.getByRole("button", { name: "Nova versão de acompanhamento" }));
    expect(escritas()).toHaveLength(0);
    fireEvent.change(screen.getByLabelText("Vigente desde"), { target: { value: "2026-10-10" } });
    fireEvent.click(screen.getByLabelText("Configurar diagnóstico após tentativa"));
    fireEvent.change(screen.getByLabelText("Dias após a tentativa"), { target: { value: "0" } });
    fireEvent.change(screen.getByLabelText("Exame do diagnóstico"), { target: { value: "reprodutivo" } });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar reconfirmação" }));
    fireEvent.change(screen.getByLabelText("Dias desde o primeiro DG positivo"), { target: { value: "30" } });
    const submeter = () => fireEvent.submit((screen.getByRole("button", { name: "Registrar nova versão" }) as HTMLButtonElement).form!);
    submeter();
    await screen.findByText("Conferência recusada");
    expect(screen.getByLabelText("Dias após a tentativa")).toHaveProperty("value", "0");
    expect(screen.getByLabelText("Dias desde o primeiro DG positivo")).toHaveProperty("value", "30");
    expect(escritas()[0]).toEqual(["/reproducao/acompanhamento/politicas", {
      propriedadeId: 1, vigenteDesde: "2026-10-10", chave: expect.any(String), parametros: {
        versao: 1, efeito: "ALERTA", diagnostico: { diasAposTentativa: 0, tipoExameId: "reprodutivo" },
        reconfirmacoes: [{ ocorrencia: 1, diasAposPrimeiroPositivo: 30 }],
      },
    }, "POST", 1]);
    submeter();
    await screen.findByText(/Versão registrada/);
    expect(escritas()[1]).toEqual(escritas()[0]);
    fireEvent.click(screen.getByRole("button", { name: "Nova versão de acompanhamento" }));
    fireEvent.change(screen.getByLabelText("Vigente desde"), { target: { value: "2026-10-10" } });
    fireEvent.click(screen.getByLabelText("Configurar diagnóstico após tentativa"));
    fireEvent.change(screen.getByLabelText("Dias após a tentativa"), { target: { value: "10" } });
    submeter();
    await waitFor(() => expect(escritas()).toHaveLength(3));
    expect(escritas()[2][1]).toMatchObject({ chave: expect.any(String), parametros: { diagnostico: { diasAposTentativa: 10 } } });
    expect(escritas()[2][1].chave).not.toBe(escritas()[1][1].chave);
  });

  it("oferece apenas tipos ativos compatíveis e exige ao menos uma regra", async () => {
    render(<ConfiguracaoAcompanhamento propriedadeId={1} podeLancar />);
    await screen.findByText(/Versão 1/);
    fireEvent.click(screen.getByRole("button", { name: "Nova versão de acompanhamento" }));
    fireEvent.submit((screen.getByRole("button", { name: "Registrar nova versão" }) as HTMLButtonElement).form!);
    await screen.findByText("Configure ao menos um acompanhamento.");
    expect(escritas()).toHaveLength(0);
    fireEvent.click(screen.getByLabelText("Configurar diagnóstico após tentativa"));
    expect(screen.getByRole("option", { name: "Diagnóstico reprodutivo" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Exame compartilhado" })).toBeTruthy();
    expect(screen.queryByRole("option", { name: "Exame sanitário" })).toBeNull();
    expect(screen.queryByRole("option", { name: "Exame inativo" })).toBeNull();
  });
});
