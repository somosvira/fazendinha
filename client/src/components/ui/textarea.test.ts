// @vitest-environment jsdom
import { afterEach, describe, it, expect } from "vitest";
import { createElement as h, createRef } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { Textarea } from "./textarea";

afterEach(cleanup);

describe("Textarea", () => {
  it("renderiza um <textarea> com placeholder e valor controlado", () => {
    render(h(Textarea, { placeholder: "Observações", defaultValue: "texto livre" }));
    const el = screen.getByPlaceholderText("Observações") as HTMLTextAreaElement;
    expect(el.tagName).toBe("TEXTAREA");
    expect(el.value).toBe("texto livre");
    expect(el.dataset.slot).toBe("textarea");
  });

  it("encaminha ref (forwardRef R18) e className extra", () => {
    const ref = createRef<HTMLTextAreaElement>();
    render(h(Textarea, { ref, className: "h-32" }));
    expect(ref.current).toBeInstanceOf(HTMLTextAreaElement);
    expect(ref.current?.className).toContain("h-32");
  });

  it("respeita disabled", () => {
    render(h(Textarea, { disabled: true, placeholder: "off" }));
    const el = screen.getByPlaceholderText("off") as HTMLTextAreaElement;
    expect(el.disabled).toBe(true);
  });
});
