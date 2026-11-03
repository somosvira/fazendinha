import { AjudaCampo } from "../../../components/Dica";
import { useEffect, useId, useState } from "react";
import { Paginacao } from "../ui";

type AnimalVisita = {
  id: string;
  animalId: string;
  brinco: string;
  nome?: string | null;
  status: string;
  temRascunho?: boolean;
};
export type ListaAnimaisVisitaProps = {
  animais: AnimalVisita[];
  busca: string;
  onBusca: (valor: string) => void;
  onAbrir: (participanteId: string) => void;
  selecionadoId?: string | null;
  paginacao?: {pagina:number;total:number;onPagina:(pagina:number)=>void};
};

const rotulos: Record<string, string> = {
  PENDENTE: "Pendente", CONFIRMADO: "Atendimento confirmado", ADIADO: "Adiado", NAO_ATENDIDO: "Não atendido",
};
const normalizar = (valor: string) => valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");

/** Escolhe o animal; confirmação e salvamento pertencem ao atendimento individual. */
export function ListaAnimaisVisita({ animais, busca, onBusca, onAbrir, selecionadoId, paginacao }: ListaAnimaisVisitaProps) {
  const id = useId();
  const [pagina, setPagina] = useState(1);
  useEffect(() => setPagina(1), [busca]);
  const grupos = new Map<string, AnimalVisita[]>();
  for (const animal of animais) {
    const grupo = grupos.get(animal.animalId) ?? [];
    grupo.push(animal);
    grupos.set(animal.animalId, grupo);
  }
  const termos = normalizar(busca).trim().split(/\s+/).filter(Boolean);
  const visiveis = [...grupos.values()].filter(grupo => termos.every(termo =>
    grupo.some(animal => normalizar(`${animal.brinco} ${animal.nome ?? ""}`).includes(termo))));
  const total = paginacao?.total ?? visiveis.length;
  const paginaAtual = paginacao?.pagina ?? Math.min(pagina, Math.max(1, Math.ceil(visiveis.length / 10)));
  return <section className="rounded-xl border border-border bg-card p-4 sm:p-5" aria-labelledby={`${id}-titulo`}>
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div><h3 id={`${id}-titulo`} className="font-semibold">Animais da seleção livre <AjudaCampo rotulo="Ajuda sobre preenchimento da visita" texto="Abra um animal para preencher seu atendimento. Os rascunhos ficam separados da confirmação."/></h3>
        </div>
      <p className="text-sm text-ink-3" aria-live="polite">{paginacao ? `${total} participantes nos filtros` : `${visiveis.length} de ${grupos.size} animais`}</p>
    </div>
    <label htmlFor={`${id}-busca`} className="mt-4 block text-sm font-medium">Buscar por brinco ou nome</label>
    <input id={`${id}-busca`} type="search" value={busca} onChange={evento => onBusca(evento.target.value)}
      className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary" />
    {!visiveis.length && <p className="mt-5 text-sm text-ink-3">{grupos.size ? "Nenhum animal corresponde à busca." : "Nenhum animal nesta seleção."}</p>}
    <ul className="mt-4 space-y-2" aria-label="Animais para atendimento individual">
      {(paginacao ? visiveis : visiveis.slice((paginaAtual - 1) * 10, paginaAtual * 10)).map(grupo => {
        const animal = grupo.find(item => item.id === selecionadoId) ?? grupo[0];
        const selecionado = grupo.some(item => item.id === selecionadoId);
        const situacoes = [...new Set(grupo.map(item => rotulos[item.status] ?? "Situação não identificada"))];
        const temRascunho = grupo.some(item => item.temRascunho);
        return <li key={animal.animalId}>
          <button type="button" onClick={() => onAbrir(animal.id)} aria-current={selecionado ? "true" : undefined}
            aria-label={`Abrir atendimento de ${animal.brinco}${animal.nome ? ` · ${animal.nome}` : ""}`}
            className={`flex w-full items-center justify-between gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${selecionado ? "border-primary bg-surface-2" : "border-border"}`}>
            <span className="min-w-0"><span className="block font-semibold break-words">{animal.brinco}{animal.nome && <span className="font-normal"> · {animal.nome}</span>}</span>
              <span className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-ink-3">
                <span>{situacoes.join(" · ")}</span>{temRascunho && <span className="font-semibold">Rascunho salvo</span>}
                {grupo.length > 1 && <span>{grupo.length} registros na visita</span>}
              </span></span>
            <span className="shrink-0 text-sm font-medium text-primary" aria-hidden="true">Abrir →</span>
          </button>
        </li>;
      })}
    </ul>
    {total > 10 && <Paginacao paginaAtual={paginaAtual} totalPaginas={Math.ceil(total / 10)} totalItens={total} itensPorPagina={10} onPaginaChange={paginacao?.onPagina ?? setPagina} rotulo="animais da seleção" idSelect={`${id}-pagina`} />}
  </section>;
}
