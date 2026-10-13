import { FormAtividade } from "./FormAtividadeVisita";
import { Transcricao } from "./TranscricaoVisita";
import { useCallback, useEffect, useState } from "react";
import {
  Button,
  CabecalhoTabela,
  ErrorBox,
  hoje,
  PageHeader,
  PaginaFinanceira,
  Panel,
  Pill,
} from "../../../financeiro/financeiro-ui";
import {
  CampoFormulario,
  classeInput,
  PainelCadastro,
} from "../../../financeiro/PainelCadastro";
import { getPropriedadeAtiva } from "../../../propriedadeScope";
import { navegarPara } from "../../../router";
import { reqV4 } from "./api";
import {
  criarVisita,
  listarVisitas,
  obterVisita,
  type AtividadeVisita,
  type Visita,
} from "./visitas-api";
import { ordenarParticipantes, motivosParticipante } from "./visitas-regras";
export function Visitas({ podeLancar }: { podeLancar: boolean }) {
  const [lista, setLista] = useState<Visita[]>([]);
  const [visita, setVisita] = useState<Visita | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [novo, setNovo] = useState(false);
  const [atividade, setAtividade] = useState(false);
  const [data, setData] = useState(hoje());
  const [nome, setNome] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [id, setId] = useState(
    () =>
      /^\/pecuaria\/visitas\/([^/]+)$/.exec(window.location.pathname)?.[1] ??
      null,
  );
  const [impressao, setImpressao] = useState<{ atividades: AtividadeVisita[]; nome?: string; data?: string } | null>(null);
  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      if (id) setVisita(await obterVisita(id));
      else {
        setLista(await listarVisitas());
        setVisita(null);
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setCarregando(false);
    }
  }, [id]);
  useEffect(() => {
    void carregar();
  }, [carregar]);
  useEffect(() => {
    const pop = () =>
      setId(
        /^\/pecuaria\/visitas\/([^/]+)$/.exec(window.location.pathname)?.[1] ??
          null,
      );
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, []);
  const executar = async (acao: () => Promise<void>) => {
    setOcupado(true);
    setErro(null);
    try {
      await acao();
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setOcupado(false);
    }
  };
  const prop = () => {
    const p = visita?.propriedadeId ?? getPropriedadeAtiva();
    if (!p) throw new Error("Selecione um sítio para trabalhar com a visita.");
    return p;
  };
  async function imprimir() {
    await executar(async () => {
      const registro = await reqV4<{
        snapshot: { atividades: AtividadeVisita[]; nome?: string; data?: string };
      }>(`/visitas/${id}/impressoes`, { propriedadeId: prop() });
      setImpressao(registro.snapshot);
    });
  }
  useEffect(() => {
    if (impressao) requestAnimationFrame(() => window.print());
  }, [impressao]);
  return (
    <PaginaFinanceira>
      <div className="print:hidden">
        <PageHeader
          eyebrow="Pecuária"
          titulo={visita?.nome ?? "Visitas veterinárias"}
          descricao={
            visita
              ? `${visita.data.slice(0, 10).split("-").reverse().join("/")} · ${visita.status}`
              : "Prepare a lista, imprima e transcreva os atendimentos na mesma ordem."
          }
          acao={
            podeLancar &&
            !visita && (
              <Button
                onClick={() => {
                  setNovo(true);
                  setNome("");
                }}
              >
                Nova visita
              </Button>
            )
          }
        />
        <ErrorBox erro={erro} />
        {erro && (
          <Button secondary onClick={() => void carregar()}>
            Tentar novamente
          </Button>
        )}
        {carregando && <p role="status">Carregando visitas…</p>}
        {visita ? (
          <>
            <div className="my-4 flex flex-wrap gap-2">
              <Button
                secondary
                onClick={() => navegarPara("/pecuaria/visitas")}
              >
                Voltar às visitas
              </Button>
              {podeLancar && visita.status !== "ENCERRADA" && (
                <Button onClick={() => setAtividade(true)}>
                  + Adicionar atividade
                </Button>
              )}
              {podeLancar && (
                <Button
                  secondary
                  disabled={ocupado}
                  onClick={() => void imprimir()}
                >
                  Gerar lista para impressão
                </Button>
              )}
              {podeLancar && visita.status !== "ENCERRADA" && (
                <Button
                  secondary
                  disabled={ocupado}
                  onClick={() =>
                    void executar(async () => {
                      await reqV4(`/visitas/${visita.id}/encerramento`, {
                        propriedadeId: prop(),
                      });
                      await carregar();
                    })
                  }
                >
                  Encerrar visita
                </Button>
              )}
            </div>
            {visita.atividades.length === 0 && (
              <Panel>
                <p className="p-5 text-sm">
                  Adicione a primeira atividade da visita.
                </p>
              </Panel>
            )}
            {visita.atividades.map((a) => (
              <Transcricao
                key={a.id}
                visita={visita}
                atividade={a}
                podeLancar={podeLancar && visita.status !== "ENCERRADA"}
                podeRegularizar={podeLancar}
                onMudou={carregar}
              />
            ))}
            <Panel className="mt-5">
              <CabecalhoTabela titulo="Listas de impressão preservadas" />
              <div className="p-4 space-y-2">
                {visita.impressoes.map((i) => (
                  <Button
                    secondary
                    key={i.id}
                    onClick={() => setImpressao({ ...i.snapshot, atividades: i.snapshot.atividades ?? [] })}
                  >
                    Reimprimir lista{" "}
                    {i.criadoEm?.slice(0, 10) ?? i.id.slice(0, 8)}
                  </Button>
                ))}
                {!visita.impressoes.length && (
                  <p className="text-sm text-ink-3">Nenhuma lista gerada.</p>
                )}
              </div>
            </Panel>
          </>
        ) : (
          <Panel>
            <CabecalhoTabela titulo="Visitas" />
            <div className="divide-y divide-border">
              {lista.map((v) => (
                <button
                  className="w-full text-left p-4 flex justify-between gap-3 hover:bg-surface-2"
                  key={v.id}
                  onClick={() => navegarPara(`/pecuaria/visitas/${v.id}`)}
                >
                  <span>
                    {v.nome} · {v.data.slice(0, 10)}
                  </span>
                  <Pill>{v.status}</Pill>
                </button>
              ))}
              {!carregando && !lista.length && (
                <p className="p-5 text-sm text-ink-3">
                  Nenhuma visita neste sítio.
                </p>
              )}
            </div>
          </Panel>
        )}
        {novo && (
          <PainelCadastro
            aberto
            titulo="Nova visita veterinária"
            onFechar={() => setNovo(false)}
            bloqueado={ocupado}
            rodape={
              <>
                <Button secondary onClick={() => setNovo(false)}>
                  Cancelar
                </Button>
                <Button form="nova-visita" type="submit" disabled={ocupado}>
                  Criar visita
                </Button>
              </>
            }
          >
            <form
              id="nova-visita"
              className="grid gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                void executar(async () => {
                  const v = await criarVisita({
                    propriedadeId: prop(),
                    data,
                    nome,
                    responsavel: responsavel || undefined,
                  });
                  setNovo(false);
                  navegarPara(`/pecuaria/visitas/${v.id}`);
                });
              }}
            >
              <ErrorBox erro={erro} />
              <CampoFormulario id="vis-nome" rotulo="Nome" obrigatorio>
                {(p) => (
                  <input
                    {...p}
                    required
                    className={classeInput}
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                  />
                )}
              </CampoFormulario>
              <CampoFormulario id="vis-data" rotulo="Data" obrigatorio>
                {(p) => (
                  <input
                    {...p}
                    type="date"
                    required
                    className={classeInput}
                    value={data}
                    onChange={(e) => setData(e.target.value)}
                  />
                )}
              </CampoFormulario>
              <CampoFormulario id="vis-responsavel" rotulo="Responsável">
                {(p) => (
                  <input
                    {...p}
                    className={classeInput}
                    value={responsavel}
                    onChange={(e) => setResponsavel(e.target.value)}
                  />
                )}
              </CampoFormulario>
            </form>
          </PainelCadastro>
        )}
        {atividade && visita && (
          <FormAtividade
            visita={visita}
            onFechar={() => setAtividade(false)}
            onSalvo={() => {
              setAtividade(false);
              void carregar();
            }}
          />
        )}
      </div>
      {impressao && (
        <div className="hidden print:block">
          <h1>
            {impressao.nome ?? "Visita veterinária — cabeçalho não preservado"} · {impressao.data?.slice(0, 10) ?? "Data não preservada"}
          </h1>
          {impressao.atividades.map((a) => (
            <section key={a.id}>
              <h2 className="mt-6 mb-3">{a.nome}{a.extra ? " · Atividade extra" : ""}</h2>
              <p className="text-xs mb-3">Data de referência: {impressao.data?.slice(0,10) ?? "não preservada"} · Critérios de preparação: {criteriosImpressao({...(a.contexto?.criterios as object ?? {}), ...(a.contexto?.apresentacao as object ?? {})})}</p>
              <table className="w-full border-collapse text-sm">
                <thead className="table-header-group">
                  <tr>
                    <th>Ordem</th>
                    <th>Animal</th>
                    <th>Lote / motivos</th>
                    <th>Tentativa / touro / último parto</th>
                    <th>Resultado / conduta / anotações</th>
                  </tr>
                </thead>
                <tbody>
                  {ordenarParticipantes(a.participantes).map((p) => (
                    <tr key={p.id} className="break-inside-avoid">
                      <td className="border p-3">{p.ordem}</td>
                      <td className="border p-3">
                        {p.snapshot.brinco ?? p.animalId} {p.snapshot.nome}
                      </td>
                      <td className="border p-3">
                        <p>{p.snapshot.lote?.nome ?? "Lote não informado"}</p>
                        {motivosParticipante(p).join("; ")}
                      </td>
                      <td className="border p-3 text-xs">
                        <p>{p.snapshot.tentativa ? `${p.snapshot.tentativa.tipo} · ${p.snapshot.tentativa.data.slice(0,10)}` : "Tentativa não comprovada"}</p>
                        <p>Touro: {p.snapshot.tentativa?.geneticaSnapshot?.pai?.nome ?? "não informado"}</p>
                        <p>Último parto: {p.snapshot.ultimoParto?.data.slice(0,10) ?? "não informado"}</p>
                      </td>
                      <td className="border p-3 h-16" />
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))}
        </div>
      )}
    </PaginaFinanceira>
  );
}

function criteriosImpressao(valor: unknown): string {
  if (!valor || typeof valor !== "object") return "Não preservados";
  const c = valor as Record<string, unknown>;
  const partes: string[] = [];
  for (const [campo, nome] of [["categoriaNome", "Categoria"], ["loteNome", "Lote"], ["situacao", "Situação"], ["busca", "Busca"]]) if (c[campo]) partes.push(`${nome}: ${c[campo]}`);
  for (const [campo, nome] of [["diasTentativa", "tentativa"], ["diasParto", "último parto"], ["diasGestacao", "confirmação da gestação"]]) {
    const min = c[campo+"Min"], max = c[campo+"Max"];
    if (min != null || max != null) partes.push(`Dias desde ${nome}: ${min ?? "sem mínimo"} a ${max ?? "sem máximo"}`);
  }
  if (Array.isArray(c.motivos) && c.motivos.length) partes.push(`Motivos: ${c.motivos.join("; ")}`);
  return partes.join(" · ") || "Sem filtros adicionais";
}
