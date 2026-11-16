import type { SVGProps } from "react";

/** Cabeça de bezerro (sem chifres, orelhas largas, topete) no padrão de traço dos ícones Lucide; par do VacaIcon. */
export function BezerroIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...props}>
      <path d="M12 5.5c-.3-1.4.8-2.4 2-2" />
      <path d="M7.5 9.5C5.5 8.5 2.5 8.8 2.5 10c0 1.8 2.6 2.7 4.8 2.1m9.2-2.6c2-1 5-.7 5 .5 0 1.8-2.6 2.7-4.8 2.1" />
      <path d="M7.5 13v-3a4.5 4.5 0 0 1 9 0v3" />
      <rect x={7} y={13} width={10} height={7.5} rx={3.75} />
      <path d="M10 10.5h.01m3.99 0h.01M10.5 16.75h.01m2.99 0h.01" />
    </svg>
  );
}
