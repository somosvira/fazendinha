import { useState } from "react";
import {
  useProtocolosSanitarios, criarProtocoloSanitario, atualizarProtocoloSanitario, excluirProtocoloSanitario,
  type ProtocoloSanitarioDTO,
} from "../api";

type EtapaEdit = { dia: string; acao: string; produto: string };
const ETAPA_VAZIA: EtapaEdit = { dia: "", acao: "", produto: "" };
const ETAPAS_PADRAO: EtapaEdit[] = [
  { dia: "0", acao: "1ª dose", produto: "" },
  { dia: "21", acao: "Reforço", produto: "" },
];

function etapasDoDTO(p: ProtocoloSanitarioDTO): EtapaEdit[] {
  return p.etapas.map((e) => ({ dia: String(e.dia), acao: e.acao, produto: e.produto ?? "" }));
}

// Catálogo configurável de protocolos sanitários (sequências de manejos com offset de dias a
// partir do D0). Espelha ProtocolosIatf.
export function ProtocolosSanitarios() {
  const { data, loading, recarregar } = useProtocolosSanitarios(true);
  const [editandoId, setEditandoId] = useState<number | "novo" | null>(null);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [etapas, setEtapas] = useState<EtapaEdit[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  if (loading) return null;
  const protocolos = data ?? [];

  function abrirNovo() { setEditandoId("novo"); setNome(""); setDescricao(""); setEtapas(ETAPAS_PADRAO.map((e) => ({ ...e }))); setErro(null); }
  function abrirEdicao(p: ProtocoloSanitarioDTO) { setEditandoId(p.id); setNome(p.nome); setDescricao(p.descricao ?? ""); setEtapas(etapasDoDTO(p)); setErro(null); }
  function fechar() { setEditandoId(null); setErro(null); }
  function setEtapa(i: number, patch: Partial<EtapaEdit>) { setEtapas((es) => es.map((e, j) => (j === i ? { ...e, ...patch } : e))); }
  function addEtapa() { setEtapas((es) => [...es, { ...ETAPA_VAZIA }]); }
  function removeEtapa(i: number) { setEtapas((es) => es.filter((_, j) => j !== i)); }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    const etapasLimpas = etapas
      .filter((et) => et.acao.trim() && et.dia.trim() !== "")
      .map((et, i) => ({ dia: Number(et.dia), acao: et.acao.trim(), produto: et.produto.trim() || null, ordem: i }));
    if (!nome.trim() || etapasLimpas.length === 0) { setErro("Informe nome e ao menos uma etapa com dia e ação."); return; }
    setSalvando(true); setErro(null);
    try {
      const body = { nome: nome.trim(), descricao: descricao.trim() || null, etapas: etapasLimpas };
      if (editandoId === "novo") await criarProtocoloSanitario(body);
      else if (typeof editandoId === "number") await atualizarProtocoloSanitario(editandoId, body);
      fechar(); recarregar();
    } catch (err) { setErro(err instanceof Error ? err.message : "Falha ao salvar protocolo."); }
    finally { setSalvando(false); }
  }
  async function excluir(id: number) { await excluirProtocoloSanitario(id); recarregar(); }
  async function toggleAtivo(p: ProtocoloSanitarioDTO) { await atualizarProtocoloSanitario(p.id, { ativo: !p.ativo }); recarregar(); }

  return (
    <div className="mb-[18px] rounded-[10px] border border-[color:var(--rule-soft)] bg-[color:var(--bg-card)] px-4 py-[15px]">
      <div className="mb-[11px] flex items-center justify-between">
        <h4 className="mt-0 text-sm uppercase tracking-[.06em] text-ink-3">Protocolos sanitários</h4>
        {editandoId === null && <button onClick={abrirNovo} className="rounded bg-[color:var(--cafe)] px-3 py-1 text-sm font-semibold text-white">Novo protocolo</button>}
      </div>

      {editandoId !== null ? (
        <form onSubmit={salvar} className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            <label className="flex flex-1 flex-col text-xs text-ink-3">Nome
              <input className="mt-0.5 rounded border border-[color:var(--rule-soft)] px-2 py-1 text-sm text-[color:var(--ink)]" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Protocolo de recria" maxLength={120} />
            </label>
            <label className="flex flex-1 flex-col text-xs text-ink-3">Descrição (opcional)
              <input className="mt-0.5 rounded border border-[color:var(--rule-soft)] px-2 py-1 text-sm text-[color:var(--ink)]" value={descricao} onChange={(e) => setDescricao(e.target.value)} maxLength={200} />
            </label>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-xs uppercase tracking-[.06em] text-ink-3">Etapas (dia = offset a partir do D0)</span>
            {etapas.map((et, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <input type="number" min={0} max={365} className="w-16 rounded border border-[color:var(--rule-soft)] px-2 py-1 text-sm text-[color:var(--ink)]" value={et.dia} onChange={(e) => setEtapa(i, { dia: e.target.value })} placeholder="dia" aria-label={`Dia da etapa ${i + 1}`} />
                <input className="min-w-[180px] flex-1 rounded border border-[color:var(--rule-soft)] px-2 py-1 text-sm text-[color:var(--ink)]" value={et.acao} onChange={(e) => setEtapa(i, { acao: e.target.value })} placeholder="ação" aria-label={`Ação da etapa ${i + 1}`} maxLength={200} />
                <input className="w-32 rounded border border-[color:var(--rule-soft)] px-2 py-1 text-sm text-[color:var(--ink)]" value={et.produto} onChange={(e) => setEtapa(i, { produto: e.target.value })} placeholder="produto" aria-label={`Produto da etapa ${i + 1}`} maxLength={80} />
                <button type="button" onClick={() => removeEtapa(i)} className="text-sm text-ink-3 hover:text-prejuizo" aria-label={`Remover etapa ${i + 1}`}>×</button>
              </div>
            ))}
            <button type="button" onClick={addEtapa} className="self-start text-sm font-semibold text-[color:var(--cafe)] hover:underline">+ etapa</button>
          </div>
          {erro && <p className="text-sm text-prejuizo">{erro}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={salvando} className="rounded bg-[color:var(--cafe)] px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">Salvar</button>
            <button type="button" onClick={fechar} className="rounded border border-[color:var(--rule-soft)] px-3 py-1.5 text-sm text-ink-2">Cancelar</button>
          </div>
        </form>
      ) : protocolos.length === 0 ? (
        <p className="text-sm text-ink-3">Nenhum protocolo sanitário cadastrado. Crie um para aplicar aos animais.</p>
      ) : (
        <div className="flex flex-col">
          {protocolos.map((p) => (
            <div key={p.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-b border-dashed border-[color:var(--rule-soft)] py-[7px] text-sm last:border-0">
              <span className={`shrink-0 font-semibold ${p.ativo ? "text-[color:var(--ink)]" : "text-ink-3 line-through"}`}>{p.nome}</span>
              <span className="flex-1 text-ink-2">{p.etapas.map((e) => `D${e.dia}`).join(" · ")}</span>
              <span className="flex shrink-0 gap-2">
                <button onClick={() => abrirEdicao(p)} className="text-sm font-semibold text-[color:var(--cafe)] hover:underline">editar</button>
                <button onClick={() => toggleAtivo(p)} className="text-sm text-ink-3 hover:underline">{p.ativo ? "inativar" : "reativar"}</button>
                <button onClick={() => excluir(p.id)} className="text-sm text-ink-3 hover:text-prejuizo hover:underline" aria-label={`Excluir protocolo ${p.nome}`}>excluir</button>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
