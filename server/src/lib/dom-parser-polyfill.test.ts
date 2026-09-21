import { describe, expect, it } from "vitest";
import "./dom-parser-polyfill.js";

// Exercita a mesma superfície de DOM que o parser "browser" do AWS SDK usa
// dentro do Worker (DOMParser global, constantes de Node, attributes e
// childNodes iteráveis).
describe("dom-parser-polyfill", () => {
  it("expõe DOMParser e Node no globalThis", () => {
    expect(typeof globalThis.DOMParser).toBe("function");
    expect(globalThis.Node.ELEMENT_NODE).toBe(1);
    expect(globalThis.Node.TEXT_NODE).toBe(3);
  });

  it("lê a resposta XML do CopyObject do R2", () => {
    const xml = '<?xml version="1.0" encoding="UTF-8"?><CopyObjectResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/"><ETag>"abc"</ETag></CopyObjectResult>';
    const doc = new DOMParser().parseFromString(xml, "application/xml");
    const raiz = doc.documentElement;

    expect(doc.getElementsByTagName("parsererror").length).toBe(0);
    expect(raiz.nodeName).toBe("CopyObjectResult");
    expect(Array.from(raiz.attributes).map((a) => a.name)).toEqual(["xmlns"]);
    const filhos = Array.from(raiz.childNodes);
    expect(filhos).toHaveLength(1);
    expect(filhos[0].nodeType).toBe(Node.ELEMENT_NODE);
    expect(filhos[0].textContent).toBe('"abc"');
  });
});
