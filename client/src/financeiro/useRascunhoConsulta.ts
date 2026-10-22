import { useState } from "react";

/** A consulta continua exibindo os critérios aplicados enquanto o painel edita uma cópia. */
export function useRascunhoConsulta<T extends object>(valores: T, iniciais: T, onAplicar: (valores: T) => void) {
  const [rascunho, setRascunho] = useState(valores);
  return {
    rascunho,
    iniciar: () => setRascunho(valores),
    editar: <K extends keyof T>(campo: K, valor: T[K]) => setRascunho(atual => ({ ...atual, [campo]: valor })),
    limpar: () => setRascunho(iniciais),
    aplicar: () => onAplicar(rascunho),
  };
}
