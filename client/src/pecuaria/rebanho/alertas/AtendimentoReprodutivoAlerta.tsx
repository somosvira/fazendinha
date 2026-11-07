import { useRef, useState } from "react";
import {
  Button,
  ErrorBox,
  dataBR,
  hoje,
} from "../../../financeiro/financeiro-ui";
import {
  CampoFormulario,
  classeInput,
  PainelCadastro,
} from "../../../financeiro/PainelCadastro";
import { DatePicker } from "../../../components/DatePicker";
import { ConfirmacaoCiencia } from "../../../components/ConfirmacaoCiencia";
import { dataHoraISO } from "../reproducao/CampoDataIatf";
import {
  decidirAlertaReprodutivo,
  registrarRetiradaFisica,
  type DetalheAlerta,
  type TipoDecisaoReprodutiva,
} from "./api";

const nomes: Record<TipoDecisaoReprodutiva, string> = {
  REAGENDAR: "Reagendar cuidado",
  DISPENSAR: "Dispensar cuidado",
  RETIRAR: "Retirar participação",
  SUSPENDER: "Suspender até revisão",
};
type Acao = TipoDecisaoReprodutiva | "REGISTRAR_RETIRADA_FISICA";
export function AtendimentoReprodutivoAlerta({
  detalhe,
  propriedadeId,
  onAtualizado,
}: {
  detalhe: DetalheAlerta;
  propriedadeId: number;
  onAtualizado: () => void;
}) {
  const [acao, setAcao] = useState<Acao | null>(null);
  const dispositivo = detalhe.origem.tipo === "DISPOSITIVO_SEM_RETIRADA";
  const acoes = (Object.keys(nomes) as TipoDecisaoReprodutiva[]).filter(
    (a) =>
      detalhe.acoes.includes(a) &&
      !(dispositivo && (a === "DISPENSAR" || a === "RETIRAR")),
  );
  return (
    <>
      {dispositivo &&
        detalhe.acoes.includes("REGISTRAR_RETIRADA_FISICA") &&
        detalhe.origem.origemId && (
          <Button onClick={() => setAcao("REGISTRAR_RETIRADA_FISICA")}>
            Registrar retirada física
          </Button>
        )}
      {acoes.map((a) => (
        <Button key={a} secondary onClick={() => setAcao(a)}>
          {nomes[a]}
        </Button>
      ))}
      {acao && (
        <FormularioAtendimento
          key={`${detalhe.alertaId}:${detalhe.revisao}:${acao}`}
          acao={acao}
          detalhe={detalhe}
          propriedadeId={propriedadeId}
          onFechar={() => setAcao(null)}
          onSalvo={() => {
            setAcao(null);
            onAtualizado();
          }}
        />
      )}
    </>
  );
}
function FormularioAtendimento({
  acao,
  detalhe,
  propriedadeId,
  onFechar,
  onSalvo,
}: {
  acao: Acao;
  detalhe: DetalheAlerta;
  propriedadeId: number;
  onFechar: () => void;
  onSalvo: () => void;
}) {
  const fisica = acao === "REGISTRAR_RETIRADA_FISICA";
  const revisao = acao === "REAGENDAR" || acao === "SUSPENDER";
  const [data, setData] = useState("");
  const [hora, setHora] = useState("");
  const [destino, setDestino] = useState("");
  const [motivo, setMotivo] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [ciencia, setCiencia] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [obsoleta, setObsoleta] = useState(false);
  const recibo = useRef<{ payload: string; chave: string } | null>(null);
  const trava = useRef(false);
  const titulo = fisica ? "Registrar retirada física" : nomes[acao];
  async function salvar() {
    if (trava.current || obsoleta) return;
    if (
      motivo.trim().length < 5 ||
      !ciencia ||
      (revisao && (!data || destino.trim().length < 2)) ||
      (fisica && !data)
    ) {
      setErro("Preencha os campos e confirme a conferência antes de salvar.");
      return;
    }
    if (revisao && data <= hoje()) {
      setErro("Informe uma data de revisão posterior a hoje.");
      return;
    }
    if (fisica && data > hoje()) {
      setErro("Informe a data em que a retirada ocorreu, até hoje.");
      return;
    }
    trava.current = true;
    setOcupado(true);
    setErro(null);
    const payload = JSON.stringify({
      acao,
      propriedadeId,
      revisao: detalhe.revisao,
      data,
      hora,
      destino,
      motivo,
      responsavel,
    });
    if (recibo.current?.payload !== payload)
      recibo.current = { payload, chave: crypto.randomUUID() };
    try {
      if (fisica) {
        if (!detalhe.origem.origemId)
          throw new Error("Inserção indisponível. Reconsulte o cuidado.");
        await registrarRetiradaFisica(detalhe.origem.origemId, {
          chave: recibo.current.chave,
          propriedadeId,
          realizadaEm: hora ? dataHoraISO(`${data}T${hora}`) : data,
          confirmarRetiradaFisica: true,
          observacao: motivo.trim(),
          ...(responsavel.trim() ? { responsavel: responsavel.trim() } : {}),
        });
      } else {
        if (!detalhe.revisao)
          throw new Error("Revisão indisponível. Reconsulte o cuidado.");
        await decidirAlertaReprodutivo(detalhe.alertaId, {
          chave: recibo.current.chave,
          propriedadeId,
          revisao: detalhe.revisao,
          tipo: acao,
          motivo: motivo.trim(),
          ...(revisao ? { data, destino: destino.trim() } : {}),
        });
      }
      onSalvo();
    } catch (e) {
      setErro(
        e instanceof Error
          ? e.message
          : "Não foi possível registrar o atendimento.",
      );
      if (
        e &&
        typeof e === "object" &&
        (("status" in e && e.status === 409) ||
          ("code" in e && e.code === "CONFLITO"))
      )
        setObsoleta(true);
    } finally {
      trava.current = false;
      setOcupado(false);
    }
  }
  return (
    <PainelCadastro
      aberto
      camada="sobreDetalhe"
      titulo={titulo}
      compacto
      bloqueado={ocupado}
      onFechar={onFechar}
      rodape={
        <>
          <Button secondary disabled={ocupado} onClick={onFechar}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form="atendimento-reprodutivo-alerta"
            disabled={ocupado || obsoleta || !ciencia}
          >
            {ocupado ? "Registrando…" : titulo}
          </Button>
        </>
      }
    >
      <form
        id="atendimento-reprodutivo-alerta"
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void salvar();
        }}
      >
        <ErrorBox erro={erro} />
        {obsoleta && (
          <Button secondary onClick={onSalvo}>
            Reconsultar cuidado
          </Button>
        )}
        <p>
          <strong>{detalhe.origem.animal?.brinco}</strong> · {detalhe.titulo}
        </p>
        {fisica ? (
          <p className="text-sm">
            Inserção documentada em{" "}
            {detalhe.origem.dataReferencia
              ? dataBR(detalhe.origem.dataReferencia)
              : "data não informada"}
            . Registre somente a remoção que ocorreu. A participação e o consumo
            original permanecem no histórico.
          </p>
        ) : (
          <p className="text-sm">
            {acao === "DISPENSAR"
              ? "A dispensa encerra administrativamente este cuidado e não registra execução."
              : acao === "RETIRAR"
                ? "A retirada encerra a participação e suas tarefas pendentes, cancelando automações. Dispositivos inseridos continuam exigindo retirada física registrada."
                : "Informe quando e para onde encaminhar o cuidado. Esta decisão não comprova execução."}
          </p>
        )}
        <fieldset disabled={ocupado || obsoleta} className="grid gap-4">
          {(fisica || revisao) && (
            <CampoFormulario
              id="atendimento-data"
              rotulo={fisica ? "Data real da retirada" : "Data de revisão"}
              obrigatorio
            >
              {(p) => (
                <DatePicker
                  {...p}
                  popoverClassName="z-[1300]"
                  required
                  value={data}
                  max={fisica ? hoje() : undefined}
                  min={
                    fisica
                      ? detalhe.origem.dataReferencia?.slice(0, 10)
                      : hoje()
                  }
                  onChange={setData}
                />
              )}
            </CampoFormulario>
          )}
          {fisica && (
            <>
              <CampoFormulario
                id="retirada-hora"
                rotulo="Hora da retirada (se conhecida)"
              >
                {(p) => (
                  <input
                    {...p}
                    type="time"
                    className={classeInput}
                    value={hora}
                    onChange={(e) => setHora(e.target.value)}
                  />
                )}
              </CampoFormulario>
              <CampoFormulario
                id="retirada-responsavel"
                rotulo="Responsável pela retirada (opcional)"
              >
                {(p) => (
                  <input
                    {...p}
                    maxLength={160}
                    className={classeInput}
                    value={responsavel}
                    onChange={(e) => setResponsavel(e.target.value)}
                  />
                )}
              </CampoFormulario>
            </>
          )}
          {revisao && (
            <CampoFormulario
              id="atendimento-destino"
              rotulo="Destino do cuidado"
              obrigatorio
            >
              {(p) => (
                <input
                  {...p}
                  required
                  maxLength={500}
                  className={classeInput}
                  value={destino}
                  onChange={(e) => setDestino(e.target.value)}
                />
              )}
            </CampoFormulario>
          )}
          <CampoFormulario
            id="atendimento-motivo"
            rotulo={fisica ? "Observação da retirada" : "Motivo"}
            obrigatorio
          >
            {(p) => (
              <textarea
                {...p}
                required
                minLength={5}
                maxLength={1000}
                rows={3}
                className={classeInput}
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
              />
            )}
          </CampoFormulario>
          <ConfirmacaoCiencia
            id="atendimento-ciencia"
            obrigatorio
            checked={ciencia}
            onChange={setCiencia}
          >
            {fisica
              ? "Confirmo que o dispositivo desta inserção foi retirado fisicamente."
              : "Conferi o cuidado e os efeitos desta decisão administrativa."}
          </ConfirmacaoCiencia>
        </fieldset>
      </form>
    </PainelCadastro>
  );
}
