/* Rio Novo — Lançar gasto */

import { useEffect, useMemo, useRef, useState } from "react";
import R from "../data/rionovo";
import { ReportHeader } from "./Shell";
import type { Tab } from "./Shell";
import { useToast } from "./Toast";

const RASCUNHO_KEY = "rionovo:lancar:rascunho";

type RascunhoSaida = {
  fornecedor: string;
  valor: string;
  data: string;
  conta: string;
  pago: boolean;
  atividade: string | null;
  investimento: boolean;
  cat: { grupoId: string | null; categoriaId: string | null; subcategoria: string | null };
  obs: string;
  ts: number;
};

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

type CatValue = { grupoId: string | null; categoriaId: string | null; subcategoria: string | null };

function CategoryCascade({
  value,
  onChange,
  aiSuggestion,
}: {
  value: CatValue;
  onChange: (v: CatValue) => void;
  aiSuggestion?: { categoriaId: string } | null;
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const grupos: any[] = R.gruposPlano;
  const grupoSel = grupos.find((g) => g.id === value.grupoId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const catSel = grupoSel?.categorias.find((c: any) => c.id === value.categoriaId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let subs: any[] = [];
  if (catSel) {
    if (catSel.ref) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      subs = (R.categoriasDetalhe[catSel.ref]?.subcategorias || []).map((s: any) => ({ nome: s.nome }));
    } else {
      subs = catSel.subcategorias || [];
    }
  }

  const setGrupo = (gid: string) => onChange({ grupoId: gid, categoriaId: null, subcategoria: null });
  const setCategoria = (cid: string) => onChange({ ...value, categoriaId: cid, subcategoria: null });
  const setSub = (sn: string) => onChange({ ...value, subcategoria: sn });

  return (
    <div className="cat-cascade">
      <div className="cat-cascade-row">
        <span className="lbl">Grupo</span>
        <div className="opts">
          {grupos.map((g) => (
            <button
              key={g.id}
              type="button"
              className="cat-chip"
              aria-pressed={value.grupoId === g.id}
              onClick={() => setGrupo(g.id)}
            >
              {g.nome}
            </button>
          ))}
        </div>
      </div>
      {grupoSel && (
        <div className="cat-cascade-row">
          <span className="lbl">Categoria</span>
          <div className="opts">
            {grupoSel.categorias.map(
              (c: { id: string; nome: string }) => (
                <button
                  key={c.id}
                  type="button"
                  className="cat-chip"
                  aria-pressed={value.categoriaId === c.id}
                  onClick={() => setCategoria(c.id)}
                >
                  {c.nome}
                </button>
              ),
            )}
            {aiSuggestion?.categoriaId === catSel?.id && (
              <span className="cat-ai-hint" title="Sugestão da IA com base na nota">
                <span className="dot"></span>sugerido pela IA
              </span>
            )}
          </div>
        </div>
      )}
      {catSel && subs.length > 0 && (
        <div className="cat-cascade-row">
          <span className="lbl">Subcategoria</span>
          <div className="opts">
            {subs.map((s) => (
              <button
                key={s.nome}
                type="button"
                className="cat-chip"
                aria-pressed={value.subcategoria === s.nome}
                onClick={() => setSub(s.nome)}
              >
                {s.nome}
              </button>
            ))}
            <button
              type="button"
              className="cat-chip"
              style={{ borderStyle: "dashed", color: "var(--ink-3)" }}
            >
              + criar subcategoria
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function FornecedorAuto({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const list: any[] = R.fornecedores;
  const filtered = useMemo(() => {
    if (!value) return list.slice(0, 8);
    const v = value.toLowerCase();
    return list.filter((f) => f.nome.toLowerCase().includes(v)).slice(0, 8);
  }, [value, list]);
  const showCreateNew = value && !list.find((f) => f.nome.toLowerCase() === value.toLowerCase());

  return (
    <div className="ac-wrapper">
      <input
        className="field-input"
        value={value}
        placeholder="Digite o nome do fornecedor…"
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 160)}
      />
      {open && (filtered.length > 0 || showCreateNew) && (
        <div className="ac-dropdown">
          {filtered.map((f) => (
            <div
              key={f.nome}
              className="ac-option"
              onMouseDown={() => {
                onChange(f.nome);
                setOpen(false);
              }}
            >
              <div>
                <div className="ac-nm">{f.nome}</div>
                <div className="ac-sub">{f.categoriaUsual}</div>
              </div>
              <span className="ac-meta">{f.lancamentos} lançam.</span>
            </div>
          ))}
          {showCreateNew && (
            <div className="ac-option new" onMouseDown={() => setOpen(false)}>
              <div>
                <div className="ac-nm">+ Cadastrar “{value}” como novo fornecedor</div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function WhatsappMock() {
  return (
    <div className="wa-frame">
      <div className="wa-head">
        <div className="av">RN</div>
        <div>
          <div className="nm">Bot Rio Novo</div>
          <div className="st">online · responde em ~3s</div>
        </div>
      </div>
      <div className="wa-body">
        <div className="wa-msg recv">
          <span className="t">Bom dia, Sandra. Manda a foto da nota fiscal aí 📸</span>
          <span className="ts">08:42</span>
        </div>

        <div className="wa-msg-photo">
          <div className="photo">
            FOTO — NF AGROPECUÁRIA SILVA
            <br />
            R$ 1.247,80 · 12/MAI
          </div>
          <span className="ts">08:44 ✓✓</span>
        </div>

        <div className="wa-msg recv">
          <span className="t">Recebi. Lendo…</span>
          <span className="ts">08:44</span>
        </div>

        <div className="wa-bot-card">
          <div className="head">📄 NOTA LIDA — confirmar?</div>
          <div className="kv">
            <span className="k">Fornecedor</span>
            <span>Agropecuária Silva</span>
          </div>
          <div className="kv">
            <span className="k">Valor</span>
            <span>R$ 1.247,80</span>
          </div>
          <div className="kv">
            <span className="k">Data</span>
            <span>12/mai/2026</span>
          </div>
          <div className="kv">
            <span className="k">Itens</span>
            <span>Ração concentrada + Antibiótico</span>
          </div>
          <div className="kv">
            <span className="k">Sugestão</span>
            <span>Ração R$ 814 + Medic. R$ 433</span>
          </div>
          <div className="kv">
            <span className="k">Atividade</span>
            <span>Leite (ambos itens)</span>
          </div>
          <div className="actions">
            <button>✓ Confirmar</button>
            <button className="alt">✎ Ajustar</button>
          </div>
          <span className="ts">08:44</span>
        </div>

        <div className="wa-msg sent">
          <span className="t">Confirmar 👍</span>
          <span className="ts">08:45 ✓✓</span>
        </div>

        <div className="wa-msg recv">
          <span className="t">Lançado ✅ Aparece no dashboard em segundos.</span>
          <span className="ts">08:45</span>
        </div>
      </div>
    </div>
  );
}

function LancarForm({ onSuccess }: { onSuccess: () => void }) {
  const toast = useToast();
  const [photo, setPhoto] = useState<{ name: string; size: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [iaUsed, setIaUsed] = useState(false);
  const fileInput = useRef<HTMLInputElement | null>(null);

  const rascunho = useMemo(loadRascunho, []);
  const [fornecedor, setFornecedor] = useState(rascunho?.fornecedor ?? "");
  const [valor, setValor] = useState(rascunho?.valor ?? "");
  const [data, setData] = useState(rascunho?.data ?? "28/05/2026");
  const [conta, setConta] = useState(rascunho?.conta ?? "bb-1234-5");
  const [pago, setPago] = useState(rascunho?.pago ?? true);
  const [atividade, setAtividade] = useState<string | null>(rascunho?.atividade ?? null);
  const [investimento, setInvestimento] = useState(rascunho?.investimento ?? false);
  const [cat, setCat] = useState<CatValue>(rascunho?.cat ?? { grupoId: null, categoriaId: null, subcategoria: null });
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
            setFornecedor(""); setValor(""); setObs(""); setCat({ grupoId: null, categoriaId: null, subcategoria: null });
            setAtividade(null); setInvestimento(false); setPago(true);
          },
        },
      },
    );
    setRestored(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSalvarRascunho = () => {
    const algumPreenchido = fornecedor || valor || cat.categoriaId || atividade || obs;
    if (!algumPreenchido) {
      toast.warn("Nada para salvar", "Preencha pelo menos um campo antes de salvar o rascunho.");
      return;
    }
    saveRascunho({
      fornecedor, valor, data, conta, pago, atividade, investimento, cat, obs,
      ts: Date.now(),
    });
    toast.success("Rascunho salvo", "Você pode voltar depois para concluir o lançamento.");
  };

  const handleSubmit = () => {
    clearRascunho();
    toast.success("Gasto registrado", `${fornecedor || "Lançamento"} salvo. Aparece no Dashboard em segundos.`);
    onSuccess();
  };

  const onPickFile = (file?: File | null) => {
    if (file) setPhoto({ name: file.name || "nota-fiscal.jpg", size: file.size || 248123 });
  };

  const runIA = () => {
    setIaUsed(true);
    setTimeout(() => {
      setFornecedor("Cooperativa Boa Vista");
      setValor("38450,00");
      setData("24/05/2026");
      setCat({
        grupoId: "insumos-animais",
        categoriaId: "racao",
        subcategoria: "Ração concentrada gado leiteiro",
      });
      setAtividade("leite");
    }, 400);
  };

  const canSubmit = !!(photo && fornecedor && valor && cat.categoriaId && atividade);

  return (
    <div className="lancar-shell">
      <div>
        <div className="form-section-title" style={{ marginBottom: 14 }}>
          1 · Nota fiscal <span style={{ color: "var(--neg)" }}>(obrigatória)</span>
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
            className={"upload-zone " + (dragging ? "dragging" : "")}
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
            <div className="upload-icon">↑</div>
            <div className="upload-title">Arraste a foto da nota fiscal aqui</div>
            <div className="upload-sub">
              ou <span style={{ textDecoration: "underline" }}>selecione um arquivo</span> · JPG, PNG ou PDF
            </div>
            <div className="req-badge">Obrigatório</div>
          </div>
        ) : (
          <div className="upload-zone has-file">
            <div className="nf-preview">
              <div className="thumb">
                NF
                <br />
                {photo.name}
              </div>
              <div className="nf-meta">
                <div className="nf-name">{photo.name}</div>
                <div className="nf-info">{(photo.size / 1024).toFixed(0)} KB · enviado agora</div>
                <div className="nf-info">Capturado às 09:18 · Marco Antônio</div>
                <div className="nf-actions">
                  <button className="btn-ia" onClick={runIA}>
                    <span className="dot"></span>
                    {iaUsed ? "Reler com IA" : "Ler nota com IA"}
                  </button>
                  <button
                    className="btn-ghost danger"
                    onClick={() => {
                      setPhoto(null);
                      setIaUsed(false);
                    }}
                  >
                    Remover
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {iaUsed && photo && (
          <div className="ia-fill-banner" style={{ marginTop: 14 }}>
            <span className="icon-dot"></span>
            <div className="body">
              <strong>Pré-preenchi 5 campos a partir da foto.</strong> Revise valor, fornecedor, data e categoria
              antes de salvar. Itens da nota detectados: <em>Ração concentrada 25t + Sal mineral</em>.
            </div>
          </div>
        )}

        <div style={{ marginTop: 28 }}>
          <div className="form-section-title">Mockup — também pode lançar pelo WhatsApp</div>
          <div className="caption" style={{ marginTop: 6, marginBottom: 14, fontStyle: "italic" }}>
            Sandra (admin) bate uma foto da nota no celular, manda pro bot, confere a sugestão. Lançamento entra no
            dashboard em segundos.
          </div>
          <WhatsappMock />
        </div>
      </div>

      <div className={"form-shell " + (!photo ? "disabled" : "")}>
        <div className="form-section-title">2 · Dados do lançamento</div>

        <div className="form-section">
          <div className="field-row-3">
            <div className="field">
              <label className="field-label">
                Fornecedor<span className="req">*</span>
              </label>
              <FornecedorAuto value={fornecedor} onChange={setFornecedor} />
            </div>
            <div className="field">
              <label className="field-label">
                Valor<span className="req">*</span>
              </label>
              <div className="field-money">
                <span className="prefix">R$</span>
                <input
                  className="field-input"
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                  placeholder="0,00"
                />
              </div>
            </div>
            <div className="field">
              <label className="field-label">
                Data<span className="req">*</span>
              </label>
              <input
                className="field-input"
                value={data}
                onChange={(e) => setData(e.target.value)}
                placeholder="dd/mm/aaaa"
              />
            </div>
          </div>

          <div className="field">
            <label className="field-label">Conta bancária</label>
            <div className="chip-group">
              {R.contasBancarias.map((c: { id: string; nome: string }) => (
                <button
                  key={c.id}
                  type="button"
                  className="chip"
                  aria-pressed={conta === c.id}
                  onClick={() => setConta(c.id)}
                >
                  {c.nome
                    .replace("Banco do Brasil ag. ", "BB ")
                    .replace("Sicredi ag. ", "Sicredi ")
                    .replace("Caixa da fazenda (dinheiro)", "Dinheiro")}
                </button>
              ))}
            </div>
          </div>

          <div className="toggle-row">
            <div className="info">
              <span className="t">Pagamento efetuado</span>
              <span className="s">Marque desligado se for previsão de pagamento.</span>
            </div>
            <div role="button" className="toggle" aria-pressed={pago} onClick={() => setPago(!pago)}></div>
          </div>
        </div>

        <div className="form-section" style={{ marginTop: 12 }}>
          <div className="form-section-title">3 · Categorização</div>

          <div className="field">
            <label className="field-label">
              Atividade (centro de custo)<span className="req">*</span>
            </label>
            <div className="chip-group">
              <button
                type="button"
                className="chip"
                aria-pressed={atividade === "leite"}
                onClick={() => setAtividade("leite")}
              >
                <span className="sw" style={{ background: "var(--leite)" }}></span>Leite
              </button>
              <button
                type="button"
                className="chip"
                aria-pressed={atividade === "cafe"}
                onClick={() => setAtividade("cafe")}
              >
                <span className="sw" style={{ background: "var(--cafe)" }}></span>Café
              </button>
              <button
                type="button"
                className="chip"
                aria-pressed={atividade === "outros"}
                onClick={() => setAtividade("outros")}
              >
                <span className="sw" style={{ background: "var(--outros)" }}></span>Outros
              </button>
              <button
                type="button"
                className="chip"
                aria-pressed={atividade === "mista"}
                onClick={() => setAtividade("mista")}
              >
                <span className="sw" style={{ background: "var(--ink-3)" }}></span>Mista (separar)
              </button>
            </div>
          </div>

          <div className="field">
            <label className="field-label">
              Categoria<span className="req">*</span>
            </label>
            <CategoryCascade
              value={cat}
              onChange={setCat}
              aiSuggestion={iaUsed ? { categoriaId: "racao" } : null}
            />
          </div>

          <div className="toggle-row">
            <div className="info">
              <span className="t">É investimento, não custeio</span>
              <span className="s">
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

        <div className="form-section" style={{ marginTop: 12 }}>
          <div className="form-section-title">4 · Observações</div>
          <div className="field">
            <label className="field-label">Descrição / observação</label>
            <textarea
              className="field-textarea"
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              placeholder="Ex.: compra mensal de ração concentrada — entrega via Cooperativa."
            />
          </div>
          <div className="field">
            <label className="field-label">Etiquetas (opcional)</label>
            <input className="field-input" placeholder="ex.: safra-26, talhão-4, rebanho-girolando" />
          </div>
        </div>

        <div className="form-footer">
          <span className="help">
            {!photo
              ? "Anexe a nota fiscal para liberar o lançamento."
              : !canSubmit
                ? "Complete os campos obrigatórios marcados com asterisco."
                : "Tudo pronto. O lançamento aparecerá no dashboard imediatamente."}
          </span>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn-ghost" onClick={handleSalvarRascunho}>Salvar rascunho</button>
            <button className="btn-primary" disabled={!canSubmit} onClick={handleSubmit}>
              Registrar gasto →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function LancadoSucesso({
  onNew,
  onNav,
  valor,
  categoria,
  fornecedor,
}: {
  onNew: () => void;
  onNav: (t: Tab) => void;
  valor: string;
  categoria: string;
  fornecedor: string;
}) {
  return (
    <div className="lancar-shell" style={{ gridTemplateColumns: "1fr", maxWidth: 640, margin: "0 auto" }}>
      <div className="lancado-card">
        <div className="checkmark">✓</div>
        <div className="h">Gasto registrado</div>
        <div className="v mono-nums">{valor}</div>
        <div className="body-s" style={{ color: "var(--ink-3)" }}>
          {fornecedor} · {categoria}
        </div>
        <div className="caption">Aparece no Dashboard e na aba Gastos em até 30 segundos.</div>
        <div style={{ display: "flex", gap: 12, marginTop: 14 }}>
          <button className="btn-secondary" onClick={() => onNav("gastos")}>
            Ver na aba Gastos
          </button>
          <button className="btn-primary" onClick={onNew}>
            Registrar outro
          </button>
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
    <div className="ac-wrapper">
      <input
        className="field-input"
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
        <div className="ac-dropdown">
          {filtered.map((f) => (
            <div
              key={f}
              className="ac-option"
              onMouseDown={() => {
                onChange(f);
                setOpen(false);
              }}
            >
              <div>
                <div className="ac-nm">{f}</div>
              </div>
            </div>
          ))}
          {showNew && (
            <div className="ac-option new" onMouseDown={() => setOpen(false)}>
              <div>
                <div className="ac-nm">+ Cadastrar "{value}" como novo cliente</div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

type EntradaPayload = { valor: string; tipo: string; comprador: string; qtd: string | null };

function EntradaForm({ onSuccess }: { onNav: (t: Tab) => void; onSuccess: (p: EntradaPayload) => void }) {
  const toast = useToast();
  const [tipoId, setTipoId] = useState("leite");
  const tipo = TIPOS_RECEITA.find((t) => t.id === tipoId) as TipoReceita;

  const [comprador, setComprador] = useState("Embaré Indústria (laticínio)");
  const [valor, setValor] = useState("");
  const [qtd, setQtd] = useState("");
  const [data, setData] = useState("31/05/2026");
  const [conta, setConta] = useState("sicred-9012");
  const [recebido, setRecebido] = useState(true);
  const [doc, setDoc] = useState<{ name: string; size: number } | null>(null);
  const [obs, setObs] = useState("");
  const docInput = useRef<HTMLInputElement>(null);

  const pickTipo = (id: string) => {
    const t = TIPOS_RECEITA.find((x) => x.id === id) as TipoReceita;
    setTipoId(id);
    setComprador(t.fontes[0]);
    setQtd("");
    setValor("");
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

  const canSubmit = comprador && valor && tipoId;

  return (
    <div className="lancar-shell">
      {/* esquerda: tipo + contexto */}
      <div>
        <div className="form-section-title" style={{ marginBottom: 14 }}>
          1 · Tipo de receita
        </div>
        <div className="receita-tipos">
          {TIPOS_RECEITA.map((t) => (
            <button key={t.id} type="button" className={"receita-tipo " + (tipoId === t.id ? "active" : "")} onClick={() => pickTipo(t.id)}>
              <span className="rt-sw" style={{ background: t.cor }}></span>
              <span className="rt-nm">{t.nome}</span>
            </button>
          ))}
        </div>

        <div className="receita-context">
          <div className="rc-head">
            <span className="rc-icon" style={{ background: tipo.cor }}></span>
            <span className="rc-title">{tipo.nome}</span>
          </div>
          {tipoId === "leite" && (
            <p className="rc-body">
              A receita do leite normalmente chega pelo <strong>extrato quinzenal da Embaré</strong>. Você pode importar o extrato
              direto ou lançar manualmente o valor e o volume entregue. O sistema calcula o <strong>R$ por litro</strong>{" "}
              automaticamente.
            </p>
          )}
          {tipoId === "cafe" && (
            <p className="rc-body">
              Venda de café é <strong>safra única</strong> — registre cada nota da cooperativa/exportadora com o número de sacas. O
              sistema calcula o <strong>R$ por saca</strong> e isola a margem da safra.
            </p>
          )}
          {tipoId === "animais" && (
            <p className="rc-body">
              Venda de descarte (vacas) e bezerros. Informe o número de cabeças — entra como receita da atividade Leite, já que reduz o
              rebanho leiteiro.
            </p>
          )}
          {tipoId === "outros" && (
            <p className="rc-body">Arrendamento, venda de esterco, reembolsos. Receitas que não pertencem direto a leite ou café.</p>
          )}

          {tipoId === "leite" && (
            <button className="btn-ia" style={{ marginTop: 14 }}>
              <span className="dot"></span>Importar extrato da Embaré
            </button>
          )}
        </div>

        <input ref={docInput} type="file" accept="image/*,application/pdf" style={{ display: "none" }} onChange={(e) => onPickDoc(e.target.files?.[0])} />
        <div style={{ marginTop: 22 }}>
          <div className="form-section-title" style={{ marginBottom: 12 }}>
            Comprovante / nota de venda <span style={{ color: "var(--ink-3)" }}>(opcional)</span>
          </div>
          {!doc ? (
            <div className="upload-zone" style={{ padding: "26px 20px" }} onClick={() => docInput.current?.click()}>
              <div className="upload-icon">↑</div>
              <div className="upload-title" style={{ fontSize: 18 }}>
                Anexar comprovante
              </div>
              <div className="upload-sub">extrato da Embaré, nota de venda, recibo — JPG, PNG ou PDF</div>
            </div>
          ) : (
            <div className="upload-zone has-file">
              <div className="nf-preview">
                <div className="thumb">
                  DOC
                  <br />
                  {doc.name}
                </div>
                <div className="nf-meta">
                  <div className="nf-name">{doc.name}</div>
                  <div className="nf-info">{(doc.size / 1024).toFixed(0)} KB · enviado agora</div>
                  <div className="nf-actions">
                    <button className="btn-ghost danger" onClick={() => setDoc(null)}>
                      Remover
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* direita: formulário */}
      <div className="form-shell">
        <div className="form-section-title">2 · Dados da entrada</div>

        <div className="form-section">
          <div className="field">
            <label className="field-label">
              Cliente / comprador<span className="req">*</span>
            </label>
            <CompradorAuto value={comprador} onChange={setComprador} fontes={tipo.fontes} />
          </div>

          <div className="field-row-3">
            <div className="field">
              <label className="field-label">
                Valor recebido<span className="req">*</span>
              </label>
              <div className="field-money">
                <span className="prefix">R$</span>
                <input className="field-input" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" />
              </div>
            </div>
            <div className="field">
              <label className="field-label">
                Quantidade {tipo.unidade !== "—" && <span style={{ color: "var(--ink-3)" }}>({tipo.unidade})</span>}
              </label>
              <input
                className="field-input"
                value={qtd}
                onChange={(e) => setQtd(e.target.value)}
                placeholder={tipo.unidade === "litros" ? "ex.: 25380" : tipo.unidade === "sacas" ? "ex.: 430" : tipo.unidade === "cabeças" ? "ex.: 9" : "—"}
                disabled={tipo.unidade === "—"}
              />
            </div>
            <div className="field">
              <label className="field-label">
                Data<span className="req">*</span>
              </label>
              <input className="field-input" value={data} onChange={(e) => setData(e.target.value)} placeholder="dd/mm/aaaa" />
            </div>
          </div>

          {precoUnit && tipo.unidade !== "—" && (
            <div className="ia-fill-banner">
              <span className="icon-dot"></span>
              <div className="body">
                Preço implícito: <strong>R$ {precoUnit.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / {tipo.unidade.replace(/s$/, "")}</strong>.
                {tipo.precoRef > 0 &&
                  (precoUnit >= tipo.precoRef ? (
                    <span style={{ color: "var(--pos)" }}> Acima da referência (R$ {tipo.precoRef.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}).</span>
                  ) : (
                    <span style={{ color: "var(--neg)" }}> Abaixo da referência (R$ {tipo.precoRef.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}).</span>
                  ))}
              </div>
            </div>
          )}

          <div className="field">
            <label className="field-label">Conta de recebimento</label>
            <div className="chip-group">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {R.contasBancarias.map((c: any) => (
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

          <div className="toggle-row">
            <div className="info">
              <span className="t">Valor já recebido</span>
              <span className="s">Desligue se for uma venda a prazo / a receber.</span>
            </div>
            <div role="button" className="toggle" aria-pressed={recebido} onClick={() => setRecebido(!recebido)}></div>
          </div>
        </div>

        <div className="form-section" style={{ marginTop: 12 }}>
          <div className="form-section-title">3 · Observações</div>
          <div className="field">
            <label className="field-label">Descrição / observação</label>
            <textarea className="field-textarea" value={obs} onChange={(e) => setObs(e.target.value)} placeholder={tipo.obsPlaceholder} />
          </div>
        </div>

        <div className="form-footer">
          <span className="help">
            {!canSubmit
              ? "Informe ao menos cliente e valor para registrar a entrada."
              : "Tudo pronto. A entrada aparecerá no Dashboard e melhora o fluxo do mês."}
          </span>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              className="btn-ghost"
              onClick={() => {
                if (!comprador && !valor && !obs) {
                  toast.warn("Nada para salvar", "Preencha pelo menos um campo antes de salvar o rascunho.");
                  return;
                }
                toast.success("Rascunho salvo", "Você pode retomar este lançamento mais tarde.");
              }}
            >
              Salvar rascunho
            </button>
            <button
              className="btn-primary entrada-btn"
              disabled={!canSubmit}
              onClick={() => {
                toast.success("Entrada registrada", `${comprador} · R$ ${valor || "0,00"}`);
                onSuccess({
                  valor: "R$ " + (valor || "0,00"),
                  tipo: tipo.nome,
                  comprador,
                  qtd: qtd && tipo.unidade !== "—" ? `${qtd} ${tipo.unidade}` : null,
                });
              }}
            >
              Registrar entrada →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EntradaSucesso({ onNew, onNav, valor, tipo, comprador, qtd }: EntradaPayload & { onNew: () => void; onNav: (t: Tab) => void }) {
  return (
    <div className="lancar-shell" style={{ gridTemplateColumns: "1fr", maxWidth: 640, margin: "0 auto" }}>
      <div className="lancado-card entrada">
        <div className="checkmark entrada">↑</div>
        <div className="h">Entrada registrada</div>
        <div className="v mono-nums" style={{ color: "var(--pos)" }}>
          {valor}
        </div>
        <div className="body-s" style={{ color: "var(--ink-3)" }}>
          {tipo} · {comprador}
          {qtd ? ` · ${qtd}` : ""}
        </div>
        <div className="caption">Entra no fluxo do mês e no comparativo por atividade.</div>
        <div style={{ display: "flex", gap: 12, marginTop: 14 }}>
          <button className="btn-secondary" onClick={() => onNav("dashboard")}>
            Ver no Dashboard
          </button>
          <button className="btn-primary" onClick={onNew}>
            Registrar outra
          </button>
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
  const [entryMode, setEntryMode] = useState<"web" | "wa">("web");
  const [lastLanc, setLastLanc] = useState<{ valor: string; categoria: string; fornecedor: string } | null>(null);
  const [lastEntrada, setLastEntrada] = useState<EntradaPayload | null>(null);

  const switchTipo = (t: "saida" | "entrada") => {
    setTipo(t);
    setView("form");
    try { localStorage.setItem(TIPO_KEY, t); } catch { /* storage cheio */ }
  };

  return (
    <div className="shell-wide">
      <ReportHeader subtitle={tipo === "saida" ? "Lançar gasto (saída)" : "Lançar entrada (receita)"} updatedAt={R.UPDATED_AT} />

      {/* seletor Entrada / Saída */}
      <div className="es-toggle">
        <button className={"es-btn saida " + (tipo === "saida" ? "active" : "")} onClick={() => switchTipo("saida")}>
          <span className="es-arrow">↓</span>
          <span className="es-txt">
            <strong>Saída</strong>
            <small>Gasto · compra · pagamento</small>
          </span>
        </button>
        <button className={"es-btn entrada " + (tipo === "entrada" ? "active" : "")} onClick={() => switchTipo("entrada")}>
          <span className="es-arrow">↑</span>
          <span className="es-txt">
            <strong>Entrada</strong>
            <small>Receita · venda · recebimento</small>
          </span>
        </button>
      </div>

      {tipo === "saida" && (
        <>
          <div className="entry-tabs">
            <button className="entry-tab" aria-current={entryMode === "web"} onClick={() => setEntryMode("web")}>
              Pelo dashboard
            </button>
            <button className="entry-tab" aria-current={entryMode === "wa"} onClick={() => setEntryMode("wa")}>
              Pelo WhatsApp · Sandra (admin) ←
            </button>
          </div>

          {view === "form" && (
            <LancarForm
              onSuccess={() => {
                setLastLanc({
                  valor: "R$ 38.450,00",
                  categoria: "Ração concentrada gado leiteiro",
                  fornecedor: "Cooperativa Boa Vista",
                });
                setView("sucesso");
              }}
            />
          )}

          {view === "sucesso" && lastLanc && <LancadoSucesso {...lastLanc} onNew={() => setView("form")} onNav={onNav} />}
        </>
      )}

      {tipo === "entrada" && (
        <>
          {view === "form" && <EntradaForm onNav={onNav} onSuccess={(payload) => { setLastEntrada(payload); setView("sucesso"); }} />}
          {view === "sucesso" && lastEntrada && <EntradaSucesso {...lastEntrada} onNew={() => setView("form")} onNav={onNav} />}
        </>
      )}
    </div>
  );
}
