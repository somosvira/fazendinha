import { useState } from "react";
import { criarFornecedor, editarFornecedor, type FornecedorDTO, type TipoPessoa } from "../api";
import { RebModal } from "@/components/rb/RebModal";
import { RebButton } from "@/components/rb/RebButton";

const TIPOS: { id: TipoPessoa; label: string }[] = [
  { id: "FORNECEDOR", label: "Fornecedor" },
  { id: "CLIENTE", label: "Cliente" },
  { id: "AMBOS", label: "Ambos" },
];

export function FornecedorForm({ fornecedor, onFechar, onSalvo }: { fornecedor?: FornecedorDTO; onFechar: () => void; onSalvo: () => void }) {
  const [f, setF] = useState({
    nome: fornecedor?.nome ?? "",
    tipo: (fornecedor?.tipo ?? "FORNECEDOR") as TipoPessoa,
    documento: fornecedor?.documento ?? "",
    telefone: fornecedor?.telefone ?? "",
    email: fornecedor?.email ?? "",
  });
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));

  async function salvar() {
    setSalvando(true); setErro(null);
    try {
      const payload = {
        nome: f.nome,
        tipo: f.tipo,
        documento: f.documento || undefined,
        telefone: f.telefone || undefined,
        email: f.email || undefined,
      };
      if (fornecedor) await editarFornecedor(fornecedor.id, payload);
      else await criarFornecedor(payload);
      onSalvo();
    } catch (e: any) { setErro(e.message); } finally { setSalvando(false); }
  }

  return (
    <RebModal
      title={fornecedor ? `Editar ${fornecedor.nome}` : "Novo fornecedor"}
      onClose={onFechar}
      actions={
        <>
          <RebButton onClick={onFechar}>Cancelar</RebButton>
          <RebButton variant="pri" disabled={salvando} onClick={salvar}>{salvando ? "Salvando…" : "Salvar"}</RebButton>
        </>
      }
    >
      <label className="rb-fld">Nome*<input value={f.nome} onChange={(e) => set("nome", e.target.value)} /></label>
      <label className="rb-fld">Tipo<select value={f.tipo} onChange={(e) => set("tipo", e.target.value)}>{TIPOS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select></label>
      <label className="rb-fld">Documento (CPF/CNPJ)<input value={f.documento} onChange={(e) => set("documento", e.target.value)} /></label>
      <label className="rb-fld">Telefone<input value={f.telefone} onChange={(e) => set("telefone", e.target.value)} /></label>
      <label className="rb-fld">E-mail<input type="email" value={f.email} onChange={(e) => set("email", e.target.value)} /></label>
      {erro && <p className="text-[13px] text-prejuizo">{erro}</p>}
    </RebModal>
  );
}
