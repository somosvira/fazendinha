import { useMemo, useState } from "react";
import {
  useConfig, salvarConfig, type ModoProducao,
  useParametros, salvarParametrosApi, resetarParametro,
  type ParametroDTO, type CategoriaParametro, type ParametroPatch,
} from "../api";

const MODOS: { id: ModoProducao; titulo: string; desc: string }[] = [
  { id: "ORDENHA", titulo: "Controle leiteiro", desc: "Peso por ordenha (manhã/tarde/noite) por vaca — controle individual." },
  { id: "TOTAL_DIARIO", titulo: "Total diário", desc: "Um total de leite por vaca a cada dia, sem separar as ordenhas." },
  { id: "TANQUE_LOTE", titulo: "Tanque / lote", desc: "Litros do tanque ou lote; a produção por vaca vem por rateio." },
];

const CATEGORIAS: { id: CategoriaParametro; titulo: string }[] = [
  { id: "MANEJO",     titulo: "Manejo" },
  { id: "PRODUCAO",   titulo: "Produção" },
  { id: "REPRODUCAO", titulo: "Reprodução" },
  { id: "GESTAO",     titulo: "Gestão" },
  { id: "SANITARIO",  titulo: "Sanitário" },
];

const fmtRef = (v: number | null) => (v == null ? "—" : String(v).replace(".", ","));

