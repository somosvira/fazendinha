// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { alterarControle } from "../../../lib/controles.fixture";
import { FormDestino } from "./FormDestino";
import { mudarDestinoAnimal } from "../api";
import type { AnimalFicha } from "../types";

vi.mock("../api", async importOriginal => ({ ...(await importOriginal<typeof import("../api")>()), mudarDestinoAnimal: vi.fn() }));
afterEach(cleanup);

describe("mudança de finalidade", () => {
  it.each(["F", "M"] as const)("envia Reprodução para sexo %s preservando o papel informado", async sexo => {
    const animal = { id: "a1", brinco: "001", sexo, aptidao: "CORTE", papelReprodutivo: "NENHUM" } as AnimalFicha;
    const atualizado = { ...animal, aptidao: "REPRODUCAO" } as AnimalFicha;
    vi.mocked(mudarDestinoAnimal).mockResolvedValue(atualizado);
    const onSalvo = vi.fn();
    render(<FormDestino animal={animal} onSalvo={onSalvo} onFechar={vi.fn()} />);
    await alterarControle(screen.getByLabelText("Finalidade"), { target: { value: "REPRODUCAO" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar finalidade" }));
    await waitFor(() => expect(onSalvo).toHaveBeenCalledWith(atualizado));
    expect(mudarDestinoAnimal).toHaveBeenLastCalledWith("a1", expect.objectContaining({ aptidao: "REPRODUCAO", papelReprodutivo: "NENHUM" }));
  });
});
