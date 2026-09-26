// Campo "Mãe"/"Pai" compartilhado por FormFiliacao (ficha do animal) e NovoAnimal
// (cadastro): três modos — animal da fazenda, genitor externo ou desconhecida/o.
// Emite o resultado já no formato de FiliacaoInput (um dos dois lados, ou nenhum).

import { useEffect, useState } from "react";
import { listarGenitores } from "../api";
import type { FiliacaoLadoDTO, GenitorDTO, Sexo } from "../types";
import { classeInput } from "../../../financeiro/PainelCadastro";
import { BuscaAnimal, type AnimalSelecionado } from "./BuscaAnimal";

export type ValorGenitor =
  | { tipo: "ANIMAL"; id: string; brinco: string; nome: string | null }
  | { tipo: "EXTERNO"; id: string }
  | { tipo: "NENHUM" };

type Modo = "ANIMAL" | "EXTERNO" | "NENHUM";

function ladoParaValor(lado: FiliacaoLadoDTO | null): ValorGenitor {
  if (!lado) return { tipo: "NENHUM" };
  if (lado.tipo === "ANIMAL") return { tipo: "ANIMAL", id: lado.id, brinco: lado.brinco, nome: lado.nome };
  return { tipo: "EXTERNO", id: lado.id };
}

export function CampoGenitor({ rotulo, sexo, ladoInicial, excluirAnimalId, valor, onChange, obrigatorio = false }: {
  rotulo: string;
  sexo: Sexo;
  /** ficha atual (edição) — se ausente, começa em "Desconhecida/o" */
  ladoInicial?: FiliacaoLadoDTO | null;
  /** o próprio animal, para não poder ser seu próprio genitor */
  excluirAnimalId?: string;
  valor?: ValorGenitor;
  onChange: (valor: ValorGenitor) => void;
  /** sem a opção "Desconhecida/o" (ex.: touro e doadora de material genético) */
  obrigatorio?: boolean;
}) {
  const [interno, setInterno] = useState<ValorGenitor>(() => valor ?? ladoParaValor(ladoInicial ?? null));
  const [genitoresExternos, setGenitoresExternos] = useState<GenitorDTO[] | null>(null);

  const atual = valor ?? interno;
  const modo: Modo = atual.tipo;

  useEffect(() => { listarGenitores({ sexo }).then(setGenitoresExternos).catch(() => setGenitoresExternos([])); }, [sexo]);

  const definir = (v: ValorGenitor) => { setInterno(v); onChange(v); };

  const trocarModo = (novoModo: Modo) => {
    if (novoModo === modo) return;
    if (novoModo === "NENHUM") definir({ tipo: "NENHUM" });
    else if (novoModo === "ANIMAL") definir({ tipo: "ANIMAL", id: "", brinco: "", nome: null });
    else definir({ tipo: "EXTERNO", id: "" });
  };

  const animalSelecionado: AnimalSelecionado | null = atual.tipo === "ANIMAL" && atual.id ? { id: atual.id, brinco: atual.brinco, nome: atual.nome } : null;

  return <div className="space-y-2">
    <span className="block text-sm font-medium">{rotulo}</span>
    <div className="flex flex-wrap gap-1.5" role="group" aria-label={`Tipo de ${rotulo.toLowerCase()}`}>
      {([
        { valor: "ANIMAL" as const, rotulo: "Animal da fazenda" },
        { valor: "EXTERNO" as const, rotulo: "Genitor externo" },
        ...(obrigatorio ? [] : [{ valor: "NENHUM" as const, rotulo: "Desconhecida/o" }]),
      ]).map((opcao) => <button
        key={opcao.valor} type="button" onClick={() => trocarModo(opcao.valor)}
        aria-pressed={modo === opcao.valor}
        className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${modo === opcao.valor ? "border-mast bg-mast text-white" : "border-border text-ink-2 hover:bg-surface-2"}`}
      >{opcao.rotulo}</button>)}
    </div>

    {modo === "ANIMAL" && <BuscaAnimal
      sexo={sexo}
      excluirId={excluirAnimalId}
      valor={animalSelecionado}
      ariaLabel={`Buscar ${rotulo.toLowerCase()} entre os animais da fazenda`}
      onSelecionar={(a) => definir(a ? { tipo: "ANIMAL", id: a.id, brinco: a.brinco, nome: a.nome } : { tipo: "ANIMAL", id: "", brinco: "", nome: null })}
    />}

    {modo === "EXTERNO" && <select
      aria-label={`Selecionar ${rotulo.toLowerCase()} entre os genitores externos`}
      value={atual.tipo === "EXTERNO" ? atual.id : ""}
      onChange={(e) => definir({ tipo: "EXTERNO", id: e.target.value })}
      className={classeInput}
    >
      <option value="">Selecione</option>
      {(genitoresExternos ?? []).map((g) => <option key={g.id} value={g.id}>{g.nome}{g.fornecedor ? ` (${g.fornecedor})` : ""}</option>)}
    </select>}

    {modo === "NENHUM" && <p className="text-xs text-ink-3">Sem {rotulo.toLowerCase()} informada.</p>}
  </div>;
}

/** Converte o valor dos dois campos (mãe/pai) para o body de PUT filiação ou dos campos de cadastro. */
export function valorGenitorParaCampos(mae: ValorGenitor, pai: ValorGenitor): {
  maeId: string | null; maeExternaId: string | null; paiId: string | null; paiExternoId: string | null;
} {
  return {
    maeId: mae.tipo === "ANIMAL" && mae.id ? mae.id : null,
    maeExternaId: mae.tipo === "EXTERNO" && mae.id ? mae.id : null,
    paiId: pai.tipo === "ANIMAL" && pai.id ? pai.id : null,
    paiExternoId: pai.tipo === "EXTERNO" && pai.id ? pai.id : null,
  };
}
