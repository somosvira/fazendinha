// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { PasswordInput } from "./PasswordInput";

afterEach(cleanup);

describe("PasswordInput", () => {
  it("alterna tipo, ícone e nome acessível nos dois estados", () => {
    const { container } = render(<PasswordInput aria-label="Senha" />);
    const input = screen.getByLabelText("Senha") as HTMLInputElement;
    const mostrar = screen.getByRole("button", { name: "Mostrar senha" });

    expect(input.type).toBe("password");
    expect(mostrar.title).toBe("Mostrar senha");
    expect(container.querySelector(".lucide-eye")).not.toBeNull();

    fireEvent.click(mostrar);
    const ocultar = screen.getByRole("button", { name: "Ocultar senha" });
    expect(input.type).toBe("text");
    expect(ocultar.title).toBe("Ocultar senha");
    expect(container.querySelector(".lucide-eye-off")).not.toBeNull();

    fireEvent.click(ocultar);
    expect(input.type).toBe("password");
    expect(screen.getByRole("button", { name: "Mostrar senha" })).not.toBeNull();
  });
});
