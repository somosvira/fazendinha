import { useId, useState } from "react";
import { Input } from "@/components/ui/input";

type Opcao = { valor: string; texto: string; disabled?: boolean };
const normalizar = (texto: string) => texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");

export function ListaOpcoesFiltro({ rotulo, opcoes, valores, onChange, multipla = false, disabled = false }: {
  rotulo: string; opcoes: Opcao[]; valores: readonly string[]; onChange: (valor: string) => void; multipla?: boolean; disabled?: boolean;
}) {
  const [busca, setBusca] = useState("");
  const nome = useId();
  const visiveis = opcoes.filter(o => normalizar(o.texto).includes(normalizar(busca)));
  return <div>
    {opcoes.length > 5 && <Input aria-label={`Buscar opções de ${rotulo.toLocaleLowerCase("pt-BR")}`} placeholder="Buscar opção…" value={busca} onChange={e => setBusca(e.target.value)} className="mb-3" />}
    <div className="operacoes-filtro-opcoes" role={multipla ? "group" : "radiogroup"} aria-label={rotulo}>
      {visiveis.map(o => <label key={o.valor} data-selecionada={valores.includes(o.valor)} data-disabled={disabled || o.disabled || undefined}>
        <input type={multipla ? "checkbox" : "radio"} name={nome} value={o.valor} disabled={disabled || o.disabled} checked={valores.includes(o.valor)} onChange={() => onChange(o.valor)} />
        <span>{o.texto}</span>
      </label>)}
      {!visiveis.length && <p role="status" className="text-sm text-muted-foreground">Nenhuma opção encontrada.</p>}
    </div>
  </div>;
}
