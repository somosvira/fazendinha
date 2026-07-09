/* Rio Novo — header global.
 * Faixa preta no topo com logo, seletor de fazenda (display-only) e chip do
 * usuário (com dropdown para "ver como" outro perfil). O burger só aparece
 * no mobile e controla o drawer da sidebar.
 * Migrado para o primitivo shadcn `DropdownMenu` (Radix): outside-click,
 * Escape e foco já vêm de graça — não há mais `useClickOutside` manual. */

import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PAPEIS, type User } from "../data/acessos";
import { fazendas, fazendaAtualId, type Fazenda } from "../data/fazendas";
import { TerranoSymbol } from "./TerranoLogo";

function Chevron({ className }: { className?: string }) {
  return (
    <svg
      className={cn("h-3 w-3 opacity-70 transition-transform group-data-[state=open]:rotate-180", className)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

/** Seletor de fazenda — DISPLAY-ONLY. A lista de fazendas não é interativa;
 * não há troca de fazenda hoje (a atual vem do singleton `fazendas`). */
function FarmPicker({ atual }: { atual: Fazenda }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="group flex cursor-pointer items-center gap-2.5 rounded-[9px] border border-[#2a3025] bg-[var(--mast-bg-2)] py-1.5 pl-2 pr-2.5 font-sans hover:bg-[#1f2521] max-[900px]:gap-2 max-[900px]:py-1 max-[900px]:pl-1.5 max-[900px]:pr-2 max-[560px]:px-1.5"
          aria-label="Fazenda atual"
        >
          <span className="text-base leading-none max-[900px]:text-sm" aria-hidden>🥛</span>
          <span className="flex flex-col items-start leading-[1.05] max-[560px]:hidden">
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--mast-ink-2)] max-[900px]:hidden">
              Fazenda
            </span>
            <span className="max-w-[26vw] overflow-hidden text-ellipsis whitespace-nowrap text-sm font-semibold text-mast-ink max-[900px]:text-[13px]">
              {atual.apelido || atual.nome}
            </span>
          </span>
          <Chevron />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[280px] max-w-[360px] rounded-[6px] p-0">
        <DropdownMenuLabel className="border-b border-border bg-[var(--bg-card-2)] px-3.5 py-2.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-3">
          Fazendas
        </DropdownMenuLabel>
        {fazendas.map((f) => (
          <DropdownMenuItem
            key={f.id}
            disabled
            className={cn(
              "gap-3 rounded-none border-b border-[var(--rule-soft)] px-3.5 py-2.5 data-[disabled]:opacity-100 last:border-b-0",
              f.id === atual.id && "bg-[var(--bg-card-2)]",
            )}
          >
            <span className="text-base" aria-hidden>🥛</span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-sm font-semibold text-foreground">{f.nome}</span>
              {(f.cidade || f.uf) && (
                <span className="text-[11px] text-ink-3">
                  {[f.cidade, f.uf].filter(Boolean).join(" — ")}
                  {f.papel && <> · {f.papel}</>}
                </span>
              )}
            </span>
            {f.id === atual.id && (
              <span className="font-bold text-lucro" aria-label="atual">✓</span>
            )}
          </DropdownMenuItem>
        ))}
        {fazendas.length === 1 && (
          <div className="border-t border-[var(--rule-soft)] px-3.5 py-2.5 text-xs italic text-ink-3">
            Você só tem uma fazenda configurada.
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function UserPicker({ user, allUsers, onSwitchUser, onSair }: {
  user: User;
  allUsers: User[] | null;
  onSwitchUser: (id: string) => void;
  onSair?: () => void;
}) {
  const papelNome = (u: User) => (u.papel === "personalizado" ? "Personalizado" : PAPEIS[u.papel]?.nome || "");
  // Menu abre se for possível trocar de perfil OU se houver ação de sair (piloto).
  const canSwitch = !!allUsers && allUsers.length > 1;
  const abreMenu = canSwitch || !!onSair;

  const chipInner = (
    <>
      <span className="grid h-[30px] w-[30px] place-items-center rounded-full bg-leite font-serif text-sm font-semibold text-[var(--mast-bg)]">
        {user.inicial}
      </span>
      <span className="flex flex-col items-start leading-[1.1] max-[900px]:hidden">
        <span className="text-sm font-semibold text-mast-ink">{user.nome.split(" ")[0]}</span>
        <span className="text-[11px] text-[var(--mast-ink-2)]">{papelNome(user)}</span>
      </span>
    </>
  );

  if (!abreMenu) {
    return (
      <div className="flex items-center gap-2.5 rounded-[9px] border border-transparent py-1 pl-1 pr-2 font-sans">
        {chipInner}
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="group flex cursor-pointer items-center gap-2.5 rounded-[9px] border border-transparent bg-transparent py-1 pl-1 pr-2 font-sans hover:border-[#2a3025] hover:bg-[var(--mast-bg-2)]"
          aria-haspopup="menu"
        >
          {chipInner}
          <Chevron />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[280px] max-w-[360px] rounded-[6px] p-0">
        {canSwitch && allUsers && (
          <>
            <DropdownMenuLabel className="border-b border-border bg-[var(--bg-card-2)] px-3.5 py-2.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-3">
              Entrar como (demonstração)
            </DropdownMenuLabel>
            {allUsers.map((u) => (
              <DropdownMenuItem
                key={u.id}
                onSelect={() => onSwitchUser(u.id)}
                className={cn(
                  "gap-3 rounded-none border-b border-[var(--rule-soft)] px-3.5 py-2.5 font-sans text-foreground last:border-b-0",
                  u.id === user.id && "bg-[var(--bg-card-2)]",
                )}
              >
                <span className="grid h-8 w-8 place-items-center rounded-full bg-[var(--mast-bg)] font-serif text-[15px] text-mast-ink">
                  {u.inicial}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-sm font-medium text-foreground">{u.nome}</span>
                  <span className="text-[11px] text-ink-3">{papelNome(u)}</span>
                </span>
                {u.id === user.id && <span className="font-bold text-lucro" aria-label="atual">✓</span>}
              </DropdownMenuItem>
            ))}
          </>
        )}
        {onSair && (
          <DropdownMenuItem
            onSelect={() => onSair()}
            className="gap-3 rounded-none border-b border-[var(--rule-soft)] px-3.5 py-2.5 font-sans text-foreground last:border-b-0"
          >
            <span className="grid h-8 w-8 place-items-center rounded-full bg-[var(--mast-bg)] font-serif text-[15px] text-mast-ink" aria-hidden>↩</span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-sm font-medium text-foreground">Sair</span>
              <span className="text-[11px] text-ink-3">Encerrar a sessão neste dispositivo</span>
            </span>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function Header({ user, allUsers, onSwitchUser, mobileOpen, onMobileToggle, onAbrirBusca, onSair }: {
  user: User;
  allUsers: User[] | null;
  onSwitchUser: (id: string) => void;
  mobileOpen: boolean;
  onMobileToggle: (open: boolean) => void;
  onAbrirBusca?: () => void;
  onSair?: () => void;
}) {
  const atual = fazendas.find((f) => f.id === fazendaAtualId) || fazendas[0];

  return (
    <header
      className="fixed left-[var(--side-w)] right-0 top-0 z-10 flex h-[var(--header-h)] items-center gap-3.5 border-b border-[#0B0F0D] bg-mast px-[18px] text-mast-ink print:hidden max-[900px]:left-0 max-[900px]:gap-2.5 max-[900px]:px-3 max-[560px]:gap-2 max-[560px]:px-2.5"
    >
      <button
        className="hidden h-[38px] w-[38px] cursor-pointer items-center justify-center rounded-lg border border-[#2a3025] bg-transparent p-0 text-mast-ink max-[900px]:flex max-[900px]:h-[34px] max-[900px]:w-[34px]"
        aria-label={mobileOpen ? "Fechar menu" : "Abrir menu"}
        onClick={() => onMobileToggle(!mobileOpen)}
      >
        <svg className="h-[18px] w-[18px] max-[900px]:h-4 max-[900px]:w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
          {mobileOpen
            ? <><path d="M6 6l12 12"/><path d="M18 6L6 18"/></>
            : <><path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h16"/></>}
        </svg>
      </button>

      <div className="ah-brand">
        <TerranoSymbol size={30} tone="dark" strokeWidth={4.4} className="ah-brand-symbol" />
        <span className="ah-brand-txt">
          <span className="ah-brand-name">Terrano</span>
          <span className="ah-brand-sub">Fazenda Rio Novo</span>
        </span>
      </div>

      <FarmPicker atual={atual} />

      {onAbrirBusca && (
        <button
          className="ml-1.5 flex max-w-[340px] flex-[0_1_340px] cursor-text items-center gap-2.5 rounded-[9px] border border-[#2a3025] bg-[var(--mast-bg-2)] py-1.5 pl-2.5 pr-2 text-left font-sans text-[var(--mast-ink-2)] hover:bg-[#1f2521] max-[760px]:flex-[0_0_auto] max-[760px]:max-w-none max-[760px]:p-1.5"
          onClick={onAbrirBusca}
          aria-label="Pesquisar páginas e recursos"
        >
          <svg className="h-4 w-4 flex-none opacity-85" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" />
          </svg>
          <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[13px] max-[760px]:hidden">
            Pesquisar páginas e recursos…
          </span>
          <span className="flex-none rounded-md border border-[#343b30] px-1.5 py-0.5 text-[11px] font-semibold leading-none tracking-[0.02em] text-[var(--mast-ink-2)] max-[760px]:hidden" aria-hidden>
            ⌘K
          </span>
        </button>
      )}

      <div className="flex-1" />

      <UserPicker user={user} allUsers={allUsers} onSwitchUser={onSwitchUser} onSair={onSair} />
    </header>
  );
}
