import { useRef, useState, type FormEvent } from "react";
import { Button } from "../../../components/ui/button";
import { ErrorBox } from "../../../financeiro/financeiro-ui";
import { classeInput } from "../../../financeiro/PainelCadastro";
import { SelectCampo } from "../../../financeiro/SelectCampo";
import { SanidadeApiError } from "../sanidade/api";
import { horarioIatf } from "./CampoDataIatf";
import { ModalPolitica } from "./ModalPolitica";
import {
  revisarBloqueioParticipacao,
  type DestinoRevisaoBloqueio,
} from "./revisao-impacto-api";

type Props = {
  participacaoId: string;
  animal: string;
  propriedadeId: number;
  bloqueadaEm: string;
  motivoBloqueio?: string | null;
  aoFechar: () => void;
  aoConfirmar: (destino: DestinoRevisaoBloqueio) => void;
  aoReconsultar: () => void;
};

export function RevisaoBloqueioParticipacao({
  participacaoId,
  animal,
  propriedadeId,
  bloqueadaEm,
  motivoBloqueio,
  aoFechar,
  aoConfirmar,
  aoReconsultar,
}: Props) {
  const [destino, setDestino] = useState<DestinoRevisaoBloqueio | "">("");
  const [motivo, setMotivo] = useState("");
  const [confirmado, setConfirmado] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [conflito, setConflito] = useState(false);
  const chave = useRef<{ assinatura: string; valor: string } | null>(null);
  const formId = `revisao-bloqueio-${participacaoId}`;

  async function salvar(e: FormEvent) {
    e.preventDefault();
    if (ocupado || conflito) return;
    if (!destino || motivo.trim().length < 5 || !confirmado) {
      setErro("Escolha a decisão, informe o motivo e confirme a revisão.");
      return;
    }
    const input = {
      propriedadeId,
      bloqueadaEm,
      destino,
      motivo: motivo.trim(),
    };
    const assinatura = JSON.stringify(input);
    if (chave.current?.assinatura !== assinatura) {
      chave.current = { assinatura, valor: crypto.randomUUID() };
    }
    setOcupado(true);
    setErro(null);
    try {
      await revisarBloqueioParticipacao(participacaoId, {
        ...input,
        chave: chave.current.valor,
      });
      aoConfirmar(destino);
    } catch (e) {
      setErro(
        e instanceof Error ? e.message : "Não foi possível revisar o bloqueio.",
      );
      if (e instanceof SanidadeApiError && e.code === "CONFLITO")
        setConflito(true);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <ModalPolitica
      aberto
      titulo={`Revisar bloqueio · ${animal}`}
      bloqueado={ocupado}
      alteracoesExternas={!!destino || !!motivo || confirmado}
      onFechar={aoFechar}
      rodape={(fechar) => (
        <>
          <Button
            type="button"
            variant="outline"
            disabled={ocupado}
            onClick={fechar}
          >
            Manter bloqueio
          </Button>
          {conflito ? (
            <Button type="button" onClick={aoReconsultar}>
              Fechar e atualizar participações
            </Button>
          ) : (
            <Button
              type="submit"
              form={formId}
              disabled={
                ocupado || !destino || motivo.trim().length < 5 || !confirmado
              }
            >
              {ocupado ? "Registrando revisão…" : "Confirmar revisão"}
            </Button>
          )}
        </>
      )}
    >
      <form id={formId} onSubmit={salvar} className="space-y-4">
        <ErrorBox erro={erro} />
        <div className="space-y-1">
          <p className="font-semibold">Participação bloqueada</p>
          <p>Desde {horarioIatf(bloqueadaEm, "HORA")}</p>
          <p>{motivoBloqueio || "Motivo do bloqueio não informado."}</p>
        </div>
        {conflito && (
          <p>
            Confira novamente o bloqueio atual antes de decidir. Nenhuma nova
            decisão será enviada com estes dados.
          </p>
        )}
        <fieldset disabled={ocupado || conflito} className="min-w-0 space-y-4">
          <label>
            Decisão sobre a participação
            <SelectCampo
              required
              value={destino}
              onValueChange={(v) => {
                setDestino(v as DestinoRevisaoBloqueio);
                setConfirmado(false);
              }}
            >
              <option value="">Selecione a decisão</option>
              <option value="RETOMAR">Retomar a participação</option>
              <option value="RETIRAR">Retirar do protocolo</option>
            </SelectCampo>
          </label>
          {destino === "RETOMAR" && (
            <p className="text-sm text-ink-3">
              A retomada remove o bloqueio operacional desta participação.
              Aptidão e impedimentos clínicos continuam sendo validados no
              atendimento. Automações canceladas exigem revisão própria.
            </p>
          )}
          {destino === "RETIRAR" && (
            <p className="text-sm text-ink-3">
              A retirada encerra a participação e dispensa as etapas pendentes.
              Dispositivos instalados continuam exigindo retirada física.
            </p>
          )}
          <label>
            Motivo da revisão
            <textarea
              className={classeInput}
              required
              minLength={5}
              maxLength={1000}
              value={motivo}
              onChange={(e) => {
                setMotivo(e.target.value);
                setConfirmado(false);
              }}
            />
          </label>
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={confirmado}
              onChange={(e) => setConfirmado(e.target.checked)}
            />
            Conferi o bloqueio e confirmo a decisão sobre esta participação.
          </label>
        </fieldset>
      </form>
    </ModalPolitica>
  );
}
