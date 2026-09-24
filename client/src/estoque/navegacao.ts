import { abrirRotaNovaOperacao } from "../router";
import type { MovimentoDTO } from "./api";
import { temAcessoArea, type AreaId } from "../lib/areas";
import { getUsuario } from "../lib/auth";

/** Atalho da tela de Estoque para "Nova operação" do tipo Ajuste de estoque.
 *  Contrato de URL (lido por OperacoesFinanceiras):
 *    /financeiro/operacoes/nova?tipo=AJUSTE_ESTOQUE[&produto=<produtoId>]
 *  O ajuste em si é uma operação financeira (não há mais contagem por modal). */
export function abrirAjusteEstoque(produtoId?: number) {
  abrirRotaNovaOperacao(produtoId ? { ajusteEstoqueProdutoId: produtoId } : { ajusteEstoque: true });
}

export const codigoOperacao = (id: number) => `OP-${String(id).padStart(4, "0")}`;

export type DestinoMovimento = { href: string; rotulo: string; area: AreaId };

/** Para onde um movimento leva: a operação financeira que o gerou ou, nas saídas
 *  automáticas, o lote/animal/talhão de origem. null = sem destino conhecido. */
export function destinoDoMovimento(m: Pick<MovimentoDTO, "operacaoId" | "vinculo">): DestinoMovimento | null {
  if (m.operacaoId != null) return { href: `/financeiro/operacoes/${m.operacaoId}`, rotulo: codigoOperacao(m.operacaoId), area: "financeiro" };
  const v = m.vinculo;
  if (!v) return null;
  // Lote de leite: os fechamentos de consumo (que geram estas saídas) vivem na aba Nutrição.
  if (v.tipo === "LOTE") return { href: "/pecuaria/nutricao", rotulo: `Lote ${v.nome}`, area: "pecuaria" };
  // `?id=` abre a ficha direto (App.tsx transforma em deep-link de cockpit no popstate).
  if (v.tipo === "ANIMAL") return { href: `/pecuaria/animal?id=${v.id}`, rotulo: `Animal ${v.numero}${v.nome ? ` · ${v.nome}` : ""}`, area: "pecuaria" };
  return { href: `/plantio/talhao?id=${v.id}`, rotulo: `Talhão ${v.codigo}`, area: "agricultura" };
}

/** Sessão atual enxerga a área de destino? (sem sessão gravada = acesso aberto, como em dev) */
export function podeAcessarArea(area: AreaId): boolean {
  const u = getUsuario();
  return temAcessoArea(u?.areas, area, !!u?.dono);
}

/** Pode abrir o ajuste de estoque (operação financeira)? Exige a área financeiro E a flag
 *  `lancar` — mesmo critério de `podeLancar` que o App passa ao FinanceiroContent
 *  (dono ou flag). Sem sessão gravada = acesso aberto, como em dev. */
export function podeAjustarEstoque(): boolean {
  const u = getUsuario();
  if (!u) return true;
  return podeAcessarArea("financeiro") && (!!u.dono || u.flags.includes("lancar"));
}

/** Vê custo e valor do estoque? O servidor já manda null sem a flag `verValores`;
 *  aqui só decide se as colunas aparecem. Sem sessão gravada = acesso aberto. */
export function podeVerValores(): boolean {
  const u = getUsuario();
  if (!u) return true;
  return !!u.dono || u.flags.includes("verValores");
}
