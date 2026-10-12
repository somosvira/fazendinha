import { useCallback, useEffect, useRef, useState } from "react";

/** Invalida respostas antigas ao mudar de lote, página ou desmontar a consulta. */
export function useConsulta<T>(consultar: () => Promise<T>) {
  const [dados, setDados] = useState<T | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const sequencia = useRef(0);
  const carregar = useCallback(async () => {
    const atual = ++sequencia.current;
    setCarregando(true); setErro(null); setDados(null);
    try { const d = await consultar(); if (sequencia.current === atual) setDados(d); }
    catch (e) { if (sequencia.current === atual) setErro(e instanceof Error ? e.message : String(e)); }
    finally { if (sequencia.current === atual) setCarregando(false); }
  }, [consultar]);
  useEffect(() => { void carregar(); return () => { sequencia.current++; }; }, [carregar]);
  return { dados, erro, carregando, carregar };
}
