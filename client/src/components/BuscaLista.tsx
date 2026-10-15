import { Search } from "lucide-react";
import { useId } from "react";
import "./busca-lista.css";

export function BuscaLista({ rotulo, placeholder, valor, onChange }: { rotulo: string; placeholder: string; valor: string; onChange: (valor: string) => void }) {
  const id = useId();
  return <label className="busca-lista" htmlFor={id}><span className="sr-only">{rotulo}</span><Search size={16} aria-hidden="true" /><input id={id} type="search" value={valor} placeholder={placeholder} onChange={e => onChange(e.target.value)} /></label>;
}
