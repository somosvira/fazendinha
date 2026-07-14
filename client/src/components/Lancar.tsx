/* Rio Novo — Lançar gasto */

import { useEffect, useMemo, useRef, useState } from "react";
import type { Tab } from "./Shell";
import { useToast } from "./Toast";
import { fmtMoneyExact } from "./charts";
import { formatBRDate, getHoje } from "../lib/hoje";
import { Loader } from "./Loading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  useCadastros,
  uploadPendenteNF,
  cancelarPendenteNF,
  criarLancamento,
} from "../financeiro/api";
import type { Cadastros, FornecedorDTO, GrupoDTO, PendenteNF } from "../financeiro/api";

const RASCUNHO_KEY = "rionovo:lancar:rascunho";

/* ─── Classes compartilhadas do formulário (Tailwind) ─────────────────────
 * Valores finais herdados da typescale pré-migração: label 14/600 (ink-2),
 * input/textarea 16px, section-title 14/600/0.10em. --pos/--neg de antes
 * viram lucro/prejuizo (aliases equivalentes em base.css). */
const FIELD = "flex flex-col gap-1.5";
const FIELD_LABEL = "gap-0 text-sm font-semibold text-ink-2";
const INPUT =
  "h-auto bg-card px-3.5 py-[11px] md:text-base focus-visible:border-foreground focus-visible:ring-0 focus-visible:ring-offset-0";
const SECTION = "flex flex-col gap-3.5";
const SECTION_TITLE =
  "border-b border-[color:var(--rule-soft)] pb-1.5 font-sans text-sm font-semibold uppercase tracking-[0.10em] text-ink-3";
const BTN_PRIMARY =
  "h-auto gap-2.5 px-[22px] py-3 text-[13px] font-normal uppercase tracking-[0.08em] disabled:pointer-events-auto disabled:cursor-not-allowed disabled:bg-border disabled:text-[color:var(--ink-mute)] disabled:opacity-100";
const BTN_SECONDARY =
  "h-auto px-5 py-2.5 text-[13px] font-normal uppercase tracking-[0.08em] hover:border-mast hover:bg-mast hover:text-mast-ink";
const BTN_GHOST = "h-auto px-3 py-1.5 text-xs font-normal tracking-[0.04em] text-ink-2 hover:text-ink-2";
const CAT_CHIP =
  "cursor-pointer border border-border bg-transparent px-3 py-[5px] font-sans text-sm font-semibold tracking-[0.02em] text-ink-2 transition-colors hover:border-ink-3 hover:text-foreground aria-pressed:border-mast aria-pressed:bg-mast aria-pressed:text-mast-ink";
const UPLOAD_ZONE =
  "flex cursor-pointer flex-col items-center justify-center gap-3 border-2 border-dashed border-border bg-card px-7 py-9 text-center transition-colors hover:border-ink-3 hover:bg-accent";
const UPLOAD_ICON = "grid h-12 w-12 place-items-center border border-ink-3 font-serif text-[28px] text-ink-3";
const IA_BANNER = "flex items-center gap-3 border-l-[3px] border-l-lucro bg-card px-4 py-3";
const IA_BANNER_DOT = "h-2 w-2 rounded-full bg-lucro";
const IA_BANNER_BODY = "flex-1 text-[13px] text-ink-2 [&_strong]:text-foreground";
const AC_DROPDOWN =
  "absolute inset-x-0 top-[calc(100%+4px)] z-[8] max-h-[260px] overflow-y-auto border border-ink-3 bg-card shadow-[0_6px_20px_rgba(20,25,26,0.12)]";
const AC_OPTION =
  "flex cursor-pointer items-baseline justify-between gap-2.5 border-b border-[color:var(--rule-soft)] px-3.5 py-2.5 last:border-b-0 hover:bg-accent";
const TOGGLE_ROW = "flex items-center justify-between gap-3 border border-border bg-card px-4 py-3";

function Req() {
  return <span className="ml-1 text-prejuizo">*</span>;
}

type RascunhoSaida = {
  fornecedor: string;
  fornecedorId?: number | null;
  valor: string;
  data: string;
  // IDs reais do backend (números). Rascunhos antigos (era mock) guardavam
  // strings — são descartados campo a campo na restauração (asNum).
  contaId?: number | null;
  atividade: number | string | null;
  investimento: boolean;
  cat: { grupoId: number | string | null; categoriaId: number | string | null };
  pago: boolean;
  obs: string;
  ts: number;
};

