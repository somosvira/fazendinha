import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  Button,
  CabecalhoTabela,
  ErrorBox,
  Panel,
  Pill,
  Empty,
} from "../../../financeiro/financeiro-ui";
import { classeInput } from "../../../financeiro/PainelCadastro";
import { SelectCampo } from "../../../financeiro/SelectCampo";
import { getPropriedadeAtiva } from "../../../propriedadeScope";
import {
  reqSanidade,
  listarTiposAplicacao,
  type TipoAplicacao,
} from "../sanidade/api";
import { obterReproducao, reqV4 } from "./api";
import { requisicaoAlertas } from "../alertas/api";
import { ModalPolitica } from "./ModalPolitica";
type Impacto = {
  versao: 1;
  gatilho: "OCORRENCIA" | "PROCEDIMENTO";
  efeito: "AVISAR" | "BLOQUEAR" | "RETIRAR";
  tipoAplicacaoId?: string;
};
type RegraProcedimento = {
  id: string;
  tipoAplicacaoId: string;
  finalidade: "PROTOCOLO" | "IATF" | "TETF" | "PRE_SINCRONIZACAO";
  efeito: "AVISAR" | "BLOQUEAR" | "RETIRAR";
  motivo: string;
  ativo: boolean;
  versao: number;
};
type Regra = {
  id: string;
  doencaId: string | null;
  acao: string;
  efeito: string;
  motivo: string;
  ativo: boolean;
  impactoProtocolar?: Impacto | null;
  doenca?: { nome: string } | null;
  procedimento?: RegraProcedimento;
};
export function RegrasSanitarias({
  podeEditar,
  propriedadeId: explicita,
}: {
  podeEditar: boolean;
  propriedadeId?: number;
}) {
  const propriedadeId = explicita ?? getPropriedadeAtiva();
  const [regras, setRegras] = useState<Regra[]>([]);
  const [doencas, setDoencas] = useState<
    Array<{ id: string; nome: string; ativo: boolean }>
  >([]);
  const [tipos, setTipos] = useState<TipoAplicacao[]>([]);
  const [aberto, setAberto] = useState(false);
  const [edicaoOcorrencia, setEdicaoOcorrencia] = useState<Regra | null>(null);
  const [edicao, setEdicao] = useState<RegraProcedimento | null>(null);
  const [ativo, setAtivo] = useState(true);
  const chave = useRef<{ payload: string; id: string } | null>(null);
  const [alterado, setAlterado] = useState(false);
  const [doencaId, setDoencaId] = useState("");
  const [acao, setAcao] = useState("");
  const [efeito, setEfeito] = useState("");
  const [motivo, setMotivo] = useState("");
  const [gatilho, setGatilho] = useState<"OCORRENCIA" | "PROCEDIMENTO">(
    "OCORRENCIA",
  );
  const [impacto, setImpacto] = useState("");
  const [tipoAplicacaoId, setTipoAplicacaoId] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [mensagem, setMensagem] = useState("");
  const geracao = useRef(0);
  useEffect(() => {
    const g = ++geracao.current;
    setErro(null);
    setCarregando(true);
    setRegras([]);
    if (!propriedadeId) {
      setErro("Selecione um sítio para consultar ou configurar regras.");
      setCarregando(false);
      return;
    }
    void Promise.all([
      obterReproducao(undefined, propriedadeId),
      reqSanidade<typeof doencas>("/doencas", undefined, propriedadeId),
      listarTiposAplicacao(propriedadeId),
      podeEditar
        ? requisicaoAlertas<RegraProcedimento[]>(
            "/reproducao/impactos-procedimentos",
            undefined,
            undefined,
            propriedadeId,
          )
        : Promise.resolve([]),
    ])
      .then(([p, d, t, procedimentos]) => {
        if (g === geracao.current) {
          setRegras([
            ...((p.regrasSanitarias ?? []) as Regra[]),
            ...procedimentos.map((procedimento) => ({
              id: procedimento.id,
              doencaId: null,
              acao: procedimento.finalidade,
              efeito: "",
              motivo: procedimento.motivo,
              ativo: procedimento.ativo,
              procedimento,
              impactoProtocolar: {
                versao: 1 as const,
                gatilho: "PROCEDIMENTO" as const,
                efeito: procedimento.efeito,
                tipoAplicacaoId: procedimento.tipoAplicacaoId,
              },
            })),
          ]);
          setDoencas(d);
          setTipos(t);
        }
      })
      .catch((e) => {
        if (g === geracao.current) setErro(e.message);
      })
      .finally(() => {
        if (g === geracao.current) setCarregando(false);
      });
    return () => {
      geracao.current++;
    };
  }, [propriedadeId, podeEditar]);
  function abrir() {
    setEdicaoOcorrencia(null);
    setEdicao(null);
    setAtivo(true);
    setDoencaId("");
    setAcao("");
    setEfeito("");
    setMotivo("");
    setGatilho("OCORRENCIA");
    setImpacto("");
    setTipoAplicacaoId("");
    setAlterado(false);
    setErro(null);
    setAberto(true);
  }
  async function salvar(e: FormEvent) {
    e.preventDefault();
    if (ocupado) return;
    if (!propriedadeId) {
      setErro("Selecione um sítio.");
      return;
    }
    if (
      !acao ||
      motivo.trim().length < 5 ||
      (gatilho === "OCORRENCIA"
        ? !doencaId || !efeito
        : !tipoAplicacaoId || !impacto)
    ) {
      setErro("Preencha o gatilho, a ação, os efeitos e o motivo da regra.");
      return;
    }
    setOcupado(true);
    setErro(null);
    const g = geracao.current;
    try {
      if (gatilho === "PROCEDIMENTO") {
        const body = {
          propriedadeId,
          tipoAplicacaoId,
          finalidade: acao,
          efeito: impacto,
          motivo,
          ativo,
          ...(edicao ? { versaoEsperada: edicao.versao } : {}),
        };
        const payload = JSON.stringify(body);
        if (chave.current?.payload !== payload)
          chave.current = { payload, id: crypto.randomUUID() };
        const salvo = await requisicaoAlertas<RegraProcedimento>(
          `/reproducao/impactos-procedimentos${edicao ? `/${edicao.id}/revisao` : ""}`,
          {
            method: "POST",
            body: JSON.stringify({ ...body, chave: chave.current.id }),
          },
          undefined,
          propriedadeId,
        );
        if (g === geracao.current)
          setRegras((v) => [
            ...v.filter((r) => r.id !== salvo.id),
            {
              id: salvo.id,
              doencaId: null,
              acao: salvo.finalidade,
              efeito: "",
              motivo: salvo.motivo,
              ativo: salvo.ativo,
              procedimento: salvo,
              impactoProtocolar: {
                versao: 1,
                gatilho: "PROCEDIMENTO",
                efeito: salvo.efeito,
                tipoAplicacaoId: salvo.tipoAplicacaoId,
              },
            },
          ]);
      } else {
        await reqV4(
          "/reproducao/regras-sanitarias",
          {
            propriedadeId,
            doencaId,
            acao,
            efeito,
            motivo,
            ativo,
            ...(impacto
              ? {
                  impactoProtocolar: {
                    versao: 1,
                    gatilho: "OCORRENCIA",
                    efeito: impacto,
                  },
                }
              : {}),
          },
          "POST",
          propriedadeId,
        );
        const p = await obterReproducao(undefined, propriedadeId);
        if (g === geracao.current)
          setRegras((v) => [
            ...((p.regrasSanitarias ?? []) as Regra[]),
            ...v.filter((r) => r.procedimento),
          ]);
      }
      if (g === geracao.current) {
        setAberto(false);
        setAlterado(false);
        setMensagem(
          "Regra configurada. Efeitos em protocolos são conferidos na prévia do registro sanitário.",
        );
      }
    } catch (e) {
      if (g === geracao.current)
        setErro(e instanceof Error ? e.message : String(e));
    } finally {
      if (g === geracao.current) setOcupado(false);
    }
  }
  function revisarOcorrencia(r: Regra) {
    setEdicaoOcorrencia(r);
    setEdicao(null);
    setGatilho("OCORRENCIA");
    setDoencaId(r.doencaId ?? "");
    setAcao(r.acao);
    setEfeito(r.efeito);
    setImpacto(r.impactoProtocolar?.efeito ?? "");
    setAtivo(r.ativo);
    setMotivo("");
    setAlterado(false);
    setErro(null);
    setAberto(true);
  }
  function revisar(r: RegraProcedimento) {
    setEdicaoOcorrencia(null);
    setEdicao(r);
    setGatilho("PROCEDIMENTO");
    setTipoAplicacaoId(r.tipoAplicacaoId);
    setAcao(r.finalidade);
    setImpacto(r.efeito);
    setAtivo(r.ativo);
    setMotivo("");
    setAlterado(false);
    setErro(null);
    setAberto(true);
  }

  return (
    <Panel>
      <CabecalhoTabela
        titulo="Regras sanitárias e impactos em protocolos"
        acao={
          podeEditar && (
            <Button
              secondary
              disabled={carregando || !propriedadeId}
              onClick={abrir}
            >
              Configurar regra
            </Button>
          )
        }
      />
      <div className="p-4 space-y-3">
        {!aberto && <ErrorBox erro={erro} />}
        <p className="text-sm text-ink-3">
          As regras são definidas pela fazenda. Efeito clínico e efeito sobre o
          protocolo são independentes; nenhuma doença ou conduta é presumida.
        </p>
        {mensagem && <p role="status">{mensagem}</p>}
        {carregando ? (
          <p role="status">Carregando regras…</p>
        ) : regras.length ? (
          regras.map((r) => (
            <article
              className="flex flex-wrap gap-3 border-t border-border pt-3 text-sm"
              key={r.id}
            >
              <strong>
                {r.impactoProtocolar?.gatilho === "PROCEDIMENTO"
                  ? (tipos.find(
                      (t) => t.id === r.impactoProtocolar?.tipoAplicacaoId,
                    )?.nome ?? "Procedimento configurado")
                  : (r.doenca?.nome ??
                    doencas.find((d) => d.id === r.doencaId)?.nome ??
                    "Doença configurada")}
              </strong>
              <span>
                {r.acao}
                {!r.procedimento &&
                  ` · ${r.efeito === "BLOQUEAR" ? "Bloquear ação clínica" : "Alertar e exigir ciência"}`}
              </span>
              {r.impactoProtocolar && (
                <span>
                  Protocolo:{" "}
                  {r.impactoProtocolar.efeito === "AVISAR"
                    ? "avisar"
                    : r.impactoProtocolar.efeito === "BLOQUEAR"
                      ? "bloquear"
                      : "retirar"}
                </span>
              )}
              <span>{r.motivo}</span>
              {r.procedimento && <span>Versão {r.procedimento.versao}</span>}
              <Pill>{r.ativo ? "Ativa" : "Inativa"}</Pill>
              {podeEditar && (
                <Button
                  secondary
                  onClick={() =>
                    r.procedimento
                      ? revisar(r.procedimento)
                      : revisarOcorrencia(r)
                  }
                >
                  Revisar regra
                </Button>
              )}
            </article>
          ))
        ) : (
          !erro && <Empty>Nenhuma regra configurada.</Empty>
        )}
      </div>
      {aberto && (
        <ModalPolitica
          aberto
          titulo={
            edicao
              ? "Revisar regra de procedimento"
              : "Configurar regra sanitária"
          }
          bloqueado={ocupado}
          alteracoesExternas={alterado}
          onFechar={() => {
            setAberto(false);
            setErro(null);
          }}
          rodape={(fechar) => (
            <>
              <Button secondary disabled={ocupado} onClick={fechar}>
                Cancelar
              </Button>
              <Button form="regra-reproducao" type="submit" disabled={ocupado}>
                Salvar regra
              </Button>
            </>
          )}
        >
          <form id="regra-reproducao" className="space-y-4" onSubmit={salvar}>
            <ErrorBox erro={erro} />
            <fieldset disabled={ocupado} className="min-w-0 space-y-4">
              <label>
                Gatilho da regra
                <SelectCampo
                  disabled={!!edicao || !!edicaoOcorrencia}
                  value={gatilho}
                  onValueChange={(v) => {
                    setGatilho(v as typeof gatilho);
                    setDoencaId("");
                    setTipoAplicacaoId("");
                    setAcao("");
                    setEfeito("");
                    setImpacto("");
                    setAlterado(true);
                  }}
                >
                  <option value="OCORRENCIA">Ocorrência de doença</option>
                  <option value="PROCEDIMENTO">Procedimento sanitário</option>
                </SelectCampo>
              </label>
              {gatilho === "OCORRENCIA" ? (
                <label>
                  Doença
                  <SelectCampo
                    required
                    disabled={!!edicaoOcorrencia}
                    value={doencaId}
                    onValueChange={(v) => {
                      setDoencaId(v);
                      setAlterado(true);
                    }}
                  >
                    <option value="">Selecione</option>
                    {doencas
                      .filter((d) => d.ativo)
                      .map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.nome}
                        </option>
                      ))}
                  </SelectCampo>
                </label>
              ) : (
                <label>
                  Tipo de procedimento
                  <SelectCampo
                    required
                    value={tipoAplicacaoId}
                    onValueChange={(v) => {
                      setTipoAplicacaoId(v);
                      setAlterado(true);
                    }}
                  >
                    <option value="">Selecione</option>
                    {tipos
                      .filter((t) => t.ativo)
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.nome}
                        </option>
                      ))}
                  </SelectCampo>
                </label>
              )}
              <label>
                {gatilho === "PROCEDIMENTO"
                  ? "Finalidade do protocolo"
                  : "Ação reprodutiva"}
                <SelectCampo
                  required
                  disabled={!!edicaoOcorrencia}
                  value={acao}
                  onValueChange={(v) => {
                    setAcao(v);
                    setAlterado(true);
                  }}
                >
                  <option value="">Selecione</option>
                  {(gatilho === "PROCEDIMENTO"
                    ? ["PROTOCOLO", "IATF", "TETF", "PRE_SINCRONIZACAO"]
                    : ["IA", "TE", "COBERTURA", "IATF", "TETF", "PROTOCOLO"]
                  ).map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </SelectCampo>
              </label>
              {gatilho === "OCORRENCIA" && (
                <label>
                  Efeito clínico
                  <SelectCampo
                    required
                    value={efeito}
                    onValueChange={(v) => {
                      setEfeito(v);
                      setAlterado(true);
                    }}
                  >
                    <option value="">Selecione</option>
                    <option value="ALERTAR">Alertar e exigir ciência</option>
                    <option value="BLOQUEAR">Bloquear ação reprodutiva</option>
                  </SelectCampo>
                </label>
              )}
              <label>
                Efeito em protocolos
                <SelectCampo
                  required={
                    gatilho === "PROCEDIMENTO" ||
                    !!edicaoOcorrencia?.impactoProtocolar
                  }
                  value={impacto}
                  onValueChange={(v) => {
                    setImpacto(v);
                    setAlterado(true);
                  }}
                >
                  <option
                    value=""
                    disabled={!!edicaoOcorrencia?.impactoProtocolar}
                  >
                    Sem efeito protocolar adicional
                  </option>
                  <option value="AVISAR">Avisar</option>
                  <option value="BLOQUEAR">
                    Bloquear execução até revisão
                  </option>
                  <option value="RETIRAR">Retirar da participação</option>
                </SelectCampo>
              </label>
              <p className="text-sm text-ink-3">
                Bloqueio e retirada são conferidos na prévia do fato sanitário.
                Retirada de participação não registra retirada física de
                dispositivo.
              </p>
              {(gatilho === "PROCEDIMENTO" || edicaoOcorrencia) && (
                <label className="flex gap-2">
                  <input
                    type="checkbox"
                    checked={ativo}
                    onChange={(e) => {
                      setAtivo(e.target.checked);
                      setAlterado(true);
                    }}
                  />
                  Regra ativa para novos fatos
                </label>
              )}
              <label>
                Motivo definido pela fazenda
                <textarea
                  className={classeInput}
                  required
                  minLength={5}
                  maxLength={1000}
                  value={motivo}
                  onChange={(e) => {
                    setMotivo(e.target.value);
                    setAlterado(true);
                  }}
                />
              </label>
            </fieldset>
          </form>
        </ModalPolitica>
      )}
    </Panel>
  );
}
