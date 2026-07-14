/* Rio Novo — header global (enxuto).
 *
 * Layout novo (handoff "Shell - sidebar + header"): a marca e o seletor de
 * fazenda desceram para o TOPO da sidebar. O header ficou com apenas a busca
 * global + o menu de conta (ações da conta — NUNCA troca de usuário; o "ver como"
 * do admin vive dentro de Acessos). O burger só aparece no mobile e controla o
 * drawer da sidebar.
 *
 * Usa o primitivo shadcn `DropdownMenu` (Radix): outside-click, Escape e foco de
 * graça — sem `useClickOutside` manual. */

import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PAPEIS, type User } from "../data/acessos";

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

/* ícones do menu de conta (contorno, 17px) */
const AccIcon = {
  gear: <><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/></>,
  out: <><path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 8l-4 4 4 4M6 12h11"/></>,
} as const;

function AcctItem({ icon, children, danger, onSelect }: {
  icon: JSX.Element; children: React.ReactNode; danger?: boolean; onSelect?: () => void;
}) {
  return (
    <DropdownMenuItem
      onSelect={onSelect}
      className={cn(
        "gap-2.5 rounded-[7px] px-2.5 py-2 font-sans text-[13.5px] text-ink-2",
        danger && "text-[color:var(--prejuizo)] focus:text-[color:var(--prejuizo)]",
      )}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" className="h-[17px] w-[17px] flex-none opacity-70" aria-hidden>
        {icon}
      </svg>
      {children}
    </DropdownMenuItem>
  );
}

/** Menu de conta — AÇÕES da conta (perfil, preferências, ajuda, sair). Nunca
 *  troca de usuário: o "ver como" do admin mora em Acessos. */
function UserPicker({ user, onPreferencias, onSair }: {
  user: User;
  onPreferencias?: () => void;
  onSair?: () => void;
}) {
  const papelNome = (u: User) => (u.papel === "personalizado" ? "Personalizado" : PAPEIS[u.papel]?.nome || "");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="group flex cursor-pointer items-center gap-2.5 rounded-[8px] border border-transparent bg-transparent py-1 pl-1.5 pr-2 font-sans hover:bg-[var(--bg-card)]"
          aria-haspopup="menu"
          aria-label="Menu da conta"
        >
          <span className="grid h-8 w-8 place-items-center rounded-full bg-leite font-sans text-sm font-semibold text-[var(--ink)]">
            {user.inicial}
          </span>
          <span className="flex flex-col items-start leading-[1.15] max-[760px]:hidden">
            <span className="text-[13.5px] font-semibold text-ink">{user.nome.split(" ")[0]}</span>
            <span className="text-[11px] text-ink-mute">{papelNome(user)}</span>
          </span>
          <Chevron className="text-ink-mute max-[760px]:hidden" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[240px] rounded-[11px] p-1.5">
        <div className="mb-1 border-b border-[var(--rule-soft)] px-2.5 pb-2.5 pt-2">
          <div className="text-sm font-semibold text-ink">{user.nome}</div>
          {user.email && <div className="mt-0.5 text-xs text-ink-mute">{user.email}</div>}
        </div>
        <AcctItem icon={AccIcon.gear} onSelect={onPreferencias}>Preferências</AcctItem>
        {onSair && (
          <>
            <DropdownMenuSeparator className="my-1 bg-[var(--rule-soft)]" />
            <AcctItem icon={AccIcon.out} danger onSelect={onSair}>Sair</AcctItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function Header({ user, mobileOpen, onMobileToggle, colapsada, onToggleColapsar, onAbrirBusca, onPreferencias, onSair }: {
  user: User;
  mobileOpen: boolean;
  onMobileToggle: (open: boolean) => void;
  colapsada?: boolean;
  onToggleColapsar?: () => void;
  onAbrirBusca?: () => void;
  onPreferencias?: () => void;
  onSair?: () => void;
}) {
  return (
    <header
      className="fixed left-[var(--side-w)] right-0 top-0 z-10 flex h-[var(--header-h)] items-center gap-3.5 border-b border-[var(--rule-soft)] bg-[var(--bg)] px-[22px] text-ink print:hidden max-[900px]:left-0 max-[900px]:gap-2.5 max-[900px]:px-3 max-[560px]:gap-2 max-[560px]:px-2.5"
    >
      <button
        className="hidden h-[38px] w-[38px] cursor-pointer items-center justify-center rounded-lg border border-[var(--border)] bg-transparent p-0 text-ink max-[900px]:flex max-[900px]:h-[34px] max-[900px]:w-[34px]"
        aria-label={mobileOpen ? "Fechar menu" : "Abrir menu"}
        onClick={() => onMobileToggle(!mobileOpen)}
      >
        <svg className="h-[18px] w-[18px] max-[900px]:h-4 max-[900px]:w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
          {mobileOpen
            ? <><path d="M6 6l12 12"/><path d="M18 6L6 18"/></>
            : <><path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h16"/></>}
        </svg>
      </button>

      {onToggleColapsar && (
        <button
          className="hidden h-[34px] w-[34px] cursor-pointer items-center justify-center rounded-lg border border-[var(--border)] bg-transparent p-0 text-ink hover:border-[var(--ink-mute)] min-[901px]:inline-flex"
          aria-label={colapsada ? "Expandir menu lateral" : "Recolher menu lateral"}
          aria-pressed={!!colapsada}
          title={colapsada ? "Expandir menu lateral" : "Recolher menu lateral"}
          onClick={onToggleColapsar}
        >
          <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <path d="M9 4v16" />
          </svg>
        </button>
      )}

      {onAbrirBusca && (
        <button
          className="flex max-w-[460px] flex-1 cursor-text items-center gap-2.5 rounded-[8px] border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-left font-sans text-ink-mute hover:border-[var(--ink-mute)] max-[760px]:max-w-none max-[760px]:flex-[0_0_auto] max-[760px]:px-2 max-[760px]:py-1.5"
          onClick={onAbrirBusca}
          aria-label="Pesquisar páginas e recursos"
        >
          <svg className="h-4 w-4 flex-none opacity-85" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" />
          </svg>
          <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[13.5px] max-[760px]:hidden">
            Pesquisar páginas e recursos…
          </span>
          <span className="ml-auto flex-none rounded-[4px] border border-[var(--border)] px-1.5 py-0.5 text-[11px] leading-none text-ink-mute max-[760px]:hidden" aria-hidden>
            ⌘K
          </span>
        </button>
      )}

      <div className="ml-auto flex items-center gap-3">
        <UserPicker user={user} onPreferencias={onPreferencias} onSair={onSair} />
      </div>
    </header>
  );
}
