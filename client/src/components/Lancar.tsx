/* Rio Novo — Lançar gasto */

import { useEffect, useMemo, useRef, useState } from "react";
import R from "../data/rionovo";
import { ReportHeader } from "./Shell";
import type { Tab } from "./Shell";

// ─── Cadastros vindos do backend ────────────────────────────────────────

type CentroCusto = { id: number; nome: string; ehInvestimento: boolean };
type Conta = { id: number; nome: string; banco: string | null };
type Categoria = { id: number; nome: string };
type Grupo = { id: number; nome: string; categorias: Categoria[] };
type Fornecedor = { id: number; nome: string; documento: string | null };

type Cadastros = {
  centrosCusto: CentroCusto[];
  contas: Conta[];
  grupos: Grupo[];
  fornecedores: Fornecedor[];
};

function useCadastros() {
  const [data, setData] = useState<Cadastros | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    fetch("/api/cadastros")
      .then((r) => (r.ok ? r.json() : Promise.reject(`HTTP ${r.status}`)))
      .then((j) => {
        if (alive) setData(j);
      })
      .catch((e) => alive && setErro(String(e)));
    return () => {
      alive = false;
    };
  }, []);
  return { data, erro };
}

// ─── Cascade de Categoria (Grupo → Categoria) ───────────────────────────

type CatValue = { grupoId: number | null; categoriaId: number | null };

