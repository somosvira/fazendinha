import { useEffect, useRef, useState } from "react";
import { ClipboardCheck } from "lucide-react";
import {
  Button,
  ErrorBox,
  Pill,
  dataBR,
} from "../../../financeiro/financeiro-ui";
import {
  PainelCadastro,
  classeInput,
} from "../../../financeiro/PainelCadastro";
import { LinkInterno } from "../../../components/LinkInterno";
import { AjudaCampo } from "../../../components/Dica";
import { Paginacao } from "../ui";
import { FormReproducao } from "../reproducao/FormReproducao";
import { obterReproducao, type PainelReprodutivo } from "../reproducao/api";
import {
  caminhoContexto,
  consultaProtocolo,
  reqProtocolo,
  type ContextoProtocolo,
} from "./api";

type ExameResultado = {
  id: string;
  data: string;
  resultado: string | null;
  conduta: string | null;
  retornoEm: string | null;
};
type TentativaResultado = {
  id: string;
  tipo: string;
  data: string;
  origem: string;
  primeiroDg: ExameResultado | null;
  conclusao: string;
  perdaPosterior: boolean;
  posteriores: ExameResultado[];
  posterioresTotal: number;
};
export type LinhaResultadoProtocolo = {
  participacaoId: string;
  animal: { id: string; brinco: string; nome: string | null };
  preparo: { situacao: string; total: number; atendidas: number };
  tentativaPrevista: string | null;
  modalidadeTentativa: string | null;
  modalidadeDiagnostico: string | null;
  tentativas: TentativaResultado[];
  tentativasTotal: number;
  primeiroDg: ExameResultado | null;
  conclusao: string;
  perdaPosterior: boolean;
  situacaoAtual: string | null;
  encaminhamento: string | null;
  retornoEm: string | null;
  pendencia: string | null;
  vinculoExterno: { id: string; tentativaId: string; valido: boolean } | null;
  demandaDiagnostico: {
    id: string;
    tentativaId: string | null;
    gestacaoId: string | null;
    etapaId: string | null;
    tipoExameId: string | null;
  } | null;
};
type Taxa = {
  numerador: number;
  denominador: number;
  percentual: number | null;
};
export type DadosResultadosProtocolo = {
  etapasAcompanhamento?: string[];
  liberado: boolean;
  itens: LinhaResultadoProtocolo[];
  total: number;
  pagina: number;
  porPagina: number;
  resumo: {
    participacoes: number;
    incluidos: number;
    preparoConcluido: number;
    tentativasRealizadas: number;
    animaisComTentativa: number;
    examinados: number;
    aguardandoDiagnostico: number;
    positivos: number;
    negativos: number;
    inconclusivos: number;
    perdasPosteriores: number;
    taxas: { porTentativa: Taxa; porExaminada: Taxa; porAnimalIncluido: Taxa };
  };
};
export function useResultadosProtocolo(
  contexto: ContextoProtocolo,
  propriedadeId: number | undefined,
  revisao: number,
  ativo: boolean,
) {
  const [dados, setDados] = useState<DadosResultadosProtocolo | null>(null),
    [erro, setErro] = useState<string | null>(null),
    [pagina, setPagina] = useState(1),
    [busca, setBusca] = useState("");
  const id = contexto.programacaoId ?? contexto.participacaoId;
  useEffect(() => {
    if (!ativo) return;
    let vivo = true;
    setDados(null);
    setErro(null);
    reqProtocolo<DadosResultadosProtocolo>(
      `${caminhoContexto(contexto)}/resultados${consultaProtocolo({ pagina, busca })}`,
      propriedadeId,
    )
      .then((d) => {
        if (vivo) setDados(d);
      })
      .catch((e) => {
        if (vivo) setErro(e instanceof Error ? e.message : String(e));
      });
    return () => {
      vivo = false;
    };
  }, [id, propriedadeId, revisao, pagina, busca, ativo]);
  return {
    dados,
    erro,
    pagina,
    busca,
    setPagina,
    aoBuscar: (v: string) => {
      setBusca(v);
      setPagina(1);
    },
  };
}
const resultado: Record<string, string> = {
  POSITIVO: "Positivo",
  NEGATIVO: "Negativo",
  INCONCLUSIVO: "Inconclusivo",
  AGUARDANDO_DIAGNOSTICO: "Aguardando diagnóstico",
  TENTATIVA_PENDENTE: "Tentativa pendente",
  CONCLUIDO: "Concluído",
  SEM_ETAPAS: "Sem etapas de preparo",
  PENDENTE: "Pendente",
  DISPENSADO: "Dispensado",
  RETIRADO: "Retirado",
  A_REGULARIZAR: "A regularizar",
  GESTANTE: "Gestante",
  VAZIA: "Vazia",
  DESCONHECIDA: "Desconhecida",
};
const taxa = (t: Taxa) =>
  t.percentual == null
    ? "Sem base"
    : `${t.percentual.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% · ${t.numerador} de ${t.denominador}`;
