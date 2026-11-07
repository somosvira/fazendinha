/* Dica curta ancorada num gatilho: abre com o mouse por cima, com foco (teclado)
 * ou com clique/toque; fecha ao sair, com Esc ou clicando fora. Serve para tirar
 * textos de ajuda de baixo dos campos e das tabelas sem perder a informação. */

import { useRef, useState, type ReactNode } from "react";
import { CircleHelp } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export function Dica({ conteudo, rotulo, children, className }: {
  conteudo: ReactNode;
  /** nome acessível do gatilho */
  rotulo: string;
  children: ReactNode;
  className?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const toque = useRef(false);
  return <Popover open={aberto} onOpenChange={setAberto}>
    <PopoverTrigger asChild>
      <button
        type="button"
        aria-label={rotulo}
        className={cn("dica-gatilho inline-flex items-center align-middle text-ink-3 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2", className)}
        onMouseEnter={() => setAberto(true)}
        onMouseLeave={() => setAberto(false)}
        // Só o foco do teclado abre: o clique também foca o botão, e o Radix devolve o
        // foco ao gatilho quando fecha, o que reabria a dica ao tirar o mouse.
        onFocus={(e) => { if (e.currentTarget.matches(":focus-visible")) setAberto(true); }}
        onBlur={() => setAberto(false)}
        // Mouse: o hover já abriu, o clique só mantém aberta (o toggle do Radix fecharia).
        // Toque: não há hover, então o toque alterna.
        onPointerDown={(e) => { toque.current = e.pointerType === "touch"; }}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setAberto((v) => (toque.current ? !v : true)); }}
      >{children}</button>
    </PopoverTrigger>
    <PopoverContent
      side="top"
      className="z-[1200] w-auto max-w-xs px-3 py-2 text-[13px] font-normal normal-case leading-5 tracking-normal"
      onOpenAutoFocus={(e) => e.preventDefault()}
      onCloseAutoFocus={(e) => e.preventDefault()}
    >{conteudo}</PopoverContent>
  </Popover>;
}

export function AjudaCampo({ texto, rotulo = "Ajuda" }: { texto: ReactNode; rotulo?: string }) {
  return <Dica conteudo={texto} rotulo={rotulo} className="ml-0.5 rounded"><CircleHelp size={14} aria-hidden="true" /></Dica>;
}
