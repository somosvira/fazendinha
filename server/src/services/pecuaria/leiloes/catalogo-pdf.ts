import { extractText, getDocumentProxy } from "unpdf";
import { origemPrograma, registroNormalizado } from "./programa.js";

export function lerFichasIndividuais(paginas: string[]) {
  return paginas.flatMap((texto, indice) => {
    // No catálogo Mafra, as camadas do título repetem a palavra e o número.
    const ficha = /^LOTE\nINDIVIDUAL(?:INDIVIDUAL)?\s*(\d{2,3})(?:\1)?\nSérie:\s*([A-Z]{2,10})\nPeso:[^\n]+\n([^\n]+)\n(RGN|RGD):\s*(\d+)\nCLIQUE AQUI ASSISTA O VÍDEO(?:\n|$)/i.exec(texto.trim());
    if (!ficha) return [];
    const [, numero, serie, titulo, tipo, valor] = ficha;
    const registro = registroNormalizado(`ABCZ ${tipo} ${serie} ${valor}`);
    return registro ? [{ numero, titulo, registro, pagina: indice + 1 }] : [];
  });
}

export async function extrairFichasPdf(bytes: Uint8Array) {
  const documento = await getDocumentProxy(bytes, { useSystemFonts: false, disableFontFace: true });
  if (documento.numPages > 150) throw new Error("Catálogo excede o limite de páginas");
  const { text } = await extractText(documento);
  return lerFichasIndividuais(text);
}

export async function baixarCatalogoPdf(url: string) {
  if (!url.startsWith(origemPrograma + "/leilao/download/")) throw new Error("URL de catálogo inválida");
  const resposta = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(12000) });
  if (!resposta.ok || !resposta.headers.get("content-type")?.startsWith("application/pdf") || !resposta.body) {
    await resposta.body?.cancel();
    throw new Error("Catálogo PDF indisponível");
  }
  const limite = 8 * 1024 * 1024;
  const leitor = resposta.body.getReader();
  const partes: Uint8Array[] = [];
  let tamanho = 0;
  try {
    for (;;) {
      const { done, value } = await leitor.read();
      if (done) break;
      tamanho += value.length;
      if (tamanho > limite) {
        await leitor.cancel();
        throw new Error("Catálogo excede o limite de tamanho");
      }
      partes.push(value);
    }
  } finally {
    leitor.releaseLock();
  }
  const bytes = new Uint8Array(tamanho);
  let deslocamento = 0;
  for (const parte of partes) {
    bytes.set(parte, deslocamento);
    deslocamento += parte.length;
  }
  return extrairFichasPdf(bytes);
}