export function ResultadosProtocolo({
  consulta,
  propriedadeId,
  podeLancar,
  aoSalvar,
  aoOperarEtapa,
}: {
  consulta: ReturnType<typeof useResultadosProtocolo>;
  propriedadeId?: number;
  podeLancar: boolean;
  aoSalvar: () => void;
  aoOperarEtapa: (id: string) => void;
}) {
  const { dados, erro, busca, aoBuscar, setPagina } = consulta;
  const [aberta, setAberta] = useState<{
    linha: LinhaResultadoProtocolo;
    acao: "vinculo" | "exames" | "diagnostico" | "revogacao";
  } | null>(null);
  if (erro)
    return (
      <div>
        <ErrorBox erro={erro} />
        <Button secondary onClick={aoSalvar}>
          Tentar consultar resultados novamente
        </Button>
      </div>
    );
  if (!dados) return <p role="status">Consultando resultados do protocolo…</p>;
  const r = dados.resumo;
  return (
    <section aria-label="Resultados do protocolo" className="grid gap-5">
      <div className="protocolo-resultados-contagens">
        {(
          [
            ["Incluídos", r.incluidos],
            ["Preparo concluído", r.preparoConcluido],
            ["Tentativas realizadas", r.tentativasRealizadas],
            ["Examinados", r.examinados],
            ["Aguardando diagnóstico", r.aguardandoDiagnostico],
            ["Positivos", r.positivos],
            ["Negativos", r.negativos],
            ["Inconclusivos", r.inconclusivos],
            ["Perdas posteriores", r.perdasPosteriores],
          ] as const
        ).map(([rotulo, valor]) => (
          <div key={rotulo}>
            <span>{rotulo}</span>
            <strong>{valor}</strong>
          </div>
        ))}
      </div>
      <div className="protocolo-resultados-taxas">
        <div>
          <span>
            Positivos por tentativa{" "}
            <AjudaCampo texto="Tentativas factuais vinculadas, incluindo as ainda sem DG. Ausência de exame permanece pendente." />
          </span>
          <strong>{taxa(r.taxas.porTentativa)}</strong>
        </div>
        <div>
          <span>Positivos por tentativa examinada</span>
          <strong>{taxa(r.taxas.porExaminada)}</strong>
        </div>
        <div>
          <span>
            Animais positivos por incluído{" "}
            <AjudaCampo texto="Animais distintos com ao menos um diagnóstico positivo entre as tentativas vinculadas. Perdas posteriores são apresentadas separadamente." />
          </span>
          <strong>{taxa(r.taxas.porAnimalIncluido)}</strong>
        </div>
      </div>
      <label className="text-sm">
        Buscar animal nos resultados
        <input
          type="search"
          className={classeInput}
          value={busca}
          onChange={(e) => aoBuscar(e.target.value)}
        />
      </label>
      <div className="protocolo-tabela">
        <table aria-label="Resultados por participante">
          <thead>
            <tr>
              <th>Animal</th>
              <th>Preparo</th>
              <th>Tentativa</th>
              <th>Primeiro DG</th>
              <th>Situação atual e encaminhamento</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {dados.itens.map((l) => {
              const atual = l.tentativas.at(-1);
              return (
                <tr key={l.participacaoId}>
                  <td>
                    <LinkInterno
                      area="pecuaria"
                      href={`/pecuaria/rebanho/animais/${l.animal.id}?participacaoId=${l.participacaoId}${propriedadeId ? `&sitio=${propriedadeId}` : ""}#reproducao`}
                    >
                      {l.animal.brinco}
                      {l.animal.nome ? ` · ${l.animal.nome}` : ""}
                    </LinkInterno>
                  </td>
                  <td>
                    <Pill
                      tone={
                        l.preparo.situacao === "CONCLUIDO" ? "green" : "neutral"
                      }
                    >
                      {resultado[l.preparo.situacao] ?? l.preparo.situacao}
                    </Pill>
                    <span className="block">
                      {l.preparo.atendidas} de {l.preparo.total} atendidas
                    </span>
                  </td>
                  <td>
                    {atual ? (
                      <>
                        <LinkInterno
                          area="pecuaria"
                          href={`/pecuaria/reproducao?animalId=${l.animal.id}&fatoId=${atual.id}${propriedadeId ? `&sitio=${propriedadeId}` : ""}`}
                        >
                          {atual.tipo} · {dataBR(atual.data)}
                        </LinkInterno>
                        <span className="block">
                          {atual.origem === "EXTERNA"
                            ? "Registro externo vinculado"
                            : "Realizada na etapa"}
                        </span>
                      </>
                    ) : l.tentativaPrevista ? (
                      `${l.tentativaPrevista} · sem atendimento registrado`
                    ) : (
                      "Não prevista"
                    )}
                    {l.pendencia && (
                      <p role="status" className="text-destructive">
                        {l.pendencia}
                      </p>
                    )}
                  </td>
                  <td>
                    {l.primeiroDg ? (
                      <>
                        {resultado[l.primeiroDg.resultado ?? ""] ??
                          "Resultado não informado"}
                        <span className="block">
                          {dataBR(l.primeiroDg.data)}
                        </span>
                      </>
                    ) : atual ? (
                      "Aguardando diagnóstico"
                    ) : (
                      "Aguardando tentativa"
                    )}
                    {l.perdaPosterior && (
                      <span className="block">Perda posterior registrada</span>
                    )}
                  </td>
                  <td>
                    {l.situacaoAtual
                      ? (resultado[l.situacaoAtual] ?? l.situacaoAtual)
                      : "Situação atual fora deste sítio"}
                    {l.encaminhamento && (
                      <span className="block">{l.encaminhamento}</span>
                    )}
                    {l.retornoEm && (
                      <span className="block">
                        Retorno: {dataBR(l.retornoEm)}
                      </span>
                    )}
                  </td>
                  <td>
                    <div className="flex flex-wrap gap-2">
                      {podeLancar &&
                        propriedadeId &&
                        l.modalidadeTentativa === "EXTERNA" &&
                        !atual &&
                        !l.vinculoExterno && (
                          <Button
                            secondary
                            onClick={() =>
                              setAberta({ linha: l, acao: "vinculo" })
                            }
                          >
                            Vincular tentativa
                          </Button>
                        )}
                      {podeLancar &&
                        propriedadeId &&
                        atual &&
                        l.demandaDiagnostico && (
                          <Button
                            onClick={() =>
                              l.demandaDiagnostico?.etapaId
                                ? aoOperarEtapa(l.demandaDiagnostico.etapaId)
                                : setAberta({ linha: l, acao: "diagnostico" })
                            }
                          >
                            <ClipboardCheck size={16} />
                            Registrar diagnóstico
                          </Button>
                        )}
                      {l.tentativas.length > 0 && (
                        <Button
                          secondary
                          onClick={() =>
                            setAberta({ linha: l, acao: "exames" })
                          }
                        >
                          Exames e encaminhamento
                        </Button>
                      )}
                      {podeLancar && propriedadeId && l.vinculoExterno && (
                        <Button
                          secondary
                          onClick={() =>
                            setAberta({ linha: l, acao: "revogacao" })
                          }
                        >
                          Rever vínculo
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!dados.total && <p>Nenhum participante corresponde à busca.</p>}
      <Paginacao
        paginaAtual={dados.pagina}
        totalPaginas={Math.max(1, Math.ceil(dados.total / dados.porPagina))}
        totalItens={dados.total}
        itensPorPagina={dados.porPagina}
        onPaginaChange={setPagina}
        rotulo="participantes"
        idSelect="resultados-protocolo-pagina"
      />
      {aberta &&
        (() => {
          const l = aberta.linha,
            fechar = () => setAberta(null),
            salvar = () => {
              fechar();
              aoSalvar();
            };
          return aberta.acao === "diagnostico" ? (
            <DiagnosticoResultado
              linha={l}
              propriedadeId={propriedadeId!}
              onFechar={fechar}
              onSalvo={salvar}
            />
          ) : aberta.acao === "vinculo" || aberta.acao === "revogacao" ? (
            <VinculoTentativaExterna
              linha={l}
              revogar={aberta.acao === "revogacao"}
              propriedadeId={propriedadeId!}
              onFechar={fechar}
              onSalvo={salvar}
            />
          ) : (
            <PainelCadastro
              aberto
              titulo={`Exames e encaminhamento · ${l.animal.brinco}`}
              onFechar={fechar}
              rodape={
                <Button secondary onClick={fechar}>
                  Fechar
                </Button>
              }
            >
              {l.tentativas.map((t) => (
                <section key={t.id} className="mb-5 grid gap-3">
                  <h3>
                    {t.tipo} · {dataBR(t.data)}
                  </h3>
                  {[
                    ...(t.primeiroDg ? [t.primeiroDg] : []),
                    ...t.posteriores,
                  ].map((e) => (
                    <div key={e.id}>
                      <LinkInterno
                        area="pecuaria"
                        href={`/pecuaria/sanidade?detalheTipo=exame&detalheId=${e.id}&propriedadeId=${propriedadeId}`}
                      >
                        {dataBR(e.data)} ·{" "}
                        {resultado[e.resultado ?? ""] ?? "Exame registrado"}
                      </LinkInterno>
                      {e.conduta && <p>Conduta: {e.conduta}</p>}
                      {e.retornoEm && <p>Retorno: {dataBR(e.retornoEm)}</p>}
                    </div>
                  ))}
                  {!t.primeiroDg && <p>Sem diagnóstico registrado.</p>}
                  {t.posterioresTotal > t.posteriores.length && (
                    <p>
                      Mostrando os primeiros {t.posteriores.length} de{" "}
                      {t.posterioresTotal} exames posteriores. Consulte a ficha
                      para o histórico completo.
                    </p>
                  )}
                </section>
              ))}
            </PainelCadastro>
          );
        })()}
    </section>
  );
}
function DiagnosticoResultado({
  linha,
  propriedadeId,
  onFechar,
  onSalvo,
}: {
  linha: LinhaResultadoProtocolo;
  propriedadeId: number;
  onFechar: () => void;
  onSalvo: () => void;
}) {
  const [painel, setPainel] = useState<PainelReprodutivo | null>(null),
    [erro, setErro] = useState<string | null>(null);
  useEffect(() => {
    let ativo = true;
    obterReproducao(linha.animal.id, propriedadeId)
      .then((p) => {
        if (ativo) setPainel(p);
      })
      .catch((e) => {
        if (ativo) setErro(e instanceof Error ? e.message : String(e));
      });
    return () => {
      ativo = false;
    };
  }, [linha.animal.id, propriedadeId]);
  if (painel)
    return (
      <FormReproducao
        acao="avaliacao"
        painel={painel}
        animalInicial={linha.animal.id}
        propriedadeId={propriedadeId}
        demandaInicial={linha.demandaDiagnostico ?? undefined}
        tipoExameInicial={linha.demandaDiagnostico?.tipoExameId ?? undefined}
        onFechar={onFechar}
        onSalvo={onSalvo}
      />
    );
  return (
    <PainelCadastro
      aberto
      titulo={`Diagnóstico · ${linha.animal.brinco}`}
      onFechar={onFechar}
      rodape={
        <Button secondary onClick={onFechar}>
          Fechar
        </Button>
      }
    >
      {erro ? (
        <ErrorBox erro={erro} />
      ) : (
        <p role="status">Carregando contexto do animal…</p>
      )}
    </PainelCadastro>
  );
}
function VinculoTentativaExterna({
  linha,
  propriedadeId,
  revogar,
  onFechar,
  onSalvo,
}: {
  linha: LinhaResultadoProtocolo;
  propriedadeId: number;
  revogar: boolean;
  onFechar: () => void;
  onSalvo: () => void;
}) {
  const [dados, setDados] = useState<{
      itens: {
        id: string;
        tipo: string;
        data: string;
        responsavel: string | null;
        revisao: string;
      }[];
      pagina: number;
      total: number;
      porPagina: number;
    } | null>(null),
    [pagina, setPagina] = useState(1),
    [selecionada, setTentativa] = useState<{
      id: string;
      revisao: string;
      tipo: string;
      data: string;
    } | null>(null),
    [motivo, setMotivo] = useState(""),
    [erro, setErro] = useState<string | null>(null),
    [ocupado, setOcupado] = useState(false);
  const chave = useRef(crypto.randomUUID()),
    trava = useRef(false);
  useEffect(() => {
    if (revogar) return;
    let ativo = true;
    setDados(null);
    reqProtocolo<NonNullable<typeof dados>>(
      `/participacoes/${linha.participacaoId}/tentativas-candidatas${consultaProtocolo({ pagina })}`,
      propriedadeId,
    )
      .then((d) => {
        if (ativo) setDados(d);
      })
      .catch((e) => {
        if (ativo) setErro(e instanceof Error ? e.message : String(e));
      });
    return () => {
      ativo = false;
    };
  }, [linha.participacaoId, propriedadeId, pagina, revogar]);
  async function salvar() {
    if (trava.current || (!revogar && !selecionada) || motivo.trim().length < 5)
      return;
    trava.current = true;
    setOcupado(true);
    setErro(null);
    try {
      await reqProtocolo(
        revogar
          ? `/vinculos-tentativa/${linha.vinculoExterno!.id}/revogacao`
          : `/participacoes/${linha.participacaoId}/tentativa-externa`,
        propriedadeId,
        {
          chave: chave.current,
          propriedadeId,
          motivo: motivo.trim(),
          ...(!revogar
            ? { tentativaId: selecionada!.id, revisao: selecionada!.revisao }
            : {}),
        },
      );
      onSalvo();
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      trava.current = false;
      setOcupado(false);
    }
  }
  return (
    <PainelCadastro
      aberto
      titulo={`${revogar ? "Rever vínculo factual" : "Vincular tentativa registrada"} · ${linha.animal.brinco}`}
      bloqueado={ocupado}
      onFechar={onFechar}
      rodape={
        <>
          <Button secondary disabled={ocupado} onClick={onFechar}>
            Cancelar
          </Button>
          <Button
            disabled={
              ocupado || (!revogar && !selecionada) || motivo.trim().length < 5
            }
            onClick={() => void salvar()}
          >
            {ocupado
              ? "Salvando…"
              : revogar
                ? "Revogar vínculo"
                : "Confirmar vínculo"}
          </Button>
        </>
      }
    >
      <ErrorBox erro={erro} />
      {revogar ? (
        <p>
          A tentativa, seus exames, consumo e custos permanecem. O vínculo ao
          protocolo será revogado com histórico. Acompanhamentos já criados
          conservam prazo e regra; cuidados pendentes precisam de atendimento,
          revisão ou dispensa própria.
        </p>
      ) : (
        <>
          <p>
            Escolha o fato realizado. O vínculo conserva a tentativa e seu custo
            único. Prazos já existentes permanecem; novos acompanhamentos usam
            os parâmetros adotados pela participação.
          </p>
          {!dados && !erro && (
            <p role="status">Consultando tentativas compatíveis…</p>
          )}
          {dados?.itens.map((t) => (
            <label className="my-3 flex items-center gap-3" key={t.id}>
              <input
                type="radio"
                name="tentativa-externa"
                value={t.id}
                checked={selecionada?.id === t.id}
                onChange={() => {
                  setTentativa(t);
                  chave.current = crypto.randomUUID();
                }}
              />
              <span>
                {t.tipo} · {dataBR(t.data)}
                {t.responsavel ? ` · ${t.responsavel}` : ""}
              </span>
            </label>
          ))}
          {dados && !dados.total && (
            <p>
              Nenhuma tentativa compatível disponível. Registre o serviço na
              ficha ou visita e retorne para vinculá-lo.
            </p>
          )}
          {dados && dados.total > dados.porPagina && (
            <Paginacao
              paginaAtual={dados.pagina}
              totalPaginas={Math.ceil(dados.total / dados.porPagina)}
              totalItens={dados.total}
              itensPorPagina={dados.porPagina}
              onPaginaChange={setPagina}
              rotulo="tentativas"
              idSelect="tentativas-externas-pagina"
            />
          )}
        </>
      )}
      {selecionada && (
        <p className="mt-3">
          Tentativa escolhida: {selecionada.tipo} · {dataBR(selecionada.data)}
        </p>
      )}
      <label className="mt-4 block">
        Justificativa
        <textarea
          required
          minLength={5}
          maxLength={1000}
          className={classeInput}
          value={motivo}
          onChange={(e) => {
            setMotivo(e.target.value);
            chave.current = crypto.randomUUID();
          }}
        />
      </label>
    </PainelCadastro>
  );
}
