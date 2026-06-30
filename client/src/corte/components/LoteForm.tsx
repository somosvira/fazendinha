import { useState } from "react";
import type { Lote, CategoriaLote, FaseCiclo, RacaCorte } from "../types";
import { CATEGORIA_LABEL, FASE_LABEL } from "../types";
import { CATEGORIAS_ORDEM } from "../domains";
import { criarLote, editarLote, darBaixa, usePiquetes, type LoteInput } from "../api";
import { HOJE } from "../HOJE";

const FASES: FaseCiclo[] = ["CRIA", "RECRIA", "TERMINACAO", "REPRODUCAO"];

const RACAS: RacaCorte[] = [
  "Nelore", "Angus", "Brangus", "F1 Angus×Nelore", "F1 Hereford×Nelore",
  "Senepol", "Tabapuã", "Caracu", "Cruza Industrial",
];

/* Drawer de novo lote / edição / baixa — espelha o TalhaoForm do plantio.
 * CRÍTICO: campos opcionais vazios são OMITIDOS do payload (undefined), nunca
 * enviados como null/"" — o Zod do backend rejeita strings vazias em enums. */
export function LoteForm({ modo, lote, onFechar, onSalvo }: { modo: "novo" | "editar" | "baixa"; lote?: Lote; onFechar: () => void; onSalvo: () => void }) {
  const l = lote;
  const { data: piquetes } = usePiquetes();

  const [codigo, setCodigo] = useState(l?.codigo ?? "");
  const [nome, setNome] = useState(l?.nome ?? "");
  const [categoria, setCategoria] = useState<CategoriaLote>(l?.categoria ?? "GAROTE");
  const [fase, setFase] = useState<FaseCiclo>(l?.fase ?? "RECRIA");
  const [raca, setRaca] = useState<RacaCorte>(l?.raca ?? "Nelore");
  const [numCabecas, setNumCabecas] = useState<string>(String(l?.numCabecas ?? ""));
  const [numCabecasEntrada, setNumCabecasEntrada] = useState<string>(String(l?.numCabecasEntrada ?? ""));
  const [dataFormacao, setDataFormacao] = useState<string>(l?.dataFormacao ?? "");
  const [origem, setOrigem] = useState<string>(l?.origem ?? "");
  const [piqueteAtual, setPiqueteAtual] = useState<string>(l?.piqueteAtual ?? "");
  const [observacao, setObservacao] = useState<string>(l?.observacao ?? "");
  // Baixa
  const [estadoBaixa, setEstadoBaixa] = useState<"VENDIDO" | "EXTINTO">("VENDIDO");
  const [motivoBaixa, setMotivoBaixa] = useState<string>("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const titulo = modo === "novo" ? "Novo lote" : modo === "editar" ? `Editar ${l?.codigo}` : `Baixar ${l?.codigo}`;

  async function salvar() {
    setSalvando(true); setErro(null);
    try {
      if (modo === "baixa" && l) {
        // Omite motivo vazio (undefined), nunca envia "".
        await darBaixa(l.id, { estado: estadoBaixa, motivo: motivoBaixa || undefined });
      } else {
        const payload: LoteInput = {
          codigo,
          nome,
          categoria,
          fase,
          raca,
          numCabecas: Number(numCabecas),
          numCabecasEntrada: numCabecasEntrada ? Number(numCabecasEntrada) : Number(numCabecas),
          dataFormacao: dataFormacao || HOJE,
          // Opcionais: só entram no payload quando preenchidos (undefined caso contrário).
          origem: origem || undefined,
          piqueteAtual: piqueteAtual || undefined,
          observacao: observacao || undefined,
        };
        if (modo === "novo") await criarLote(payload);
        else if (l) await editarLote(l.id, payload);
      }
      onSalvo();
    } catch (e: any) {
      setErro(e.message);
    } finally {
      setSalvando(false);
    }
  }

  if (modo === "baixa") {
    return (
      <>
        <div className="rb-drawer-bg" onClick={onFechar} />
        <aside className="rb-drawer" role="dialog">
          <div className="rb-drawer-head">
            <h3>Dar baixa em {l?.codigo}</h3>
            <button className="rb-drawer-x" onClick={onFechar} aria-label="Fechar">×</button>
          </div>
          <div className="rb-drawer-body">
            <p className="rb-sub">O lote sai do conjunto ativo. Mantém histórico para fins de fechamento da atividade.</p>
            <div className="rb-fld">
              <label>Tipo de baixa</label>
              <select value={estadoBaixa} onChange={(e) => setEstadoBaixa(e.target.value as "VENDIDO" | "EXTINTO")}>
                <option value="VENDIDO">Vendido (abate / reprodução / descarte)</option>
                <option value="EXTINTO">Extinto (transferência / dissolução do lote)</option>
              </select>
            </div>
            <div className="rb-fld">
              <label>Motivo (opcional)</label>
              <input value={motivoBaixa} onChange={(e) => setMotivoBaixa(e.target.value)} placeholder="Ex.: Venda frigorífico Minerva" />
            </div>
            {erro && <p style={{ color: "var(--neg)", fontSize: 13 }}>{erro}</p>}
          </div>
          <div className="rb-drawer-actions">
            <button className="rb-btn" onClick={onFechar}>Cancelar</button>
            <button className="rb-btn rb-btn-danger" disabled={salvando} onClick={salvar}>{salvando ? "Salvando…" : "Confirmar baixa"}</button>
          </div>
        </aside>
      </>
    );
  }

  return (
    <>
      <div className="rb-drawer-bg" onClick={onFechar} />
      <aside className="rb-drawer" role="dialog">
        <div className="rb-drawer-head">
          <h3>{titulo}</h3>
          <button className="rb-drawer-x" onClick={onFechar} aria-label="Fechar">×</button>
        </div>
        <div className="rb-drawer-body">
          <div style={{ display: "flex", gap: 10 }}>
            <div className="rb-fld" style={{ flex: 1 }}>
              <label>Código*</label>
              <input value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="Ex.: TER-03" />
            </div>
            <div className="rb-fld" style={{ flex: 2 }}>
              <label>Nome*</label>
              <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Terminação F1 · lote 3" />
            </div>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <div className="rb-fld" style={{ flex: 1 }}>
              <label>Categoria*</label>
              <select value={categoria} onChange={(e) => setCategoria(e.target.value as CategoriaLote)}>
                {CATEGORIAS_ORDEM.map((c) => <option key={c} value={c}>{CATEGORIA_LABEL[c]}</option>)}
              </select>
            </div>
            <div className="rb-fld" style={{ flex: 1 }}>
              <label>Fase*</label>
              <select value={fase} onChange={(e) => setFase(e.target.value as FaseCiclo)}>
                {FASES.map((f) => <option key={f} value={f}>{FASE_LABEL[f]}</option>)}
              </select>
            </div>
          </div>

          <div className="rb-fld">
            <label>Raça*</label>
            <select value={raca} onChange={(e) => setRaca(e.target.value as RacaCorte)}>
              {RACAS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <div className="rb-fld" style={{ flex: 1 }}>
              <label>Cabeças (hoje)*</label>
              <input type="number" value={numCabecas} onChange={(e) => setNumCabecas(e.target.value)} />
            </div>
            <div className="rb-fld" style={{ flex: 1 }}>
              <label>Cabeças (entrada)</label>
              <input type="number" value={numCabecasEntrada} onChange={(e) => setNumCabecasEntrada(e.target.value)} placeholder="= cabeças hoje" />
            </div>
            <div className="rb-fld" style={{ flex: 1 }}>
              <label>Data de formação*</label>
              <input type="date" value={dataFormacao} onChange={(e) => setDataFormacao(e.target.value)} max={HOJE} />
            </div>
          </div>

          <div className="rb-fld">
            <label>Origem</label>
            <input value={origem} onChange={(e) => setOrigem(e.target.value)} placeholder="Ex.: Nascimento próprio · Compra Boa Esperança" />
          </div>

          <div className="rb-fld">
            <label>Piquete atual</label>
            <select value={piqueteAtual} onChange={(e) => setPiqueteAtual(e.target.value)}>
              <option value="">—</option>
              {piquetes.map((p) => <option key={p.id} value={p.codigo}>{p.codigo} · {p.nome}</option>)}
            </select>
          </div>

          <div className="rb-fld">
            <label>Observação</label>
            <textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} rows={2} />
          </div>
          {erro && <p style={{ color: "var(--neg)", fontSize: 13 }}>{erro}</p>}
        </div>

        <div className="rb-drawer-actions">
          <button className="rb-btn" onClick={onFechar}>Cancelar</button>
          <button className="rb-btn pri" disabled={salvando || !codigo || !nome || !numCabecas} onClick={salvar}>{salvando ? "Salvando…" : "Salvar"}</button>
        </div>
      </aside>
    </>
  );
}
