import { useState } from "react";
import { Loader } from "../../components/Loading";
import { useProdutos, useFornecedores, editarProduto, editarFornecedor, type ProdutoDTO, type FornecedorDTO, type TipoProduto, type TipoPessoa } from "../api";
import { ProdutoForm } from "./ProdutoForm";
import { FornecedorForm } from "./FornecedorForm";
import { RebHeader } from "./RebHeader";
import { RebTable } from "@/components/rb/RebTable";
import { RebButton } from "@/components/rb/RebButton";

type Sub = "produtos" | "fornecedores";

const TIPO_PRODUTO: { id: TipoProduto; label: string }[] = [
  { id: "MEDICAMENTO", label: "Medicamento" },
  { id: "RACAO", label: "Ração" },
  { id: "INSUMO", label: "Insumo" },
  { id: "MINERAL", label: "Mineral" },
  { id: "OUTRO", label: "Outro" },
];
const LABEL_PRODUTO: Record<TipoProduto, string> = Object.fromEntries(TIPO_PRODUTO.map((t) => [t.id, t.label])) as Record<TipoProduto, string>;

const TIPO_PESSOA: { id: TipoPessoa; label: string }[] = [
  { id: "FORNECEDOR", label: "Fornecedor" },
  { id: "CLIENTE", label: "Cliente" },
  { id: "AMBOS", label: "Ambos" },
];
const LABEL_PESSOA: Record<TipoPessoa, string> = Object.fromEntries(TIPO_PESSOA.map((t) => [t.id, t.label])) as Record<TipoPessoa, string>;

const money = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function CadastrosView() {
  const [sub, setSub] = useState<Sub>("produtos");
  return (
    <main className="rb-main">
      <RebHeader eyebrow="Cadastros · Sítio São Francisco" title="Cadastros" />
      <div className="rb-chips" style={{ marginBottom: 18 }}>
        <button className={"rb-chip-q" + (sub === "produtos" ? " on" : "")} onClick={() => setSub("produtos")} style={sub === "produtos" ? { borderColor: "var(--cafe)", color: "var(--cafe)" } : undefined}>Produtos</button>
        <button className={"rb-chip-q" + (sub === "fornecedores" ? " on" : "")} onClick={() => setSub("fornecedores")} style={sub === "fornecedores" ? { borderColor: "var(--cafe)", color: "var(--cafe)" } : undefined}>Fornecedores</button>
      </div>
      {sub === "produtos" ? <Produtos /> : <Fornecedores />}
    </main>
  );
}

function Produtos() {
  const [tipo, setTipo] = useState<string>("");
  const [q, setQ] = useState("");
  const { data, loading, erro, recarregar } = useProdutos({ tipo: tipo || undefined, q: q || undefined });
  const [editando, setEditando] = useState<ProdutoDTO | null>(null);
  const [novo, setNovo] = useState(false);

  const toggleAtivo = async (p: ProdutoDTO) => { await editarProduto(p.id, { ativo: !p.ativo }); recarregar(); };

  return (
    <>
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="m-0 font-serif text-lg font-medium">Produtos</h3>
        <RebButton variant="pri" onClick={() => setNovo(true)}>+ Novo produto</RebButton>
      </div>
      <div className="rb-chips" style={{ marginBottom: 12, alignItems: "center" }}>
        <button className="rb-chip-q" onClick={() => setTipo("")} style={tipo === "" ? { borderColor: "var(--cafe)", color: "var(--cafe)" } : undefined}>Todos</button>
        {TIPO_PRODUTO.map((t) => (
          <button key={t.id} className="rb-chip-q" onClick={() => setTipo(t.id)} style={tipo === t.id ? { borderColor: "var(--cafe)", color: "var(--cafe)" } : undefined}>{t.label}</button>
        ))}
        <input className="rb-fld" style={{ marginBottom: 0, padding: "7px 11px", fontSize: 13.5, marginLeft: "auto" }} placeholder="Buscar por nome…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {loading ? <Loader />
        : erro ? <p className="mt-[7px] text-sm text-prejuizo">Erro: {erro}</p>
        : data.length === 0 ? <p className="mt-[7px] text-sm text-ink-3">Nenhum produto encontrado.</p>
        : (
          <RebTable>
            <thead><tr><th>Nome</th><th>Tipo</th><th>Unidade</th><th>Custo</th><th>Situação</th><th></th></tr></thead>
            <tbody>{data.map((p) => (
              <tr key={p.id}>
                <td className="rb-anm">{p.nome}</td>
                <td>{LABEL_PRODUTO[p.tipo]}</td>
                <td>{p.unidade}</td>
                <td>{p.custoUnitario != null ? money(p.custoUnitario) : "—"}</td>
                <td><span className={"rb-pill" + (p.ativo ? "" : " bad")}>{p.ativo ? "Ativo" : "Inativo"}</span></td>
                <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                  <RebButton onClick={() => setEditando(p)}>Editar</RebButton>{" "}
                  <RebButton onClick={() => toggleAtivo(p)}>{p.ativo ? "Desativar" : "Ativar"}</RebButton>
                </td>
              </tr>
            ))}</tbody>
          </RebTable>
        )}

      {novo && <ProdutoForm onFechar={() => setNovo(false)} onSalvo={() => { setNovo(false); recarregar(); }} />}
      {editando && <ProdutoForm produto={editando} onFechar={() => setEditando(null)} onSalvo={() => { setEditando(null); recarregar(); }} />}
    </>
  );
}

