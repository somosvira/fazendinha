import { prisma } from "../db.js";
import type { UsuarioContexto } from "./auth/sessao.js";
import { fontesAutorizadas, montarConsultaBusca, type LinhaBusca } from "./busca.consulta.js";

export type ResultadoBusca = { tipo: string; entidadeId: string; label: string; sublabel: string; tab: string; grupo: string; caminho: string };
export const qValido = (q: string): boolean => q.trim().length >= 2 || /^\d$/.test(q.trim());

/** Leitura limitada por fonte; autorização antecede o SQL. Nunca retorna valores/snapshots. */
/** Limite por fonte quando a busca é restrita a um único tipo (ex.: só animais). */
export const LIMITE_FONTE_UNICA = 20;
export async function buscarEntidades(q: string, usuario: UsuarioContexto, propriedadeId: number | null, tipos?: readonly string[]): Promise<ResultadoBusca[]> {
  if (!qValido(q)) return [];
  const fontes = fontesAutorizadas(usuario).filter(f => !tipos?.length || tipos.includes(f.tipo));
  if (!fontes.length) return [];
  const linhas = await prisma.$queryRaw<LinhaBusca[]>(montarConsultaBusca(q, fontes, propriedadeId, tipos?.length && fontes.length === 1 ? LIMITE_FONTE_UNICA : undefined));
  const porTipo = new Map(fontes.map(f => [f.tipo, f]));
  return linhas.flatMap(r => {
    const fonte = porTipo.get(r.tipo);
    if (!fonte) return [];
    const url = new URL(fonte.caminho(r), "https://terrano.internal");
    if (r.propriedadeId != null) { url.searchParams.set("propriedadeId", String(r.propriedadeId)); url.searchParams.set("sitio", String(r.propriedadeId)); }
    const caminho = url.pathname + url.search + url.hash;
    return [{ tipo: r.tipo, entidadeId: r.id, label: r.label, sublabel: r.contexto, tab: r.tipo === "programacao" && r.alvoId === "SANITARIO" ? "pec-sanidade" : fonte.tab, grupo: fonte.grupo, caminho }];
  });
}
