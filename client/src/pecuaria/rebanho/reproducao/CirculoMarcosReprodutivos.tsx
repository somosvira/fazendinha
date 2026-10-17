import { useId } from "react";
import { formatBRDateISO } from "../../../lib/hoje";

export type MarcoReprodutivo = {
  id: "PARTO" | "FIM_PEV" | "LIBERACAO" | "PRIMEIRO_SERVICO" | "DG_POSITIVO";
  rotulo: string;
  data: string | null;
  estado: "REALIZADO" | "PREVISTO" | "PENDENTE" | "DESCONHECIDO";
};
export type EventoLinhaReprodutiva = {
  id: string;
  data: string | null;
  titulo: string;
  detalhe?: string;
  pendente?: boolean;
};
export type CirculoMarcosReprodutivosProps = {
  estado: string;
  marcos: MarcoReprodutivo[];
  eventos: EventoLinhaReprodutiva[];
  pendencias?: string[];
  intervalos?: Array<{ rotulo: string; dias: number | null }>;
};

const etapas: Array<Pick<MarcoReprodutivo, "id" | "rotulo"> & { x: number; y: number; ancora: "middle" | "start" | "end" }> = [
  { id: "PARTO", rotulo: "Parto", x: 240, y: 43, ancora: "middle" },
  { id: "FIM_PEV", rotulo: "Fim do PEV", x: 365, y: 157, ancora: "start" },
  { id: "LIBERACAO", rotulo: "Liberação", x: 330, y: 345, ancora: "middle" },
  { id: "PRIMEIRO_SERVICO", rotulo: "Primeiro serviço", x: 150, y: 345, ancora: "middle" },
  { id: "DG_POSITIVO", rotulo: "DG positivo", x: 115, y: 157, ancora: "end" },
];
const estados: Record<MarcoReprodutivo["estado"], string> = {
  REALIZADO: "Registrado", PREVISTO: "Previsto", PENDENTE: "Pendente", DESCONHECIDO: "Não informado",
};
function ponto(angulo: number) {
  const radianos = angulo * Math.PI / 180;
  return { x: 240 + 110 * Math.cos(radianos), y: 205 + 110 * Math.sin(radianos) };
}
function arco(indice: number) {
  const inicio = ponto(-90 + indice * 72 + 5);
  const fim = ponto(-90 + (indice + 1) * 72 - 5);
  return `M ${inicio.x} ${inicio.y} A 110 110 0 0 1 ${fim.x} ${fim.y}`;
}

