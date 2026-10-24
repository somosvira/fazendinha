import { useState } from "react";
import { ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { PainelCadastro } from "@/financeiro/PainelCadastro";
import type { ConsultaOrdenhasGerais } from "./tanques-types";

export function OrigensAfericaoLeite({
  selecionados,
  animais,
  automaticos,
  salva,
  somenteLeitura,
  ocupado,
  onAplicar,
}: {
  selecionados: string[];
  animais: ConsultaOrdenhasGerais["animais"];
  automaticos: ConsultaOrdenhasGerais["origensAutomaticas"];
  salva: boolean;
  somenteLeitura: boolean;
  ocupado: boolean;
  onAplicar: (ids: string[]) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [rascunho, setRascunho] = useState<string[]>([]);
  const referencias = new Map(
    [...animais, ...automaticos].map(a => [a.animalId, a]),
  );
  const ids = [...new Set([...automaticos.map(a => a.animalId), ...selecionados])];
  const alterado = JSON.stringify([...rascunho].sort()) !==
    JSON.stringify([...selecionados].sort());

  return (
    <section className="leite-origens-painel" aria-label="Animais de origem">
      <div>
        <h4>Animais de origem · {selecionados.length}</h4>
        <p>{salva
          ? "Seleção preservada desta aferição."
          : "Pré-seleção: finalidade Leite e DEL > 0 na data da ordenha."}</p>
        <p>Identifica a população de origem sem atribuir litros por animal.</p>
      </div>
      <Button
        type="button"
        variant="outline"
        disabled={ocupado}
        onClick={() => {
          setRascunho([...selecionados]);
          setAberto(true);
        }}
      >
        <ListChecks size={18} aria-hidden="true" />
        {somenteLeitura ? "Ver animais" : "Conferir animais"}
      </Button>
      {aberto && (
        <PainelCadastro
          compacto
          aberto
          titulo="Animais de origem"
          icon={ListChecks}
          onFechar={() => setAberto(false)}
          alteracoesExternas={alterado}
          rodape={fechar => (
            <>
              <Button type="button" variant="outline" onClick={fechar}>
                {somenteLeitura ? "Fechar" : "Cancelar"}
              </Button>
              {!somenteLeitura && (
                <Button type="button" onClick={() => {
                  onAplicar(rascunho);
                  setAberto(false);
                }}>
                  Aplicar seleção
                </Button>
              )}
            </>
          )}
        >
          <div className="leite-origens-modal">
            <p>
              Animais com finalidade Leite e DEL maior que zero na data da ordenha.
              Origens já salvas não são recalculadas automaticamente.
            </p>
            {ids.length === 0 ? (
              <p>Nenhum animal atende ao critério comprovado nesta data.</p>
            ) : ids.map(id => {
              const animal = referencias.get(id);
              const elegivel = automaticos.find(a => a.animalId === id);
              return (
                <label key={id}>
                  <Checkbox
                    disabled={somenteLeitura || (!elegivel && !rascunho.includes(id))}
                    checked={rascunho.includes(id)}
                    onCheckedChange={marcado => setRascunho(anteriores =>
                      marcado === true
                        ? [...anteriores, id]
                        : anteriores.filter(i => i !== id),
                    )}
                  />
                  <span>
                    <strong>{animal
                      ? `${animal.brinco}${animal.nome ? ` · ${animal.nome}` : ""}`
                      : `Origem salva · ${id}`}</strong>
                    <small>{elegivel
                      ? `Finalidade Leite · DEL ${elegivel.del}`
                      : "Origem preservada; fora da pré-seleção atual"}</small>
                  </span>
                </label>
              );
            })}
            <p>
              DEL zero ou desconhecido não entra na pré-seleção.
              A conferência sanitária continua independente.
            </p>
          </div>
        </PainelCadastro>
      )}
    </section>
  );
}
