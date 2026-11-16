import { LoaderCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Esqueleto, EsqueletoCabecalho, EsqueletoTabelaCorpo } from "@/components/Esqueleto";

export function AtualizandoFinanceiro({ label = "Atualizando…" }: { label?: string }) {
  return <span role="status" className="inline-flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />{label}</span>;
}

function LinhasSkeleton() {
  return <div className="space-y-3">{[1, 2, 3].map(item => <div key={item} className="flex items-start gap-3 rounded-lg border border-border p-4"><Skeleton className="size-9 shrink-0" /><div className="flex-1 space-y-3"><Skeleton className="h-4 w-1/3" /><Skeleton className="h-5 w-full" /><Skeleton className="h-4 w-2/3" /></div></div>)}</div>;
}

export function SkeletonOperacao() {
  return <div role="status" aria-label="Carregando operação" aria-busy="true" className="fin-carregamento">
    <span className="sr-only">Carregando operação…</span>
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
    <div aria-hidden="true" className="space-y-4"><Skeleton className="h-20 w-full" /><Skeleton className="h-4 w-3/4" /><LinhasSkeleton /></div>
  </div>;
}

function CabecalhoSkeleton() {
  return <div className="flex flex-wrap justify-between gap-4"><div className="space-y-3"><Skeleton className="h-7 w-52" /><Skeleton className="h-4 w-64 max-w-full" /></div><Skeleton className="h-9 w-36" /></div>;
}

function SkeletonDashboard() {
  return <div className="space-y-4">
    <CabecalhoSkeleton />
    <div className="grid gap-4 lg:grid-cols-[3fr_1fr]">
      <Card className="gap-4 p-4"><Skeleton className="h-5 w-48" /><div className="grid grid-cols-2 gap-3"><Skeleton className="h-20" /><Skeleton className="h-20" /></div><Skeleton className="h-44" /></Card>
      <Card className="gap-4 p-4"><Skeleton className="h-5 w-40" /><Skeleton className="h-9 w-3/4" /><LinhasSkeleton /></Card>
    </div>
    <Card className="gap-4 p-4"><Skeleton className="h-5 w-44" /><div className="grid gap-4 lg:grid-cols-[1fr_2fr]"><LinhasSkeleton /><Skeleton className="h-64" /></div></Card>
    <Card className="p-4"><Skeleton className="h-5 w-48" /><Skeleton className="h-24" /></Card>
  </div>;
}

export function SkeletonListaFinanceira({ label = "Carregando cadastros", paginaInteira = false, estrutura = "lista" }: { label?: string; paginaInteira?: boolean; estrutura?: "lista" | "dashboard" }) {
  if (paginaInteira && estrutura === "dashboard") return <div role="status" aria-label={label} aria-busy="true" className="fin-carregamento min-w-0"><span className="sr-only">{label}…</span><div aria-hidden="true"><SkeletonDashboard /></div></div>;
  return <Esqueleto label={label} className="fin-carregamento">
    {paginaInteira && <EsqueletoCabecalho />}
    {paginaInteira && <div className="flex flex-wrap gap-3"><Skeleton className="h-9 w-56 max-w-full" /><Skeleton className="h-9 w-36" /><Skeleton className="h-9 w-36" /></div>}
    <EsqueletoTabelaCorpo />
  </Esqueleto>;
}

export function SkeletonGraficoFinanceiro() {
  return <div role="status" aria-label="Carregando receitas e despesas" aria-busy="true" className="fin-carregamento p-4"><span className="sr-only">Carregando receitas e despesas…</span><div aria-hidden="true" className="space-y-4"><div className="grid grid-cols-2 gap-3"><Skeleton className="h-16" /><Skeleton className="h-16" /></div><Skeleton className="h-52 w-full" /><Skeleton className="mx-auto h-4 w-36" /></div></div>;
}
