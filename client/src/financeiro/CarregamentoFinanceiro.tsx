import { Loader } from "@/components/Loading";
import { Skeleton } from "@/components/ui/skeleton";

function IndicadorCarregamento({ label }: { label: string }) {
  return <div aria-hidden="true" className="flex justify-center py-3"><Loader label={`${label}…`} size="sm" /></div>;
}

function LinhasSkeleton() {
  return <div className="space-y-3">{[1, 2, 3].map(item => <div key={item} className="flex items-start gap-3 rounded-lg border border-border p-4"><Skeleton className="size-9 shrink-0" /><div className="flex-1 space-y-3"><Skeleton className="h-4 w-1/3" /><Skeleton className="h-5 w-full" /><Skeleton className="h-4 w-2/3" /></div></div>)}</div>;
}

export function SkeletonOperacao() {
  return <div role="status" aria-label="Carregando operação" aria-busy="true" className="fin-carregamento">
    <span className="sr-only">Carregando operação…</span>
    <IndicadorCarregamento label="Carregando operação" />
    <div aria-hidden="true" className="space-y-3">
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap justify-between gap-4"><div className="min-w-0 flex-1 space-y-3"><Skeleton className="h-5 w-32" /><Skeleton className="h-6 w-full" /><Skeleton className="h-4 w-2/3" /></div><Skeleton className="h-20 w-40" /></div>
        <Skeleton className="mt-4 h-8 w-full" />
      </div>
      <div className="grid items-start gap-3 lg:grid-cols-2">
        {[1, 2].map(item => <div key={item} className="min-w-0 space-y-3 rounded-xl border border-border bg-card p-4"><Skeleton className="h-4 w-40" /><LinhasSkeleton /></div>)}
        {[1, 2].map(item => <Skeleton key={`apoio-${item}`} className="h-24 w-full rounded-xl" />)}
      </div>
    </div>
  </div>;
}

export function SkeletonCategorias() {
  return <div role="status" aria-label="Carregando lançamentos" aria-busy="true" className="fin-carregamento">
    <span className="sr-only">Carregando lançamentos…</span>
    <IndicadorCarregamento label="Carregando lançamentos" />
    <div aria-hidden="true" className="space-y-4"><Skeleton className="h-20 w-full" /><Skeleton className="h-4 w-3/4" /><LinhasSkeleton /></div>
  </div>;
}

export function SkeletonListaFinanceira({ label = "Carregando cadastros", paginaInteira = false }: { label?: string; paginaInteira?: boolean }) {
  return <div role="status" aria-label={label} aria-busy="true" className={`fin-carregamento rounded-xl border border-border bg-white p-4 ${paginaInteira ? "flex min-h-[calc(100dvh-5rem)] flex-col max-[900px]:min-h-[calc(100dvh-6rem)]" : ""}`}><span className="sr-only">{label}…</span><IndicadorCarregamento label={label} /><div aria-hidden="true" className={paginaInteira ? "grid flex-1 grid-rows-8 gap-3" : "space-y-3"}>{Array.from({ length: 8 }, (_, indice) => <div key={indice} className="grid grid-cols-[2fr_1fr_1fr] gap-4"><Skeleton className={paginaInteira ? "h-full min-h-8" : "h-8"} /><Skeleton className={paginaInteira ? "h-full min-h-8" : "h-8"} /><Skeleton className={paginaInteira ? "h-full min-h-8" : "h-8"} /></div>)}</div></div>;
}
