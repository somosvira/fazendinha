import { useState } from "react";
import { Loader } from "../../components/Loading";
import { rotuloUnidade } from "../../lib/unidades";
import { useProdutos, useFornecedores, editarProduto, editarFornecedor, type ProdutoDTO, type FornecedorDTO, type UsoProduto, type TipoPessoa } from "../api";
import { FormProduto } from "../../financeiro/FormProduto";
import { FornecedorForm } from "./FornecedorForm";
import { RebHeader } from "./RebHeader";
import { RebTable } from "@/components/rb/RebTable";
import { RebButton } from "@/components/rb/RebButton";
import { REB_FIELD_BOXED } from "@/components/rb/RebField";
import { RebMain, RebAnm, RebPill, REB_CHIPS, REB_CHIP_Q } from "@/components/rb/RebPrimitives";
import { EmptyState } from "@/components/EmptyState";
import { Package, Users } from "lucide-react";
import { IndicadoresGeneticosSection } from "./IndicadoresGeneticosSection";
import { MedidasAcasalamentoSection } from "./MedidasAcasalamentoSection";

type Sub = "produtos" | "fornecedores" | "indicadores" | "acasalamento";

const USO_PRODUTO: { id: UsoProduto; label: string }[] = [
  { id: "sanitario", label: "Sanitário" },
  { id: "nutricional", label: "Nutricional" },
  { id: "agricola", label: "Agrícola" },
];

const TIPO_PESSOA: { id: TipoPessoa; label: string }[] = [
  { id: "FORNECEDOR", label: "Fornecedor" },
  { id: "CLIENTE", label: "Cliente" },
  { id: "AMBOS", label: "Ambos" },
];
const LABEL_PESSOA: Record<TipoPessoa, string> = Object.fromEntries(TIPO_PESSOA.map((t) => [t.id, t.label])) as Record<TipoPessoa, string>;


export function CadastrosView() {
  const [sub, setSub] = useState<Sub>("produtos");
  return (
    <RebMain>
      <RebHeader eyebrow="Cadastros · compartilhado entre propriedades" title="Cadastros" />
      <div className={REB_CHIPS} style={{ marginBottom: 18 }}>
        <button className={REB_CHIP_Q} onClick={() => setSub("produtos")} aria-pressed={sub === "produtos"} style={sub === "produtos" ? { borderColor: "var(--cafe)", color: "var(--cafe)" } : undefined}>Produtos</button>
        <button className={REB_CHIP_Q} onClick={() => setSub("fornecedores")} aria-pressed={sub === "fornecedores"} style={sub === "fornecedores" ? { borderColor: "var(--cafe)", color: "var(--cafe)" } : undefined}>Fornecedores</button>
        <button className={REB_CHIP_Q} onClick={() => setSub("indicadores")} aria-pressed={sub === "indicadores"} style={sub === "indicadores" ? { borderColor: "var(--cafe)", color: "var(--cafe)" } : undefined}>Indicadores</button>
        <button className={REB_CHIP_Q} onClick={() => setSub("acasalamento")} aria-pressed={sub === "acasalamento"} style={sub === "acasalamento" ? { borderColor: "var(--cafe)", color: "var(--cafe)" } : undefined}>Medidas de acasalamento</button>
      </div>
      {sub === "produtos" ? <Produtos /> : sub === "fornecedores" ? <Fornecedores /> : sub === "indicadores" ? <IndicadoresGeneticosSection /> : <MedidasAcasalamentoSection />}
    </RebMain>
  );
}

