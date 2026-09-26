// Busca de um único animal por brinco/nome, com filtro opcional de sexo — usada em
// FormFiliacao/CampoGenitor (mãe/pai). Diferente de SeletorAnimais (seleção múltipla,
// painel com tabela paginada, usado em movimentação): aqui é só um campo de busca com
// lista curta de resultados, sem paginação.

import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { listarAnimais } from "../api";
import type { AnimalResumo, Sexo } from "../types";
import { classeInput } from "../../../financeiro/PainelCadastro";

export type AnimalSelecionado = { id: string; brinco: string; nome: string | null };

export function BuscaAnimal({ sexo, excluirId, valor, onSelecionar, ariaLabel }: {
  sexo?: Sexo;
  /** exclui o próprio animal (não pode ser genitor de si mesmo) */
  excluirId?: string;
  valor: AnimalSelecionado | null;
  onSelecionar: (animal: AnimalSelecionado | null) => void;
  ariaLabel: string;
}) {
  const [texto, setTexto] = useState("");
  const [resultados, setResultados] = useState<AnimalResumo[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [aberto, setAberto] = useState(false);
  const caixaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (texto.trim().length < 1) { setResultados([]); return; }
    let vigente = true;
    setBuscando(true);
    const t = setTimeout(() => {
      listarAnimais({ busca: texto.trim(), sexo, situacao: "ATIVO", page: 1, pageSize: 8 })
        .then((resultado) => { if (vigente) setResultados(resultado.itens.filter((a) => a.id !== excluirId)); })
        .catch(() => { if (vigente) setResultados([]); })
        .finally(() => { if (vigente) setBuscando(false); });
    }, 300);
    return () => { vigente = false; clearTimeout(t); };
  }, [texto, sexo, excluirId]);

  useEffect(() => {
    function fechaFora(e: MouseEvent) {
      if (caixaRef.current && !caixaRef.current.contains(e.target as Node)) setAberto(false);
    }
    document.addEventListener("mousedown", fechaFora);
    return () => document.removeEventListener("mousedown", fechaFora);
  }, []);

  const selecionar = (animal: AnimalResumo) => {
    onSelecionar({ id: animal.id, brinco: animal.brinco, nome: animal.nome });
    setTexto("");
    setAberto(false);
  };

  if (valor) {
    return <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm">
      <span className="break-words"><strong>{valor.brinco}</strong>{valor.nome ? ` — ${valor.nome}` : ""}</span>
      <button type="button" aria-label="Trocar animal selecionado" onClick={() => onSelecionar(null)} className="shrink-0 rounded p-1 text-ink-2 hover:bg-surface hover:text-red-700"><X size={15} /></button>
    </div>;
  }

  return <div ref={caixaRef} className="relative">
    <div className="relative">
      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
      <input
        aria-label={ariaLabel}
        value={texto}
        onFocus={() => setAberto(true)}
        onChange={(e) => { setTexto(e.target.value); setAberto(true); }}
        placeholder="Buscar por brinco ou nome"
        className={`${classeInput} pl-9`}
      />
    </div>
    {aberto && texto.trim().length > 0 && <div className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-border bg-white shadow-lg">
      {buscando ? <p className="p-3 text-sm text-ink-3">Buscando…</p>
        : resultados.length ? resultados.map((a) => (
          <button key={a.id} type="button" onClick={() => selecionar(a)} className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm hover:bg-surface-2">
            <strong>{a.brinco}</strong>
            {a.nome && <span className="text-xs text-ink-3">{a.nome}</span>}
          </button>
        ))
        : <p className="p-3 text-sm text-ink-3">Nenhum animal encontrado.</p>}
    </div>}
  </div>;
}
