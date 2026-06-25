import { useCallback, useEffect, useState } from "react";
import { useSaldos, useCustoVacaDia, listarMovimentos, excluirMovimento, type MovimentoDTO } from "../api";
import { MovimentoForm } from "./MovimentoForm";

const money = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const qtd = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
const TIPO_MOV: Record<MovimentoDTO["tipo"], string> = { ENTRADA: "Entrada", SAIDA: "Saída", AJUSTE: "Ajuste" };

function useMovimentos() {
  const [data, setData] = useState<MovimentoDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const recarregar = useCallback(() => { setLoading(true); setErro(null); listarMovimentos().then(setData).catch((e) => setErro(e.message)).finally(() => setLoading(false)); }, []);
  useEffect(() => { recarregar(); }, [recarregar]);
  return { data, loading, erro, recarregar };
}

export function EstoqueTab() {
  const custo = useCustoVacaDia();
  const saldos = useSaldos();
  const movimentos = useMovimentos();
  const [form, setForm] = useState(false);

  const recarregarTudo = () => { custo.recarregar(); saldos.recarregar(); movimentos.recarregar(); };

  async function excluir(m: MovimentoDTO) {
    if (!confirm(`Excluir movimento de ${m.produto}?`)) return;
    await excluirMovimento(m.id);
    recarregarTudo();
  }

  if (custo.loading && saldos.loading && movimentos.loading) {
    return <main className="rb-main"><div className="rb-eyebrow">Rebanho</div><div className="rb-head"><h1>Estoque</h1></div><p className="rb-sub">Carregando…</p></main>;
  }

  const c = custo.data;
  const custoTxt = c && c.custoVacaDia != null ? money(c.custoVacaDia) : "—";

  return (
    <main className="rb-main">
      <div className="rb-eyebrow">Rebanho · insumos e consumo</div>
      <div className="rb-head"><h1>Estoque</h1></div>

      {/* KPI headline — custo vaca/dia (o norte da Tássila) */}
      <div className="rb-kstrip" style={{ ["--cols" as any]: 3 }}>
        <div className="rb-k" style={{ borderLeft: "3px solid var(--leite)" }}>
          <div className="lab">Custo vaca/dia</div>
          <div className="val" style={{ fontSize: 34, color: "var(--cafe)" }}>{custoTxt}</div>
          <div className="d">{c ? `consumo dos últimos ${c.periodoDias} dias` : "—"}</div>
        </div>
        <div className="rb-k"><div className="lab">Vacas em lactação</div><div className="val">{c?.vacasEmLactacao ?? "—"}</div><div className="d">base do rateio</div></div>
        <div className="rb-k"><div className="lab">Consumo no período</div><div className="val" style={{ fontSize: 20 }}>{c ? money(c.totalConsumo) : "—"}</div><div className="d">{c ? `${c.periodoDias} dias` : "—"}</div></div>
      </div>
      {custo.erro && <p className="rb-sub" style={{ color: "var(--neg)" }}>Erro no custo: {custo.erro}</p>}

      {/* Saldos */}
      <h2 className="rb-sec-title">Saldos de estoque</h2>
      {saldos.loading ? <p className="rb-sub">Carregando…</p>
        : saldos.erro ? <p className="rb-sub" style={{ color: "var(--neg)" }}>Erro: {saldos.erro}</p>
        : saldos.data.length === 0 ? <div className="rb-empty">Nenhum produto estocável cadastrado.</div>
        : (
          <div className="rb-tbl-wrap"><table className="rb-tbl">
            <thead><tr><th>Produto</th><th>Tipo</th><th>Saldo</th><th>Valor</th><th>Mínimo</th></tr></thead>
            <tbody>{saldos.data.map((s) => (
              <tr key={s.produtoId}>
                <td className="rb-anm">{s.nome} {s.abaixoMinimo && <span className="rb-pill bad">⚠ abaixo do mínimo</span>}</td>
                <td>{s.tipo}</td>
                <td>{qtd(s.saldo)} {s.unidade}</td>
                <td>{money(s.valor)}</td>
                <td>{s.minimoEstoque != null ? `${qtd(s.minimoEstoque)} ${s.unidade}` : "—"}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}

      {/* Movimentos */}
      <div className="rb-listhead" style={{ marginTop: 26 }}>
        <h3>Movimentos recentes</h3>
        <button className="rb-btn pri" onClick={() => setForm(true)}>+ Registrar movimento</button>
      </div>
      {movimentos.loading ? <p className="rb-sub">Carregando…</p>
        : movimentos.erro ? <p className="rb-sub" style={{ color: "var(--neg)" }}>Erro: {movimentos.erro}</p>
        : movimentos.data.length === 0 ? <div className="rb-empty">Nenhum movimento registrado ainda.</div>
        : (
          <div className="rb-tbl-wrap"><table className="rb-tbl">
            <thead><tr><th>Data</th><th>Produto</th><th>Tipo</th><th>Qtde</th><th>Valor</th><th>Origem/destino</th><th></th></tr></thead>
            <tbody>{movimentos.data.map((m) => (
              <tr key={m.id}>
                <td>{m.data}</td>
                <td className="rb-anm">{m.produto}</td>
                <td><span className={"rb-pill" + (m.tipo === "SAIDA" ? " warn" : "")}>{TIPO_MOV[m.tipo]}</span></td>
                <td>{qtd(m.quantidade)}</td>
                <td>{money(m.valorTotal)}</td>
                <td>{m.fornecedor ?? m.grupo ?? "—"}</td>
                <td style={{ textAlign: "right" }}><button className="rb-btn" onClick={() => excluir(m)}>Excluir</button></td>
              </tr>
            ))}</tbody>
          </table></div>
        )}

      {form && <MovimentoForm onFechar={() => setForm(false)} onSalvo={() => { setForm(false); recarregarTudo(); }} />}
    </main>
  );
}
