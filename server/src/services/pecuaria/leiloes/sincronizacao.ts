import { baixarCatalogoPdf } from "./catalogo-pdf.js";
import { Prisma } from "@prisma/client";
import { prisma } from "../../../db.js";
import { baixarPagina, lerAgenda, lerCatalogo, origemPrograma } from "./programa.js";

const fonte = "PROGRAMA";

export async function sincronizarPrograma(agendadoEm: Date) {
  const agenda = lerAgenda(await baixarPagina(origemPrograma + "/appportal"));
  if (!agenda.length) throw new Error("Agenda da Programa sem eventos reconhecidos");
  const valores = agenda.map(evento => Prisma.sql`(${fonte}, ${evento.id}, ${evento.titulo}, ${evento.url}, ${agendadoEm})`);
  await prisma.$executeRaw`
    INSERT INTO pecuaria."EventoLeilaoExterno" ("fonte", "idExterno", "titulo", "url", "vistoNaAgendaEm")
    VALUES ${Prisma.join(valores)}
    ON CONFLICT ("fonte", "idExterno") DO UPDATE SET
      "titulo" = EXCLUDED."titulo", "url" = EXCLUDED."url", "vistoNaAgendaEm" = EXCLUDED."vistoNaAgendaEm"
    WHERE "EventoLeilaoExterno"."vistoNaAgendaEm" <= EXCLUDED."vistoNaAgendaEm"
  `;

  const pendentes = await prisma.eventoLeilaoExterno.findMany({
    where: { fonte, vistoNaAgendaEm: agendadoEm },
    orderBy: [{ catalogoTentadoEm: { sort: "asc", nulls: "first" } }, { idExterno: "asc" }],
    take: 1,
    select: { idExterno: true, url: true, catalogo: true },
  });
  let falhasPdf = 0;
  const resultados = await Promise.allSettled(pendentes.map(async evento => {
    const tentativa = await prisma.eventoLeilaoExterno.updateMany({
      where: {
        fonte, idExterno: evento.idExterno, vistoNaAgendaEm: agendadoEm,
        OR: [{ catalogoTentadoEm: null }, { catalogoTentadoEm: { lt: agendadoEm } }],
      },
      data: { catalogoTentadoEm: agendadoEm },
    });
    if (!tentativa.count) return;
    const catalogo = lerCatalogo(await baixarPagina(evento.url));
    if (!catalogo.horarioPublicado) throw new Error("Página de evento sem horário reconhecido");
    const pdf = catalogo.catalogos.find(url => /-catalogo-[a-z0-9-]*pdf$/i.test(url));
    let fichasPdf: Awaited<ReturnType<typeof baixarCatalogoPdf>> | undefined;
    if (pdf) {
      try { fichasPdf = await baixarCatalogoPdf(pdf); }
      catch { falhasPdf++; }
    }
    // Preserva a última extração do mesmo documento entre rodadas.
    const anterior = evento.catalogo && typeof evento.catalogo === "object" && !Array.isArray(evento.catalogo)
      ? evento.catalogo : null;
    const evidencia = fichasPdf ? { pdf: pdf!, fichas: fichasPdf }
      : pdf && anterior?.pdf === pdf && Array.isArray(anterior.fichasPdf)
        ? { pdf, fichas: anterior.fichasPdf } : null;
    const lotes = new Map<string, Prisma.InputJsonObject>(catalogo.lotes.map(lote => [lote.numero, lote]));
    const fichas = evidencia?.fichas ?? [];
    const contagem = new Map<string, number>();
    for (const ficha of fichas) {
      if (!ficha || typeof ficha !== "object" || Array.isArray(ficha) || typeof ficha.numero !== "string") continue;
      contagem.set(ficha.numero, (contagem.get(ficha.numero) ?? 0) + 1);
    }
    for (const ficha of fichas) {
      if (!ficha || typeof ficha !== "object" || Array.isArray(ficha) || typeof ficha.numero !== "string" || contagem.get(ficha.numero) !== 1) continue;
      const lote = lotes.get(ficha.numero);
      if (lote?.registro && lote.registro !== ficha.registro) {
        lotes.set(ficha.numero, { ...lote, registro: null });
        continue;
      }
      lotes.set(ficha.numero, { ...ficha, pdf: evidencia!.pdf });
    }
    await prisma.eventoLeilaoExterno.updateMany({
      where: {
        fonte, idExterno: evento.idExterno, vistoNaAgendaEm: agendadoEm,
        OR: [{ catalogoConsultadoEm: null }, { catalogoConsultadoEm: { lte: agendadoEm } }],
      },
      data: { catalogo: { ...catalogo, lotes: [...lotes.values()], pdf: evidencia?.pdf ?? null, fichasPdf: fichas }, catalogoConsultadoEm: agendadoEm },
    });
  }));
  return { eventos: agenda.length, catalogosConsultados: resultados.length, falhasPdf, falhas: resultados.filter(item => item.status === "rejected").length };
}
