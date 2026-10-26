import type { ConferenciaDraft, SituacaoEntrega } from "./comercial-types";
export function CamposConferenciaEntrega({
  valor,
  onChange,
}: {
  valor: ConferenciaDraft;
  onChange: (c: ConferenciaDraft) => void;
}) {
  return (
    <>
      <div className="leite-form-inline">
        <label>
          Situação do aceite
          <select
            value={valor.situacao}
            onChange={(e) =>
              onChange({
                ...valor,
                situacao: e.target.value as SituacaoEntrega,
              })
            }
          >
            <option value="PENDENTE">Aceite ainda não informado</option>
            <option value="ACEITE_INFORMADO">
              Aceite informado pelo comprador
            </option>
            <option value="DIVERGENCIA">Divergência a conferir</option>
            <option value="REJEITADA">Rejeição integral informada</option>
            <option value="DESTINACAO_POSTERIOR">
              Destinação posterior informada
            </option>
          </select>
        </label>
        {valor.situacao !== "PENDENTE" && (
          <label>
            Volume aceito (L)
            {["DIVERGENCIA", "DESTINACAO_POSTERIOR"].includes(valor.situacao) &&
              " — vazio permanece desconhecido"}
            <input
              inputMode="decimal"
              required={["ACEITE_INFORMADO", "REJEITADA"].includes(
                valor.situacao,
              )}
              value={valor.aceito}
              onChange={(e) => onChange({ ...valor, aceito: e.target.value })}
            />
          </label>
        )}
      </div>
      {valor.situacao === "PENDENTE" && (
        <p>
          O volume aceito permanece desconhecido. O volume expedido não será
          copiado como aceite.
        </p>
      )}
      <label>
        Motivo ou evidência da conferência
        <textarea
          required
          minLength={5}
          maxLength={1000}
          value={valor.motivo}
          onChange={(e) => onChange({ ...valor, motivo: e.target.value })}
        />
      </label>
      {valor.situacao === "DESTINACAO_POSTERIOR" && (
        <label>
          Destinação realmente informada
          <textarea
            required
            minLength={5}
            maxLength={1000}
            value={valor.destinacao}
            onChange={(e) => onChange({ ...valor, destinacao: e.target.value })}
          />
        </label>
      )}
      <small>
        Conferir aceite ou documentar divergência não devolve litros ao estoque,
        não registra descarte nem movimenta dinheiro automaticamente.
      </small>
    </>
  );
}
