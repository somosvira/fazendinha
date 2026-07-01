import { useState } from "react";
import type { Lote, TipoComercial } from "../types";
import { registrarOperacaoComercial, type OperacaoComercialInput } from "../api";
import { arrobasCarcaca } from "../lib/derive";
import { HOJE } from "../HOJE";

/* Tipos de operação comercial. O valor é o enum TipoComercial em UPPERCASE. */
const TIPOS: { v: TipoComercial; lab: string }[] = [
  { v: "VENDA_ABATE", lab: "Venda — abate (frigorífico)" },
  { v: "VENDA_REPRODUCAO", lab: "Venda — reprodução / matriz" },
  { v: "DESCARTE", lab: "Descarte (vaca / touro)" },
  { v: "COMPRA", lab: "Compra (reposição)" },
  { v: "TRANSFERENCIA_ATIVIDADE", lab: "Transferência de atividade" },
];

const PRECO_SPOT_MG = 317;

/* Drawer de registro de operação comercial — espelha o PesagemForm. O `loteId`
 * vai no CORPO (venda pode ser parcial), não na rota.
 * CRÍTICO: campos opcionais vazios são OMITIDOS (undefined), nunca null/""; o
 * `tipo` é sempre um enum em UPPERCASE vindo do select tipado. */
export function OperacaoComercialForm({ lote, onFechar, onSalvo }: { lote: Lote; onFechar: () => void; onSalvo: () => void }) {
  const [tipo, setTipo] = useState<TipoComercial>("VENDA_ABATE");
  const [data, setData] = useState<string>(HOJE);
  const [numCabecas, setNumCabecas] = useState<string>(String(lote.numCabecas ?? ""));
  const [pesoMedio, setPesoMedio] = useState<string>(String(lote.resumo?.pesoMedio ?? ""));
  const [precoArroba, setPrecoArroba] = useState<string>(String(PRECO_SPOT_MG));
  const [comprador, setComprador] = useState<string>("");
  const [observacao, setObservacao] = useState<string>("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    setSalvando(true); setErro(null);
    try {
      const payload: OperacaoComercialInput = {
        data: data || HOJE,
        tipo,
        numCabecas: Number(numCabecas),
        pesoMedio: Number(pesoMedio),
        // loteId no corpo — a operação pode cobrir só parte do lote.
        loteId: lote.id,
        // Opcionais: só entram no payload quando preenchidos (undefined caso contrário).
        precoArroba: precoArroba ? Number(precoArroba) : undefined,
        comprador: comprador || undefined,
        observacao: observacao || undefined,
      };
      await registrarOperacaoComercial(payload);
      onSalvo();
    } catch (e: any) {
      setErro(e?.message ?? "Erro ao salvar.");
      setSalvando(false);
    }
  }

  const arrobasTot = pesoMedio && numCabecas ? arrobasCarcaca(Number(pesoMedio)) * Number(numCabecas) : 0;
  const receita = arrobasTot && precoArroba ? arrobasTot * Number(precoArroba) : 0;

  return (
    <>
      <div className="rb-drawer-bg" onClick={onFechar} />
      <aside className="rb-drawer" role="dialog" aria-labelledby="oper-title">
        <div className="rb-drawer-head">
          <h3 id="oper-title">Registrar operação — {lote.codigo}</h3>
          <button className="rb-drawer-x" onClick={onFechar} aria-label="Fechar">×</button>
        </div>
        <div className="rb-drawer-body">
          <p className="rb-sub">{lote.nome} · {lote.numCabecas} cabeças. Venda/compra/descarte — entra na linha do tempo do lote.</p>

          <div className="rb-fld">
            <label>Tipo de operação*</label>
            <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoComercial)}>
              {TIPOS.map((t) => <option key={t.v} value={t.v}>{t.lab}</option>)}
            </select>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <div className="rb-fld" style={{ flex: 1 }}>
              <label>Data*</label>
              <input type="date" value={data} onChange={(e) => setData(e.target.value)} max={HOJE} />
            </div>
            <div className="rb-fld" style={{ flex: 1 }}>
              <label>Cabeças*</label>
              <input type="number" value={numCabecas} onChange={(e) => setNumCabecas(e.target.value)} max={lote.numCabecas} />
            </div>
            <div className="rb-fld" style={{ flex: 1 }}>
              <label>Peso médio (kg)*</label>
              <input type="number" step="0.1" value={pesoMedio} onChange={(e) => setPesoMedio(e.target.value)} />
            </div>
          </div>

          <div className="rb-fld">
            <label>Preço da @ (R$)</label>
            <input type="number" step="0.01" value={precoArroba} onChange={(e) => setPrecoArroba(e.target.value)} placeholder={`Spot MG ≈ ${PRECO_SPOT_MG}`} />
          </div>

          {arrobasTot > 0 && (
            <p className="rb-sub" style={{ marginTop: 0 }}>
              <b>{arrobasTot.toFixed(0)} @</b> carcaça (rend. 52%)
              {receita > 0 && <> · receita estimada <b>{receita.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}</b></>}
            </p>
          )}

          <div className="rb-fld">
            <label>Comprador / origem</label>
            <input value={comprador} onChange={(e) => setComprador(e.target.value)} placeholder="Ex.: Frigorífico Minerva · Leilão Boa Esperança" />
          </div>

          <div className="rb-fld">
            <label>Observação</label>
            <textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} rows={2} />
          </div>
          {erro && <p style={{ color: "var(--neg)", fontSize: 13 }}>{erro}</p>}
        </div>

        <div className="rb-drawer-actions">
          <button className="rb-btn" onClick={onFechar} disabled={salvando}>Cancelar</button>
          <button className="rb-btn pri" disabled={salvando || !numCabecas || !pesoMedio} onClick={salvar}>{salvando ? "Salvando…" : "Salvar operação"}</button>
        </div>
      </aside>
    </>
  );
}
