// Seção "Auditoria" da ficha do animal: data e hora, alterações expansíveis (campo: antes →
// depois) e paginação "Carregar mais". Busca a própria página em vez de receber a lista pronta,
// para poder acumular páginas sem que o resto da ficha recarregue — mesmo espírito de
// HistoricoMovimentacoes.tsx, mas acumulando em vez de trocar de página.

import { useEffect, useState } from "react";
import { Button } from "../../../financeiro/financeiro-ui";
import { buscarAuditoriaAnimal, RebanhoApiError } from "../api";
import type { EntradaAuditoria } from "../types";

const TAMANHO_PAGINA = 20;

function mensagemErro(e: unknown): string {
  return e instanceof RebanhoApiError ? e.message : e instanceof Error ? e.message : String(e);
}

/** "24/09/2026 14:32" — a lista de eventos precisa da hora, não só do dia (dois eventos no
 *  mesmo dia ficam impossíveis de distinguir só pela data). */
function formatarDataHoraBR(iso: string): string {
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return iso;
  const dataFmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(data);
  const horaFmt = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(data);
  return `${dataFmt} ${horaFmt}`;
}

export function AuditoriaAnimal({ id, recarregarToken }: {
  id: string;
  /** mudar este valor recomeça da página 1 (ex.: uma ação no animal gerou uma entrada nova) */
  recarregarToken?: string | number;
}) {
  const [itens, setItens] = useState<EntradaAuditoria[]>([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [carregando, setCarregando] = useState(true);
  const [carregandoMais, setCarregandoMais] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [expandidos, setExpandidos] = useState<Set<number>>(new Set());

  useEffect(() => {
    let vigente = true;
    setCarregando(true); setErro(null); setPagina(1); setExpandidos(new Set());
    buscarAuditoriaAnimal(id, { page: 1, pageSize: TAMANHO_PAGINA })
      .then((resultado) => { if (vigente) { setItens(resultado.itens); setTotal(resultado.total); } })
      .catch((e) => { if (vigente) setErro(mensagemErro(e)); })
      .finally(() => { if (vigente) setCarregando(false); });
    return () => { vigente = false; };
  }, [id, recarregarToken]);

  const carregarMais = async () => {
    const proximaPagina = pagina + 1;
    setCarregandoMais(true); setErro(null);
    try {
      const resultado = await buscarAuditoriaAnimal(id, { page: proximaPagina, pageSize: TAMANHO_PAGINA });
      setItens((atuais) => [...atuais, ...resultado.itens]);
      setTotal(resultado.total);
      setPagina(proximaPagina);
    } catch (e) { setErro(mensagemErro(e)); }
    finally { setCarregandoMais(false); }
  };

  const alternarExpandido = (indice: number) => setExpandidos((atuais) => {
    const novo = new Set(atuais);
    if (novo.has(indice)) novo.delete(indice); else novo.add(indice);
    return novo;
  });

  if (carregando) return <p className="mt-4 text-sm text-ink-3">Carregando…</p>;
  if (erro && !itens.length) return <p role="alert" className="mt-4 text-sm text-red-700">{erro}</p>;
  if (!itens.length) return <p className="mt-4 text-sm text-ink-3">Nenhum registro de auditoria.</p>;

  return <div className="mt-4">
    {erro && <p role="alert" className="mb-3 text-sm text-red-700">{erro}</p>}
    <div className="divide-y divide-border rounded-lg border border-border">
      {itens.map((entrada, indice) => {
        const aberto = expandidos.has(indice);
        const temAlteracoes = entrada.alteracoes.length > 0;
        return <div key={`${entrada.entidadeId}-${entrada.em}-${indice}`} className="p-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0"><strong className="break-words">{entrada.resumo}</strong><div className="mt-0.5 text-xs text-ink-3">{entrada.usuarioNome ?? "Sistema"}</div></div>
            <div className="flex shrink-0 items-center gap-3">
              <span className="text-xs text-ink-3">{formatarDataHoraBR(entrada.em)}</span>
              {temAlteracoes && <button type="button" aria-expanded={aberto} onClick={() => alternarExpandido(indice)} className="text-xs font-semibold text-green-800 hover:underline">{aberto ? "Ocultar alterações" : "Ver alterações"}</button>}
            </div>
          </div>
          {aberto && temAlteracoes && <ul className="mt-3 space-y-1 border-t border-border pt-3 text-xs text-ink-3">
            {entrada.alteracoes.map((alteracao) => <li key={alteracao.campo}><strong className="text-ink">{alteracao.rotulo}:</strong> {alteracao.antes ?? "—"} → {alteracao.depois ?? "—"}</li>)}
          </ul>}
        </div>;
      })}
    </div>
    {itens.length < total && <div className="mt-3 flex justify-center">
      <Button secondary onClick={() => void carregarMais()} disabled={carregandoMais}>{carregandoMais ? "Carregando…" : "Carregar mais"}</Button>
    </div>}
  </div>;
}
