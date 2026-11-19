import { DOMParser } from "@xmldom/xmldom";

export const origemPrograma = "https://programaleiloes.com";

function texto(html: string): string {
  return (new DOMParser().parseFromString(`<span>${html}</span>`, "text/html")
    .documentElement?.textContent ?? "").replace(/\s+/g, " ").trim();
}

export function registroNormalizado(valor: string): string | null {
  const partes = /^ABCZ\s+(RGD|RGN)\s+([A-Z]{2,10})[ -]+0*(\d{1,10})$/i.exec(valor.trim());
  return partes && Number(partes[3]) > 0 ? `ABCZ:${partes[1].toUpperCase()}:${partes[2].toUpperCase()}:${partes[3]}` : null;
}

export function lerAgenda(html: string) {
  const eventos = new Map<string, { id: string; url: string; titulo: string }>();
  for (const [, caminho, id, conteudo] of html.matchAll(/<a\s+href="(\/appportal\/agenda\/leilao\/(\d+)-[\w-]+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const titulo = texto(/<span class="titulo">([\s\S]*?)<\/span>/i.exec(conteudo)?.[1] ?? "");
    if (titulo && !eventos.has(id)) eventos.set(id, { id, url: origemPrograma + caminho.replace(/^\/appportal/, ""), titulo });
  }
  return [...eventos.values()];
}

export function lerCatalogo(html: string) {
  const lotes = new Map<string, { numero: string; titulo: string; registro: string | null }>();
  const ambiguos = new Set<string>();
  for (const [, rotulo] of html.matchAll(/<a\b[^>]*\bdata-idplaylist="[^"]*"[^>]*>\s*(?:<img\b[^>]*>\s*)?<span class="transition">([^<]*)<\/span>/gi)) {
    const partes = /^LOTE\s+(\d+[A-Z]?)(?:\s*[-–:]?\s+(.*))?$/i.exec(texto(rotulo));
    if (!partes) continue;
    const numero = partes[1].toUpperCase();
    const titulo = partes[2] ?? "";
    if (lotes.has(numero) && lotes.get(numero)?.titulo !== titulo) ambiguos.add(numero);
    lotes.set(numero, { numero, titulo, registro: registroNormalizado(titulo) });
  }
  return {
    horarioPublicado: /<time\s+datetime="(\d{4}-\d{2}-\d{2} \d{2}:\d{2})"/i.exec(html)?.[1] ?? null,
    catalogos: [...new Set([...html.matchAll(/href="(\/leilao\/download\/\d+-[\w-]+)"/gi)].map(([, caminho]) => origemPrograma + caminho))],
    lotes: [...lotes.values()].filter(lote => !ambiguos.has(lote.numero)),
  };
}

export async function baixarPagina(url: string): Promise<string> {
  const resposta = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(8000) });
  if (!resposta.ok) throw new Error(`Programa Leilões respondeu HTTP ${resposta.status}`);
  return resposta.text();
}
