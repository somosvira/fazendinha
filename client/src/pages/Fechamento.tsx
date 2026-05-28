import { useEffect, useState } from "react";
import { apiGet, apiSend } from "../api";

interface Fechamento {
  id: number;
  ano: number;
  mes: number;
  fechadoEm: string;
  observacao: string | null;
}

const MESES = ["", "Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export function Fechamento() {
  const [fechamentos, setFechamentos] = useState<Fechamento[]>([]);
  const hoje = new Date();
  const [ano, setAno] = useState(hoje.getUTCFullYear());
  const [mes, setMes] = useState(hoje.getUTCMonth() + 1);
  const [erro, setErro] = useState<string | null>(null);

  const load = () => apiGet<Fechamento[]>("/fechamentos").then(setFechamentos);
  useEffect(() => { load(); }, []);

  const run = async (fn: () => Promise<void>) => {
    setErro(null);
    try { await fn(); } catch (e) { setErro((e as Error).message); }
  };

  const anos = Array.from({ length: 6 }, (_, i) => hoje.getUTCFullYear() - 3 + i);

  return (
    <section className="card">
      <p className="subtitle">Fechamento mensal</p>
      <p className="muted" style={{ marginTop: -6 }}>
        Meses fechados bloqueiam criação, edição e exclusão de lançamentos com data de caixa naquele mês.
      </p>

      <form className="inline-form" onSubmit={(e) => { e.preventDefault(); run(async () => { await apiSend("POST", "/fechamentos", { ano, mes }); await load(); }); }}>
        <select value={mes} onChange={(e) => setMes(Number(e.target.value))}>
          {MESES.slice(1).map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
        </select>
        <select value={ano} onChange={(e) => setAno(Number(e.target.value))}>
          {anos.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <button className="btn-primary" type="submit">🔒 Fechar mês</button>
      </form>
      {erro && <p className="erro">{erro}</p>}

      <div className="table-wrap">
        <table className="list">
          <thead><tr><th>Mês</th><th>Fechado em</th><th></th></tr></thead>
          <tbody>
            {fechamentos.length === 0 && (
              <tr><td colSpan={3} className="muted">Nenhum mês fechado.</td></tr>
            )}
            {fechamentos.map((f) => (
              <tr key={f.id}>
                <td><span className="pill ok">🔒 {MESES[f.mes]}/{f.ano}</span></td>
                <td className="muted">{new Date(f.fechadoEm).toLocaleString("pt-BR")}</td>
                <td className="acts">
                  <button onClick={() => run(async () => { await apiSend("DELETE", `/fechamentos/${f.ano}/${f.mes}`); await load(); })}>
                    🔓 Reabrir
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
