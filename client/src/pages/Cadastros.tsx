import { useEffect, useState } from "react";
import { apiGet, apiSend } from "../api";
import type { CentroCusto, Categoria, Conta, Fornecedor } from "../types";

type Sub = "centros" | "grupos" | "categorias" | "contas" | "fornecedores";
const SUBS: { id: Sub; label: string }[] = [
  { id: "centros", label: "Centros de Custo" },
  { id: "grupos", label: "Grupos" },
  { id: "categorias", label: "Categorias" },
  { id: "contas", label: "Contas" },
  { id: "fornecedores", label: "Clientes/Fornecedores" },
];

interface Grupo {
  id: number;
  nome: string;
  categorias: Categoria[];
}

export function Cadastros() {
  const [sub, setSub] = useState<Sub>("centros");
  return (
    <section className="card">
      <nav className="subnav">
        {SUBS.map((s) => (
          <button key={s.id} className={sub === s.id ? "on" : ""} onClick={() => setSub(s.id)}>
            {s.label}
          </button>
        ))}
      </nav>
      {sub === "centros" && <Centros />}
      {sub === "grupos" && <Grupos />}
      {sub === "categorias" && <Categorias />}
      {sub === "contas" && <Contas />}
      {sub === "fornecedores" && <Fornecedores />}
    </section>
  );
}

function useErro() {
  const [erro, setErro] = useState<string | null>(null);
  const run = async (fn: () => Promise<void>) => {
    setErro(null);
    try {
      await fn();
    } catch (e) {
      setErro((e as Error).message);
    }
  };
  return { erro, run };
}

function CrudTable({
  children,
  erro,
}: {
  children: React.ReactNode;
  erro: string | null;
}) {
  return (
    <>
      {erro && <p className="erro">{erro}</p>}
      <div className="table-wrap">
        <table className="list">{children}</table>
      </div>
    </>
  );
}

// --- Centros de Custo ------------------------------------------------------
function Centros() {
  const [itens, setItens] = useState<CentroCusto[]>([]);
  const [nome, setNome] = useState("");
  const [ehInv, setEhInv] = useState(false);
  const { erro, run } = useErro();
  const load = () => apiGet<CentroCusto[]>("/cadastros/centros-custo").then(setItens);
  useEffect(() => { load(); }, []);

  return (
    <>
      <form className="inline-form" onSubmit={(e) => { e.preventDefault(); run(async () => { await apiSend("POST", "/cadastros/centros-custo", { nome, ehInvestimento: ehInv, ordem: itens.length + 1 }); setNome(""); setEhInv(false); await load(); }); }}>
        <input placeholder="Novo centro de custo" value={nome} onChange={(e) => setNome(e.target.value)} required />
        <label className="chk"><input type="checkbox" checked={ehInv} onChange={(e) => setEhInv(e.target.checked)} /> Investimento</label>
        <button className="btn-primary" type="submit">Adicionar</button>
      </form>
      <CrudTable erro={erro}>
        <thead><tr><th>Nome</th><th>Tipo</th><th></th></tr></thead>
        <tbody>
          {itens.map((c) => (
            <tr key={c.id}>
              <td>{c.nome}</td>
              <td>{c.ehInvestimento ? "Investimento" : "Operacional"}</td>
              <td className="acts">
                <button onClick={() => run(async () => { const n = prompt("Novo nome", c.nome); if (n) { await apiSend("PUT", `/cadastros/centros-custo/${c.id}`, { nome: n }); await load(); } })}>✎</button>
                <button className="del" onClick={() => run(async () => { await apiSend("DELETE", `/cadastros/centros-custo/${c.id}`); await load(); })}>🗑</button>
              </td>
            </tr>
          ))}
        </tbody>
      </CrudTable>
    </>
  );
}

// --- Grupos ----------------------------------------------------------------
function Grupos() {
  const [itens, setItens] = useState<Grupo[]>([]);
  const [nome, setNome] = useState("");
  const { erro, run } = useErro();
  const load = () => apiGet<Grupo[]>("/cadastros/grupos").then(setItens);
  useEffect(() => { load(); }, []);

  return (
    <>
      <form className="inline-form" onSubmit={(e) => { e.preventDefault(); run(async () => { await apiSend("POST", "/cadastros/grupos", { nome, ordem: itens.length + 1 }); setNome(""); await load(); }); }}>
        <input placeholder="Novo grupo de categoria" value={nome} onChange={(e) => setNome(e.target.value)} required />
        <button className="btn-primary" type="submit">Adicionar</button>
      </form>
      <CrudTable erro={erro}>
        <thead><tr><th>Grupo</th><th>Categorias</th><th></th></tr></thead>
        <tbody>
          {itens.map((g) => (
            <tr key={g.id}>
              <td>{g.nome}</td>
              <td className="muted">{g.categorias.length}</td>
              <td className="acts">
                <button onClick={() => run(async () => { const n = prompt("Novo nome", g.nome); if (n) { await apiSend("PUT", `/cadastros/grupos/${g.id}`, { nome: n }); await load(); } })}>✎</button>
                <button className="del" onClick={() => run(async () => { await apiSend("DELETE", `/cadastros/grupos/${g.id}`); await load(); })}>🗑</button>
              </td>
            </tr>
          ))}
        </tbody>
      </CrudTable>
    </>
  );
}

