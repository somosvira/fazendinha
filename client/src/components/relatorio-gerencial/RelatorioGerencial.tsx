/* Tela do relatório financeiro gerencial: filtros (propriedade, período,
 * regime) → backend agrega → template (textos, ordem, visibilidade) só muda a
 * apresentação → pré-visualização = PDF. */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { fetchRelatorioGerencial } from "../../api";
import { getHoje } from "../../lib/hoje";
import { getPropriedadeAtiva } from "../../propriedadeScope";
import { usePropriedades } from "../../api/propriedades";
import { DateRangePicker, type DateRange } from "../DateRangePicker";
import { useToast } from "../Toast";
import { RelatorioGerencialDocumento } from "./RelatorioGerencialDocumento";
import { baixarRelatorioGerencialCsv, exportarRelatorioGerencialPdf } from "./export";
import { SECOES, alternarSecao, carregarTemplate, editarTexto, moverSecao, salvarTemplate } from "./template";
import type { RegimeRelatorio, RelatorioGerencialDTO, TemplateRelatorio } from "./types";

const REGIMES: { id: RegimeRelatorio; rotulo: string; dica: string }[] = [
  { id: "ambos", rotulo: "Realizado + previsto", dica: "Caixa liquidado e compromissos em aberto, em blocos separados." },
  { id: "realizado", rotulo: "Só realizado", dica: "Apenas lançamentos liquidados (regime de caixa)." },
  { id: "previsto", rotulo: "Só compromissos", dica: "Apenas títulos em aberto por vencimento." },
];

