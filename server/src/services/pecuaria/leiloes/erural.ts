import { DOMParser } from "@xmldom/xmldom";
import { prisma } from "../../../db.js";

const origem = "https://www.erural.net";
const caminhoEvento = "/evento/1-leilao-univida-969a";
const caminhoLote = caminhoEvento + "/lotes/lote-40-4157";

function lerAtributo(html: string, nome: string): unknown {
  const bruto = new RegExp(`\\s:${nome}="([^"]*)"`).exec(html)?.[1];
  if (!bruto) throw new Error(`Campo eRural ausente: ${nome}`);
  const texto = new DOMParser().parseFromString(`<x>${bruto}</x>`, "text/html").documentElement?.textContent;
  return JSON.parse(texto ?? "");
}

function objeto(valor: unknown): Record<string, unknown> {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) throw new Error("Ficha eRural inválida");
  return valor as Record<string, unknown>;
}

export function lerLoteErural(html: string) {
  const numero = /<div class="batch-number [^"]*">\s*LOTE\s+([\w-]+)\s*<\/div>/i.exec(html)?.[1];
  const tituloHtml = /<h1 class="batch-title">([^<]+)<\/h1>/i.exec(html)?.[1];
  const animais = lerAtributo(html, "animals");
  if (!Array.isArray(animais) || !numero || !tituloHtml) {
    throw new Error("Lote eRural sem identificação");
  }
  const registrosDeclarados = animais.map(objeto).flatMap(animal =>
    animal.org === "zebu" && typeof animal.register_cod === "string" && animal.register_cod.trim()
      ? [animal.register_cod.trim()] : []);
  return {
    numero,
    titulo: new DOMParser().parseFromString(`<x>${tituloHtml}</x>`, "text/html").documentElement?.textContent?.trim() ?? "",
    vendido: /class="card-sold\b/.test(html),
    registro: null,
    registrosDeclarados,
    precoFinal: null,
  };
}

async function lerPagina(caminho: string) {
  const resposta = await fetch(origem + caminho, { redirect: "error", signal: AbortSignal.timeout(10000) });
  if (!resposta.ok) throw new Error(`eRural respondeu HTTP ${resposta.status}`);
  return resposta.text();
}

export async function sincronizarAmostraErural(agendadoEm: Date) {
  const [paginaEvento, paginaLote] = await Promise.all([lerPagina(caminhoEvento), lerPagina(caminhoLote)]);
  const evento = objeto(lerAtributo(paginaEvento, "auction"));
  const lote = lerLoteErural(paginaLote);
  if (typeof evento.id !== "number" || typeof evento.title !== "string" || typeof evento.end_date !== "string") {
    throw new Error("Evento eRural sem identificação");
  }
  const catalogo = { horarioPublicado: evento.end_date, lotes: [{ ...lote, url: origem + caminhoLote }] };
  await prisma.$executeRaw`
    INSERT INTO pecuaria."EventoLeilaoExterno"
      ("fonte","idExterno","titulo","url","vistoNaAgendaEm","catalogo","catalogoConsultadoEm")
    VALUES ('ERURAL', ${String(evento.id)}, ${evento.title}, ${origem + caminhoEvento}, ${agendadoEm}, ${JSON.stringify(catalogo)}::jsonb, ${agendadoEm})
    ON CONFLICT ("fonte","idExterno") DO UPDATE SET
      "titulo" = EXCLUDED."titulo", "url" = EXCLUDED."url", "vistoNaAgendaEm" = EXCLUDED."vistoNaAgendaEm",
      "catalogo" = EXCLUDED."catalogo", "catalogoConsultadoEm" = EXCLUDED."catalogoConsultadoEm"
    WHERE "EventoLeilaoExterno"."vistoNaAgendaEm" <= EXCLUDED."vistoNaAgendaEm"
  `;
}
