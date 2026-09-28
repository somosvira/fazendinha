// Histórico de alterações de uma entidade de cadastro (Lote, Raça, Motivo de baixa,
// Categoria) — GET /pecuaria/rebanho/auditoria. Cada linha abre as alterações (campo:
// antes → depois, já formatadas e com rótulo em PT-BR pelo servidor) e "Carregar mais"
// busca a próxima página, acumulando (sem reiniciar a lista, ao contrário da paginação
// clássica de `Paginacao`). Nasceu na página do lote (Fase 5); a tela de Cadastros deve
// reaproveitar este mesmo componente para o painel "Histórico de alterações" de cada
// sub-aba (Fase 6) em vez de recriar a lista — só troca `entidade`/`entidadeId`.

import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Loader } from "../../../components/Loading";
import { Button, Empty, ErrorBox } from "../../../financeiro/financeiro-ui";
import { listarAuditoriaCadastro, RebanhoApiError } from "../api";
import type { EntidadeCadastro, EntradaAuditoria } from "../types";

const ITENS_POR_PAGINA = 10;

function mensagemErro(e: unknown): string {
  return e instanceof RebanhoApiError ? e.message : e instanceof Error ? e.message : String(e);
}

/** "24/09/2026 14:32" — a auditoria de cadastro traz hora (diferente de formatarDataBR). */
function formatarDataHoraBR(iso: string): string {
  const data = new Date(iso);
  return Number.isNaN(data.getTime()) ? iso : data.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

/** `recarregarToken`: quem hospeda muda o valor depois de uma escrita (editar, desativar…) para a
 *  lista voltar à página 1 com a alteração nova, sem precisar recarregar a página. */
export function AlteracoesCadastro({ entidade, entidadeId, recarregarToken }: { entidade: EntidadeCadastro; entidadeId?: string; recarregarToken?: unknown }) {
  const [itens, setItens] = useState<EntradaAuditoria[]>([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [carregando, setCarregando] = useState(true);
  const [carregandoMais, setCarregandoMais] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [expandidos, setExpandidos] = useState<Set<number>>(new Set());

  // muda entidade/entidadeId (ex.: trocou de sub-aba em Cadastros) ou houve escrita — reinicia do zero
  useEffect(() => {
    let vigente = true;
    setCarregando(true); setErro(null); setPagina(1); setExpandidos(new Set());
    listarAuditoriaCadastro(entidade, { entidadeId, page: 1, pageSize: ITENS_POR_PAGINA })
      .then((resultado) => { if (vigente) { setItens(resultado.itens); setTotal(resultado.total); } })
      .catch((e) => { if (vigente) setErro(mensagemErro(e)); })
      .finally(() => { if (vigente) setCarregando(false); });
    return () => { vigente = false; };
  }, [entidade, entidadeId, recarregarToken]);

  const carregarMais = async () => {
    const proxima = pagina + 1;
    setCarregandoMais(true); setErro(null);
    try {
      const resultado = await listarAuditoriaCadastro(entidade, { entidadeId, page: proxima, pageSize: ITENS_POR_PAGINA });
      setItens((atual) => [...atual, ...resultado.itens]);
      setTotal(resultado.total);
      setPagina(proxima);
    } catch (e) { setErro(mensagemErro(e)); }
    finally { setCarregandoMais(false); }
  };

  const alternarExpandido = (indice: number) => setExpandidos((atual) => {
    const novo = new Set(atual);
    if (novo.has(indice)) novo.delete(indice); else novo.add(indice);
    return novo;
  });

  if (carregando) return <div className="p-6"><Loader label="Carregando alterações" /></div>;

  return <>
    <ErrorBox erro={erro} />
    {itens.length ? <div className="divide-y divide-border">
      {itens.map((entrada, indice) => {
        const aberto = expandidos.has(indice);
        const temAlteracoes = entrada.alteracoes.length > 0;
        return <div key={indice}>
          <button
            type="button" disabled={!temAlteracoes} onClick={() => alternarExpandido(indice)}
            aria-expanded={temAlteracoes ? aberto : undefined}
            className="flex w-full flex-wrap items-center justify-between gap-3 p-4 text-left text-sm hover:bg-surface-2 disabled:cursor-default disabled:hover:bg-transparent"
          >
            <div className="flex min-w-0 items-center gap-2">
              {temAlteracoes && (aberto ? <ChevronDown size={16} className="shrink-0 text-ink-3" /> : <ChevronRight size={16} className="shrink-0 text-ink-3" />)}
              <div className="min-w-0">
                <strong className="break-words">{entrada.resumo}</strong>
                <div className="mt-0.5 text-xs text-ink-3">{entrada.usuarioNome ?? "Sistema"}</div>
              </div>
            </div>
            <span className="shrink-0 text-xs text-ink-3">{formatarDataHoraBR(entrada.em)}</span>
          </button>
          {aberto && temAlteracoes && <div className="overflow-x-auto px-4 pb-4">
            <table className="w-full text-left text-xs">
              <thead className="text-ink-3"><tr><th className="py-1 pr-3 font-semibold">Campo</th><th className="py-1 pr-3 font-semibold">Antes</th><th className="py-1 pr-3 font-semibold">Depois</th></tr></thead>
              <tbody className="divide-y divide-border">
                {entrada.alteracoes.map((alt) => <tr key={alt.campo}><td className="py-1.5 pr-3">{alt.rotulo}</td><td className="py-1.5 pr-3 break-words">{alt.antes ?? "—"}</td><td className="py-1.5 pr-3 break-words">{alt.depois ?? "—"}</td></tr>)}
              </tbody>
            </table>
          </div>}
        </div>;
      })}
    </div> : !erro && <Empty>Nenhuma alteração registrada.</Empty>}
    {itens.length > 0 && itens.length < total && <div className="border-t border-border p-4 text-center">
      <Button secondary disabled={carregandoMais} onClick={() => void carregarMais()}>{carregandoMais ? "Carregando…" : "Carregar mais"}</Button>
    </div>}
  </>;
}