/** Apresenta fatos calculados pelo servidor. Não decide liberação, concepção ou novo ciclo. */
export function CirculoMarcosReprodutivos({ estado, marcos, eventos, pendencias = [], intervalos = [] }: CirculoMarcosReprodutivosProps) {
  const id = useId();
  const conhecidos = etapas.map(etapa => {
    const marco = marcos.find(m => m.id === etapa.id);
    return { ...etapa, ...marco, estado: marco?.estado ?? "DESCONHECIDO" as MarcoReprodutivo["estado"], data: marco?.data ?? null };
  });
  const registrados = conhecidos.filter(m => m.estado === "REALIZADO").length;
  const descrever = (m: MarcoReprodutivo) => `${m.rotulo}: ${estados[m.estado]}${m.data ? ` em ${formatBRDateISO(m.data)}` : ", data não informada"}`;
  return <section className="rounded-xl border border-border bg-card p-4 sm:p-6" aria-labelledby={`${id}-titulo`}>
    <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
      <div><p className="text-xs font-semibold uppercase tracking-wider text-ink-3">Acompanhamento individual</p>
        <h3 id={`${id}-titulo`} className="mt-1 text-lg font-semibold">Marcos do ciclo reprodutivo</h3></div>
      <p className="max-w-full rounded-lg bg-surface-2 px-3 py-2 text-sm font-semibold break-words" role="status">{estado}</p>
    </header>
    <div className="grid items-start gap-6 lg:grid-cols-2">
      <figure className="min-w-0">
        <div className="relative mx-auto max-w-[480px]">
          <svg viewBox="-20 0 520 390" className="block h-auto w-full" role="img" aria-labelledby={`${id}-svg-titulo ${id}-svg-desc`}>
            <title id={`${id}-svg-titulo`}>Marcos conhecidos do ciclo</title>
            <desc id={`${id}-svg-desc`}>{conhecidos.map(descrever).join(". ")}. O preenchimento mostra registros, sem probabilidade de prenhez.</desc>
            <g aria-hidden="true">
              {conhecidos.map((m, i) => {
                const posicao = ponto(-90 + i * 72);
                const realizado = m.estado === "REALIZADO";
                return <g key={m.id}>
                  <path d={arco(i)} fill="none" stroke="currentColor" strokeWidth="9" strokeLinecap="round"
                    className={realizado ? "text-primary" : "text-border"} strokeDasharray={m.estado === "PREVISTO" ? "3 6" : undefined} />
                  <circle cx={posicao.x} cy={posicao.y} r="6" stroke="currentColor" strokeWidth="2"
                    fill={realizado ? "currentColor" : "var(--card)"} className={realizado ? "text-primary" : "text-ink-3"} />
                  <text x={m.x} y={m.y} textAnchor={m.ancora} fill="currentColor" className="text-foreground text-[19px] sm:text-[13px]" fontWeight="600">{m.rotulo}</text>
                  <text x={m.x} y={m.y + 19} textAnchor={m.ancora} fill="currentColor" className="text-ink-3 text-[17px] sm:text-[12px]">{m.data ? formatBRDateISO(m.data) : estados[m.estado]}</text>
                  {m.data && m.estado !== "REALIZADO" && <text x={m.x} y={m.y + 36} textAnchor={m.ancora} fill="currentColor" className="text-ink-3 text-[16px] sm:text-[11px]">{estados[m.estado]}</text>}
                </g>;
              })}
            </g>
          </svg>
          <div className="pointer-events-none absolute left-1/2 top-[52.5%] w-[35%] -translate-x-1/2 -translate-y-1/2 text-center" aria-hidden="true">
            <p className="text-sm font-semibold sm:text-base break-words line-clamp-3">{estado}</p>
            <p className="mt-2 text-xs text-ink-3">{registrados} de 5 marcos registrados</p>
          </div>
        </div>
        <figcaption className="text-sm text-ink-3">O círculo mostra marcos conhecidos, sem medir chance de prenhez. Datas previstas não comprovam realização. A liberação pode ocorrer em ordem diferente do desenho.</figcaption>
      </figure>
      <div className="min-w-0 pt-5">
        <h4 className="font-semibold">Linha do tempo</h4>
        {!eventos.length && <p className="mt-3 text-sm text-ink-3">Ainda não há eventos suficientes para mostrar a sequência deste ciclo.</p>}
        <ol className="mt-5 space-y-0" aria-label="Eventos do ciclo">
          {eventos.map((e, i) => <li key={e.id} className={`relative ml-2 pl-6 pb-5 ${i < eventos.length - 1 ? "border-l-2 border-border" : "border-l-2 border-transparent"}`}>
            <span aria-hidden="true" className={`absolute -left-[7px] top-1 h-3 w-3 rounded-full border-2 border-primary ${e.pendente ? "bg-card" : "bg-primary"}`} />
            <p className="text-sm font-semibold break-words">{e.data ? <time dateTime={e.data}>{formatBRDateISO(e.data)}</time> : "Data não informada"} · {e.titulo}</p>
            {e.pendente && <p className="text-xs font-semibold text-ink-3">Pendente</p>}
            {e.detalhe && <p className="mt-1 text-sm text-ink-3 break-words">{e.detalhe}</p>}
          </li>)}
        </ol>
      </div>
    </div>
    {intervalos.length > 0 && <dl className="mt-5 grid gap-3 sm:grid-cols-3">
      {intervalos.map(item => <div key={item.rotulo} className="rounded-lg bg-surface-2 p-3"><dt className="text-xs text-ink-3">{item.rotulo}</dt>
        <dd className="mt-1 text-lg font-semibold">{item.dias === null ? "Não aferido" : `${item.dias} ${item.dias === 1 ? "dia" : "dias"}`}</dd></div>)}
    </dl>}
    {pendencias.length > 0 && <aside className="mt-5 rounded-lg border border-border p-3" aria-label="Lacunas e pendências do ciclo">
      <h4 className="text-sm font-semibold">Informações a conferir</h4><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-3">
        {pendencias.map((p, i) => <li key={`${i}:${p}`}>{p}</li>)}
      </ul></aside>}
  </section>;
}