// Coerção defensiva: rascunhos da era mock tinham ids string ("racao",
// "bb-1234-5") que não existem no banco — viram null e o usuário re-seleciona.
function asNum(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function loadRascunho(): RascunhoSaida | null {
  try {
    const raw = localStorage.getItem(RASCUNHO_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as RascunhoSaida;
  } catch { return null; }
}
function saveRascunho(r: RascunhoSaida) {
  try { localStorage.setItem(RASCUNHO_KEY, JSON.stringify(r)); } catch { /* storage cheio */ }
}
function clearRascunho() {
  try { localStorage.removeItem(RASCUNHO_KEY); } catch { /* noop */ }
}

type CatValue = { grupoId: number | null; categoriaId: number | null };

// O plano de contas real não tem nível de subcategoria (ver schema Prisma) —
// o cascade agora é Grupo → Categoria, com dados de GET /api/cadastros.
function CategoryCascade({
  grupos,
  value,
  onChange,
}: {
  grupos: GrupoDTO[];
  value: CatValue;
  onChange: (v: CatValue) => void;
}) {
  const grupoSel = grupos.find((g) => g.id === value.grupoId);

  const setGrupo = (gid: number) => onChange({ grupoId: gid, categoriaId: null });
  const setCategoria = (cid: number) => onChange({ ...value, categoriaId: cid });

  return (
    <div className="flex flex-col gap-2.5 border border-border bg-card px-4 py-3.5">
      <div className="grid grid-cols-[86px_1fr] items-center gap-3">
        <span className="text-[11px] uppercase tracking-[0.14em] text-ink-3">Grupo</span>
        <div className="flex flex-wrap gap-1.5">
          {grupos.map((g) => (
            <button
              key={g.id}
              type="button"
              className={CAT_CHIP}
              aria-pressed={value.grupoId === g.id}
              onClick={() => setGrupo(g.id)}
            >
              {g.nome}
            </button>
          ))}
        </div>
      </div>
      {grupoSel && (
        <div className="grid grid-cols-[86px_1fr] items-center gap-3">
          <span className="text-[11px] uppercase tracking-[0.14em] text-ink-3">Categoria</span>
          <div className="flex flex-wrap gap-1.5">
            {grupoSel.categorias.map((c) => (
              <button
                key={c.id}
                type="button"
                className={CAT_CHIP}
                aria-pressed={value.categoriaId === c.id}
                onClick={() => setCategoria(c.id)}
              >
                {c.nome}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

type FornecedorValue = { id: number | null; nome: string };

function FornecedorAuto({
  lista,
  value,
  onChange,
}: {
  lista: FornecedorDTO[];
  value: FornecedorValue;
  onChange: (v: FornecedorValue) => void;
}) {
  const [open, setOpen] = useState(false);
  const filtered = useMemo(() => {
    if (!value.nome) return lista.slice(0, 8);
    const v = value.nome.toLowerCase();
    return lista.filter((f) => f.nome.toLowerCase().includes(v)).slice(0, 8);
  }, [value.nome, lista]);
  const showCreateNew =
    value.nome && !lista.find((f) => f.nome.toLowerCase() === value.nome.toLowerCase());

  return (
    <div className="relative">
      <Input
        className={INPUT}
        value={value.nome}
        placeholder="Digite o nome do fornecedor…"
        onChange={(e) => {
          // digitou → perde o vínculo com o ID; se não re-selecionar, o POST
          // manda fornecedorNome e o servidor faz upsert por nome único.
          onChange({ id: null, nome: e.target.value });
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 160)}
      />
      {open && (filtered.length > 0 || showCreateNew) && (
        <div className={AC_DROPDOWN}>
          {filtered.map((f) => (
            <div
              key={f.id}
              className={AC_OPTION}
              onMouseDown={() => {
                onChange({ id: f.id, nome: f.nome });
                setOpen(false);
              }}
            >
              <div>
                <div className="text-sm text-foreground">{f.nome}</div>
                {f.documento && <div className="text-[11px] text-ink-3">{f.documento}</div>}
              </div>
            </div>
          ))}
          {showCreateNew && (
            <div className={cn(AC_OPTION, "bg-accent italic")} onMouseDown={() => setOpen(false)}>
              <div>
                <div className="text-sm text-ink-2">+ Cadastrar “{value.nome}” como novo fornecedor</div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Atividade (centro de custo) ─────────────────────────────────────────

// Cor da atividade por heurística sobre o nome — sempre via var() CSS.
function corAtividade(nome: string): string {
  const n = nome.toLowerCase();
  if (n.includes("leit")) return "var(--leite)";
  if (n.includes("caf")) return "var(--cafe)";
  return "var(--outros)";
}

// Rótulo curto do chip: "Atividade Leiteira" → "Leite", "Plantio Café" → "Café".
function rotuloAtividade(nome: string): string {
  const n = nome.toLowerCase();
  if (n.includes("leit")) return "Leite";
  if (n.includes("caf")) return "Café";
  return nome;
}

// Centro "de investimento": pela flag OU pelo nome — no banco real existe
// "Plantio Café - investimento" com ehInvestimento=false (dado do BPO).
function ehCentroInvestimento(c: { nome: string; ehInvestimento: boolean }): boolean {
  return c.ehInvestimento || /invest/i.test(c.nome);
}

// Resolve o CentroCusto efetivo: chips mostram só os de custeio; o toggle
// "É investimento" troca para a variante *- Investimento* do mesmo nome
// (ex.: "Atividade Leiteira" → "Atividade Leiteira - Investimento").
function resolveCentroCustoId(
  cadastros: Cadastros,
  atividadeId: number | null,
  investimento: boolean,
): number | null {
  if (atividadeId == null) return null;
  const base = cadastros.centrosCusto.find((c) => c.id === atividadeId);
  if (!base) return null;
  if (!investimento || ehCentroInvestimento(base)) return base.id;
  const investimentos = cadastros.centrosCusto.filter(
    (c) => c.id !== base.id && ehCentroInvestimento(c),
  );
  const variante = investimentos.find((c) =>
    c.nome.toLowerCase().startsWith(base.nome.toLowerCase()),
  );
  if (variante) return variante.id;
  // fallback: se só existe um centro de investimento, é ele
  if (investimentos.length === 1) return investimentos[0].id;
  return base.id;
}

type SucessoInfo = { lancamentoId: number; valor: string; categoria: string; fornecedor: string };

type UploadStatus = "idle" | "enviando" | "ok" | "erro";

function LancarForm({ cadastros, onSuccess }: { cadastros: Cadastros; onSuccess: (info: SucessoInfo) => void }) {
  const toast = useToast();
  const [photo, setPhoto] = useState<{ name: string; size: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement | null>(null);

  // Upload pendente de NF: o arquivo sobe na hora do anexo; o lançamento só
  // é criado quando o usuário confirma (POST /api/lancamentos com pendenteId).
  const [pendente, setPendente] = useState<PendenteNF | null>(null);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>("idle");
  const [uploadMensagem, setUploadMensagem] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const rascunho = useMemo(loadRascunho, []);
  const [fornecedor, setFornecedor] = useState<FornecedorValue>({
    id: asNum(rascunho?.fornecedorId),
    nome: rascunho?.fornecedor ?? "",
  });
  const [valor, setValor] = useState(rascunho?.valor ?? "");
  const [data, setData] = useState(rascunho?.data ?? formatBRDate(getHoje()));
  const [contaId, setContaId] = useState<number | null>(
    asNum(rascunho?.contaId) ?? cadastros.contas[0]?.id ?? null,
  );
  const [pago, setPago] = useState(rascunho?.pago ?? true);
  const [atividadeId, setAtividadeId] = useState<number | null>(asNum(rascunho?.atividade));
  const [investimento, setInvestimento] = useState(rascunho?.investimento ?? false);
  const [cat, setCat] = useState<CatValue>({
    grupoId: asNum(rascunho?.cat?.grupoId),
    categoriaId: asNum(rascunho?.cat?.categoriaId),
  });
  const [obs, setObs] = useState(rascunho?.obs ?? "");
  const [restored, setRestored] = useState(!!rascunho);

  useEffect(() => {
    if (!restored) return;
    toast.info(
      "Rascunho restaurado",
      "Continuamos de onde você parou. Salve ou descarte quando quiser.",
      {
        action: {
          label: "Descartar",
          onClick: () => {
            clearRascunho();
            setFornecedor({ id: null, nome: "" }); setValor(""); setObs("");
            setCat({ grupoId: null, categoriaId: null });
            setAtividadeId(null); setInvestimento(false); setPago(true);
          },
        },
      },
    );
    setRestored(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSalvarRascunho = () => {
    const algumPreenchido = fornecedor.nome || valor || cat.categoriaId || atividadeId || obs;
    if (!algumPreenchido) {
      toast.warn("Nada para salvar", "Preencha pelo menos um campo antes de salvar o rascunho.");
      return;
    }
    saveRascunho({
      fornecedor: fornecedor.nome, fornecedorId: fornecedor.id,
      valor, data, contaId, pago,
      atividade: atividadeId, investimento, cat, obs,
      ts: Date.now(),
    });
    toast.success("Rascunho salvo", "Você pode voltar depois para concluir o lançamento.");
  };

  const handleSubmit = async () => {
    if (!cat.categoriaId) return;
    // NF é opcional: se houve upload, aguarde o "ok" antes de deixar registrar
    // (evita amarrar uma pendente ainda em trânsito ou com erro).
    if (photo && uploadStatus !== "ok") return;
    const centroCustoId = resolveCentroCustoId(cadastros, atividadeId, investimento);
    if (!centroCustoId) return;

    setSubmitting(true);
    const r = await criarLancamento({
      // só amarra a NF quando ela subiu com sucesso; senão lança sem foto.
      pendenteId: pendente && uploadStatus === "ok" ? pendente.id : null,
      natureza: "DEBITO",
      valorBR: valor,
      dataBR: data,
      categoriaId: cat.categoriaId,
      centroCustoId,
      contaBancariaId: contaId,
      fornecedorId: fornecedor.id,
      fornecedorNome: fornecedor.id ? null : fornecedor.nome.trim() || null,
      pago,
      descricao: obs.trim() || null,
    });
    setSubmitting(false);

    if (!r.ok) {
      if (r.codigo === "MES_FECHADO") {
        toast.error("Mês fechado", `${r.erro} Escolha uma data em mês aberto.`);
      } else if (r.codigo === "PENDENTE_INVALIDA") {
        toast.error("Nota fiscal expirou", `${r.erro}`);
        // pendente morreu no servidor — força reenvio da foto
        setPhoto(null); setPendente(null); setUploadStatus("idle"); setUploadMensagem(null);
      } else {
        toast.error("Não consegui registrar", r.erro);
      }
      return;
    }

    clearRascunho();
    const catNome =
      cadastros.grupos.flatMap((g) => g.categorias).find((c) => c.id === cat.categoriaId)?.nome ??
      "(sem categoria)";
    const valorNum = Number(valor.replace(/\s/g, "").replace(/\./g, "").replace(",", "."));
    toast.success(
      "Gasto registrado",
      `${fornecedor.nome || "Lançamento"} salvo. Aparece no Dashboard em segundos.`,
    );
    onSuccess({
      lancamentoId: r.lancamentoId,
      valor: Number.isFinite(valorNum) ? fmtMoneyExact(valorNum) : `R$ ${valor}`,
      categoria: catNome,
      fornecedor: fornecedor.nome || "(sem fornecedor)",
    });
  };

  const onPickFile = async (file?: File | null) => {
    if (!file) return;
    setPhoto({ name: file.name || "nota-fiscal.jpg", size: file.size || 0 });
    setUploadStatus("enviando");
    setUploadMensagem(null);
    const r = await uploadPendenteNF(file);
    if (!r.ok) {
      setUploadStatus("erro");
      if (r.codigo === "DUPLICATA_DEFINITIVA" && r.arquivoExistente) {
        setUploadMensagem(`Esta nota já foi lançada antes (lançamento #${r.arquivoExistente.lancamentoId}).`);
        toast.warn("Nota duplicada", `Esta foto já está no lançamento #${r.arquivoExistente.lancamentoId}.`);
      } else {
        setUploadMensagem(r.erro);
        toast.error("Falha no upload da nota", r.erro);
      }
      return;
    }
    setPendente(r.pendente);
    setUploadStatus("ok");
    setUploadMensagem(
      r.retomada
        ? "Esta foto já estava aguardando — seguimos com ela."
        : "Nota validada e aguardando confirmação.",
    );
  };

  const removerFoto = () => {
    if (pendente) void cancelarPendenteNF(pendente.id);
    setPhoto(null);
    setPendente(null);
    setUploadStatus("idle");
    setUploadMensagem(null);
  };

  // NF opcional: só bloqueia se há uma foto em trânsito/erro (não deixa
  // registrar no meio de um upload). Sem foto, os campos de dados bastam.
  const nfPendenteBloqueia = !!photo && uploadStatus !== "ok";
  const canSubmit = !!(
    fornecedor.nome.trim() && valor && data &&
    cat.categoriaId && atividadeId && !submitting && !nfPendenteBloqueia
  );

  return (
    <div className="grid grid-cols-[1.1fr_1fr] gap-10 pb-[60px] pt-7">
      <div>
        <div className={cn(SECTION_TITLE, "mb-3.5")}>
          1 · Anexar nota fiscal <span className="text-ink-3">(opcional)</span>
        </div>

        <input
          ref={fileInput}
          type="file"
          accept="image/*,application/pdf"
          style={{ display: "none" }}
          onChange={(e) => onPickFile(e.target.files?.[0])}
        />

        {!photo ? (
          <div
            className={cn(UPLOAD_ZONE, dragging && "border-foreground bg-accent")}
            onClick={() => fileInput.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              onPickFile(e.dataTransfer.files[0]);
            }}
          >
            <div className={UPLOAD_ICON}>↑</div>
            <div className="font-serif text-[22px] tracking-[-0.005em] text-foreground">Arraste a foto da nota fiscal aqui</div>
            <div className="text-[13px] text-ink-3">
              ou <span className="underline">selecione um arquivo</span> · JPG, PNG ou PDF
            </div>
            <div className="mt-1.5 text-[13px] italic text-ink-3">
              Opcional — dá pra lançar o gasto sem foto.
            </div>
          </div>
        ) : (
          <div className="border-2 border-dashed border-border bg-card p-[18px] transition-colors hover:border-ink-3 hover:bg-accent">
            <div className="flex items-start gap-4">
              <div className="flex min-h-[180px] w-[140px] shrink-0 items-end bg-[color:var(--bg-card-2)] p-2.5 text-[10px] text-ink-3 [background-image:repeating-linear-gradient(45deg,var(--rule-soft)_0_8px,transparent_8px_16px)] [font-family:'Courier_New',monospace]">
                <span>
                  NF
                  <br />
                  {photo.name}
                </span>
              </div>
              <div className="flex flex-1 flex-col gap-2">
                <div className="font-serif text-lg">{photo.name}</div>
                <div className="text-xs tabular-nums text-ink-3">
                  {(photo.size / 1024).toFixed(0)} KB ·{" "}
                  {uploadStatus === "enviando"
                    ? "enviando…"
                    : uploadStatus === "ok"
                      ? "recebida no servidor"
                      : uploadStatus === "erro"
                        ? "falha no envio"
                        : "aguardando"}
                </div>
                {pendente && (
                  <div className="text-xs tabular-nums text-ink-3">
                    Reservada até{" "}
                    {new Date(pendente.expiraEm).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}{" "}
                    · confirme o lançamento para efetivar
                  </div>
                )}
                <div className="mt-auto flex gap-2">
                  <Button
                    variant="outline"
                    className={cn(BTN_GHOST, "hover:border-prejuizo hover:text-prejuizo")}
                    onClick={removerFoto}
                  >
                    Remover
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {photo && uploadStatus !== "idle" && (
          <div
            className={cn(IA_BANNER, "mt-3.5")}
            style={{
              background:
                uploadStatus === "erro"
                  ? "color-mix(in srgb, var(--neg) 8%, transparent)"
                  : uploadStatus === "ok"
                    ? "color-mix(in srgb, var(--pos) 8%, transparent)"
                    : undefined,
            }}
          >
            <span className={IA_BANNER_DOT}></span>
            <div className={IA_BANNER_BODY}>
              <strong>
                {uploadStatus === "enviando" && "Enviando nota fiscal…"}
                {uploadStatus === "ok" && "Nota fiscal recebida."}
                {uploadStatus === "erro" && "Falha no upload."}
              </strong>
              {uploadMensagem ? <> {uploadMensagem}</> : null}
            </div>
          </div>
        )}

      </div>

      <div className="flex flex-col gap-[22px]">
        <div className={SECTION_TITLE}>2 · Dados do lançamento</div>

        <div className={SECTION}>
          <div className="grid grid-cols-[1.4fr_1fr_1fr] gap-4">
            <div className={FIELD}>
              <Label className={FIELD_LABEL}>
                Fornecedor<Req />
              </Label>
              <FornecedorAuto lista={cadastros.fornecedores} value={fornecedor} onChange={setFornecedor} />
            </div>
            <div className={FIELD}>
              <Label className={FIELD_LABEL}>
                Valor<Req />
              </Label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-sans text-[13px] text-ink-3">R$</span>
                <Input
                  className={cn(INPUT, "pl-[38px] font-serif text-lg tabular-nums md:text-lg")}
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                  placeholder="0,00"
                />
              </div>
            </div>
            <div className={FIELD}>
              <Label className={FIELD_LABEL}>
                Data<Req />
              </Label>
              <Input
                className={INPUT}
                value={data}
                onChange={(e) => setData(e.target.value)}
                placeholder="dd/mm/aaaa"
              />
            </div>
          </div>

          <div className={FIELD}>
            <Label className={FIELD_LABEL}>Conta bancária</Label>
            <div className="chip-group">
              {cadastros.contas.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="chip"
                  aria-pressed={contaId === c.id}
                  onClick={() => setContaId(c.id)}
                >
                  {c.nome
                    .replace("Banco do Brasil ag. ", "BB ")
                    .replace("Sicredi ag. ", "Sicredi ")
                    .replace("Caixa da fazenda (dinheiro)", "Dinheiro")}
                </button>
              ))}
            </div>
          </div>

          <div className={TOGGLE_ROW}>
            <div className="flex flex-col gap-0.5">
              <span className="text-sm text-foreground">Pagamento efetuado</span>
              <span className="text-xs text-ink-3">Marque desligado se for previsão de pagamento.</span>
            </div>
            <div role="button" className="toggle" aria-pressed={pago} onClick={() => setPago(!pago)}></div>
          </div>
        </div>

        <div className={cn(SECTION, "mt-3")}>
          <div className={SECTION_TITLE}>3 · Categorização</div>

          <div className={FIELD}>
            <Label className={FIELD_LABEL}>
              Atividade (centro de custo)<Req />
            </Label>
            <div className="chip-group">
              {cadastros.centrosCusto
                .filter((cc) => !ehCentroInvestimento(cc))
                .map((cc) => (
                  <button
                    key={cc.id}
                    type="button"
                    className="chip"
                    aria-pressed={atividadeId === cc.id}
                    onClick={() => setAtividadeId(cc.id)}
                    title={cc.nome}
                  >
                    <span className="sw" style={{ background: corAtividade(cc.nome) }}></span>
                    {rotuloAtividade(cc.nome)}
                  </button>
                ))}
            </div>
          </div>

          <div className={FIELD}>
            <Label className={FIELD_LABEL}>
              Categoria<Req />
            </Label>
            <CategoryCascade grupos={cadastros.grupos} value={cat} onChange={setCat} />
          </div>

          <div className={TOGGLE_ROW}>
            <div className="flex flex-col gap-0.5">
              <span className="text-sm text-foreground">É investimento, não custeio</span>
              <span className="text-xs text-ink-3">
                Marque para compra de gado, máquinas, plantio novo, benfeitorias — não entra no custeio operacional.
              </span>
            </div>
            <div
              role="button"
              className="toggle"
              aria-pressed={investimento}
              onClick={() => setInvestimento(!investimento)}
            ></div>
          </div>
        </div>

        <div className={cn(SECTION, "mt-3")}>
          <div className={SECTION_TITLE}>4 · Observações</div>
          <div className={FIELD}>
            <Label className={FIELD_LABEL}>Descrição / observação</Label>
            <Textarea
              className={cn(INPUT, "min-h-[70px] resize-y")}
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              placeholder="Ex.: compra mensal de ração concentrada — entrega via Cooperativa."
            />
          </div>
          <div className={FIELD}>
            <Label className={FIELD_LABEL}>Etiquetas (opcional)</Label>
            <Input className={INPUT} placeholder="ex.: safra-26, talhão-4, rebanho-girolando" />
          </div>
        </div>

        <div className="sticky bottom-0 flex items-center justify-between gap-4 border-t border-border bg-background py-[18px] pr-[100px] max-[640px]:pr-0 max-[640px]:pb-24">
          <span className="text-xs text-ink-3">
            {photo && uploadStatus === "enviando"
              ? "Aguarde o envio da nota terminar."
              : photo && uploadStatus === "erro"
                ? "Falha no upload — remova a foto ou envie outra (a nota é opcional)."
                : !canSubmit
                  ? "Complete os campos obrigatórios marcados com asterisco. A nota fiscal é opcional."
                  : photo && uploadStatus === "ok"
                    ? "Tudo pronto. Ao registrar, o lançamento é criado e a nota amarrada a ele."
                    : "Tudo pronto. O gasto será registrado sem nota fiscal (você pode anexá-la depois)."}
          </span>
          <div className="flex gap-2.5">
            <Button variant="outline" className={BTN_GHOST} onClick={handleSalvarRascunho}>Salvar rascunho</Button>
            <Button className={BTN_PRIMARY} disabled={!canSubmit} onClick={handleSubmit}>
              {submitting ? "Registrando…" : "Registrar gasto →"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function LancadoSucesso({
  onNew,
  onNav,
  lancamentoId,
  valor,
  categoria,
  fornecedor,
}: SucessoInfo & {
  onNew: () => void;
  onNav: (t: Tab) => void;
}) {
  return (
    <div className="mx-auto grid w-full max-w-[640px] grid-cols-1 gap-10 pb-[60px] pt-7">
      <div className="flex flex-col items-center gap-3.5 border border-border bg-card px-8 py-9 text-center">
        <div className="grid h-14 w-14 place-items-center rounded-full border-2 border-lucro font-serif text-[30px] text-lucro">✓</div>
        <div className="font-serif text-[26px] tracking-[-0.01em]">Gasto registrado · #{lancamentoId}</div>
        <div className="mono-nums font-serif text-[32px] tabular-nums tracking-[-0.015em]">{valor}</div>
        <div className="body-s text-ink-3">
          {fornecedor} · {categoria}
        </div>
        <div className="caption">Aparece no Dashboard e na aba Gastos em até 30 segundos.</div>
        <div className="mt-3.5 flex gap-3">
          <Button variant="secondary" className={BTN_SECONDARY} onClick={() => onNav("gastos")}>
            Ver na aba Gastos
          </Button>
          <Button className={BTN_PRIMARY} onClick={onNew}>
            Registrar outro
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ===== ENTRADA (receita) ===== */

type TipoReceita = { id: string; nome: string; cor: string; fontes: string[]; unidade: string; precoRef: number; obsPlaceholder: string };

const TIPOS_RECEITA: TipoReceita[] = [
  {
    id: "leite",
    nome: "Leite",
    cor: "var(--leite)",
    fontes: ["Embaré Indústria (laticínio)", "Cooperativa Boa Vista", "Venda avulsa (queijo/cru)"],
    unidade: "litros",
    precoRef: 3.5,
    obsPlaceholder: "Ex.: 2ª quinzena de maio — entrega à Embaré, 25.380 L.",
  },
  {
    id: "cafe",
    nome: "Café",
    cor: "var(--cafe)",
    fontes: ["Cooxupé (cooperativa)", "Exportadora Volcafé", "Corretor regional"],
    unidade: "sacas",
    precoRef: 707,
    obsPlaceholder: "Ex.: safra 2026 — 430 sacas tipo 6/7, bebida dura.",
  },
  {
    id: "animais",
    nome: "Venda de animais",
    cor: "var(--outros)",
    fontes: ["Frigorífico Vale", "Leilão regional", "Comprador particular"],
    unidade: "cabeças",
    precoRef: 2800,
    obsPlaceholder: "Ex.: descarte de 6 vacas + 3 bezerros machos.",
  },
  {
    id: "outros",
    nome: "Outros",
    cor: "var(--ink-3)",
    fontes: ["Arrendamento de pasto", "Venda de esterco", "Reembolso / diversos"],
    unidade: "—",
    precoRef: 0,
    obsPlaceholder: "Ex.: arrendamento de pasto para terceiro.",
  },
];

/* Comprador autocomplete (por tipo de receita) */
function CompradorAuto({ value, onChange, fontes }: { value: string; onChange: (v: string) => void; fontes: string[] }) {
  const [open, setOpen] = useState(false);
  const filtered = useMemo(() => {
    if (!value) return fontes;
    const v = value.toLowerCase();
    return fontes.filter((f) => f.toLowerCase().includes(v));
  }, [value, fontes]);
  const showNew = value && !fontes.find((f) => f.toLowerCase() === value.toLowerCase());

  return (
    <div className="relative">
      <Input
        className={INPUT}
        value={value}
        placeholder="Quem comprou / pagou…"
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 160)}
      />
      {open && (filtered.length > 0 || showNew) && (
        <div className={AC_DROPDOWN}>
          {filtered.map((f) => (
            <div
              key={f}
              className={AC_OPTION}
              onMouseDown={() => {
                onChange(f);
                setOpen(false);
              }}
            >
              <div>
                <div className="text-sm text-foreground">{f}</div>
              </div>
            </div>
          ))}
          {showNew && (
            <div className={cn(AC_OPTION, "bg-accent italic")} onMouseDown={() => setOpen(false)}>
              <div>
                <div className="text-sm text-ink-2">+ Cadastrar "{value}" como novo cliente</div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

type EntradaPayload = { valor: string; tipo: string; comprador: string; qtd: string | null };

// Centro de custo default por tipo de receita: casa o rótulo do tipo com o
// nome do CentroCusto real (heurística — mesma da corAtividade/rotuloAtividade
// do form de saída). "Outros" cai no primeiro centro de custeio disponível.
function centroCustoDefault(cadastros: Cadastros, tipoId: string): number | null {
  const custeio = cadastros.centrosCusto.filter((c) => !ehCentroInvestimento(c));
  const acha = (frag: string) => custeio.find((c) => c.nome.toLowerCase().includes(frag))?.id ?? null;
  if (tipoId === "leite" || tipoId === "animais") return acha("leit") ?? custeio[0]?.id ?? null;
  if (tipoId === "cafe") return acha("caf") ?? custeio[0]?.id ?? null;
  return custeio[0]?.id ?? null;
}

function EntradaForm({ cadastros, onSuccess }: { cadastros: Cadastros; onNav: (t: Tab) => void; onSuccess: (p: EntradaPayload) => void }) {
  const toast = useToast();
  const contas = cadastros.contas;
  const [tipoId, setTipoId] = useState("leite");
  const tipo = TIPOS_RECEITA.find((t) => t.id === tipoId) as TipoReceita;

  const [comprador, setComprador] = useState("");
  const [valor, setValor] = useState("");
  const [qtd, setQtd] = useState("");
  const [data, setData] = useState("31/05/2026");
  const [conta, setConta] = useState<number | null>(contas[0]?.id ?? null);
  const [recebido, setRecebido] = useState(true);
  const [doc, setDoc] = useState<{ name: string; size: number } | null>(null);
  const [obs, setObs] = useState("");
  const docInput = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);

  // Dimensões reais do lançamento de receita (natureza CREDITO):
  // Categoria (cascade Grupo→Categoria) + Centro de custo. Sem toggle de
  // investimento — receita é sempre operacional.
  const [cat, setCat] = useState<CatValue>({ grupoId: null, categoriaId: null });
  const [centroCustoId, setCentroCustoId] = useState<number | null>(centroCustoDefault(cadastros, "leite"));

  const pickTipo = (id: string) => {
    setTipoId(id);
    setComprador("");
    setQtd("");
    setValor("");
    setCentroCustoId(centroCustoDefault(cadastros, id));
  };

  const precoUnit = useMemo(() => {
    const v = parseFloat((valor || "").replace(/\./g, "").replace(",", "."));
    const q = parseFloat((qtd || "").replace(/\./g, "").replace(",", "."));
    if (v > 0 && q > 0) return v / q;
    return null;
  }, [valor, qtd]);

  const onPickDoc = (file?: File) => {
    if (file) setDoc({ name: file.name || "comprovante.jpg", size: file.size || 142000 });
  };

  const canSubmit = !!(comprador.trim() && valor && data && cat.categoriaId && centroCustoId && !submitting);

  const handleSubmit = async () => {
    if (!cat.categoriaId || !centroCustoId) return;
    setSubmitting(true);
    // Comprador é sempre texto livre aqui → o server faz upsert por nome único.
    // A quantidade (litros/sacas/cabeças) não tem campo no schema — vai pra
    // descrição como contexto, junto da observação do usuário.
    const ctx = qtd && tipo.unidade !== "—" ? `${qtd} ${tipo.unidade}` : "";
    const descricao = [obs.trim(), ctx].filter(Boolean).join(" · ") || null;
    const r = await criarLancamento({
      natureza: "CREDITO",
      valorBR: valor,
      dataBR: data,
      categoriaId: cat.categoriaId,
      centroCustoId,
      contaBancariaId: conta,
      fornecedorNome: comprador.trim() || null,
      pago: recebido,
      descricao,
    });
    setSubmitting(false);

    if (!r.ok) {
      if (r.codigo === "MES_FECHADO") {
        toast.error("Mês fechado", `${r.erro} Escolha uma data em mês aberto.`);
      } else {
        toast.error("Não consegui registrar a entrada", r.erro);
      }
      return;
    }

    toast.success("Entrada registrada", `${comprador} · R$ ${valor || "0,00"}`);
    onSuccess({
      valor: "R$ " + (valor || "0,00"),
      tipo: tipo.nome,
      comprador,
      qtd: ctx || null,
    });
  };

  return (
    <div className="grid grid-cols-[1.1fr_1fr] gap-10 pb-[60px] pt-7">
      {/* esquerda: tipo + contexto */}
      <div>
        <div className={cn(SECTION_TITLE, "mb-3.5")}>
          1 · Tipo de receita
        </div>
        <div className="grid grid-cols-2 gap-2.5 max-[1100px]:grid-cols-1">
          {TIPOS_RECEITA.map((t) => (
            <button
              key={t.id}
              type="button"
              className={cn(
                "flex cursor-pointer items-center gap-3 border bg-card px-4 py-3.5 font-sans transition-colors",
                tipoId === t.id ? "border-foreground bg-accent" : "border-border hover:border-ink-3",
              )}
              onClick={() => pickTipo(t.id)}
            >
              <span className="h-3.5 w-3.5 shrink-0" style={{ background: t.cor }}></span>
              <span className="text-[15px] text-foreground">{t.nome}</span>
            </button>
          ))}
        </div>

        <div className="mt-[18px] border border-border bg-card px-[22px] py-5">
          <div className="mb-2.5 flex items-center gap-2.5">
            <span className="h-3.5 w-3.5" style={{ background: tipo.cor }}></span>
            <span className="font-serif text-xl tracking-[-0.005em]">{tipo.nome}</span>
          </div>
          {tipoId === "leite" && (
            <p className="m-0 text-sm leading-[1.6] text-ink-2 [&_strong]:font-medium [&_strong]:text-foreground">
              A receita do leite normalmente chega pelo <strong>extrato quinzenal da Embaré</strong>. Você pode importar o extrato
              direto ou lançar manualmente o valor e o volume entregue. O sistema calcula o <strong>R$ por litro</strong>{" "}
              automaticamente.
            </p>
          )}
          {tipoId === "cafe" && (
            <p className="m-0 text-sm leading-[1.6] text-ink-2 [&_strong]:font-medium [&_strong]:text-foreground">
              Venda de café é <strong>safra única</strong> — registre cada nota da cooperativa/exportadora com o número de sacas. O
              sistema calcula o <strong>R$ por saca</strong> e isola a margem da safra.
            </p>
          )}
          {tipoId === "animais" && (
            <p className="m-0 text-sm leading-[1.6] text-ink-2 [&_strong]:font-medium [&_strong]:text-foreground">
              Venda de descarte (vacas) e bezerros. Informe o número de cabeças — entra como receita da atividade Leite, já que reduz o
              rebanho leiteiro.
            </p>
          )}
          {tipoId === "outros" && (
            <p className="m-0 text-sm leading-[1.6] text-ink-2 [&_strong]:font-medium [&_strong]:text-foreground">
              Arrendamento, venda de esterco, reembolsos. Receitas que não pertencem direto a leite ou café.
            </p>
          )}

          {tipoId === "leite" && (
            <Button
              variant="secondary"
              className="mt-3.5 h-auto gap-2 px-4 py-2.5 text-xs font-normal tracking-[0.04em] hover:border-mast hover:bg-mast hover:text-mast-ink"
            >
              <span className="h-1.5 w-1.5 bg-lucro"></span>Importar extrato da Embaré
            </Button>
          )}
        </div>

        <input ref={docInput} type="file" accept="image/*,application/pdf" style={{ display: "none" }} onChange={(e) => onPickDoc(e.target.files?.[0])} />
        <div className="mt-[22px]">
          <div className={cn(SECTION_TITLE, "mb-3")}>
            Comprovante / nota de venda <span className="text-ink-3">(opcional)</span>
          </div>
          {!doc ? (
            <div className={cn(UPLOAD_ZONE, "px-5 py-[26px]")} onClick={() => docInput.current?.click()}>
              <div className={UPLOAD_ICON}>↑</div>
              <div className="font-serif text-lg tracking-[-0.005em] text-foreground">
                Anexar comprovante
              </div>
              <div className="text-[13px] text-ink-3">extrato da Embaré, nota de venda, recibo — JPG, PNG ou PDF</div>
            </div>
          ) : (
            <div className="border-2 border-dashed border-border bg-card p-[18px] transition-colors hover:border-ink-3 hover:bg-accent">
              <div className="flex items-start gap-4">
                <div className="flex min-h-[180px] w-[140px] shrink-0 items-end bg-[color:var(--bg-card-2)] p-2.5 text-[10px] text-ink-3 [background-image:repeating-linear-gradient(45deg,var(--rule-soft)_0_8px,transparent_8px_16px)] [font-family:'Courier_New',monospace]">
                  <span>
                    DOC
                    <br />
                    {doc.name}
                  </span>
                </div>
                <div className="flex flex-1 flex-col gap-2">
                  <div className="font-serif text-lg">{doc.name}</div>
                  <div className="text-xs tabular-nums text-ink-3">{(doc.size / 1024).toFixed(0)} KB · enviado agora</div>
                  <div className="mt-auto flex gap-2">
                    <Button
                      variant="outline"
                      className={cn(BTN_GHOST, "hover:border-prejuizo hover:text-prejuizo")}
                      onClick={() => setDoc(null)}
                    >
                      Remover
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* direita: formulário */}
      <div className="flex flex-col gap-[22px]">
        <div className={SECTION_TITLE}>2 · Dados da entrada</div>

        <div className={SECTION}>
          <div className={FIELD}>
            <Label className={FIELD_LABEL}>
              Cliente / comprador<Req />
            </Label>
            <CompradorAuto value={comprador} onChange={setComprador} fontes={tipo.fontes} />
          </div>

          <div className="grid grid-cols-[1.4fr_1fr_1fr] gap-4">
            <div className={FIELD}>
              <Label className={FIELD_LABEL}>
                Valor recebido<Req />
              </Label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-sans text-[13px] text-ink-3">R$</span>
                <Input
                  className={cn(INPUT, "pl-[38px] font-serif text-lg tabular-nums md:text-lg")}
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                  placeholder="0,00"
                />
              </div>
            </div>
            <div className={FIELD}>
              <Label className={FIELD_LABEL}>
                Quantidade {tipo.unidade !== "—" && <span className="ml-1 text-ink-3">({tipo.unidade})</span>}
              </Label>
              <Input
                className={INPUT}
                value={qtd}
                onChange={(e) => setQtd(e.target.value)}
                placeholder={tipo.unidade === "litros" ? "ex.: 25380" : tipo.unidade === "sacas" ? "ex.: 430" : tipo.unidade === "cabeças" ? "ex.: 9" : "—"}
                disabled={tipo.unidade === "—"}
              />
            </div>
            <div className={FIELD}>
              <Label className={FIELD_LABEL}>
                Data<Req />
              </Label>
              <Input className={INPUT} value={data} onChange={(e) => setData(e.target.value)} placeholder="dd/mm/aaaa" />
            </div>
          </div>

          {precoUnit && tipo.unidade !== "—" && (
            <div className={IA_BANNER}>
              <span className={IA_BANNER_DOT}></span>
              <div className={IA_BANNER_BODY}>
                Preço implícito: <strong>R$ {precoUnit.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / {tipo.unidade.replace(/s$/, "")}</strong>.
                {tipo.precoRef > 0 &&
                  (precoUnit >= tipo.precoRef ? (
                    <span className="text-lucro"> Acima da referência (R$ {tipo.precoRef.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}).</span>
                  ) : (
                    <span className="text-prejuizo"> Abaixo da referência (R$ {tipo.precoRef.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}).</span>
                  ))}
              </div>
            </div>
          )}

          <div className={FIELD}>
            <Label className={FIELD_LABEL}>Conta de recebimento</Label>
            <div className="chip-group">
              {contas.map((c) => (
                <button key={c.id} type="button" className="chip" aria-pressed={conta === c.id} onClick={() => setConta(c.id)}>
                  {c.nome
                    .replace("Banco do Brasil ag. ", "BB ")
                    .replace("Sicredi ag. ", "Sicredi ")
                    .replace("Sicoob PJ ag. ", "Sicoob ")
                    .replace("Caixa da fazenda (dinheiro)", "Dinheiro")
                    .replace("Caixa da fazenda", "Dinheiro")}
                </button>
              ))}
            </div>
          </div>

          <div className={TOGGLE_ROW}>
            <div className="flex flex-col gap-0.5">
              <span className="text-sm text-foreground">Valor já recebido</span>
              <span className="text-xs text-ink-3">Desligue se for uma venda a prazo / a receber.</span>
            </div>
            <div role="button" className="toggle" aria-pressed={recebido} onClick={() => setRecebido(!recebido)}></div>
          </div>
        </div>

        <div className={cn(SECTION, "mt-3")}>
          <div className={SECTION_TITLE}>3 · Categorização</div>

          <div className={FIELD}>
            <Label className={FIELD_LABEL}>
              Atividade (centro de custo)<Req />
            </Label>
            <div className="chip-group">
              {cadastros.centrosCusto
                .filter((cc) => !ehCentroInvestimento(cc))
                .map((cc) => (
                  <button
                    key={cc.id}
                    type="button"
                    className="chip"
                    aria-pressed={centroCustoId === cc.id}
                    onClick={() => setCentroCustoId(cc.id)}
                    title={cc.nome}
                  >
                    <span className="sw" style={{ background: corAtividade(cc.nome) }}></span>
                    {rotuloAtividade(cc.nome)}
                  </button>
                ))}
            </div>
          </div>

          <div className={FIELD}>
            <Label className={FIELD_LABEL}>
              Categoria<Req />
            </Label>
            <CategoryCascade grupos={cadastros.grupos} value={cat} onChange={setCat} />
          </div>
        </div>

        <div className={cn(SECTION, "mt-3")}>
          <div className={SECTION_TITLE}>4 · Observações</div>
          <div className={FIELD}>
            <Label className={FIELD_LABEL}>Descrição / observação</Label>
            <Textarea
              className={cn(INPUT, "min-h-[70px] resize-y")}
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              placeholder={tipo.obsPlaceholder}
            />
          </div>
        </div>

        <div className="sticky bottom-0 flex items-center justify-between gap-4 border-t border-border bg-background py-[18px] pr-[100px] max-[640px]:pr-0 max-[640px]:pb-24">
          <span className="text-xs text-ink-3">
            {!canSubmit
              ? "Informe cliente, valor, data, atividade e categoria para registrar a entrada."
              : "Tudo pronto. A entrada aparecerá no Dashboard e melhora o fluxo do mês."}
          </span>
          <div className="flex gap-2.5">
            <Button
              variant="outline"
              className={BTN_GHOST}
              onClick={() => {
                if (!comprador && !valor && !obs) {
                  toast.warn("Nada para salvar", "Preencha pelo menos um campo antes de salvar o rascunho.");
                  return;
                }
                toast.success("Rascunho salvo", "Você pode retomar este lançamento mais tarde.");
              }}
            >
              Salvar rascunho
            </Button>
            <Button
              className={cn(BTN_PRIMARY, "bg-lucro hover:bg-lucro")}
              disabled={!canSubmit}
              onClick={handleSubmit}
            >
              {submitting ? "Registrando…" : "Registrar entrada →"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EntradaSucesso({ onNew, onNav, valor, tipo, comprador, qtd }: EntradaPayload & { onNew: () => void; onNav: (t: Tab) => void }) {
  return (
    <div className="mx-auto grid w-full max-w-[640px] grid-cols-1 gap-10 pb-[60px] pt-7">
      <div className="flex flex-col items-center gap-3.5 border border-border bg-card px-8 py-9 text-center">
        <div className="grid h-14 w-14 place-items-center rounded-full border-2 border-lucro font-serif text-[30px] text-lucro">↑</div>
        <div className="font-serif text-[26px] tracking-[-0.01em]">Entrada registrada</div>
        <div className="mono-nums font-serif text-[32px] tabular-nums tracking-[-0.015em] text-lucro">
          {valor}
        </div>
        <div className="body-s text-ink-3">
          {tipo} · {comprador}
          {qtd ? ` · ${qtd}` : ""}
        </div>
        <div className="caption">Entra no fluxo do mês e no comparativo por atividade.</div>
        <div className="mt-3.5 flex gap-3">
          <Button variant="secondary" className={BTN_SECONDARY} onClick={() => onNav("dashboard")}>
            Ver no Dashboard
          </Button>
          <Button className={BTN_PRIMARY} onClick={onNew}>
            Registrar outra
          </Button>
        </div>
      </div>
    </div>
  );
}

const TIPO_KEY = "rionovo:lancar:tipo";

export function Lancar({ onNav }: { onNav: (t: Tab) => void }) {
  const [tipo, setTipo] = useState<"saida" | "entrada">(() => {
    try {
      const s = localStorage.getItem(TIPO_KEY);
      return s === "entrada" ? "entrada" : "saida";
    } catch { return "saida"; }
  });
  const [view, setView] = useState<"form" | "sucesso">("form");
  const [lastLanc, setLastLanc] = useState<SucessoInfo | null>(null);
  const [lastEntrada, setLastEntrada] = useState<EntradaPayload | null>(null);

  // Dimensões reais (contas, centros de custo, grupos→categorias, fornecedores)
  const { data: cadastros, loading: cadastrosLoading, erro: cadastrosErro, recarregar } = useCadastros();

  const switchTipo = (t: "saida" | "entrada") => {
    setTipo(t);
    setView("form");
    try { localStorage.setItem(TIPO_KEY, t); } catch { /* storage cheio */ }
  };

  const esBtn =
    "flex cursor-pointer items-center gap-4 border border-border bg-card px-[22px] py-[18px] text-left font-sans transition-colors hover:border-ink-3";
  const esArrow = "grid h-[42px] w-[42px] shrink-0 place-items-center border border-border font-serif text-2xl";

  return (
    <div className="shell-wide">
      {/* seletor Entrada / Saída */}
      <div className="mb-2 mt-[22px] grid grid-cols-2 gap-3.5 max-[1100px]:grid-cols-1">
        <button
          className={cn(esBtn, tipo === "saida" && "border-prejuizo shadow-[inset_3px_0_0_var(--prejuizo)]")}
          onClick={() => switchTipo("saida")}
        >
          <span className={cn(esArrow, tipo === "saida" && "border-prejuizo text-prejuizo")}>↓</span>
          <span className="flex flex-col gap-0.5">
            <strong className="font-serif text-[22px] font-normal tracking-[-0.01em] text-foreground">Saída</strong>
            <small className="text-[13px] text-ink-3">Gasto · compra · pagamento</small>
          </span>
        </button>
        <button
          className={cn(esBtn, tipo === "entrada" && "border-lucro shadow-[inset_3px_0_0_var(--lucro)]")}
          onClick={() => switchTipo("entrada")}
        >
          <span className={cn(esArrow, tipo === "entrada" && "border-lucro text-lucro")}>↑</span>
          <span className="flex flex-col gap-0.5">
            <strong className="font-serif text-[22px] font-normal tracking-[-0.01em] text-foreground">Entrada</strong>
            <small className="text-[13px] text-ink-3">Receita · venda · recebimento</small>
          </span>
        </button>
      </div>

      {tipo === "saida" && (
        <>
          {cadastrosErro && (
            <div className={IA_BANNER} style={{ background: "color-mix(in srgb, var(--neg) 8%, transparent)" }}>
              <span className={IA_BANNER_DOT}></span>
              <div className={IA_BANNER_BODY}>
                <strong>Não consegui carregar os cadastros.</strong> {cadastrosErro}{" "}
                <Button variant="outline" className={BTN_GHOST} onClick={recarregar}>Tentar de novo</Button>
              </div>
            </div>
          )}
          {cadastrosLoading && !cadastros && (
            <Loader label="Carregando cadastros…" />
          )}

          {view === "form" && cadastros && (
            <LancarForm
              cadastros={cadastros}
              onSuccess={(info) => {
                setLastLanc(info);
                setView("sucesso");
              }}
            />
          )}

          {view === "sucesso" && lastLanc && <LancadoSucesso {...lastLanc} onNew={() => setView("form")} onNav={onNav} />}
        </>
      )}

      {tipo === "entrada" && (
        <>
          {cadastrosErro && (
            <div className={IA_BANNER} style={{ background: "color-mix(in srgb, var(--neg) 8%, transparent)" }}>
              <span className={IA_BANNER_DOT}></span>
              <div className={IA_BANNER_BODY}>
                <strong>Não consegui carregar os cadastros.</strong> {cadastrosErro}{" "}
                <Button variant="outline" className={BTN_GHOST} onClick={recarregar}>Tentar de novo</Button>
              </div>
            </div>
          )}
          {cadastrosLoading && !cadastros && (
            <Loader label="Carregando cadastros…" />
          )}

          {view === "form" && cadastros && (
            <EntradaForm
              cadastros={cadastros}
              onNav={onNav}
              onSuccess={(payload) => { setLastEntrada(payload); setView("sucesso"); }}
            />
          )}
          {view === "sucesso" && lastEntrada && <EntradaSucesso {...lastEntrada} onNew={() => setView("form")} onNav={onNav} />}
        </>
      )}
    </div>
  );
}
