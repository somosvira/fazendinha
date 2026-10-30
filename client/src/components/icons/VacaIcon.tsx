import type { SVGProps } from "react";

/** Símbolo de bovino compartilhado, com o tamanho controlado pelo consumidor. */
export function VacaIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width={20} height={20} fill="none" aria-hidden="true" focusable="false" {...props}>
      <image href="/images/pecuaria/vaca-icone-v2.png" width={24} height={24} />
    </svg>
  );
}
