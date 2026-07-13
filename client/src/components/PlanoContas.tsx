/* Rio Novo — Plano de Contas (categorias) */

import { useState } from "react";
import R from "../data/rionovo";
import { ReportHeader } from "./Shell";
import { fmtMoney } from "./charts";
import type { Tab } from "./Shell";
import { useToast } from "./Toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/* Mesmos consts do Lançar (Fase 3 slice 2) — valores finais da typescale
 * pré-migração: label 14/600 (ink-2), input/textarea 16px. */
const FIELD = "flex flex-col gap-1.5";
const FIELD_LABEL = "gap-0 text-sm font-semibold text-ink-2";
const INPUT =
  "h-auto bg-card px-3.5 py-[11px] md:text-base focus-visible:border-foreground focus-visible:ring-0 focus-visible:ring-offset-0";
const INPUT_ERROR =
  "border-prejuizo focus-visible:border-prejuizo [background-image:linear-gradient(0deg,rgba(198,40,40,0.04),rgba(198,40,40,0.04))]";
const BTN_PRIMARY =
  "h-auto gap-2.5 px-[22px] py-3 text-[13px] font-normal uppercase tracking-[0.08em] disabled:pointer-events-auto disabled:cursor-not-allowed disabled:bg-border disabled:text-[color:var(--ink-mute)] disabled:opacity-100";
const BTN_GHOST = "h-auto px-3 py-1.5 text-xs font-normal tracking-[0.04em] text-ink-2 hover:text-ink-2";
const BTN_MINI =
  "h-auto border-foreground bg-transparent px-3 py-[5px] text-[11px] font-normal tracking-[0.06em] text-foreground hover:border-mast hover:bg-mast hover:text-mast-ink";

function NewCategoryModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (v: { nome: string; grupoId: string; pilha: "Custeio" | "Investimento"; descricao: string }) => void;
}) {
  const [nome, setNome] = useState("");
  const [grupoId, setGrupoId] = useState("insumos-animais");
  const [pilha, setPilha] = useState<"Custeio" | "Investimento">("Custeio");
  const [descricao, setDescricao] = useState("");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nomesExistentes: string[] = R.gruposPlano.flatMap((g: any) => g.categorias.map((c: any) => c.nome.toLowerCase()));
  const jaExiste = nomesExistentes.includes(nome.trim().toLowerCase());

  const submit = () => {
    if (!nome.trim() || jaExiste) return;
    onCreate({ nome: nome.trim(), grupoId, pilha, descricao: descricao.trim() });
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent
        showCloseButton={false}
        className="w-[520px] max-w-[92vw] bg-background p-0 shadow-[0_18px_60px_rgba(20,25,26,0.25)]"
      >
        <DialogHeader className="flex-row items-center justify-between space-y-0 bg-mast px-6 py-[18px]">
          <DialogTitle className="font-serif text-[22px] font-normal text-mast-ink">Nova categoria</DialogTitle>
          <DialogClose
            className="cursor-pointer border-0 bg-transparent text-xl text-mast-ink outline-none"
            aria-label="Fechar"
          >
            ×
          </DialogClose>
        </DialogHeader>
        <div className="flex flex-col gap-4 px-6 py-[22px]">
          <div className={FIELD}>
            <Label className={FIELD_LABEL} htmlFor="cat-nome">Nome da categoria</Label>
            <Input
              id="cat-nome"
              className={cn(INPUT, nome.trim() && jaExiste && INPUT_ERROR)}
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex.: Ração de cavalo"
              aria-invalid={nome.trim() && jaExiste ? true : undefined}
            />
            {nome.trim() && jaExiste && (
              <span className="mt-0.5 text-[12.5px] font-semibold tracking-[0.01em] text-prejuizo">
                Já existe uma categoria com esse nome.
              </span>
            )}
          </div>
          <div className={FIELD}>
            <Label className={FIELD_LABEL}>Grupo</Label>
            <div className="chip-group">
              {R.gruposPlano.map((g: { id: string; nome: string }) => (
                <button
                  key={g.id}
                  type="button"
                  className="chip"
                  aria-pressed={grupoId === g.id}
                  onClick={() => setGrupoId(g.id)}
                >
                  {g.nome}
                </button>
              ))}
            </div>
          </div>
          <div className={FIELD}>
            <Label className={FIELD_LABEL}>Pilha</Label>
            <div className="chip-group">
              {(["Custeio", "Investimento"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  className="chip"
                  aria-pressed={pilha === p}
                  onClick={() => setPilha(p)}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div className={FIELD}>
            <Label className={FIELD_LABEL} htmlFor="cat-desc">Descrição (opcional)</Label>
            <Textarea
              id="cat-desc"
              className={cn(INPUT, "min-h-[70px] resize-y")}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ajuda a IA a categorizar lançamentos futuros."
            />
          </div>
        </div>
        <div className="flex justify-end gap-2.5 border-t border-border px-6 py-4">
          <Button variant="outline" className={BTN_GHOST} onClick={onClose}>
            Cancelar
          </Button>
          <Button className={BTN_PRIMARY} onClick={submit} disabled={!nome.trim() || jaExiste}>
            Criar categoria →
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TreeSub({ sub }: { sub: { nome: string; total: number; lancamentos: number } }) {
  return (
    <div className="group grid grid-cols-[14px_1fr_auto_auto] items-center gap-3 py-[7px] pr-3 font-sans text-[13px]">
      <span className="font-serif text-[color:var(--ink-mute)]">·</span>
      <span className="text-[15px] text-ink-2 group-hover:text-foreground">{sub.nome}</span>
      <span className="mono-nums font-serif text-sm tabular-nums">{fmtMoney(sub.total)}</span>
      <span className="text-[11px] text-ink-3">{sub.lancamentos} lançam.</span>
    </div>
  );
}

function TreeCat({
  cat,
  expanded,
  onToggle,
  onAddSub,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cat: any;
  expanded: boolean;
  onToggle: () => void;
  onAddSub: (catNome: string) => void;
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let subs: any[] = cat.subcategorias || [];
  let total: number = cat.total || 0;
  let lancamentos: number = cat.lancamentos || 0;
  if (cat.ref) {
    const d = R.categoriasDetalhe[cat.ref];
    if (d) {
      subs = d.subcategorias.map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (s: any) => ({ nome: s.nome, total: s.total, lancamentos: Math.round(s.share * 4 + 10) }),
      );
      total = d.total;
      lancamentos = d.subcategorias.reduce(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (s: number, x: any) => s + Math.round(x.share * 4 + 10),
        0,
      );
    }
  }

  return (
    <div>
      <button
        className="grid w-full cursor-pointer grid-cols-[1fr_auto_auto_auto] items-center gap-3 border-b border-[color:var(--rule-soft)] bg-transparent px-3.5 py-2.5 text-left font-sans transition-colors hover:bg-card"
        onClick={onToggle}
        aria-expanded={expanded}
      >
        <span className="text-base font-semibold text-foreground">{cat.nome}</span>
        <span className="mono-nums font-serif text-[15px] font-normal tabular-nums">{fmtMoney(total)}</span>
        <span className="text-[11px] font-normal tabular-nums text-ink-3">
          {lancamentos} lançam. · {subs.length} {subs.length === 1 ? "subcategoria" : "subcategorias"}
        </span>
        <span className="font-serif text-sm font-normal text-ink-3" aria-hidden>{expanded ? "▾" : "›"}</span>
      </button>
      {expanded && (
        <div className="pb-2.5 pl-[18px] pt-1.5">
          {subs.map((s, i) => (
            <TreeSub key={i} sub={s} />
          ))}
          <button
            className="grid w-full cursor-pointer grid-cols-[14px_1fr] gap-3 bg-transparent py-2 pr-3 text-left font-serif text-xs italic text-ink-3 transition-colors hover:text-foreground"
            type="button"
            onClick={() => onAddSub(cat.nome)}
          >
            <span>+</span>
            <span>adicionar subcategoria</span>
          </button>
        </div>
      )}
    </div>
  );
}

function TreeGroup({
  grupo,
  search,
  defaultOpen,
  onAddSub,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  grupo: any;
  search: string;
  defaultOpen: boolean;
  onAddSub: (catNome: string) => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [openCats, setOpenCats] = useState<Record<string, boolean>>({});

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const totalG = grupo.categorias.reduce((sum: number, c: any) => {
    if (c.ref) return sum + (R.categoriasDetalhe[c.ref]?.total || 0);
    return sum + (c.total || 0);
  }, 0);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cntG = grupo.categorias.reduce((sum: number, c: any) => {
    if (c.ref) {
      const d = R.categoriasDetalhe[c.ref];
      if (d) return sum + d.subcategorias.length;
      return sum;
    }
    return sum + (c.subcategorias?.length || 0);
  }, 0);

  const filtered = search
    ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
      grupo.categorias.filter((c: any) => c.nome.toLowerCase().includes(search.toLowerCase()))
    : grupo.categorias;

  if (search && filtered.length === 0) return null;

  return (
    <div className="border-b border-border py-3">
      <button
        className="grid w-full cursor-pointer grid-cols-[1fr_auto_auto_auto] items-center gap-3 bg-transparent px-2 py-3 text-left transition-colors hover:bg-card"
        onClick={() => setOpen(!open)}
      >
        <span className="font-serif text-[22px] tracking-[-0.005em]">
          {grupo.nome}
          <small className="mt-1 block font-sans text-[11px] uppercase tracking-[0.14em] text-ink-3">
            {grupo.pilha} · {grupo.categorias.length} categorias · {cntG} subcategorias
          </small>
        </span>
        <span className="mono-nums font-serif text-lg tabular-nums">{fmtMoney(totalG)}</span>
        <span className="font-sans text-xs tabular-nums text-ink-3">YTD 2026</span>
        <span className="font-serif text-lg text-ink-3">{open ? "▾" : "›"}</span>
      </button>
      {open && (
        <div className="ml-2 border-l border-[color:var(--rule-soft)]">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {filtered.map((c: any) => (
            <TreeCat
              key={c.id}
              cat={c}
              expanded={!!openCats[c.id]}
              onToggle={() => setOpenCats((s) => ({ ...s, [c.id]: !s[c.id] }))}
              onAddSub={onAddSub}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function exportarCSV() {
  const linhas: string[] = ["Grupo;Pilha;Categoria;Subcategoria;Total YTD"];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  R.gruposPlano.forEach((g: any) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    g.categorias.forEach((c: any) => {
      const detalhe = c.ref ? R.categoriasDetalhe[c.ref] : null;
      const subs = detalhe?.subcategorias || c.subcategorias || [];
      if (subs.length === 0) {
        linhas.push([g.nome, g.pilha, c.nome, "", String(c.total || detalhe?.total || 0)].join(";"));
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        subs.forEach((s: any) => {
          linhas.push([g.nome, g.pilha, c.nome, s.nome, String(s.total)].join(";"));
        });
      }
    });
  });
  const blob = new Blob([linhas.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `plano-contas-rio-novo-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return linhas.length - 1; // sem o header
}

export function PlanoContas({ onNav: _onNav }: { onNav: (t: Tab) => void }) {
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [ignored, setIgnored] = useState<Record<number, boolean>>({});

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const totalCat: number = R.gruposPlano.reduce((s: number, g: any) => s + g.categorias.length, 0);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const totalSub: number = R.gruposPlano.reduce((s: number, g: any) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return s + g.categorias.reduce((ss: number, c: any) => {
      if (c.ref) return ss + (R.categoriasDetalhe[c.ref]?.subcategorias?.length || 0);
      return ss + (c.subcategorias?.length || 0);
    }, 0);
  }, 0);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sugestoesVisiveis = (R.sugestoesPlano as any[]).filter((_, i) => !ignored[i]);

  const semResultados = !!search.trim() && // eslint-disable-next-line @typescript-eslint/no-explicit-any
    R.gruposPlano.every((g: any) => g.categorias.every((c: any) => !c.nome.toLowerCase().includes(search.toLowerCase())));

  const handleExport = () => {
    const n = exportarCSV();
    toast.success("CSV exportado", `${n} linhas geradas. Procure o arquivo em sua pasta de downloads.`);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleCreate = (v: { nome: string; grupoId: string; pilha: string; descricao: string }) => {
    setShowNew(false);
    const g = R.gruposPlano.find((x: { id: string }) => x.id === v.grupoId);
    toast.success("Categoria criada", `“${v.nome}” foi adicionada ao grupo ${g?.nome || v.grupoId}.`);
  };

  return (
    <div className="shell-wide">
      <ReportHeader eyebrow="Financeiro · Plano de contas" subtitle="Categorias" updatedAt={R.UPDATED_AT} />

      <div className="flex items-center gap-3 border-b border-border py-[18px]">
        <div className="flex w-[320px] items-center gap-2 border border-border bg-card px-3 py-[7px]">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden className="text-ink-2">
            <circle cx="11" cy="11" r="7"></circle>
            <line x1="16" y1="16" x2="21" y2="21"></line>
          </svg>
          <input
            className="flex-1 border-0 bg-transparent font-sans text-[15px] font-medium text-foreground outline-none"
            placeholder="Buscar categoria ou subcategoria…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Buscar categoria"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="Limpar busca"
              className="cursor-pointer border-0 bg-transparent p-0 text-base leading-none text-ink-3"
            >
              ×
            </button>
          )}
        </div>
        <div className="ml-auto flex gap-2.5 print:hidden">
          <Button variant="outline" className={BTN_GHOST} onClick={handleExport} title="Baixa um arquivo CSV com todo o plano de contas">
            Exportar CSV
          </Button>
          <Button className={BTN_PRIMARY} onClick={() => setShowNew(true)}>
            + Nova categoria
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-[1.5fr_1fr] gap-9 pb-[60px] pt-6">
        <div>
          <div className="caption mb-3.5 italic">
            Toque um grupo para abrir suas categorias. Toque uma categoria para ver as subcategorias.
          </div>
          {semResultados ? (
            <div className="flex flex-col items-center gap-2 px-6 py-14 text-center text-ink-2">
              <div className="mb-1.5 grid h-11 w-11 place-items-center rounded-full border border-dashed border-border font-serif text-[22px] text-ink-3">⌕</div>
              <div className="font-serif text-xl font-medium text-foreground">Nada encontrado para "{search}"</div>
              <div className="max-w-[42ch] text-sm text-ink-2">
                Verifique a ortografia ou abra "+ Nova categoria" se for o caso de cadastrar algo novo.
              </div>
              <div className="mt-2.5 flex gap-2.5">
                <Button variant="outline" className={BTN_GHOST} onClick={() => setSearch("")}>Limpar busca</Button>
                <Button className={BTN_PRIMARY} onClick={() => setShowNew(true)}>+ Nova categoria</Button>
              </div>
            </div>
          ) : (
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            R.gruposPlano.map((g: any, i: number) => (
              <TreeGroup
                key={g.id}
                grupo={g}
                search={search}
                defaultOpen={i < 2}
                onAddSub={(catNome) => {
                  const sub = window.prompt(`Nome da nova subcategoria em "${catNome}":`);
                  if (sub && sub.trim()) {
                    toast.success("Subcategoria adicionada", `“${sub.trim()}” entrou em ${catNome}.`);
                  }
                }}
              />
            ))
          )}
        </div>

        <div className="flex flex-col gap-3.5">
          <h4 className="m-0 text-[11px] font-medium uppercase tracking-[0.16em] text-ink-3">Resumo</h4>
          <div className="grid grid-cols-2 border border-border bg-card">
            {[
              { l: "Grupos", v: String(R.gruposPlano.length) },
              { l: "Categorias", v: String(totalCat) },
              { l: "Subcategorias", v: String(totalSub) },
              { l: "Última edição", v: "23/mai/2026", small: true },
            ].map((cell) => (
              <div
                key={cell.l}
                className="flex flex-col gap-1 border-b border-r border-[color:var(--rule-soft)] px-4 py-3.5 even:border-r-0 [&:nth-last-child(-n+2)]:border-b-0"
              >
                <span className="text-[11px] uppercase tracking-[0.14em] text-ink-3">{cell.l}</span>
                <span className={cn("mono-nums font-serif tabular-nums tracking-[-0.005em]", cell.small ? "text-sm" : "text-[22px]")}>
                  {cell.v}
                </span>
              </div>
            ))}
          </div>

          <h4 className="m-0 mt-[22px] text-[11px] font-medium uppercase tracking-[0.16em] text-ink-3">Sugestões da IA</h4>
          {sugestoesVisiveis.length === 0 ? (
            <div className="caption italic py-2">
              Nenhuma sugestão pendente. A IA volta a sugerir quando notar novos padrões.
            </div>
          ) : (
            <div className="flex flex-col gap-3.5">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {(R.sugestoesPlano as any[]).map(
                (s: { titulo: string; detalhe: string; acao: string }, i: number) => {
                  if (ignored[i]) return null;
                  return (
                    <div key={i} className="flex flex-col gap-2.5 border border-border bg-card px-[18px] py-4">
                      <div className="flex items-center gap-2">
                        <span className="h-1.5 w-1.5 bg-lucro"></span>
                        <span className="text-[10px] uppercase tracking-[0.2em] text-ink-3">Sugestão</span>
                      </div>
                      <div className="font-serif text-[17px] font-medium leading-[1.4] tracking-[-0.005em] text-foreground">{s.titulo}</div>
                      <div className="text-sm leading-[1.5] text-ink-3">{s.detalhe}</div>
                      <div className="mt-1 flex gap-2">
                        <Button
                          variant="outline"
                          className={BTN_MINI}
                          onClick={() => {
                            setIgnored((cur) => ({ ...cur, [i]: true }));
                            toast.success("Sugestão aplicada", s.titulo);
                          }}
                        >
                          {s.acao}
                        </Button>
                        <Button
                          variant="outline"
                          className={cn(BTN_MINI, "border-border text-ink-3 hover:border-mast")}
                          onClick={() => {
                            setIgnored((cur) => ({ ...cur, [i]: true }));
                            toast.info("Sugestão dispensada", "Você pode revisar mais tarde se a IA reabri-la.");
                          }}
                        >
                          Ignorar
                        </Button>
                      </div>
                    </div>
                  );
                },
              )}
            </div>
          )}

          <div className="mt-2.5 border-l-[3px] border-l-leite bg-card px-[18px] py-4 font-serif text-[15px] italic leading-[1.5] text-ink-2">
            A IA observa os lançamentos novos e sugere divisões ou agrupamentos quando detecta padrões. Você decide
            se aceita.
          </div>
        </div>
      </div>

      {showNew && <NewCategoryModal onClose={() => setShowNew(false)} onCreate={handleCreate} />}
    </div>
  );
}
