import { fmtBRL } from "../../components/charts";
import type { ResumoAtencao, ResumoCaixa, ResumoLeite } from "../lib/inicioDerive";

const CARD = "rounded-xl border border-[color:var(--rule-soft)] bg-card px-6 py-[22px] max-[620px]:px-4";
const H2 = "m-0 font-serif text-xl font-medium tracking-[-.01em]";
const num = (v: number | null, u = "") => (v == null ? "—" : `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}${u ? ` ${u}` : ""}`);

export function AtencaoCard({ itens, onAbrir }: { itens: ResumoAtencao[]; onAbrir: (tab: string) => void }) {
  return (
    <section className={CARD}>
      <h2 className={H2}>Precisa de atenção</h2>
      {itens.length === 0 ? (
        <div className="mt-4 rounded-[9px] border border-dashed border-[color:var(--rule-soft)] bg-[color:var(--bg)] px-4 py-3 text-sm text-ink-2">✓ Operação em dia.</div>
      ) : (
        <div className="mt-4 flex flex-col gap-2">
          {itens.map((a) => (
            <button key={a.chave} onClick={() => onAbrir(a.tab)} className="flex w-full items-center gap-3 rounded-[9px] border border-[color:var(--rule-soft)] border-l-[3px] border-l-prejuizo bg-[color:var(--bg)] px-[15px] py-3 text-left hover:border-cafe">
              <strong className="w-10 text-center font-serif text-[26px] font-medium tabular-nums text-prejuizo">{a.quantidade}</strong>
              <span className="flex-1 text-sm font-semibold text-foreground">{a.titulo}</span>
              <span aria-hidden className="text-ink-3">→</span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function CardComAtalho({ titulo, erro, loading, onVer, verLabel, children }: { titulo: string; erro?: boolean; loading?: boolean; onVer: () => void; verLabel: string; children: React.ReactNode }) {
  return (
    <section className={CARD}>
      <header className="mb-[18px] flex items-center justify-between gap-3">
        <h2 className={H2}>{titulo}</h2>
        <button className="text-xs font-semibold text-cafe" onClick={onVer}>{verLabel} →</button>
      </header>
      {erro ? <p className="text-sm text-ink-3">Não foi possível carregar.</p>
        : loading ? <p className="text-sm text-ink-3">Carregando…</p>
        : children}
    </section>
  );
}

export function LeiteHojeCard({ resumo, loading, erro, onVer }: { resumo: ResumoLeite; loading?: boolean; erro?: boolean; onVer: () => void }) {
  return (
    <CardComAtalho titulo="Leite hoje" verLabel="Ver rebanho" erro={erro} loading={loading} onVer={onVer}>
      <div className="grid grid-cols-3 gap-4 max-[520px]:grid-cols-1">
        <div><p className="text-xs text-ink-3">Produção do dia</p><p className="mt-1 font-serif text-2xl font-medium tabular-nums">{num(resumo.producaoDia, "L")}</p></div>
        <div><p className="text-xs text-ink-3">Em lactação</p><p className="mt-1 font-serif text-2xl font-medium tabular-nums">{num(resumo.emLactacao)}</p></div>
        <div><p className="text-xs text-ink-3">Média/vaca</p><p className="mt-1 font-serif text-2xl font-medium tabular-nums">{num(resumo.mediaVaca, "L")}</p></div>
      </div>
    </CardComAtalho>
  );
}

export function CaixaCard({ resumo, loading, erro, onVer }: { resumo: ResumoCaixa; loading?: boolean; erro?: boolean; onVer: () => void }) {
  return (
    <CardComAtalho titulo="Caixa" verLabel="Ver financeiro" erro={erro} loading={loading} onVer={onVer}>
      <div><p className="text-xs text-ink-3">Saldo em caixa</p><p className="mt-1 font-serif text-2xl font-medium tabular-nums">{resumo.saldo == null ? "—" : fmtBRL(resumo.saldo)}</p></div>
      {resumo.mesLabel && (
        <div className="mt-4 grid grid-cols-3 gap-4 border-t border-[color:var(--rule-soft)] pt-3 text-sm max-[520px]:grid-cols-1">
          <div><p className="text-xs text-ink-3">Entrada · {resumo.mesLabel}</p><p className="mt-1 tabular-nums">{resumo.entrada == null ? "—" : fmtBRL(resumo.entrada)}</p></div>
          <div><p className="text-xs text-ink-3">Saída</p><p className="mt-1 tabular-nums">{resumo.saida == null ? "—" : fmtBRL(resumo.saida)}</p></div>
          <div><p className="text-xs text-ink-3">Fluxo</p><p className="mt-1 tabular-nums">{resumo.fluxo == null ? "—" : fmtBRL(resumo.fluxo)}</p></div>
        </div>
      )}
    </CardComAtalho>
  );
}