function mesPassado(): DateRange {
  const hoje = getHoje();
  return { start: new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1), end: new Date(hoje.getFullYear(), hoje.getMonth(), 0) };
}
const isoLocal = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function RelatorioGerencial({ onVoltar }: { onVoltar?: () => void }) {
  const toast = useToast();
  const { data: propriedades } = usePropriedades();
  const ativas = useMemo(() => propriedades.filter((p) => p.ativo), [propriedades]);
  const [propriedadeId, setPropriedadeId] = useState<number | null>(() => getPropriedadeAtiva());
  const [range, setRange] = useState<DateRange>(mesPassado);
  const [regime, setRegime] = useState<RegimeRelatorio>("ambos");
  const [template, setTemplate] = useState<TemplateRelatorio>(() => carregarTemplate(getPropriedadeAtiva()));
  const [dto, setDto] = useState<RelatorioGerencialDTO | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [exportando, setExportando] = useState(false);
  const docRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setTemplate(carregarTemplate(propriedadeId)); }, [propriedadeId]);
  useEffect(() => { salvarTemplate(propriedadeId, template); }, [propriedadeId, template]);

  const gerar = useCallback(async () => {
    if (!range.start || !range.end) { setErro("Informe o período completo."); return; }
    setCarregando(true);
    setErro(null);
    try {
      setDto(await fetchRelatorioGerencial({ inicio: isoLocal(range.start), fim: isoLocal(range.end), regime, propriedadeId }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setErro("Não foi possível gerar o relatório.");
      toast.error("Falha ao gerar relatório", msg);
    } finally {
      setCarregando(false);
    }
  }, [range, regime, propriedadeId, toast]);

  useEffect(() => { void gerar(); /* primeira carga */ // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const exportarPdf = async () => {
    if (!dto || !docRef.current || exportando) return;
    setExportando(true);
    try { await exportarRelatorioGerencialPdf(docRef.current, dto); }
    catch (e) { toast.error("Falha ao gerar PDF", e instanceof Error ? e.message : String(e)); }
    finally { setExportando(false); }
  };

  const secoesAplicaveis = useMemo(() => new Set(SECOES.filter((s) => s.regime === "ambos" || regime === "ambos" || s.regime === regime).map((s) => s.id)), [regime]);

  return (
    <main className="shell-wide pb-24">
      <header className="border-b border-border pb-6 pt-8">
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-[.14em] text-leite">Financeiro · Documento</p>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="m-0 font-serif text-[42px] font-normal leading-tight">Relatório financeiro gerencial</h1>
            <p className="mb-0 mt-2 max-w-2xl text-sm text-ink-3">Escolha período, propriedade e regime; monte as seções e exporte. Os valores vêm dos lançamentos reais e não podem ser editados aqui.</p>
          </div>
          {onVoltar && <button type="button" className="btn-ghost font-sans text-sm" onClick={onVoltar}>← Voltar para relatórios</button>}
        </div>
      </header>

      <section className="mt-6 flex flex-wrap items-end gap-4 rounded-[10px] border border-border bg-card p-4" aria-label="Filtros do relatório">
        {ativas.length >= 2 && (
          <label className="flex flex-col gap-1 text-xs text-ink-3">
            Propriedade
            <select className="rounded-md border border-border bg-[color:var(--bg)] px-3 py-2 text-sm text-foreground" value={propriedadeId ?? ""} onChange={(e) => setPropriedadeId(e.target.value ? Number(e.target.value) : null)}>
              <option value="">Consolidado</option>
              {ativas.map((p) => <option key={p.id} value={p.id}>{p.apelido ?? p.nome}</option>)}
            </select>
          </label>
        )}
        <div className="flex flex-col gap-1 text-xs text-ink-3">Período<DateRangePicker value={range} onChange={setRange} /></div>
        <fieldset className="m-0 flex flex-col gap-1 border-0 p-0 text-xs text-ink-3">
          <legend className="mb-1 p-0">Regime de leitura</legend>
          <div className="inline-flex overflow-hidden rounded-md border border-border bg-[color:var(--bg)]">
            {REGIMES.map((r) => <button key={r.id} type="button" title={r.dica} aria-pressed={regime === r.id} className={cn("border-0 bg-transparent px-3 py-2 text-sm text-ink-3", regime === r.id && "bg-mast text-mast-ink")} onClick={() => setRegime(r.id)}>{r.rotulo}</button>)}
          </div>
        </fieldset>
        <button type="button" className="btn-primary font-sans" onClick={() => void gerar()} disabled={carregando}>{carregando ? "Gerando…" : "Gerar relatório"}</button>
        {erro && <span role="alert" className="text-sm text-[color:var(--neg)]">{erro}</span>}
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)] lg:items-start">
        <aside className="rounded-[10px] border border-border bg-card p-4" aria-label="Montar relatório">
          <h2 className="m-0 font-serif text-xl font-medium">Montar relatório</h2>
          <p className="mb-4 mt-1 text-xs text-ink-3">Texto e ordem das seções. Os números não mudam.</p>
          <label className="mb-3 flex flex-col gap-1 text-xs text-ink-3">Título<input className="rounded-md border border-border bg-[color:var(--bg)] px-3 py-2 text-sm text-foreground" value={template.titulo} onChange={(e) => setTemplate((t) => editarTexto(t, "titulo", e.target.value))} /></label>
          <label className="mb-3 flex flex-col gap-1 text-xs text-ink-3">Subtítulo<input className="rounded-md border border-border bg-[color:var(--bg)] px-3 py-2 text-sm text-foreground" value={template.subtitulo} onChange={(e) => setTemplate((t) => editarTexto(t, "subtitulo", e.target.value))} placeholder="Ex.: Posição para reunião de sócios" /></label>
          <label className="mb-4 flex flex-col gap-1 text-xs text-ink-3">Observações<textarea rows={3} className="rounded-md border border-border bg-[color:var(--bg)] px-3 py-2 text-sm text-foreground" value={template.observacoes} onChange={(e) => setTemplate((t) => editarTexto(t, "observacoes", e.target.value))} placeholder="Notas editoriais que saem no fim do documento" /></label>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[.12em] text-leite">Seções</p>
          <ul className="m-0 list-none p-0">
            {template.secoes.map((s, i) => {
              const cat = SECOES.find((c) => c.id === s.id)!;
              const aplicavel = secoesAplicaveis.has(s.id);
              return (
                <li key={s.id} className={cn("flex items-center gap-2 border-b border-[color:var(--rule-soft)] py-2 text-sm", !aplicavel && "opacity-50")}>
                  <input type="checkbox" id={`sec-${s.id}`} checked={s.visivel} onChange={() => setTemplate((t) => alternarSecao(t, s.id))} aria-label={`Mostrar ${cat.rotulo}`} />
                  <label htmlFor={`sec-${s.id}`} className="flex-1 leading-tight">{cat.rotulo}{!aplicavel && <span className="block text-[11px] text-ink-3">fora do regime escolhido</span>}</label>
                  <button type="button" className="btn-ghost px-2 py-1 text-xs" aria-label={`Subir ${cat.rotulo}`} disabled={i === 0} onClick={() => setTemplate((t) => moverSecao(t, s.id, -1))}>↑</button>
                  <button type="button" className="btn-ghost px-2 py-1 text-xs" aria-label={`Descer ${cat.rotulo}`} disabled={i === template.secoes.length - 1} onClick={() => setTemplate((t) => moverSecao(t, s.id, 1))}>↓</button>
                </li>
              );
            })}
          </ul>
          <div className="mt-4 flex flex-col gap-2">
            <button type="button" className="btn-primary font-sans" onClick={() => void exportarPdf()} disabled={!dto || exportando}>{exportando ? "Gerando PDF…" : "⤓ Baixar PDF"}</button>
            <button type="button" className="btn-ghost font-sans" onClick={() => dto && baixarRelatorioGerencialCsv(dto, template)} disabled={!dto}>⤓ Baixar CSV (tabelas)</button>
          </div>
        </aside>

        <section aria-label="Pré-visualização" className="min-w-0 overflow-x-auto">
          {dto ? (
            <div className={cn("rg-previa", carregando && "opacity-60")}>
              <RelatorioGerencialDocumento ref={docRef} dto={dto} template={template} />
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border px-5 py-16 text-center text-sm text-ink-3">{carregando ? "Gerando relatório…" : erro ?? "Escolha os filtros e clique em Gerar relatório."}</div>
          )}
        </section>
      </div>
    </main>
  );
}
