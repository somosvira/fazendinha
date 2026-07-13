/**
 * EmptyState — estado vazio "de página", composto (ícone + mensagem + ação).
 *
 * Diferente do <RebEmpty> (caixa tracejada pequena, inline numa seção que já
 * tem dados em volta), este é para quando a TELA INTEIRA está sem dados — a
 * primeira impressão de quem acabou de comprar o sistema. Preenche o vazio com
 * um ícone leve, uma frase do que aquilo faz e, opcionalmente, um CTA primário.
 *
 * Casos:
 *  - vazio de verdade (não há nada cadastrado)  → mostra o CTA de criar.
 *  - vazio por filtro (busca/aba sem resultado) → passa `variant="filtro"`,
 *    esconde o CTA e sugere limpar o filtro.
 */
import { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";

export function EmptyState({
  icon: Icon = Inbox,
  titulo,
  descricao,
  acao,
  variant = "vazio",
  className = "",
}: {
  /** Ícone lucide (default: Inbox). Passe um do módulo p/ dar contexto. */
  icon?: LucideIcon;
  titulo: string;
  /** Uma frase curta: o que essa tela guarda / o que fazer aqui. */
  descricao?: string;
  /** CTA primário (ex.: <RebButton>+ Novo produto</RebButton>). Omitido em filtro. */
  acao?: ReactNode;
  variant?: "vazio" | "filtro";
  className?: string;
}) {
  return (
    <div
      className={
        "flex flex-col items-center justify-center gap-3 rounded-[10px] border border-dashed border-border bg-[color:var(--bg-card-2)] px-6 py-16 text-center " +
        className
      }
      role="note"
    >
      <span
        aria-hidden
        className="grid h-14 w-14 place-items-center rounded-full border border-border bg-[color:var(--bg-card)] text-ink-3"
      >
        <Icon size={26} strokeWidth={1.5} />
      </span>
      <div className="flex flex-col gap-1">
        <p className="m-0 font-serif text-[19px] font-medium leading-tight text-foreground">{titulo}</p>
        {descricao ? <p className="m-0 max-w-[42ch] text-sm leading-relaxed text-ink-2">{descricao}</p> : null}
      </div>
      {variant === "vazio" && acao ? <div className="mt-2">{acao}</div> : null}
    </div>
  );
}