function Produtos() {
  const [uso, setUso] = useState<UsoProduto | "">("");
  const [q, setQ] = useState("");
  const { data, loading, erro, recarregar } = useProdutos({ uso: uso || undefined, q: q || undefined });
  const [editando, setEditando] = useState<ProdutoDTO | null>(null);
  const [novo, setNovo] = useState(false);

  const toggleAtivo = async (p: ProdutoDTO) => { await editarProduto(p.id, { ativo: !p.ativo }); recarregar(); };

  return (
    <>
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="m-0 font-serif text-lg font-medium">Produtos</h3>
        <RebButton variant="pri" onClick={() => setNovo(true)}>+ Novo produto</RebButton>
      </div>
      <div className={REB_CHIPS} style={{ marginBottom: 12, alignItems: "center" }}>
        <button className={REB_CHIP_Q} onClick={() => setUso("")} style={uso === "" ? { borderColor: "var(--cafe)", color: "var(--cafe)" } : undefined}>Todos</button>
        {USO_PRODUTO.map((t) => (
          <button key={t.id} className={REB_CHIP_Q} onClick={() => setUso(t.id)} style={uso === t.id ? { borderColor: "var(--cafe)", color: "var(--cafe)" } : undefined}>{t.label}</button>
        ))}
        <input className={REB_FIELD_BOXED} style={{ marginBottom: 0, padding: "7px 11px", fontSize: 13.5, marginLeft: "auto" }} placeholder="Buscar por nome…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {loading ? <Loader />
        : erro ? <p className="mt-[7px] text-sm text-prejuizo">Erro: {erro}</p>
        : data.length === 0 ? (
          (uso || q)
            ? <EmptyState icon={Package} variant="filtro" titulo="Nenhum produto neste filtro" descricao="Nenhum produto bate com a busca ou o uso selecionado. Limpe o filtro para ver todos." />
            : <EmptyState icon={Package} titulo="Nenhum produto cadastrado" descricao="Produtos são os itens que você compra e lança (ração, medicamento, insumo). Cadastre o primeiro para começar." acao={<RebButton variant="pri" onClick={() => setNovo(true)}>+ Novo produto</RebButton>} />
        )
        : (
          <RebTable>
            <thead><tr><th>Nome</th><th>Categoria</th><th>Unidade</th><th>Situação</th><th></th></tr></thead>
            <tbody>{data.map((p) => (
              <tr key={p.id}>
                <td><RebAnm>{p.nome}</RebAnm></td>
                <td>{p.categoriaNome ?? "Sem categoria"}</td>
                <td>{rotuloUnidade(p.unidade)}</td>
                <td><RebPill tone={p.ativo ? "ok" : "bad"}>{p.ativo ? "Ativo" : "Inativo"}</RebPill></td>
                <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                  <RebButton onClick={() => setEditando(p)}>Editar</RebButton>{" "}
                  <RebButton onClick={() => toggleAtivo(p)}>{p.ativo ? "Desativar" : "Ativar"}</RebButton>
                </td>
              </tr>
            ))}</tbody>
          </RebTable>
        )}

      {novo && <FormProduto produto={null} onFechar={() => setNovo(false)} onSalvo={() => { setNovo(false); recarregar(); }} />}
      {editando && <FormProduto produto={editando} onFechar={() => setEditando(null)} onSalvo={() => { setEditando(null); recarregar(); }} />}
    </>
  );
}

export function Fornecedores() {
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
      <div className={REB_CHIPS} style={{ marginBottom: 12, alignItems: "center" }}>
        <button className={REB_CHIP_Q} onClick={() => setTipo("")} style={tipo === "" ? { borderColor: "var(--cafe)", color: "var(--cafe)" } : undefined}>Todos</button>
        {TIPO_PESSOA.map((t) => (
          <button key={t.id} className={REB_CHIP_Q} onClick={() => setTipo(t.id)} style={tipo === t.id ? { borderColor: "var(--cafe)", color: "var(--cafe)" } : undefined}>{t.label}</button>
        ))}
        <input className={REB_FIELD_BOXED} style={{ marginBottom: 0, padding: "7px 11px", fontSize: 13.5, marginLeft: "auto" }} placeholder="Buscar por nome…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {loading ? <Loader />
        : erro ? <p className="mt-[7px] text-sm text-prejuizo">Erro: {erro}</p>
        : data.length === 0 ? (
          (tipo || q)
            ? <EmptyState icon={Users} variant="filtro" titulo="Nenhum fornecedor neste filtro" descricao="Nenhum fornecedor bate com a busca ou o tipo selecionado. Limpe o filtro para ver todos." />
            : <EmptyState icon={Users} titulo="Nenhum fornecedor cadastrado" descricao="Fornecedores e clientes de quem você compra ou para quem vende. Cadastre o primeiro para vinculá-lo aos lançamentos." acao={<RebButton variant="pri" onClick={() => setNovo(true)}>+ Novo fornecedor</RebButton>} />
        )
        : (
          <RebTable>
            <thead><tr><th>Nome</th><th>Tipo</th><th>Documento</th><th>Contato</th><th>Situação</th><th></th></tr></thead>
            <tbody>{data.map((fr) => (
              <tr key={fr.id}>
                <td><RebAnm>{fr.nome}</RebAnm></td>
                <td>{LABEL_PESSOA[fr.tipo]}</td>
                <td>{fr.documento ?? "—"}</td>
                <td>{contato(fr)}</td>
                <td><RebPill tone={fr.ativo ? "ok" : "bad"}>{fr.ativo ? "Ativo" : "Inativo"}</RebPill></td>
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
