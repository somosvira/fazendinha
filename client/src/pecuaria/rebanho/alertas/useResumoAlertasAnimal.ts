import { useEffect, useState } from "react";
import { resumirAlertas } from "./api";

/** A contagem só é exibida quando a avaliação confirmou o recorte do animal. */
export function useResumoAlertasAnimal(animalId: string | undefined, propriedadeId?: number, revisao = 0) {
  const [versao, setVersao] = useState(0);
  const [resultado, setResultado] = useState<{ chave: string; cuidados: number } | null>(null);
  const chave = JSON.stringify([animalId, propriedadeId, revisao, versao]);

  useEffect(() => {
    const atualizar = () => setVersao(valor => valor + 1);
    window.addEventListener("pecuaria:alertas-atualizados", atualizar);
    return () => window.removeEventListener("pecuaria:alertas-atualizados", atualizar);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setResultado(null);
    if (animalId) {
      void resumirAlertas({ animalId, propriedadeId, disposicao: "ATENCAO", tamanho: 1 }, controller.signal)
        .then(dados => {
          if (!controller.signal.aborted && dados.cobertura.estado === "ATUALIZADA") {
            setResultado({ chave, cuidados: dados.totaisFiltrados.cuidados });
          }
        })
        .catch(() => { /* Falha na consulta não representa ausência de alertas. A aba oferece nova tentativa. */ });
    }
    return () => controller.abort();
  }, [animalId, propriedadeId, revisao, versao, chave]);

  return resultado?.chave === chave && resultado.cuidados > 0 ? resultado.cuidados : null;
}