function CategoryCascade({
  grupos,
  value,
  onChange,
}: {
  grupos: Grupo[];
  value: CatValue;
  onChange: (v: CatValue) => void;
}) {
  const grupoSel = grupos.find((g) => g.id === value.grupoId);

  const setGrupo = (gid: number) => onChange({ grupoId: gid, categoriaId: null });
  const setCategoria = (cid: number) => onChange({ ...value, categoriaId: cid });

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
            {grupoSel.categorias.map((c) => (
              <button
                key={c.id}
                type="button"
                className="cat-chip"
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

// ─── Autocomplete de fornecedor ─────────────────────────────────────────

type FornecedorValue = { id: number | null; nome: string };

function FornecedorAuto({
  lista,
  value,
  onChange,
}: {
  lista: Fornecedor[];
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
    <div className="ac-wrapper">
      <input
        className="field-input"
        value={value.nome}
        placeholder="Digite o nome do fornecedor…"
        onChange={(e) => {
          onChange({ id: null, nome: e.target.value });
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 160)}
      />
      {open && (filtered.length > 0 || showCreateNew) && (
        <div className="ac-dropdown">
          {filtered.map((f) => (
            <div
              key={f.id}
              className="ac-option"
              onMouseDown={() => {
                onChange({ id: f.id, nome: f.nome });
                setOpen(false);
              }}
            >
              <div>
                <div className="ac-nm">{f.nome}</div>
                {f.documento ? <div className="ac-sub">{f.documento}</div> : null}
              </div>
            </div>
          ))}
          {showCreateNew && (
            <div className="ac-option new" onMouseDown={() => setOpen(false)}>
              <div>
                <div className="ac-nm">+ Cadastrar “{value.nome}” como novo fornecedor</div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Mock do fluxo WhatsApp (continua só ilustrativo) ───────────────────

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

// ─── Estado do upload pendente ──────────────────────────────────────────

type UploadStatus = "idle" | "enviando" | "pendente-ok" | "erro";

type PendenteState = {
  id: number;
  expiraEm: string;
};

// dd/mm/aaaa de uma Date
function hojeBR(): string {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

// ─── Form principal ─────────────────────────────────────────────────────

function LancarForm({
  cadastros,
  onSuccess,
}: {
  cadastros: Cadastros;
  onSuccess: (info: { lancamentoId: number; valor: string; categoria: string; fornecedor: string }) => void;
}) {
  const [photo, setPhoto] = useState<{ name: string; size: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement | null>(null);

  const [pendente, setPendente] = useState<PendenteState | null>(null);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>("idle");
  const [uploadMensagem, setUploadMensagem] = useState<string | null>(null);

  const [fornecedor, setFornecedor] = useState<FornecedorValue>({ id: null, nome: "" });
  const [valor, setValor] = useState("");
  const [data, setData] = useState(hojeBR());
  const [contaId, setContaId] = useState<number | null>(cadastros.contas[0]?.id ?? null);
  const [pago, setPago] = useState(true);
  const [centroCustoId, setCentroCustoId] = useState<number | null>(null);
  const [cat, setCat] = useState<CatValue>({ grupoId: null, categoriaId: null });
  const [obs, setObs] = useState("");

  const [submitErro, setSubmitErro] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onPickFile = async (file?: File | null) => {
    if (!file) return;
    setPhoto({ name: file.name || "nota-fiscal", size: file.size || 0 });
    setUploadStatus("enviando");
    setUploadMensagem("Enviando arquivo…");
    try {
      const form = new FormData();
      form.append("arquivo", file);
      const res = await fetch("/api/nota-fiscal/upload-pendente", { method: "POST", body: form });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setUploadStatus("erro");
        if (json.codigo === "DUPLICATA_DEFINITIVA" && json.arquivoExistente) {
          setUploadMensagem(
            `Esta nota já foi lançada antes (lançamento #${json.arquivoExistente.lancamentoId}).`,
          );
        } else {
          setUploadMensagem(json.erro || `Falha no upload (HTTP ${res.status})`);
        }
        return;
      }
      setPendente({ id: json.pendente.id, expiraEm: json.pendente.expiraEm });
      setUploadStatus("pendente-ok");
      setUploadMensagem(
        json.retomada
          ? "Foto já estava aguardando — vamos seguir com ela."
          : "Foto recebida. Preencha os dados abaixo.",
      );
    } catch (e: unknown) {
      setUploadStatus("erro");
      setUploadMensagem(e instanceof Error ? e.message : "Falha no upload");
    }
  };

  const removerFoto = async () => {
    if (pendente) {
      try {
        await fetch(`/api/nota-fiscal/upload-pendente/${pendente.id}`, { method: "DELETE" });
      } catch {
        // best effort
      }
    }
    setPhoto(null);
    setPendente(null);
    setUploadStatus("idle");
    setUploadMensagem(null);
  };

  const submit = async () => {
    if (!pendente) return;
    if (!cat.categoriaId || !centroCustoId) return;
    setSubmitting(true);
    setSubmitErro(null);
    try {
      const res = await fetch("/api/lancamentos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pendenteId: pendente.id,
          natureza: "DEBITO",
          valorBR: valor,
          dataBR: data,
          categoriaId: cat.categoriaId,
          centroCustoId,
          contaBancariaId: contaId,
          fornecedorId: fornecedor.id,
          fornecedorNome: fornecedor.id ? null : fornecedor.nome,
          pago,
          descricao: obs || null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSubmitErro(json.erro || `Falha ao registrar (HTTP ${res.status})`);
        setSubmitting(false);
        return;
      }
      const catNome =
        cadastros.grupos.flatMap((g) => g.categorias).find((c) => c.id === cat.categoriaId)?.nome ??
        "(sem categoria)";
      onSuccess({
        lancamentoId: json.lancamentoId,
        valor: `R$ ${valor}`,
        categoria: catNome,
        fornecedor: fornecedor.nome || "(sem fornecedor)",
      });
    } catch (e: unknown) {
      setSubmitErro(e instanceof Error ? e.message : "Falha ao registrar");
      setSubmitting(false);
    }
  };

  const uploadBloqueia = uploadStatus === "enviando" || uploadStatus === "erro";
  const canSubmit = !!(
    photo &&
    pendente &&
    fornecedor.nome.trim() &&
    valor &&
    data &&
    cat.categoriaId &&
    centroCustoId &&
    !uploadBloqueia &&
    !submitting
  );

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
                <div className="nf-actions">
                  <button className="btn-ghost danger" onClick={removerFoto}>
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
                uploadStatus === "pendente-ok"
                  ? "rgba(56, 142, 60, 0.08)"
                  : uploadStatus === "erro"
                    ? "rgba(211, 47, 47, 0.08)"
                    : undefined,
            }}
          >
            <span className="icon-dot"></span>
            <div className="body">
              <strong>
                {uploadStatus === "enviando" && "Enviando arquivo…"}
                {uploadStatus === "pendente-ok" && "Foto aguardando confirmação."}
                {uploadStatus === "erro" && "Falha no upload."}
              </strong>
              {uploadMensagem ? <> {uploadMensagem}</> : null}
            </div>
          </div>
        )}

        <div style={{ marginTop: 28 }}>
          <div className="form-section-title">Mockup — também pode lançar pelo WhatsApp</div>
          <div className="caption" style={{ marginTop: 6, marginBottom: 14, fontStyle: "italic" }}>
            Sandra (admin) bate uma foto da nota no celular, manda pro bot, confere a sugestão.
          </div>
          <WhatsappMock />
        </div>
      </div>

      <div className={"form-shell " + (!pendente ? "disabled" : "")}>
        <div className="form-section-title">2 · Dados do lançamento</div>

        <div className="form-section">
          <div className="field-row-3">
            <div className="field">
              <label className="field-label">
                Fornecedor<span className="req">*</span>
              </label>
              <FornecedorAuto lista={cadastros.fornecedores} value={fornecedor} onChange={setFornecedor} />
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
              {cadastros.contas.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="chip"
                  aria-pressed={contaId === c.id}
                  onClick={() => setContaId(c.id)}
                >
                  {c.nome}
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
              {cadastros.centrosCusto.map((cc) => (
                <button
                  key={cc.id}
                  type="button"
                  className="chip"
                  aria-pressed={centroCustoId === cc.id}
                  onClick={() => setCentroCustoId(cc.id)}
                >
                  {cc.nome}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <label className="field-label">
              Categoria<span className="req">*</span>
            </label>
            <CategoryCascade grupos={cadastros.grupos} value={cat} onChange={setCat} />
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
        </div>

        {submitErro && (
          <div className="ia-fill-banner" style={{ marginTop: 12, background: "rgba(211, 47, 47, 0.08)" }}>
            <span className="icon-dot"></span>
            <div className="body">
              <strong>Não consegui registrar.</strong> {submitErro}
            </div>
          </div>
        )}

        <div className="form-footer">
          <span className="help">
            {!pendente
              ? "Anexe a nota fiscal para liberar o lançamento."
              : uploadStatus === "enviando"
                ? "Aguarde o upload terminar."
                : uploadStatus === "erro"
                  ? "Falha no upload — remova e envie outra."
                  : !canSubmit
                    ? "Complete os campos obrigatórios marcados com asterisco."
                    : "Tudo pronto. Ao registrar, o lançamento será criado e a foto amarrada a ele."}
          </span>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn-ghost" disabled>
              Salvar rascunho
            </button>
            <button className="btn-primary" disabled={!canSubmit} onClick={submit}>
              {submitting ? "Registrando…" : "Registrar gasto →"}
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
  lancamentoId,
  valor,
  categoria,
  fornecedor,
}: {
  onNew: () => void;
  onNav: (t: Tab) => void;
  lancamentoId: number;
  valor: string;
  categoria: string;
  fornecedor: string;
}) {
  return (
    <div className="lancar-shell" style={{ gridTemplateColumns: "1fr", maxWidth: 640, margin: "0 auto" }}>
      <div className="lancado-card">
        <div className="checkmark">✓</div>
        <div className="h">Gasto registrado · #{lancamentoId}</div>
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
  const [lastLanc, setLastLanc] = useState<
    | { lancamentoId: number; valor: string; categoria: string; fornecedor: string }
    | null
  >(null);

  const { data: cadastros, erro: cadastrosErro } = useCadastros();

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

      {cadastrosErro && (
        <div className="ia-fill-banner" style={{ background: "rgba(211, 47, 47, 0.08)" }}>
          <span className="icon-dot"></span>
          <div className="body">
            <strong>Não consegui carregar os cadastros.</strong> {cadastrosErro}
          </div>
        </div>
      )}

      {!cadastros && !cadastrosErro && (
        <div className="caption" style={{ padding: 24 }}>
          Carregando cadastros…
        </div>
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

      {view === "sucesso" && lastLanc && (
        <LancadoSucesso {...lastLanc} onNew={() => setView("form")} onNav={onNav} />
      )}
    </div>
  );
}
