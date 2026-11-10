import { Search } from "lucide-react";
import { VacaIcon } from "@/components/icons/VacaIcon";
import { AlternadorDoCabecalho } from "./VisualizacaoConsulta";
import "./app-header.css";
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
function UserPicker({ user, onPreferencias, onAcessos, onSair }: {
  user: User;
  onPreferencias?: () => void;
  onAcessos?: () => void;
  onSair?: () => void;
}) {
  const papelNome = (u: User) => (u.papel === "personalizado" ? "Personalizado" : PAPEIS[u.papel]?.nome || "");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="group flex min-h-[var(--campo-altura)] cursor-pointer items-center gap-2.5 rounded-[8px] border border-transparent bg-transparent py-1 pl-1.5 pr-2 font-sans hover:bg-[var(--bg-card)]"
          aria-haspopup="menu"
          aria-label="Menu da conta"
        >
          <span className="grid h-8 w-8 place-items-center rounded-full bg-[var(--fin-nav-selected,var(--accent))] font-sans text-sm font-semibold text-foreground">
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
        {onPreferencias && <AcctItem icon={AccIcon.gear} onSelect={onPreferencias}>Preferências</AcctItem>}
        {onAcessos && (user.dono || user.flags.includes("gerenciarAcessos")) && <AcctItem icon={AccIcon.gear} onSelect={onAcessos}>Acessos</AcctItem>}
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

export function Header({ user, mobileOpen, onMobileToggle, colapsada, onToggleColapsar, onAbrirBusca, onBuscarAnimal, onPreferencias, onAcessos, onSair }: {
  user: User;
  mobileOpen: boolean;
  onMobileToggle: (open: boolean) => void;
  colapsada?: boolean;
  onToggleColapsar?: () => void;
  onAbrirBusca?: (termo?: string) => void;
  onBuscarAnimal?: () => void;
  onPreferencias?: () => void;
  onAcessos?: () => void;
  onSair?: () => void;
}) {
  return (
    <header className="app-header print:hidden">
      <button
        className="hidden h-[38px] w-[38px] cursor-pointer items-center justify-center rounded-lg border border-[var(--border)] bg-transparent p-0 text-ink max-[900px]:flex max-[900px]:h-11 max-[900px]:w-11 shrink-0"
        aria-label={mobileOpen ? "Fechar menu" : "Abrir menu"}
        aria-expanded={mobileOpen}
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
        <div className="app-header-busca">
          <Search size={17} aria-hidden />
          <input
            type="search"
            aria-label="Pesquisar páginas e recursos"
            aria-haspopup="dialog"
            aria-keyshortcuts="Control+k Meta+k"
            placeholder="Buscar no Terrano"
            value=""
            onClick={() => onAbrirBusca()}
            onChange={e => onAbrirBusca(e.currentTarget.value)}
            onKeyDown={e => { if (e.key === "Enter") onAbrirBusca(); }}
          />
          <kbd aria-hidden>Ctrl/⌘ K</kbd>
        </div>
      )}
      {onBuscarAnimal && (
        <button className="app-header-animal" type="button" onClick={onBuscarAnimal} aria-label="Buscar animal" aria-haspopup="dialog" aria-keyshortcuts="Control+Shift+k Meta+Shift+k">
          <VacaIcon width={18} height={18} aria-hidden />
          <span>Buscar animal</span>
        </button>
      )}
      <div className="app-header-visualizacao"><AlternadorDoCabecalho /></div>
      <div className="app-header-perfil">
        <UserPicker user={user} onPreferencias={onPreferencias} onAcessos={onAcessos} onSair={onSair} />
      </div>
    </header>
  );
}
