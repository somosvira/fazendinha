import type { SVGProps } from "react";

/** Ícone compartilhado de vaca de perfil, já usado na navegação do Rebanho. */
export function VacaIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
      <path d="M3 10h3l1-3h7l1.5 2 2-2 2 .5-.7 1.4 1.7.5-1.4 1.3 1 1.3-2.2.5L16 11v2h-1v4h-2v-4H9v4H7v-4H5.5A2.5 2.5 0 0 1 3 10Z" />
      <path d="m6 10-2-2-1 1M16.5 7l.8-2 1.2.8M18 10h.01" />
      <path d="M11 13v1.5h2V13" />
    </svg>
  );
}