export function ConfiguracoesView() {
  const cfg = useConfig();
  const params = useParametros();

  const [salvando, setSalvando] = useState<ModoProducao | null>(null);
  const [salvandoPreco, setSalvandoPreco] = useState(false);
  const [precoLeite, setPrecoLeite] = useState<string>("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);

  // Rascunho local dos parâmetros editados (chave → patch). Envio só o que mudou.
  const [rascunho, setRascunho] = useState<Record<string, ParametroPatch>>({});
  const [salvandoParams, setSalvandoParams] = useState(false);

  const paramsPorCategoria = useMemo(() => {
    const map = new Map<CategoriaParametro, ParametroDTO[]>();
    for (const p of params.data ?? []) {
      if (!map.has(p.categoria)) map.set(p.categoria, []);
      map.get(p.categoria)!.push(p);
    }
    return map;
  }, [params.data]);

  if (cfg.loading) return <main className="rb-main"><div className="rb-eyebrow">Configurações</div><div className="rb-head"><h1>Configurações</h1></div><p className="rb-sub">Carregando…</p></main>;
  if (cfg.erro || !cfg.data) return <main className="rb-main"><div className="rb-head"><h1>Configurações</h1></div><p className="rb-sub" style={{ color: "var(--neg)" }}>Erro: {cfg.erro}</p></main>;

  // Sincroniza estado local do input com o valor do banco quando ele muda
  if (cfg.data.precoLeite != null && precoLeite === "") setPrecoLeite(String(cfg.data.precoLeite));

  const escolher = async (modo: ModoProducao) => {
    if (modo === cfg.data!.producaoModo || salvando) return;
    setSalvando(modo); setErroSalvar(null); setFeedback(null);
    try {
      await salvarConfig({ producaoModo: modo });
      cfg.recarregar();
      setFeedback("Modo de produção atualizado. O rebanho foi recalculado.");
    } catch (e: any) {
      setErroSalvar(e.message);
    } finally {
      setSalvando(null);
    }
  };

  const salvarPreco = async () => {
    setSalvandoPreco(true); setErroSalvar(null); setFeedback(null);
    try {
      const valor = precoLeite.trim() === "" ? null : Number(precoLeite.replace(",", "."));
      await salvarConfig({ precoLeite: valor });
      cfg.recarregar();
      setFeedback("Preço do leite atualizado.");
    } catch (e: any) {
      setErroSalvar(e.message);
    } finally {
      setSalvandoPreco(false);
    }
  };

  // Helpers pro rascunho
  const setPatch = (chave: string, campo: keyof ParametroPatch, v: number | string | null) => {
    setRascunho((r) => ({ ...r, [chave]: { ...r[chave], chave, [campo]: v } }));
  };

  // Valor exibido no input: se está no rascunho, mostra o rascunho; senão o efetivo.
  const efetivo = (p: ParametroDTO, campo: "valorNumero" | "valorNumeroAceitavel"): string => {
    const r = rascunho[p.chave]?.[campo];
    if (r !== undefined) return r == null ? "" : String(r);
    const v = p[campo];
    return v == null ? "" : String(v);
  };

  const modoAtual = (p: ParametroDTO): string => rascunho[p.chave]?.modo ?? p.modo ?? "DIAS";

  const salvarParametros = async () => {
    const patches = Object.values(rascunho);
    if (patches.length === 0) return;
    setSalvandoParams(true); setErroSalvar(null); setFeedback(null);
    try {
      const atualizados = await salvarParametrosApi(patches);
      params.substituir(atualizados);
      setRascunho({});
      setFeedback(`${patches.length} parâmetro(s) atualizado(s).`);
    } catch (e: any) {
      setErroSalvar(e.message);
    } finally {
      setSalvandoParams(false);
    }
  };

  const restaurar = async (chave: string) => {
    setErroSalvar(null); setFeedback(null);
    try {
      const dto = await resetarParametro(chave);
      params.substituirUm(dto);
      setRascunho((r) => { const c = { ...r }; delete c[chave]; return c; });
      setFeedback("Parâmetro restaurado para o padrão Embrapa.");
    } catch (e: any) {
      setErroSalvar(e.message);
    }
  };

  const parseNum = (s: string): number | null => {
    const t = s.trim().replace(",", ".");
    if (t === "") return null;
    const n = Number(t);
    return isFinite(n) ? n : null;
  };

  const nMudancas = Object.keys(rascunho).length;

  return (
    <main className="rb-main">
      <div className="rb-eyebrow">Configurações · Sítio São Francisco</div>
      <div className="rb-head"><h1>Configurações</h1></div>

      <h2 className="rb-sec-title">Como a fazenda mede o leite?</h2>
      <p className="rb-sec-sub">Define como a produção é registrada e como a média por vaca é calculada. Trocar o modo recalcula todo o rebanho.</p>

      <div className="rb-dcards" role="radiogroup" aria-label="Modo de produção">
        {MODOS.map((m) => {
          const ativo = cfg.data!.producaoModo === m.id;
          return (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={ativo}
              className={"rb-dcard" + (ativo ? " on" : "")}
              onClick={() => escolher(m.id)}
              disabled={salvando != null}
            >
              <h4>{m.titulo}<span className="go">{ativo ? "✓ atual" : salvando === m.id ? "salvando…" : "selecionar"}</span></h4>
              <ul><li>{m.desc}</li></ul>
            </button>
          );
        })}
      </div>

      <h2 className="rb-sec-title" style={{ marginTop: 36 }}>Preço do leite</h2>
      <p className="rb-sec-sub">Valor recebido por litro. Alimenta os cálculos de receita e rentabilidade na ficha do animal. Vazio = sistema usa R$ 2,40/L como fallback.</p>
      <div style={{ display: "flex", gap: 12, alignItems: "center", maxWidth: 360 }}>
        <input
          type="number"
          step="0.01"
          min={0}
          className="rb-fld"
          value={precoLeite}
          onChange={(e) => setPrecoLeite(e.target.value)}
          placeholder="ex.: 2.40"
          style={{ flex: 1 }}
        />
        <button className="rb-btn pri" disabled={salvandoPreco} onClick={salvarPreco}>{salvandoPreco ? "Salvando…" : "Salvar"}</button>
      </div>

      {/* ── Parâmetros de manejo ─────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginTop: 36 }}>
        <div>
          <h2 className="rb-sec-title" style={{ marginTop: 0 }}>Parâmetros de manejo</h2>
          <p className="rb-sec-sub">Metas Embrapa, pesos de referência e regras da fazenda. O valor Embrapa fica sempre à direita como comparação — a fazenda pode sobrescrever.</p>
        </div>
        <button
          className="rb-btn pri"
          disabled={salvandoParams || nMudancas === 0}
          onClick={salvarParametros}
        >
          {salvandoParams ? "Salvando…" : nMudancas === 0 ? "Salvar parâmetros" : `Salvar ${nMudancas} alteração(ões)`}
        </button>
      </div>

      {params.loading && <p className="rb-sub">Carregando parâmetros…</p>}
      {params.erro && <p className="rb-sub" style={{ color: "var(--neg)" }}>Erro: {params.erro}</p>}

      {!params.loading && !params.erro && CATEGORIAS.map(({ id, titulo }) => {
        const items = paramsPorCategoria.get(id) ?? [];
        if (items.length === 0) return null;
        return (
          <details key={id} open style={{ marginTop: 18, borderTop: "1px solid var(--linha)", paddingTop: 12 }}>
            <summary style={{ cursor: "pointer", fontFamily: "Newsreader, serif", fontSize: 18, fontWeight: 500 }}>
              {titulo} <span className="rb-sub" style={{ fontSize: 13 }}>({items.length})</span>
            </summary>
            <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
              {items.map((p) => {
                const temAceitavel = p.direcao != null; // metas com semáforo
                const modo = modoAtual(p);
                const desmame = p.chave === "DESMAME_MODO";

                return (
                  <div key={p.chave} style={{
                    display: "grid",
                    gridTemplateColumns: desmame ? "260px 1fr auto" : temAceitavel ? "260px 110px 110px 220px auto" : "260px 130px 220px auto",
                    gap: 10, alignItems: "center", fontSize: 14,
                  }}>
                    <div>
                      <div style={{ fontWeight: 500 }}>{p.descricao}</div>
                      <div className="rb-sub" style={{ fontSize: 12 }}>{p.chave}{p.unidade ? ` · ${p.unidade}` : ""}</div>
                    </div>

                    {desmame ? (
                      <div style={{ display: "flex", gap: 12 }}>
                        <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <input type="radio" name="desmame_modo" checked={modo === "DIAS"} onChange={() => setPatch(p.chave, "modo", "DIAS")} /> Por dias
                        </label>
                        <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <input type="radio" name="desmame_modo" checked={modo === "PESO"} onChange={() => setPatch(p.chave, "modo", "PESO")} /> Por peso
                        </label>
                      </div>
                    ) : (
                      <>
                        <input
                          type="number" step="any" className="rb-fld"
                          value={efetivo(p, "valorNumero")}
                          placeholder={temAceitavel ? "ideal" : ""}
                          onChange={(e) => setPatch(p.chave, "valorNumero", parseNum(e.target.value))}
                        />
                        {temAceitavel && (
                          <input
                            type="number" step="any" className="rb-fld"
                            value={efetivo(p, "valorNumeroAceitavel")}
                            placeholder="aceitável"
                            onChange={(e) => setPatch(p.chave, "valorNumeroAceitavel", parseNum(e.target.value))}
                          />
                        )}
                      </>
                    )}

                    <div className="rb-sub" style={{ fontSize: 12 }}>
                      {desmame
                        ? "Embrapa: 120 dias (padrão)"
                        : temAceitavel
                          ? `Embrapa: ${fmtRef(p.referenciaNumero)} / ${fmtRef(p.referenciaNumeroAceitavel)}`
                          : `Embrapa: ${fmtRef(p.referenciaNumero)}`}
                      {p.temOverride && <span style={{ color: "var(--brass)", marginLeft: 8 }}>· fazenda</span>}
                    </div>

                    <button
                      className="rb-btn"
                      style={{ padding: "4px 10px", fontSize: 12 }}
                      disabled={!p.temOverride}
                      onClick={() => restaurar(p.chave)}
                      title="Restaurar padrão Embrapa"
                    >
                      Restaurar
                    </button>
                  </div>
                );
              })}
            </div>
          </details>
        );
      })}

      {feedback && <p className="rb-sub" style={{ marginTop: 14, color: "var(--pos)" }}>{feedback}</p>}
      {erroSalvar && <p className="rb-sub" style={{ marginTop: 14, color: "var(--neg)" }}>Erro: {erroSalvar}</p>}
    </main>
  );
}
