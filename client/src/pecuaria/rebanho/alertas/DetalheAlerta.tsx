import { HistoricoAlerta } from "./HistoricoAlerta";
import { useEffect, useState } from "react";
import { Button, ErrorBox, Pill, dataBR } from "@/financeiro/financeiro-ui";
import { DialogFinanceiro } from "@/financeiro/DialogFinanceiro";
import { FormAplicacaoServico } from "../sanidade/FormAplicacaoServico";
import { reqSanidade } from "../sanidade/api";
import { navegarPara } from "../../../router";
import { linkFichaAnimal } from "../lib/navegacao";
import {
  consultarDetalhe,
  avisarAlteracaoAlertas,
  type DetalheAlerta as Detalhe,
} from "./api";
import { rotuloSituacao } from "./consulta";
import { DecisoesAlerta } from "./DecisoesAlerta";
import { ExameAlerta } from "./ExameAlerta";
import { AtendimentoReprodutivoAlerta } from "./AtendimentoReprodutivoAlerta";
const data = (v?: string | null) => (v ? dataBR(v) : "Não informada");
export function DetalheAlerta({
  id,
  propriedadeId,
  onFechar,
  onAtualizado,
  animalIdAtual,
}: {
  id: string;
  animalIdAtual?: string;
  propriedadeId?: number;
  onFechar: () => void;
  onAtualizado: () => void;
}) {
  const [dados, setDados] = useState<Detalhe | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);
  const [aplicando, setAplicando] = useState(false);
  const [examinando, setExaminando] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setErro(null);
    setDados(null);
    consultarDetalhe(id, propriedadeId, controller.signal)
      .then(setDados)
      .catch((e) => {
        if (!controller.signal.aborted)
          setErro(
            e instanceof Error
              ? e.message
              : "Não foi possível consultar o detalhe",
          );
      });
    return () => controller.abort();
  }, [id, propriedadeId, tentativa]);
  function atualizar() {
    avisarAlteracaoAlertas();
    onAtualizado();
    setTentativa((n) => n + 1);
  }
  if (examinando && dados?.origem.animal && propriedadeId && dados.revisao)
    return (
      <ExameAlerta
        alertaId={id}
        revisao={dados.revisao}
        animalId={dados.origem.animal.id}
        tipoExameId={dados.origem.programacao?.tipoExameId}
        propriedadeId={propriedadeId}
        titulo={dados.titulo}
        onFechar={() => setExaminando(false)}
        onSalvo={() => {
          setExaminando(false);
          atualizar();
        }}
      />
    );
  if (aplicando && dados?.origem.animal && propriedadeId && dados.revisao)
    return (
      <FormAplicacaoServico
        animalId={dados.origem.animal.id}
        propriedadeId={propriedadeId}
        onFechar={() => setAplicando(false)}
        onSalvo={() => {
          setAplicando(false);
          atualizar();
        }}
        rotuloSubmeter="Registrar aplicação para este cuidado"
        conteudoExtra={
          <p className="p-4">
            <strong>{dados.titulo}</strong>
            <br />A aplicação será vinculada ao cuidado deste animal.
          </p>
        }
        onRegistrar={async (input) => {
          await reqSanidade(
            "/aplicacoes",
            {
              method: "POST",
              body: JSON.stringify({
                ...input,
                alertaId: id,
                alertaRevisao: dados.revisao,
                confirmarCuidadoAlerta: true,
              }),
            },
            propriedadeId,
          );
        }}
      />
    );
  const reprodutivo = dados?.produtor === "reproducao";
  return (
    <DialogFinanceiro
      titulo={dados?.titulo ?? "Detalhe do alerta"}
      eyebrow=""
      onClose={onFechar}
    >
      <div className="p-5">
        {erro ? (
          <>
            <ErrorBox erro={erro} />
            <Button secondary onClick={() => setTentativa((n) => n + 1)}>
              Tentar novamente
            </Button>
          </>
        ) : !dados ? (
          <p role="status">Consultando detalhes na origem…</p>
        ) : (
          <>
            <Pill>{rotuloSituacao(dados.situacao)}</Pill>
            <h3 className="mt-5 font-semibold">Evidência do disparo</h3>
            <p className="mt-2">
              {dados.evidenciaDisparo.motivo ?? dados.motivo}
            </p>
            <dl className="alertas-detalhe-dados">
              <div>
                <dt>Data de referência original</dt>
                <dd>{data(dados.evidenciaDisparo.dataReferencia)}</dd>
              </div>
              {!reprodutivo && (
                <div>
                  <dt>Produto no disparo</dt>
                  <dd>
                    {dados.evidenciaDisparo.resumo?.produtoNome ??
                      "Não informado"}
                  </dd>
                </div>
              )}
            </dl>
            <h3 className="mt-3 font-semibold">Situação atual na origem</h3>
            {dados.origem.estado !== "DISPONIVEL" ? (
              <p className="mt-2">
                {dados.origem.estado === "REMOVIDA"
                  ? "A origem não está mais disponível."
                  : "Os detalhes da origem estão indisponíveis."}{" "}
                A evidência autorizada foi preservada.
              </p>
            ) : (
              <>
                <dl className="alertas-detalhe-dados">
                  <div>
                    <dt>Animal</dt>
                    <dd>
                      {dados.origem.animal?.brinco} {dados.origem.animal?.nome}
                    </dd>
                  </div>
                  {!reprodutivo && (
                    <>
                      <div>
                        <dt>Produto atual</dt>
                        <dd>{dados.origem.produto?.nome ?? "Procedimento"}</dd>
                      </div>
                      <div>
                        <dt>Regra</dt>
                        <dd>
                          {dados.origem.regra?.nome ??
                            dados.origem.programacao?.nome ??
                            "Programação sanitária"}
                        </dd>
                      </div>
                    </>
                  )}
                  <div>
                    <dt>Referência atual</dt>
                    <dd>{data(dados.origem.dataReferencia)}</dd>
                  </div>
                  {reprodutivo && (
                    <div>
                      <dt>Data prevista</dt>
                      <dd>
                        {dados.origem.previstaPara
                          ? data(dados.origem.previstaPara)
                          : "Planejamento pendente"}
                      </dd>
                    </div>
                  )}
                  {dados.origem.dataAtencao && (
                    <div>
                      <dt>
                        {["ADIADO", "SUSPENSO"].includes(dados.situacao)
                          ? "Retomar atenção em"
                          : "Data de atenção"}
                      </dt>
                      <dd>{data(dados.origem.dataAtencao)}</dd>
                    </div>
                  )}
                  {dados.origem.destino && (
                    <div>
                      <dt>Destino do cuidado</dt>
                      <dd>{dados.origem.destino}</dd>
                    </div>
                  )}
                  {!reprodutivo && (
                    <div>
                      <dt>Atendimento</dt>
                      <dd>
                        {dados.origem.aplicacaoId
                          ? "Aplicação vinculada"
                          : dados.origem.exameId
                            ? "Exame vinculado"
                            : dados.origem.participacaoId
                              ? "Protocolo programado"
                              : "Sem atendimento vinculado"}
                      </dd>
                    </div>
                  )}
                </dl>
                {reprodutivo && (
                  <p className="mb-4 text-sm">
                    {dados.origem.tipo === "DISPOSITIVO_SEM_RETIRADA"
                      ? "A necessidade de retirada física permanece mesmo após dispensa de tarefa ou retirada da participação. Registre a remoção realizada para concluir este cuidado."
                      : "Programação, reagendamento e decisões administrativas não comprovam atendimento. Registre a execução pelo fluxo do fato correspondente."}
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  {dados.acoes.includes("REGISTRAR_APLICACAO") &&
                    propriedadeId &&
                    dados.origem.animal && (
                      <Button onClick={() => setAplicando(true)}>
                        Registrar aplicação
                      </Button>
                    )}
                  {dados.acoes.includes("REGISTRAR_EXAME") &&
                    propriedadeId &&
                    dados.origem.animal && (
                      <Button onClick={() => setExaminando(true)}>
                        Registrar exame
                      </Button>
                    )}
                  {propriedadeId &&
                    (reprodutivo ? (
                      <AtendimentoReprodutivoAlerta
                        detalhe={dados}
                        propriedadeId={propriedadeId}
                        onAtualizado={atualizar}
                      />
                    ) : (
                      <DecisoesAlerta
                        detalhe={dados}
                        propriedadeId={propriedadeId}
                        onAtualizado={() => {
                          onAtualizado();
                          setTentativa((n) => n + 1);
                        }}
                      />
                    ))}
                  {dados.origem.animal &&
                    dados.origem.animal.id !== animalIdAtual && (
                      <Button
                        secondary
                        onClick={() => {
                          onFechar();
                          navegarPara(linkFichaAnimal(dados.origem.animal!.id));
                        }}
                      >
                        Abrir ficha do animal
                      </Button>
                    )}
                </div>
              </>
            )}
            {dados.eventos && <HistoricoAlerta eventos={dados.eventos} />}
          </>
        )}
      </div>
    </DialogFinanceiro>
  );
}
