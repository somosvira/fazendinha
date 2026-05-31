/* Rio Novo — Lançar gasto */

import { useMemo, useRef, useState } from "react";
import R from "../data/rionovo";
import { ReportHeader } from "./Shell";
import type { Tab } from "./Shell";

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

// TODO: trocar quando a rota POST /api/lancamentos existir.
// Por enquanto o upload anexa a nota a um Lancamento pré-existente (ex.: seed id=1).
const LANCAMENTO_ID_PLACEHOLDER = 1;

type UploadStatus = "idle" | "enviando" | "PENDENTE" | "VALIDA" | "ATENCAO" | "REJEITADA" | "ERRO";

function LancarForm({ onSuccess }: { onSuccess: () => void }) {
  const [photo, setPhoto] = useState<{ name: string; size: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [iaUsed, setIaUsed] = useState(false);
  const fileInput = useRef<HTMLInputElement | null>(null);

  const [uploadStatus, setUploadStatus] = useState<UploadStatus>("idle");
  const [uploadMensagem, setUploadMensagem] = useState<string | null>(null);
  const [arquivoId, setArquivoId] = useState<number | null>(null);

  const [fornecedor, setFornecedor] = useState("");
  const [valor, setValor] = useState("");
  const [data, setData] = useState("28/05/2026");
  const [conta, setConta] = useState("bb-1234-5");
  const [pago, setPago] = useState(true);
  const [atividade, setAtividade] = useState<string | null>(null);
  const [investimento, setInvestimento] = useState(false);
  const [cat, setCat] = useState<CatValue>({ grupoId: null, categoriaId: null, subcategoria: null });
  const [obs, setObs] = useState("");

  const pollStatus = async (id: number) => {
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 1500));
      try {
        const res = await fetch(`/api/nota-fiscal/arquivo/${id}`);
        if (!res.ok) continue;
        const json = await res.json();
        const status = json.arquivo?.statusValidacao;
        if (status && status !== "PENDENTE") {
          setUploadStatus(status as UploadStatus);
          setUploadMensagem(json.arquivo.mensagemValidacao ?? null);
          return;
        }
      } catch {
        // segue tentando
      }
    }
    setUploadMensagem("OCR demorou mais que o esperado — confira em breve.");
  };

  const onPickFile = async (file?: File | null) => {
    if (!file) return;
    setPhoto({ name: file.name || "nota-fiscal", size: file.size || 0 });
    setArquivoId(null);
    setUploadStatus("enviando");
    setUploadMensagem("Verificando arquivo…");
    try {
      const form = new FormData();
      form.append("arquivo", file);
      const res = await fetch(`/api/lancamentos/${LANCAMENTO_ID_PLACEHOLDER}/nota-fiscal`, {
        method: "POST",
        body: form,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setUploadStatus("ERRO");
        setUploadMensagem(json.erro || `Falha no upload (HTTP ${res.status})`);
        return;
      }
      setArquivoId(json.arquivo.id);
      setUploadStatus("PENDENTE");
      setUploadMensagem("Analisando conteúdo (OCR)…");
      pollStatus(json.arquivo.id);
    } catch (e: unknown) {
      setUploadStatus("ERRO");
      setUploadMensagem(e instanceof Error ? e.message : "Falha no upload");
    }
  };

  const runIA = () => {
    setIaUsed(true);
    // TODO: aproveitar ocrTexto retornado por GET /api/nota-fiscal/arquivo/:id
    // ou migrar para Textract AnalyzeExpense, que devolve fornecedor/valor/data estruturados.
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

  const uploadBloqueia = uploadStatus === "enviando" || uploadStatus === "REJEITADA" || uploadStatus === "ERRO";
  const canSubmit = !!(photo && fornecedor && valor && cat.categoriaId && atividade && !uploadBloqueia);

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
                    onClick={async () => {
                      // Remove no backend se já subiu — best-effort.
                      if (arquivoId != null) {
                        try {
                          await fetch(
                            `/api/lancamentos/${LANCAMENTO_ID_PLACEHOLDER}/nota-fiscal/${arquivoId}`,
                            { method: "DELETE" },
                          );
                        } catch {
                          // ignora; o user pode tentar de novo
                        }
                      }
                      setPhoto(null);
                      setIaUsed(false);
                      setArquivoId(null);
                      setUploadStatus("idle");
                      setUploadMensagem(null);
                    }}
                  >
                    Remover
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {photo && uploadStatus !== "idle" && (
          <div
            className="ia-fill-banner"
            style={{
              marginTop: 14,
              background:
                uploadStatus === "VALIDA"
                  ? "rgba(56, 142, 60, 0.08)"
                  : uploadStatus === "ATENCAO"
                    ? "rgba(245, 166, 35, 0.10)"
                    : uploadStatus === "REJEITADA" || uploadStatus === "ERRO"
                      ? "rgba(211, 47, 47, 0.08)"
                      : undefined,
            }}
          >
            <span className="icon-dot"></span>
            <div className="body">
              <strong>
                {uploadStatus === "enviando" && "Enviando arquivo…"}
                {uploadStatus === "PENDENTE" && "Validando nota fiscal (OCR)…"}
                {uploadStatus === "VALIDA" && "Nota fiscal verificada."}
                {uploadStatus === "ATENCAO" && "Atenção: arquivo aceito, mas precisa revisão manual."}
                {uploadStatus === "REJEITADA" && "Não parece ser uma nota fiscal."}
                {uploadStatus === "ERRO" && "Falha no upload."}
              </strong>
              {uploadMensagem ? <> {uploadMensagem}</> : null}
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
              : uploadStatus === "enviando" || uploadStatus === "PENDENTE"
                ? "Aguarde a validação da nota terminar."
                : uploadStatus === "REJEITADA"
                  ? "Nota rejeitada — remova e envie outra antes de salvar."
                  : uploadStatus === "ERRO"
                    ? "Falha no upload — tente remover e enviar novamente."
                    : !canSubmit
                      ? "Complete os campos obrigatórios marcados com asterisco."
                      : "Tudo pronto. O lançamento aparecerá no dashboard imediatamente."}
          </span>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn-ghost">Salvar rascunho</button>
            <button className="btn-primary" disabled={!canSubmit} onClick={onSuccess}>
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

export function Lancar({ onNav }: { onNav: (t: Tab) => void }) {
  const [view, setView] = useState<"form" | "sucesso">("form");
  const [entryMode, setEntryMode] = useState<"web" | "wa">("web");
  const [lastLanc, setLastLanc] = useState<{ valor: string; categoria: string; fornecedor: string } | null>(null);

  return (
    <div className="shell-wide">
      <ReportHeader subtitle="Lançar gasto" updatedAt={R.UPDATED_AT} />

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

      {view === "sucesso" && lastLanc && (
        <LancadoSucesso {...lastLanc} onNew={() => setView("form")} onNav={onNav} />
      )}
    </div>
  );
}
