// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { CasosPorDoenca } from "./CasosPorDoenca";

afterEach(cleanup);

const resumo = { abertas: 5, encerradas: 1, anuladas: 0, porDoenca: [{ id: "mastite", nome: "Mastite", quantidade: 4 }, { id: "placenta", nome: "Retenção de placenta", quantidade: 1 }] };

describe("CasosPorDoenca", () => {
  it("mostra os casos abertos por doença e filtra ao clicar na barra", () => {
    const onDoenca = vi.fn();
    render(<CasosPorDoenca resumo={resumo} doencaId="" onDoenca={onDoenca} />);
    expect(screen.getByText("5 ocorrências abertas no recorte filtrado")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Mastite/ }));
    expect(onDoenca).toHaveBeenCalledWith("mastite");
  });

  it("clicar na doença já escolhida volta para todas", () => {
    const onDoenca = vi.fn();
    render(<CasosPorDoenca resumo={resumo} doencaId="mastite" onDoenca={onDoenca} />);
    const barra = screen.getByRole("button", { name: /Mastite/ });
    expect(barra.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(barra);
    expect(onDoenca).toHaveBeenCalledWith("");
  });
});
