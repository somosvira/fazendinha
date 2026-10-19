import { useCallback, useEffect, useState } from "react";
import { Button, ErrorBox } from "../../../financeiro/financeiro-ui";
import {
  classeInput,
  PainelCadastro,
} from "../../../financeiro/PainelCadastro";
import { ConfirmacaoCiencia } from "../../../components/ConfirmacaoCiencia";
import { getPropriedadeAtiva } from "../../../propriedadeScope";
import { reqV4 } from "./api";
type Previa = {
  fingerprint: string;
  impedimentos: string[];
  efeitos: string[];
  criasIds: string[];
  exigeDestinoConsumo?: boolean;
};
export function AnularFato({
  tipo,
  id,
  propriedadeId,
  onFechar,
  onSalvo,
}: {
  tipo: string;
  id: string;
  propriedadeId?: number | null;
  onFechar: () => void;
  onSalvo: () => void;
}) {
  const [destinoConsumo, setDestinoConsumo] = useState<
    "" | "DEVOLVER_ESTOQUE" | "MANTER_CONSUMO"
  >("");
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("");
  const [ciencia, setCiencia] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [chave] = useState(() => crypto.randomUUID());
  const prop = propriedadeId ?? getPropriedadeAtiva();
  const carregar = useCallback(async () => {
    if (!prop) {
      setErro("Selecione o sítio do fato.");
      return;
    }
    try {
      setPrevia(
        await reqV4<Previa>(
          `/reproducao/${tipo}/${id}/anulacao/previa?propriedadeId=${prop}`,
        ),
      );
      setErro(null);
      setCiencia(false);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    }
  }, [id, prop, tipo]);
  useEffect(() => {
    void carregar();
  }, [carregar]);
  const exigeDestino = previa?.exigeDestinoConsumo === true;
  return (
    <PainelCadastro
      aberto
      titulo="Conferir anulação do fato"
      onFechar={onFechar}
      bloqueado={ocupado}
      rodape={
        <>
          <Button secondary disabled={ocupado} onClick={onFechar}>
            Manter fato
          </Button>
          <Button
            danger
            type="submit"
            form="anular-fato-v4"
            disabled={
              ocupado ||
              !previa ||
              previa.impedimentos.length > 0 ||
              (!!previa.criasIds.length && !ciencia) ||
              (exigeDestino && !destinoConsumo)
            }
          >
            Confirmar anulação
          </Button>
        </>
      }
    >
      <form
        id="anular-fato-v4"
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!previa || !prop) return;
          if (exigeDestino && !destinoConsumo) {
            setErro(
              "Escolha se o consumo será mantido ou devolvido ao estoque.",
            );
            return;
          }
          setOcupado(true);
          setErro(null);
          reqV4(`/reproducao/${tipo}/${id}/anulacao`, {
            propriedadeId: prop,
            chave,
            motivo,
            fingerprint: previa.fingerprint,
            cienciaPreservacaoCrias: ciencia,
            ...(exigeDestino ? { destinoConsumo } : {}),
          })
            .then(onSalvo)
            .catch((e) => setErro(e.message))
            .finally(() => setOcupado(false));
        }}
      >
        <ErrorBox erro={erro} />
        {previa ? (
          <>
            <ul className="space-y-2 text-sm">
              {previa.efeitos.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
            {previa.impedimentos.length > 0 && (
              <ErrorBox erro={previa.impedimentos.join("; ")} />
            )}
            {exigeDestino && (
              <fieldset className="rounded-lg border border-border p-4">
                <legend>Destino do material consumido</legend>
                <p className="text-sm mb-3">
                  Confirme o que aconteceu com a dose. A anulação do registro
                  não prova que o material pode voltar ao estoque.
                </p>
                <label className="flex gap-2 text-sm">
                  <input
                    type="radio"
                    name="destino-consumo"
                    required
                    checked={destinoConsumo === "DEVOLVER_ESTOQUE"}
                    onChange={() => setDestinoConsumo("DEVOLVER_ESTOQUE")}
                  />{" "}
                  Devolver ao estoque: o material não foi usado nem descartado.
                </label>
                <label className="flex gap-2 mt-3 text-sm">
                  <input
                    type="radio"
                    name="destino-consumo"
                    required
                    checked={destinoConsumo === "MANTER_CONSUMO"}
                    onChange={() => setDestinoConsumo("MANTER_CONSUMO")}
                  />{" "}
                  Manter o consumo: o material foi usado ou descartado.
                </label>
              </fieldset>
            )}
            <label>
              Motivo
              <input
                required
                minLength={5}
                className={classeInput}
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
              />
            </label>
            {previa.criasIds.length > 0 && (
              <ConfirmacaoCiencia
                id="anular-preservar-crias"
                checked={ciencia}
                onChange={setCiencia}
              >
                Estou ciente de que os cadastros e a filiação das crias serão
                preservados.
              </ConfirmacaoCiencia>
            )}
          </>
        ) : (
          <p role="status">Consultando os efeitos e impedimentos…</p>
        )}
        <Button
          secondary
          type="button"
          disabled={ocupado}
          onClick={() => void carregar()}
        >
          Revisar prévia atualizada
        </Button>
      </form>
    </PainelCadastro>
  );
}
