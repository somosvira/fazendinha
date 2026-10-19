import { useEffect, useState } from "react";
import { reqV4 } from "./api";
export function AlertasSanitarios({animalId, data, acao, propriedadeId}: {animalId: string; data: string; acao: string; propriedadeId?: number}) {
  const [alertas, setAlertas] = useState<Array<{motivo: string; efeito: string; doencaId: string}>>([]);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => {
    let vigente = true;
    setAlertas([]); setErro(null);
    if (animalId && data) reqV4<typeof alertas>(`/reproducao/alertas-sanitarios?${new URLSearchParams({animalId, data, acao})}`, undefined, "GET", propriedadeId)
      .then(r => { if (vigente) setAlertas(r ?? []); })
      .catch(e => { if (vigente) setErro(e.message); });
    return () => { vigente = false; };
  }, [animalId, data, acao, propriedadeId]);
  return <div aria-live="polite" className="text-sm">{erro && <p role="alert">Não foi possível consultar os alertas: {erro}</p>}
    {alertas.map((a,i) => <p key={i}>{a.efeito === "BLOQUEAR" ? "Bloqueio" : "Alerta"}: {a.motivo}</p>)}
  </div>;
}
