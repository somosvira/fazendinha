import type { SVGProps } from "react";

/** Cabeça de bovino no mesmo padrão de traço dos ícones Lucide da interface. */
export function VacaIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...props}>
      <path d="M8 7C6 6 6 4 7 3m9 4c2-1 2-3 1-4" />
      <path d="M7 9C5 7 2 7 2 8c0 3 3 4 5 3m10-2c2-2 5-2 5-1 0 3-3 4-5 3" />
      <path d="M7 14v-4c0-4 10-4 10 0v4" />
      <rect x={6} y={14} width={12} height={7} rx={3} />
      <path d="M9 11v1m6-1v1M9 17.5h.01m5.99 0h.01" />
    </svg>
  );
}
