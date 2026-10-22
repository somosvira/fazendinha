import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "../../../components/ui/dialog";
import { obterCandidatos } from "./api";
import type { CandidatoLeite, CandidatosLeite } from "./types";
export function IncluirAnimal({
  data,
  propriedadeId,
  existentes,
  aoIncluir,
  aoFechar,
}: {
  data: string;
  propriedadeId: number;
  existentes: string[];
  aoIncluir: (animal: CandidatoLeite) => void;
  aoFechar: () => void;
}) {
  const [revisao, setRevisao] = useState(0);
  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(1);
  const [resultado, setResultado] = useState<CandidatosLeite | null>(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);
  useEffect(() => {
    let atual = true;
    setCarregando(true);
    setErro("");
    const timer = setTimeout(() => {
      void obterCandidatos(data, busca, pagina, propriedadeId)
        .then((r) => {
          if (atual) setResultado(r);
        })
        .catch((e) => {
          if (atual)
            setErro(
              e instanceof Error ? e.message : "Falha ao consultar animais.",
            );
        })
        .finally(() => {
          if (atual) setCarregando(false);
        });
    }, 250);
    return () => {
      atual = false;
      clearTimeout(timer);
    };
  }, [data, busca, pagina, propriedadeId, revisao]);
  return (
    <Dialog
      open
      onOpenChange={(aberto) => {
        if (!aberto) aoFechar();
      }}
    >
      <DialogContent className="leite-config">
        <DialogTitle>Incluir animal no dia</DialogTitle>
        <DialogDescription>
          Consulte fêmeas com finalidade Leite comprovada neste sítio na data
          operacional. Lactação ausente fica pendente de conciliação.
        </DialogDescription>
        <label>
          Nome ou brinco
          <input
            value={busca}
            onChange={(e) => {
              setBusca(e.target.value);
              setPagina(1);
            }}
          />
        </label>
        {carregando ? (
          <p role="status">Consultando animais…</p>
        ) : erro ? (
          <p role="alert" className="leite-erro">
            {erro}
            <button
              className="leite-button"
              onClick={() => setRevisao((r) => r + 1)}
            >
              Tentar novamente
            </button>
          </p>
        ) : (
          <>
            <div className="leite-candidatos">
              {resultado?.itens.map((a) => (
                <div className="leite-candidato" key={a.animalId}>
                  <span>
                    <strong>{a.nome || a.brinco}</strong>
                    <small>
                      Brinco {a.brinco}
                      {!a.lactacaoId ? " · Lactação a conciliar" : ""}
                    </small>
                  </span>
                  <button
                    className="leite-button"
                    disabled={existentes.includes(a.animalId)}
                    onClick={() => aoIncluir(a)}
                  >
                    {existentes.includes(a.animalId) ? "Incluído" : "Incluir"}
                  </button>
                </div>
              ))}
              {!resultado?.itens.length && (
                <p>Nenhum animal disponível nesta busca.</p>
              )}
              {!!resultado?.impedimentos.length && <h3>Impedimentos na data da produção</h3>}
              {resultado?.impedimentos.map((a) => (
                <p key={a.animalId} className="leite-muted">
                  {a.nome || a.brinco}: {a.motivo}
                </p>
              ))}
            </div>
            <div className="leite-config-acoes">
              <button
                className="leite-button"
                disabled={pagina <= 1}
                onClick={() => setPagina((p) => p - 1)}
              >
                Anterior
              </button>
              <span className="leite-muted">Página {pagina}</span>
              <button
                className="leite-button"
                disabled={
                  !resultado || pagina * resultado.porPagina >= resultado.total
                }
                onClick={() => setPagina((p) => p + 1)}
              >
                Próxima
              </button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
