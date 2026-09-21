// Polyfill de `DOMParser`/`Node` para o Cloudflare Worker.
//
// O Wrangler empacota o build "browser" do AWS SDK, cujo parser de XML
// (`@aws-sdk/xml-builder/dist-es/xml-parser.browser.js`) chama
// `new DOMParser()` e lê `Node.TEXT_NODE`/`Node.ELEMENT_NODE` — APIs de DOM
// que não existem no runtime dos Workers. Sem isto, toda resposta XML do R2
// (o `CopyObject` da confirmação de upload e o corpo de qualquer erro S3)
// estoura `DOMParser is not defined`. No Node o SDK usa outro parser, então
// este módulo só é importado por `worker.ts`.
import { DOMParser, Node } from "@xmldom/xmldom";

const alvo = globalThis as Record<string, unknown>;
alvo.DOMParser ??= DOMParser;
alvo.Node ??= Node;
