import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function rotuloAnimal(numero: string, nome?: string | null): string {
  const nomeLimpo = nome?.trim();
  return `#${numero}${nomeLimpo ? ` · ${nomeLimpo}` : ""}`;
}

export function mencaoAnimal(numero: string, nome?: string | null): string {
  const nomeLimpo = nome?.trim();
  return `#${numero}${nomeLimpo ? ` ${nomeLimpo}` : ""}`;
}

export function descricaoAnimalA11y(numero: string, nome?: string | null): string {
  const nomeLimpo = nome?.trim();
  return `Animal número ${numero}${nomeLimpo ? `, ${nomeLimpo}` : ""}`;
}

type AnimalIdentityVariant = "inline" | "heading";

interface AnimalIdentityProps extends Omit<HTMLAttributes<HTMLSpanElement>, "children"> {
  numero: string;
  nome?: string | null;
  variant?: AnimalIdentityVariant;
  numberClassName?: string;
  nameClassName?: string;
}

export function AnimalIdentity({
  numero,
  nome,
  variant = "inline",
  className,
  numberClassName,
  nameClassName,
  ...props
}: AnimalIdentityProps) {
  const nomeLimpo = nome?.trim();
  return (
    <span
      className={cn(
        "inline-flex min-w-0 items-baseline gap-1.5",
        variant === "heading" && "flex-col items-start gap-1 font-serif",
        className,
      )}
      {...props}
    >
      <span className="sr-only">{descricaoAnimalA11y(numero, nomeLimpo)}</span>
      <strong
        aria-hidden
        className={cn(
          "shrink-0 font-semibold tabular-nums text-foreground",
          variant === "heading" && "text-[38px] font-medium leading-[1.05]",
          numberClassName,
        )}
      >
        #{numero}
      </strong>
      {nomeLimpo && variant === "inline" && <span aria-hidden className="text-ink-2">·</span>}
      {nomeLimpo && (
        <span
          aria-hidden
          className={cn(
            "min-w-0 truncate font-medium text-ink-2",
            variant === "heading" && "text-2xl",
            nameClassName,
          )}
        >
          {nomeLimpo}
        </span>
      )}
    </span>
  );
}
