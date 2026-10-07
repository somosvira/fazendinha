import { nomeLotePadrao } from "../../estoque/partidas.calc.js";

export const alocacaoLoteSanitario = { select: { partidaId: true, quantidade: true, partida: { select: {
  nome: true, codigo: true, validade: true, lotePrincipalId: true, lotePrincipal: { select: { nome: true } },
} } } } as const;

export function loteAplicacaoDTO(fato: { nomeProdutoAplicado: string; movimentoEstoque?: { alocacaoPartidaEstoques: Array<{ partidaId: string; partida: { nome: string | null; validade: Date | null; lotePrincipalId: string | null; lotePrincipal: { nome: string | null } | null } }> } | null }) {
  const alocacao = fato.movimentoEstoque?.alocacaoPartidaEstoques[0];
  if (!alocacao) return { loteNome: null, lotePrincipalId: null };
  const p = alocacao.partida;
  return { loteNome: p.lotePrincipal?.nome ?? p.nome ?? nomeLotePadrao(fato.nomeProdutoAplicado, p.validade), lotePrincipalId: p.lotePrincipalId ?? alocacao.partidaId };
}
