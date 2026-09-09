// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { PaginaCarregando, PaginaSemDados } from "./financeiro-ui";

afterEach(() => cleanup());

describe("PaginaCarregando — semDadosOffline", () => {
  it("mostra o label normal quando não é semDadosOffline", () => {
    render(<PaginaCarregando label="Carregando operações" />);
    expect(screen.getByText("Carregando operações")).toBeTruthy();
  });

  it("troca o label por uma mensagem de offline quando semDadosOffline", () => {
    render(<PaginaCarregando label="Carregando operações" semDadosOffline />);
    expect(screen.queryByText("Carregando operações")).toBeNull();
    expect(screen.getByText(/Sem conexão/)).toBeTruthy();
  });
});

describe("PaginaSemDados — semDadosOffline", () => {
  it("propaga semDadosOffline pro PaginaCarregando quando ainda não tem erro", () => {
    render(<PaginaSemDados titulo="Contas" descricao="desc" label="Carregando contas" erro={null} semDadosOffline />);
    expect(screen.getByText(/Sem conexão/)).toBeTruthy();
  });

  it("erro tem prioridade sobre semDadosOffline — nunca esconde uma falha real", () => {
    render(<PaginaSemDados titulo="Contas" descricao="desc" label="Carregando contas" erro="Falha ao carregar" semDadosOffline />);
    expect(screen.getByText("Falha ao carregar")).toBeTruthy();
    expect(screen.queryByText(/Sem conexão/)).toBeNull();
  });
});
