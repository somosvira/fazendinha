import { useEffect, useState } from "react";
import type { Categoria, CentroCusto, Conta, Fornecedor, Lancamento } from "../types";
import { money } from "../format";
import { apiGet, apiSend } from "../api";

export function Lancamentos() {
  const [lancs, setLancs] = useState<Lancamento[]>([]);
  const [centros, setCentros] = useState<CentroCusto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [contas, setContas] = useState<Conta[]>([]);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [showForm, setShowForm] = useState(false);

  const load = () => apiGet<Lancamento[]>("/lancamentos").then(setLancs);

  useEffect(() => {
    load();
    apiGet<CentroCusto[]>("/cadastros/centros-custo").then(setCentros);
    apiGet<Categoria[]>("/cadastros/categorias").then(setCategorias);
    apiGet<Conta[]>("/cadastros/contas").then(setContas);
    apiGet<Fornecedor[]>("/cadastros/fornecedores").then(setFornecedores);
  }, []);

  return (
    <section className="card">
      <div className="toolbar">
        <span className="muted">{lancs.length} lançamentos</span>
        <button className="btn-primary" onClick={() => setShowForm((s) => !s)}>
          {showForm ? "Fechar" : "+ Novo lançamento"}
        </button>
      </div>

      {showForm && (
        <NovoLancamento
          centros={centros}
          categorias={categorias}
          contas={contas}
          fornecedores={fornecedores}
          onSaved={() => {
            setShowForm(false);
            load();
          }}
        />
      )}

      <div className="table-wrap">
        <table className="list">
          <thead>
            <tr>
              <th>Vencimento</th>
              <th>Situação</th>
              <th>C/D</th>
              <th>Centro de Custo</th>
              <th>Grupo / Categoria</th>
              <th>Fornecedor</th>
              <th className="num">Valor</th>
            </tr>
          </thead>
          <tbody>
            {lancs.map((l) => {
              const signed = (l.natureza === "DEBITO" ? -1 : 1) * Number(l.valor);
              return (
                <tr key={l.id}>
                  <td>{l.dataVencimento.slice(0, 10).split("-").reverse().join("/")}</td>
                  <td>
                    <span className={`pill ${l.situacao === "LIQUIDADO" ? "ok" : "open"}`}>
                      {l.situacao === "LIQUIDADO" ? "Liquidado" : "Aberto"}
                    </span>
                  </td>
                  <td>{l.natureza === "CREDITO" ? "C" : "D"}</td>
                  <td>{l.centroCusto.nome}</td>
                  <td>
                    {l.categoria.grupoCategoria.nome} › {l.categoria.nome}
                  </td>
                  <td>{l.clienteFornecedor?.nome ?? "—"}</td>
                  <td className={`num ${signed < 0 ? "neg" : ""}`}>{money(signed)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function NovoLancamento({
  centros,
  categorias,
  contas,
  fornecedores,
  onSaved,
}: {
  centros: CentroCusto[];
  categorias: Categoria[];
  contas: Conta[];
  fornecedores: Fornecedor[];
  onSaved: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    natureza: "DEBITO",
    valor: "",
    dataVencimento: today,
    situacao: "LIQUIDADO",
    categoriaId: "",
    centroCustoId: "",
    contaBancariaId: "",
    clienteFornecedorId: "",
    descricao: "",
  });
  const [erro, setErro] = useState<string | null>(null);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    const body = {
      natureza: form.natureza,
      valor: Number(form.valor),
      dataCompetencia: form.dataVencimento,
      dataVencimento: form.dataVencimento,
      dataLiquidacao: form.situacao === "LIQUIDADO" ? form.dataVencimento : null,
      situacao: form.situacao,
      categoriaId: Number(form.categoriaId),
      centroCustoId: Number(form.centroCustoId),
      contaBancariaId: form.contaBancariaId ? Number(form.contaBancariaId) : null,
      clienteFornecedorId: form.clienteFornecedorId ? Number(form.clienteFornecedorId) : null,
      descricao: form.descricao || null,
    };
    try {
      await apiSend("POST", "/lancamentos", body);
      onSaved();
    } catch (err) {
      setErro((err as Error).message);
    }
  }

  return (
    <form className="form" onSubmit={submit}>
      <div className="grid">
        <label>
          Natureza
          <select value={form.natureza} onChange={(e) => set("natureza", e.target.value)}>
            <option value="DEBITO">Débito (saída)</option>
            <option value="CREDITO">Crédito (entrada)</option>
          </select>
        </label>
        <label>
          Valor (R$)
          <input type="number" step="0.01" value={form.valor} onChange={(e) => set("valor", e.target.value)} required />
        </label>
        <label>
          Vencimento
          <input type="date" value={form.dataVencimento} onChange={(e) => set("dataVencimento", e.target.value)} />
        </label>
        <label>
          Situação
          <select value={form.situacao} onChange={(e) => set("situacao", e.target.value)}>
            <option value="LIQUIDADO">Liquidado</option>
            <option value="ABERTO">Aberto</option>
          </select>
        </label>
        <label>
          Centro de Custo
          <select value={form.centroCustoId} onChange={(e) => set("centroCustoId", e.target.value)} required>
            <option value="">Selecione…</option>
            {centros.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </label>
        <label>
          Categoria
          <select value={form.categoriaId} onChange={(e) => set("categoriaId", e.target.value)} required>
            <option value="">Selecione…</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.grupoCategoria.nome} › {c.nome}
              </option>
            ))}
          </select>
        </label>
        <label>
          Conta bancária
          <select value={form.contaBancariaId} onChange={(e) => set("contaBancariaId", e.target.value)}>
            <option value="">—</option>
            {contas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </label>
        <label>
          Cliente / Fornecedor
          <select value={form.clienteFornecedorId} onChange={(e) => set("clienteFornecedorId", e.target.value)}>
            <option value="">—</option>
            {fornecedores.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome}
              </option>
            ))}
          </select>
        </label>
        <label className="wide">
          Descrição
          <input value={form.descricao} onChange={(e) => set("descricao", e.target.value)} />
        </label>
      </div>
      {erro && <p className="erro">{erro}</p>}
      <button className="btn-primary" type="submit">
        Salvar lançamento
      </button>
    </form>
  );
}
