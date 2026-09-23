// Agregações puras para o Painel do rebanho, a partir da lista de AnimalResumo já carregada.
import type { AnimalResumo, Categoria, PainelServidor } from "../types";
import { rotuloCategoria } from "./rotulos";

export type ContagemPorCategoria = { categoria: Categoria; rotulo: string; total: number };
export type ContagemPorSitio = { propriedadeId: number | null; nome: string; total: number };

export type ResumoPainel = {
  totalAtivos: number;
  porCategoria: ContagemPorCategoria[];
  porSitio: ContagemPorSitio[];
  pctReceptoras: number;
};

const ORDEM_CATEGORIA: Categoria[] = ["BEZERRA", "NOVILHA", "VACA", "BEZERRO", "GARROTE", "TOURO"];

/** Adapta as contagens vindas do servidor (conjunto inteiro, não só a página carregada). */
export function painelDoServidor(p: PainelServidor): ResumoPainel {
  return {
    totalAtivos: p.totalAtivos,
    porCategoria: p.porCategoria.map((c) => ({ categoria: c.categoria, rotulo: rotuloCategoria(c.categoria), total: c.total })),
    porSitio: p.porSitio,
    pctReceptoras: p.femeasAtivas > 0 ? (p.receptorasAtivas / p.femeasAtivas) * 100 : 0,
  };
}

export function agruparParaPainel(animais: AnimalResumo[]): ResumoPainel {
  const ativos = animais.filter((a) => a.situacao === "ATIVO");

  const contagemCategoria = new Map<Categoria, number>();
  for (const a of ativos) contagemCategoria.set(a.categoria, (contagemCategoria.get(a.categoria) ?? 0) + 1);
  const porCategoria: ContagemPorCategoria[] = ORDEM_CATEGORIA.filter((c) => contagemCategoria.has(c)).map((categoria) => ({
    categoria,
    rotulo: rotuloCategoria(categoria),
    total: contagemCategoria.get(categoria) ?? 0,
  }));

  const contagemSitio = new Map<number | null, { nome: string; total: number }>();
  for (const a of ativos) {
    const chave = a.propriedade?.id ?? null;
    const nome = a.propriedade?.nome ?? "Sem sítio";
    const atual = contagemSitio.get(chave);
    contagemSitio.set(chave, { nome, total: (atual?.total ?? 0) + 1 });
  }
  const porSitio: ContagemPorSitio[] = Array.from(contagemSitio, ([propriedadeId, v]) => ({ propriedadeId, ...v })).sort(
    (a, b) => b.total - a.total,
  );

  const femeas = ativos.filter((a) => a.sexo === "F");
  const receptoras = femeas.filter((a) => a.papelReprodutivo === "RECEPTORA");
  const pctReceptoras = femeas.length > 0 ? (receptoras.length / femeas.length) * 100 : 0;

  return { totalAtivos: ativos.length, porCategoria, porSitio, pctReceptoras };
}
