/* Rio Novo — command palette (busca global ⌘K, estilo Cloudflare).
 *
 * Modal client-only: navega entre páginas/abas + dispara ações (atalhos).
 * Filtra o índice por `podeVer` (abas bloqueadas do Financeiro/Admin somem;
 * abas de módulo passam sempre). Busca via `buscar()` puro (índice estático)
 * + entidades reais do backend (GET /api/busca?q=). Teclado (setas/enter) é
 * do cmdk; Escape/backdrop/foco-trap vêm do shadcn Dialog (Radix).
 *
 * Reescrito sobre shadcn `command` (cmdk) + `Dialog` — ver
 * docs/superpowers/specs/2026-07-08-shadcn-migration-playbook.md (Fase 1,
 * Tarefa 5). A busca é SERVIDOR + índice estático (não é fuzzy-filter do
 * cmdk), então `shouldFilter={false}` no `Command` e os resultados são
 * filtrados/agrupados por nós mesmos; o cmdk só cuida de seleção/teclado.
 *
 * Nada toca `window`/`document` no nível de módulo — só dentro de effects.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import type { Tab } from "./Shell";
import { COMANDOS, buscar, type Comando, type GrupoComando, type ResultadoBusca } from "../lib/searchIndex";
import { comPropriedade } from "../propriedadeScope";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Command, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { X } from "lucide-react";

type Props = {
  aberto: boolean;
  onFechar: () => void;
  onNav: (t: Tab, entidadeId?: string) => void;
  podeVer: (t: Tab) => boolean;
};

// Ordem fixa dos cabeçalhos de entidades reais (depois dos grupos de navegação).
const ORDEM_GRUPO_ENTIDADE = ["Talhões", "Animais", "Lotes de corte", "Categorias", "Fornecedores"];

// Ordem fixa das seções (cabeçalhos) no resultado.
const ORDEM_GRUPO: GrupoComando[] = [
  "Ações",
  "Financeiro",
  "Rebanho",
  "Plantio",
  "Gado de corte",
  "Milho",
  "Administração",
];

// Pontinho colorido por grupo (reusa as vars de atividade da paleta).
const COR_GRUPO: Record<GrupoComando, string> = {
  Financeiro: "var(--info)",
  Rebanho: "var(--leite)",
  Plantio: "var(--outros)",
  "Gado de corte": "var(--cafe-2)",
  Milho: "var(--outros)",
  Administração: "var(--ink-3)",
  Ações: "var(--leite-2)",
};

// Estilo compartilhado das linhas selecionáveis (nav e entidade).
const LINHA_CLASSE =
  "gap-3 rounded-none px-3 py-2.5 text-foreground data-[selected=true]:bg-[color:var(--leite-soft)] data-[selected=true]:text-foreground";

function Dot({ cor }: { cor: string }) {
  return (
    <span
      aria-hidden
      className="h-2 w-2 shrink-0 rounded-full"
      style={{ background: cor, boxShadow: "0 0 0 3px var(--bg-card-2)" }}
    />
  );
}

export function CommandPalette({ aberto, onFechar, onNav, podeVer }: Props) {
  const [query, setQuery] = useState("");
  const [entidades, setEntidades] = useState<ResultadoBusca[]>([]);
  const [buscando, setBuscando] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Índice já filtrado pela permissão — abas bloqueadas não aparecem.
  const visiveis = useMemo(() => COMANDOS.filter((c) => podeVer(c.tab)), [podeVer]);

  // Resultado (índice estático) puro — `buscar()` não toca estado nenhum.
  const resultados = useMemo(() => buscar(visiveis, query), [visiveis, query]);

  // Agrupa preservando a ordem de ORDEM_GRUPO; dentro do grupo, ordem do resultado.
  const grupos = useMemo(() => {
    const out: { grupo: GrupoComando; itens: Comando[] }[] = [];
    for (const g of ORDEM_GRUPO) {
      const itens = resultados.filter((c) => c.grupo === g);
      if (itens.length) out.push({ grupo: g, itens });
    }
    return out;
  }, [resultados]);

  const vazio = query.trim() === "";

  // Busca de entidades reais no backend (GET /api/busca?q=). Só dispara com ≥2
  // chars, com debounce ~200ms; respostas obsoletas (query já mudou) são
  // ignoradas. NUNCA roda no nível de módulo — só dentro deste effect.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setEntidades([]);
      setBuscando(false);
      return;
    }
    let vivo = true;
    setBuscando(true);
    const id = window.setTimeout(() => {
      fetch(`/api/busca?q=${encodeURIComponent(q)}`, { headers: comPropriedade() })
        .then((r) => (r.ok ? r.json() : []))
        .then((data: ResultadoBusca[]) => {
          if (!vivo) return; // resposta obsoleta — a query já mudou
          setEntidades(Array.isArray(data) ? data : []);
          setBuscando(false);
        })
        .catch(() => {
          if (!vivo) return;
          setEntidades([]);
          setBuscando(false);
        });
    }, 200);
    return () => {
      vivo = false;
      window.clearTimeout(id);
    };
  }, [query]);

  // Só entidades cujo `tab` o perfil pode ver (abas de módulo passam sempre).
  const entidadesVisiveis = useMemo(
    () => entidades.filter((e) => podeVer(e.tab as Tab)),
    [entidades, podeVer],
  );

  // Agrupa entidades por `grupo` na ordem fixa de ORDEM_GRUPO_ENTIDADE.
  const gruposEntidade = useMemo(() => {
    const out: { grupo: string; itens: ResultadoBusca[] }[] = [];
    for (const g of ORDEM_GRUPO_ENTIDADE) {
      const itens = entidadesVisiveis.filter((e) => e.grupo === g);
      if (itens.length) out.push({ grupo: g, itens });
    }
    // Qualquer grupo não previsto entra no fim, preservando a ordem de chegada.
    for (const e of entidadesVisiveis) {
      if (!ORDEM_GRUPO_ENTIDADE.includes(e.grupo) && !out.some((o) => o.grupo === e.grupo)) {
        out.push({ grupo: e.grupo, itens: entidadesVisiveis.filter((x) => x.grupo === e.grupo) });
      }
    }
    return out;
  }, [entidadesVisiveis]);

  const semResultados = grupos.length === 0 && gruposEntidade.length === 0 && !buscando;

  // Ao abrir: limpa a query (curadoria some, dicas voltam). Fechar/reabrir sempre
  // parte de um estado limpo, igual ao comportamento anterior.
  useEffect(() => {
    if (aberto) setQuery("");
  }, [aberto]);

  const escolher = (tab: Tab, entidadeId?: string) => {
    onNav(tab, entidadeId);
    onFechar();
  };

  return (
    <Dialog
      open={aberto}
      onOpenChange={(open) => {
        if (!open) onFechar();
      }}
    >
      <DialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        className="top-[12vh] flex max-h-[70vh] max-w-[640px] translate-y-0 flex-col gap-0 overflow-hidden rounded-xl p-0"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          inputRef.current?.focus();
        }}
      >
        <DialogTitle className="sr-only">Busca global</DialogTitle>
        <Command shouldFilter={false} vimBindings={false} className="flex h-full max-h-[70vh] flex-col">
          <div className="relative">
            <CommandInput
              ref={inputRef}
              value={query}
              onValueChange={setQuery}
              placeholder="Pesquisar páginas, ações e recursos…"
              className="h-auto w-full border-0 py-3 pr-12 text-[15px]"
            />
            <button
              type="button"
              onClick={onFechar}
              tabIndex={-1}
              aria-label="Fechar busca"
              className="absolute right-2.5 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-md text-ink-3 transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>

          <CommandList className="max-h-none flex-1 overflow-y-auto overflow-x-hidden px-2 pb-2">
            {vazio && (
              <div className="px-3 pb-2.5 pt-2.5 text-[13px] text-ink-3">
                Digite uma página, ação ou recurso — ex.: <em className="not-italic font-semibold text-ink-2">talhão</em>,{" "}
                <em className="not-italic font-semibold text-ink-2">ferrugem</em>,{" "}
                <em className="not-italic font-semibold text-ink-2">lançar gasto</em>.
              </div>
            )}

            {semResultados ? (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                Nenhum resultado para «{query.trim()}»
              </div>
            ) : (
              <>
                {grupos.map((g) => (
                  <CommandGroup
                    key={g.grupo}
                    heading={vazio && g.grupo === "Financeiro" ? "Sugestões" : g.grupo}
                    className="[&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.08em]"
                  >
                    {g.itens.map((c) => (
                      <CommandItem
                        key={c.id}
                        value={c.id}
                        onSelect={() => escolher(c.tab)}
                        className={LINHA_CLASSE}
                      >
                        <Dot cor={COR_GRUPO[c.grupo]} />
                        <span className="flex min-w-0 flex-1 flex-col leading-tight">
                          <span className="truncate text-[15px] font-medium text-foreground">{c.label}</span>
                          {c.descricao && (
                            <span className="truncate text-xs text-ink-3">{c.descricao}</span>
                          )}
                        </span>
                        <span className="shrink-0 text-[11px] text-[color:var(--ink-mute)]">
                          {c.acao ? "Ação" : c.grupo}
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ))}

                {gruposEntidade.map((g) => (
                  <CommandGroup
                    key={"ent-" + g.grupo}
                    heading={g.grupo}
                    className="[&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.08em]"
                  >
                    {g.itens.map((e) => (
                      <CommandItem
                        key={e.tipo + ":" + e.entidadeId}
                        value={e.tipo + ":" + e.entidadeId}
                        onSelect={() => escolher(e.tab as Tab, e.entidadeId)}
                        className={LINHA_CLASSE}
                      >
                        <Dot cor="var(--ink-3)" />
                        <span className="flex min-w-0 flex-1 flex-col leading-tight">
                          <span className="truncate text-[15px] font-medium text-foreground">{e.label}</span>
                          {e.sublabel && <span className="truncate text-xs text-ink-3">{e.sublabel}</span>}
                        </span>
                        <span className="shrink-0 text-[11px] text-[color:var(--ink-mute)]">{e.grupo}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ))}

                {buscando && (
                  <div className="px-3.5 pb-2.5 pt-2 text-xs tracking-wide text-[color:var(--ink-mute)]">
                    buscando…
                  </div>
                )}
              </>
            )}
          </CommandList>

          <div className="flex items-center gap-4 border-t border-[color:var(--rule-soft)] bg-muted px-3.5 py-2.5">
            <span className="inline-flex items-center gap-1.5 text-[11px] text-[color:var(--ink-mute)]">
              <kbd className="grid h-[17px] min-w-[17px] place-items-center rounded-[5px] border border-border bg-card px-1 text-[11px] text-ink-3">↑</kbd>
              <kbd className="grid h-[17px] min-w-[17px] place-items-center rounded-[5px] border border-border bg-card px-1 text-[11px] text-ink-3">↓</kbd>
              navegar
            </span>
            <span className="inline-flex items-center gap-1.5 text-[11px] text-[color:var(--ink-mute)]">
              <kbd className="grid h-[17px] min-w-[17px] place-items-center rounded-[5px] border border-border bg-card px-1 text-[11px] text-ink-3">↵</kbd>
              selecionar
            </span>
            <span className="inline-flex items-center gap-1.5 text-[11px] text-[color:var(--ink-mute)]">
              <kbd className="grid h-[17px] min-w-[17px] place-items-center rounded-[5px] border border-border bg-card px-1 text-[11px] text-ink-3">esc</kbd>
              fechar
            </span>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