// --- Categorias ------------------------------------------------------------
function Categorias() {
  const [itens, setItens] = useState<Categoria[]>([]);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [nome, setNome] = useState("");
  const [grupoId, setGrupoId] = useState("");
  const { erro, run } = useErro();
  const load = () => apiGet<Categoria[]>("/cadastros/categorias").then(setItens);
  useEffect(() => { load(); apiGet<Grupo[]>("/cadastros/grupos").then(setGrupos); }, []);

  return (
    <>
      <form className="inline-form" onSubmit={(e) => { e.preventDefault(); run(async () => { await apiSend("POST", "/cadastros/categorias", { nome, grupoCategoriaId: Number(grupoId) }); setNome(""); await load(); }); }}>
        <select value={grupoId} onChange={(e) => setGrupoId(e.target.value)} required>
          <option value="">Grupo…</option>
          {grupos.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}
        </select>
        <input placeholder="Nova categoria" value={nome} onChange={(e) => setNome(e.target.value)} required />
        <button className="btn-primary" type="submit">Adicionar</button>
      </form>
      <CrudTable erro={erro}>
        <thead><tr><th>Grupo</th><th>Categoria</th><th></th></tr></thead>
        <tbody>
          {itens.map((c) => (
            <tr key={c.id}>
              <td className="muted">{c.grupoCategoria.nome}</td>
              <td>{c.nome}</td>
              <td className="acts">
                <button onClick={() => run(async () => { const n = prompt("Novo nome", c.nome); if (n) { await apiSend("PUT", `/cadastros/categorias/${c.id}`, { nome: n }); await load(); } })}>✎</button>
                <button className="del" onClick={() => run(async () => { await apiSend("DELETE", `/cadastros/categorias/${c.id}`); await load(); })}>🗑</button>
              </td>
            </tr>
          ))}
        </tbody>
      </CrudTable>
    </>
  );
}

// --- Contas ----------------------------------------------------------------
function Contas() {
  const [itens, setItens] = useState<Conta[]>([]);
  const [nome, setNome] = useState("");
  const [banco, setBanco] = useState("");
  const { erro, run } = useErro();
  const load = () => apiGet<Conta[]>("/cadastros/contas").then(setItens);
  useEffect(() => { load(); }, []);

  return (
    <>
      <form className="inline-form" onSubmit={(e) => { e.preventDefault(); run(async () => { await apiSend("POST", "/cadastros/contas", { nome, banco: banco || null }); setNome(""); setBanco(""); await load(); }); }}>
        <input placeholder="Nova conta" value={nome} onChange={(e) => setNome(e.target.value)} required />
        <input placeholder="Banco (opcional)" value={banco} onChange={(e) => setBanco(e.target.value)} />
        <button className="btn-primary" type="submit">Adicionar</button>
      </form>
      <CrudTable erro={erro}>
        <thead><tr><th>Conta</th><th></th></tr></thead>
        <tbody>
          {itens.map((c) => (
            <tr key={c.id}>
              <td>{c.nome}</td>
              <td className="acts">
                <button onClick={() => run(async () => { const n = prompt("Novo nome", c.nome); if (n) { await apiSend("PUT", `/cadastros/contas/${c.id}`, { nome: n }); await load(); } })}>✎</button>
                <button className="del" onClick={() => run(async () => { await apiSend("DELETE", `/cadastros/contas/${c.id}`); await load(); })}>🗑</button>
              </td>
            </tr>
          ))}
        </tbody>
      </CrudTable>
    </>
  );
}

// --- Fornecedores ----------------------------------------------------------
function Fornecedores() {
  const [itens, setItens] = useState<Fornecedor[]>([]);
  const [nome, setNome] = useState("");
  const [filtro, setFiltro] = useState("");
  const { erro, run } = useErro();
  const load = () => apiGet<Fornecedor[]>("/cadastros/fornecedores").then(setItens);
  useEffect(() => { load(); }, []);
  const filtrados = itens.filter((f) => f.nome.toLowerCase().includes(filtro.toLowerCase()));

  return (
    <>
      <form className="inline-form" onSubmit={(e) => { e.preventDefault(); run(async () => { await apiSend("POST", "/cadastros/fornecedores", { nome }); setNome(""); await load(); }); }}>
        <input placeholder="Novo cliente/fornecedor" value={nome} onChange={(e) => setNome(e.target.value)} required />
        <button className="btn-primary" type="submit">Adicionar</button>
        <input className="search" placeholder="🔎 filtrar…" value={filtro} onChange={(e) => setFiltro(e.target.value)} />
      </form>
      <CrudTable erro={erro}>
        <thead><tr><th>Nome ({filtrados.length})</th><th></th></tr></thead>
        <tbody>
          {filtrados.slice(0, 200).map((f) => (
            <tr key={f.id}>
              <td>{f.nome}</td>
              <td className="acts">
                <button onClick={() => run(async () => { const n = prompt("Novo nome", f.nome); if (n) { await apiSend("PUT", `/cadastros/fornecedores/${f.id}`, { nome: n }); await load(); } })}>✎</button>
                <button className="del" onClick={() => run(async () => { await apiSend("DELETE", `/cadastros/fornecedores/${f.id}`); await load(); })}>🗑</button>
              </td>
            </tr>
          ))}
        </tbody>
      </CrudTable>
    </>
  );
}