function Fornecedores() {
  const [tipo, setTipo] = useState<string>("");
  const [q, setQ] = useState("");
  const { data, loading, erro, recarregar } = useFornecedores({ tipo: tipo || undefined, q: q || undefined });
  const [editando, setEditando] = useState<FornecedorDTO | null>(null);
  const [novo, setNovo] = useState(false);

  const toggleAtivo = async (fr: FornecedorDTO) => { await editarFornecedor(fr.id, { ativo: !fr.ativo }); recarregar(); };
  const contato = (fr: FornecedorDTO) => [fr.telefone, fr.email].filter(Boolean).join(" · ") || "—";

  return (
    <>
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="m-0 font-serif text-lg font-medium">Fornecedores</h3>
        <RebButton variant="pri" onClick={() => setNovo(true)}>+ Novo fornecedor</RebButton>
      </div>
      <div className="rb-chips" style={{ marginBottom: 12, alignItems: "center" }}>
        <button className="rb-chip-q" onClick={() => setTipo("")} style={tipo === "" ? { borderColor: "var(--cafe)", color: "var(--cafe)" } : undefined}>Todos</button>
        {TIPO_PESSOA.map((t) => (
          <button key={t.id} className="rb-chip-q" onClick={() => setTipo(t.id)} style={tipo === t.id ? { borderColor: "var(--cafe)", color: "var(--cafe)" } : undefined}>{t.label}</button>
        ))}
        <input className="rb-fld" style={{ marginBottom: 0, padding: "7px 11px", fontSize: 13.5, marginLeft: "auto" }} placeholder="Buscar por nome…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {loading ? <Loader />
        : erro ? <p className="mt-[7px] text-sm text-prejuizo">Erro: {erro}</p>
        : data.length === 0 ? <p className="mt-[7px] text-sm text-ink-3">Nenhum fornecedor encontrado.</p>
        : (
          <RebTable>
            <thead><tr><th>Nome</th><th>Tipo</th><th>Documento</th><th>Contato</th><th>Situação</th><th></th></tr></thead>
            <tbody>{data.map((fr) => (
              <tr key={fr.id}>
                <td className="rb-anm">{fr.nome}</td>
                <td>{LABEL_PESSOA[fr.tipo]}</td>
                <td>{fr.documento ?? "—"}</td>
                <td>{contato(fr)}</td>
                <td><span className={"rb-pill" + (fr.ativo ? "" : " bad")}>{fr.ativo ? "Ativo" : "Inativo"}</span></td>
                <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                  <RebButton onClick={() => setEditando(fr)}>Editar</RebButton>{" "}
                  <RebButton onClick={() => toggleAtivo(fr)}>{fr.ativo ? "Desativar" : "Ativar"}</RebButton>
                </td>
              </tr>
            ))}</tbody>
          </RebTable>
        )}

      {novo && <FornecedorForm onFechar={() => setNovo(false)} onSalvo={() => { setNovo(false); recarregar(); }} />}
      {editando && <FornecedorForm fornecedor={editando} onFechar={() => setEditando(null)} onSalvo={() => { setEditando(null); recarregar(); }} />}
    </>
  );
}
