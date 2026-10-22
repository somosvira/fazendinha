import { Skeleton } from "../../../components/ui/skeleton";

type EstruturaSkeletonSanitario = "lista" | "ciclos" | "detalhe";

export function SkeletonSanitario({ estrutura = "lista", label }: { estrutura?: EstruturaSkeletonSanitario; label: string }) {
  const linhas = estrutura === "ciclos" ? 4 : 6;
  return <div role="status" aria-live="polite" aria-busy="true" aria-label={label} className="p-4">
    <span className="sr-only">{label}</span>
    <div aria-hidden="true" className="grid gap-3">
      {estrutura === "detalhe" ? <div className="rounded-xl border border-border p-5"><Skeleton className="h-6 w-2/5" /><Skeleton className="mt-3 h-4 w-3/5" /><div className="mt-6 grid gap-3 md:grid-cols-2"><Skeleton className="h-28" /><Skeleton className="h-28" /></div></div> : <div className="overflow-hidden rounded-xl border border-border"><div className={`grid gap-4 border-b border-border p-4 ${estrutura === "ciclos" ? "grid-cols-4" : "grid-cols-4"}`}><Skeleton className="h-4 w-4/5" /><Skeleton className="h-4 w-3/5" /><Skeleton className="h-4 w-2/3" /><Skeleton className="h-4 w-1/2" /></div>{Array.from({ length: linhas }, (_, indice) => <div key={indice} className="grid grid-cols-4 gap-4 border-b border-border p-4 last:border-0"><Skeleton className="h-5 w-4/5" /><Skeleton className="h-5 w-3/5" /><Skeleton className="h-5 w-2/3" /><Skeleton className="h-5 w-1/2" /></div>)}</div>}
    </div>
  </div>;
}
