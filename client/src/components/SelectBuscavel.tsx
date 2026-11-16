import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Check, ChevronsUpDown, Loader2, X } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type OpcaoBuscavel = { id: string; nome: string; ativo?: boolean };
export type ConsultaBuscavel = { busca: string; selecionadoId?: string };
export type ResultadoBuscavel<T extends OpcaoBuscavel> = { itens: T[]; total: number };

const ATRASO_BUSCA_MS = 200;
const rotuloOpcao = (o: OpcaoBuscavel) => (o.ativo === false ? `${o.nome} (inativo)` : o.nome);

/**
 * Dropdown de seleção única com busca digitada no servidor. A lista só mostra o que `buscar` devolve
 * (o filtro do cmdk fica desligado); `selecionadoId` pede a opção já escolhida, mesmo inativa, para
 * exibir seu nome sem depender da busca atual.
 */
export function SelectBuscavel<T extends OpcaoBuscavel>({ rotulo, valor, onChange, buscar, somenteLeitura, erroCampo, placeholder = "Selecione ou digite", detalhe, limpavel = true, contentClassName, containerPopover }: {
  rotulo: string;
  valor: string;
  onChange: (id: string, opcao?: T) => void;
  buscar: (consulta: ConsultaBuscavel) => Promise<ResultadoBuscavel<T>>;
  somenteLeitura?: boolean;
  /** Mensagem de erro do campo, anunciada com role="alert". */
  erroCampo?: string;
  placeholder?: string;
  /** Informação extra sobre a opção selecionada, abaixo do campo. */
  detalhe?: (opcao: T) => ReactNode;
  /** Mostra o botão que limpa a seleção (padrão). */
  limpavel?: boolean;
  /** Classes extras do painel (ex.: z-index quando o campo vive dentro de um modal). */
  contentClassName?: string;
  containerPopover?: HTMLElement | null;
}) {
  const id = useId();
  const [aberto, setAberto] = useState(false), [busca, setBusca] = useState("");
  const [itens, setItens] = useState<T[]>([]), [total, setTotal] = useState(0);
  const [selecionada, setSelecionada] = useState<T | null>(null);
  const [erro, setErro] = useState<string | null>(null), [carregando, setCarregando] = useState(false), [revisao, setRevisao] = useState(0);
  const buscarRef = useRef(buscar);
  buscarRef.current = buscar;

  // Nome da opção escolhida: consulta por ID, inclusive de opção inativa ou fora da primeira página.
  useEffect(() => {
    if (!valor) { setSelecionada(null); return; }
    if (selecionada?.id === valor) return;
    let vivo = true;
    buscarRef.current({ busca: "", selecionadoId: valor })
      .then(r => { if (vivo) setSelecionada(r.itens.find(i => i.id === valor) ?? null); })
      .catch(() => { if (vivo) setSelecionada(null); });
    return () => { vivo = false; };
  }, [valor, selecionada?.id, revisao]);

  // Lista do painel aberto, com atraso para não consultar a cada tecla.
  useEffect(() => {
    if (!aberto || somenteLeitura) return;
    let vivo = true; setCarregando(true); setErro(null);
    const timer = setTimeout(() => {
      buscarRef.current({ busca })
        .then(r => { if (vivo) { setItens(r.itens); setTotal(r.total); } })
        .catch(e => { if (vivo) { setItens([]); setTotal(0); setErro(e instanceof Error ? e.message : String(e)); } })
        .finally(() => { if (vivo) setCarregando(false); });
    }, ATRASO_BUSCA_MS);
    return () => { vivo = false; clearTimeout(timer); };
  }, [aberto, busca, revisao, somenteLeitura]);

  const mudarAberto = useCallback((proximo: boolean) => { setAberto(proximo); if (!proximo) setBusca(""); }, []);
  const escolher = (opcao: T) => { setSelecionada(opcao); onChange(opcao.id, opcao); mudarAberto(false); };
  const limpar = () => { setSelecionada(null); onChange(""); };

  const nomeAtual = !valor ? null : selecionada?.id === valor ? rotuloOpcao(selecionada) : "Referência planejada";
  if (somenteLeitura) return <span>{nomeAtual ?? "Não informado"}</span>;

  return <div className="grid gap-1.5">
    <label htmlFor={id} className="text-sm font-medium">{rotulo}</label>
    <Popover open={aberto} onOpenChange={mudarAberto}>
      <div className="relative">
        <PopoverTrigger asChild>
          <button id={id} type="button" role="combobox" aria-expanded={aberto} aria-haspopup="listbox" aria-invalid={erroCampo ? true : undefined} aria-describedby={erroCampo ? `${id}-erro` : undefined}
            className={cn("flex min-h-10 w-full items-center justify-between gap-2 rounded-lg border bg-card px-3 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", valor && limpavel ? "pr-16" : "pr-3", erroCampo ? "border-destructive" : "border-border")}>
            <span className={cn("truncate", !nomeAtual && "text-ink-3")}>{nomeAtual ?? placeholder}</span>
            <ChevronsUpDown className="ml-auto size-4 shrink-0 text-ink-3" aria-hidden="true" />
          </button>
        </PopoverTrigger>
        {valor && limpavel && <button type="button" aria-label={`Limpar ${rotulo}`} onClick={limpar} className="absolute right-9 top-1/2 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded-full text-ink-3 hover:bg-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><X className="size-3.5" aria-hidden="true" /></button>}
      </div>
      <PopoverContent container={containerPopover} align="start" className={cn("w-[var(--radix-popover-trigger-width)] min-w-[280px] p-0", contentClassName)}>
        <Command shouldFilter={false}>
          <CommandInput value={busca} onValueChange={setBusca} placeholder={`Buscar ${rotulo.toLowerCase()}`} />
          <CommandList className="max-h-64">
            {erro ? <div className="grid gap-2 p-3 text-sm"><p role="alert" className="text-destructive">{erro}</p><button type="button" className="justify-self-start text-sm font-medium underline" onClick={() => setRevisao(r => r + 1)}>Tentar novamente</button></div>
              : carregando && !itens.length ? <div role="status" className="flex items-center gap-2 p-3 text-sm text-ink-3"><Loader2 className="size-4 animate-spin" aria-hidden="true" />Carregando…</div>
              : <>
                <CommandEmpty>{busca ? `Nenhum resultado para “${busca}”.` : "Nenhuma opção disponível."}</CommandEmpty>
                <CommandGroup>
                  {itens.map(opcao => <CommandItem key={opcao.id} value={opcao.id} onSelect={() => escolher(opcao)} className="cursor-pointer py-2.5">
                    <Check className={cn("mr-2 size-4 shrink-0", opcao.id === valor ? "opacity-100" : "opacity-0")} aria-hidden="true" />
                    <span className="min-w-0 break-words">{rotuloOpcao(opcao)}</span>
                  </CommandItem>)}
                </CommandGroup>
              </>}
          </CommandList>
          {!erro && total > itens.length && <p className="border-t border-border px-3 py-2 text-xs text-ink-3">Mostrando {itens.length} de {total}. Digite para refinar.</p>}
        </Command>
      </PopoverContent>
    </Popover>
    {valor && selecionada?.id === valor && detalhe?.(selecionada)}
    {erroCampo && <p id={`${id}-erro`} role="alert" className="text-sm text-destructive">{erroCampo}</p>}
  </div>;
}
