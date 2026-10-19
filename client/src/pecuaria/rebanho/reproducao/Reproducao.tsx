import "./reproducao-v4.css";
import { ReproducaoIndividual } from "./ReproducaoIndividual";
import { ManejoReprodutivo } from "./ManejoReprodutivo";
import { navegarConsultaComSitio, urlConsultaComSitio } from "./contexto-consulta";
import {CirculoMarcosReprodutivos} from "./CirculoMarcosReprodutivos";
import {DemandasAcompanhamento,type DemandaAcompanhamento} from "./DemandasAcompanhamento";
import { CustosDiretos } from "../custos/CustosDiretos";
import { SubTabs } from "../../../components/SubTabs";
import { getPropriedadeAtiva } from "../../../propriedadeScope";
import { IndicadoresReprodutivos } from "./IndicadoresReprodutivos";
import { ConsultaPorSitio } from "./ConsultaPorSitio";
import { DetalheParto } from "./DetalheParto";
import { PartosPosParto } from "./PartosPosParto";
import { ElegibilidadeAnimal } from "./ElegibilidadeAnimal";
import { AcompanhamentoReprodutivo } from "./AcompanhamentoReprodutivo";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Button,
  CabecalhoTabela,
  ErrorBox,
  PageHeader,
  PaginaFinanceira,
  Panel,
  Pill,
  TabelaFinanceira,
} from "../../../financeiro/financeiro-ui";
import { classeInput } from "../../../financeiro/PainelCadastro";
import { navegarPara } from "../../../router";
import {
  obterReproducao,
  type FatoReprodutivo,
  type PainelReprodutivo,
} from "./api";
import { FormReproducao, type AcaoReprodutiva } from "./FormReproducao";

import { Exposicoes } from "./Exposicoes";
import { Iatf } from "./Iatf";
import { DetalheFato } from "./DetalheFato";
import { AcoesReprodutivas } from "./AcoesReprodutivas";
function acaoDaUrl(): AcaoReprodutiva | null {
  const acao = new URLSearchParams(window.location.search).get("acao");
  return ["avaliacao", "tentativa", "parto", "situacao", "restricao"].includes(acao ?? "") ? acao as AcaoReprodutiva : null;
}
const ROTULOS: Record<string, string> = {
  VAZIA: "Vazia",
  GESTANTE: "Gestante",
  DESCONHECIDA: "Desconhecida",
  AGUARDANDO_DIAGNOSTICO: "Aguardando diagnóstico",
  POSITIVO: "Positivo",
  RECONFIRMACAO: "Reconfirmada",
  SEXAGEM: "Sexagem",
  NEGATIVO: "Negativo",
  NAO_AVALIADO: "Não avaliado",
  INCONCLUSIVO: "Inconclusivo",
};
export function ReproducaoAnimal({
  animalId,
  podeLancar,
  recarregarToken = 0,
  onSituacao,
  propriedadeId,
}: {
  animalId: string;
  propriedadeId?: number | null;
  podeLancar: boolean;
  recarregarToken?: number;
  onSituacao?: (situacao: string | null) => void;
}) {
  return (
    <ReproducaoIndividual
      onSituacao={onSituacao}
      animalId={animalId}
      podeLancar={podeLancar}
      recarregarToken={recarregarToken}
      propriedadeId={propriedadeId ?? null}
    />
  );
}
const ROTINAS = [
  { id: "ciclos", label: "Animais e acompanhamentos" },
  { id: "agenda", label: "Agenda" },
  { id: "programacoes", label: "Programações" },
  { id: "partos", label: "Partos e pós-parto" },
  { id: "indicadores", label: "Indicadores" },
] as const;
type Rotina = typeof ROTINAS[number]["id"];
function rotinaDaUrl(): Rotina {
  const valor = new URLSearchParams(window.location.search).get("rotina");
  return ROTINAS.find(r => r.id === valor)?.id ?? (new URLSearchParams(window.location.search).has("programacaoId") ? "programacoes" : "ciclos");
}
export function Reproducao({ podeLancar }: { podeLancar: boolean }) {
  const [caminho,setCaminho]=useState(window.location.pathname);
  const [rotina, setRotina] = useState<Rotina>(rotinaDaUrl);
  const propriedadeId = getPropriedadeAtiva();
  const [consultaUrl, setConsultaUrl] = useState(window.location.search);
  useEffect(() => {
    const atualizar = () => { setCaminho(window.location.pathname); setRotina(rotinaDaUrl()); setConsultaUrl(window.location.search); };
    window.addEventListener("popstate", atualizar);
    return () => window.removeEventListener("popstate", atualizar);
  }, []);
  useEffect(()=>{const p=new URLSearchParams(window.location.search),id=p.get("programacaoId");if(caminho==="/pecuaria/reproducao"&&id&&(!p.get("rotina")||p.get("rotina")==="programacoes")){p.delete("programacaoId");if(!p.has("retorno"))p.set("retorno",`/pecuaria/reproducao?${p}${window.location.hash}`);navegarPara(`/pecuaria/reproducao/programacoes/${encodeURIComponent(id)}?${p}${window.location.hash}`);}},[caminho,consultaUrl]);
  function selecionarRotina(valor: Rotina) {
    const url = new URL(window.location.href);
    url.searchParams.set("rotina", valor);
    navegarPara(url.pathname + url.search + url.hash);
  }
  function conteudoDaRotina() {
    const parametros = new URLSearchParams(consultaUrl);
    const historico = parametros.get("visao") === "historico" || ["animalId", "fatoId", "tentativaId", "acao"].some(chave => parametros.has(chave));
    // Deep links históricos continuam acessíveis inclusive no consolidado.
    if (rotina === "ciclos" && historico) return <>
      <Button secondary onClick={() => {
        const url = new URL(window.location.href);
        ["visao", "animalId", "fatoId", "tentativaId", "acao"].forEach(chave => url.searchParams.delete(chave));
        navegarPara(url.pathname + url.search);
      }}>Voltar às filas de manejo</Button>
      <ConteudoReproducao podeLancar={podeLancar} propriedadeId={propriedadeId ?? (Number(parametros.get("sitio")) || null)}/>
    </>;
    return <ConsultaPorSitio>{sitioId => <div key={`${sitioId}:${rotina}`} className="space-y-5">
      {rotina === "partos" ? <PartosPosParto propriedadeId={sitioId}/>
        : rotina === "indicadores" ? <IndicadoresReprodutivos propriedadeId={sitioId} podeLancar={podeLancar} modo="painel"/>
        : rotina === "agenda" ? <AcompanhamentoReprodutivo atualizacao={sitioId} propriedadeId={sitioId} podeLancar={podeLancar}/>
        : rotina === "programacoes" ? <ConteudoReproducao propriedadeId={sitioId} podeLancar={podeLancar} secao="programacoes"/>
        : <ManejoReprodutivo propriedadeId={sitioId} podeLancar={podeLancar}
            onConsultarHistorico={() => navegarConsultaComSitio("/pecuaria/reproducao?rotina=ciclos&visao=historico", sitioId)}
            onRegistrarEvento={() => navegarConsultaComSitio("/pecuaria/reproducao?rotina=ciclos&visao=historico&acao=avaliacao", sitioId)}/>
      }
    </div>}</ConsultaPorSitio>;
  }
  const detalheRota = caminho.match(/^\/pecuaria\/reproducao\/(programacoes|partos)\/([^/]+)\/?$/);
  if(detalheRota) {
    const [,tipo,id]=detalheRota;
    const voltar=()=>{const retorno=new URLSearchParams(window.location.search).get("retorno");navegarPara(retorno?.startsWith("/pecuaria/")?retorno:urlConsultaComSitio(`/pecuaria/reproducao?rotina=${tipo==="partos"?"partos":"programacoes"}`));};
    return <PaginaFinanceira><PageHeader eyebrow="Pecuária" titulo={tipo==="partos"?"Parto e pós-parto":"Programação IATF"} acao={<Button secondary onClick={voltar}>Voltar à lista</Button>}/><ConsultaPorSitio>{sitioId=><div key={`${tipo}:${id}:${sitioId}`} className="mt-5">{tipo==="partos"?<DetalheParto id={id} propriedadeId={sitioId} podeLancar={podeLancar}/>:<ConteudoReproducao secao="programacoes" programacaoId={id} propriedadeId={sitioId} podeLancar={podeLancar} onFecharDetalhe={voltar}/>}</div>}</ConsultaPorSitio></PaginaFinanceira>;
  }
  return (
    <PaginaFinanceira>
    <div className={`reproducao-v4 ${rotina === "indicadores" ? "reproducao-v4-indicadores" : ""}`}>
      {rotina !== "indicadores" && <PageHeader
        eyebrow="Pecuária"
        titulo="Reprodução"
        descricao="Organize o manejo e acompanhe a reprodução do rebanho."
      />}
      {rotina !== "indicadores" && <SubTabs variant="financeiro" ariaLabel="Rotinas da reprodução" tabs={[...ROTINAS]}
        active={rotina} onSelect={selecionarRotina} />}

      {conteudoDaRotina()}
      {rotina === "indicadores" && <div className="mt-6"><SubTabs variant="financeiro" ariaLabel="Rotinas da reprodução" tabs={[...ROTINAS]}
        active={rotina} onSelect={selecionarRotina} /></div>}
      <div className="mt-5 border-t border-border pt-4 flex flex-wrap gap-4 text-sm"><a className="font-semibold underline" href={urlConsultaComSitio("/pecuaria/relatorios")} onClick={e => { if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) { e.preventDefault(); navegarConsultaComSitio("/pecuaria/relatorios"); } }}>Relatórios da Pecuária</a><a className="underline" href={urlConsultaComSitio("/configuracoes/pecuaria/reproducao/politica")} onClick={e => { if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) { e.preventDefault(); navegarConsultaComSitio("/configuracoes/pecuaria/reproducao/politica"); } }}>Política reprodutiva</a></div>
    </div>
    </PaginaFinanceira>
  );
}
function ConteudoReproducao({
  secao = "historico",
  animalId,
  propriedadeId,
  podeLancar,
  recarregarToken = 0,
  programacaoId,
  onFecharDetalhe,
}: {
  secao?: "historico" | "programacoes";
  programacaoId?: string;
  onFecharDetalhe?: () => void;
  animalId?: string;
  propriedadeId?: number | null;
  podeLancar: boolean;
  recarregarToken?: number;
}) {
  const [demandaAvaliada,setDemandaAvaliada]=useState<DemandaAcompanhamento|null>(null);
  const [fatoAberto, setFatoAberto] = useState<
    (FatoReprodutivo & { grupo: string }) | null
  >(null);
  const [painel, setPainel] = useState<PainelReprodutivo | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [acao, setAcao] = useState<AcaoReprodutiva | null>(acaoDaUrl);
  const [animalAcao, setAnimalAcao] = useState<string | undefined>(animalId);
  const [q, setQ] = useState(() =>
    animalId
      ? ""
      : (new URLSearchParams(window.location.search).get("q") ?? ""),
  );
  const [situacao, setSituacao] = useState(
    () => new URLSearchParams(window.location.search).get("situacao") ?? "",
  );
  const [consultaUrl, setConsultaUrl] = useState(window.location.search);
  const consultaAtual = useRef(0);
  const carregar = useCallback(async () => {
    const sequencia = ++consultaAtual.current;
    setCarregando(true);
    setErro(null);
    try {
      const animalConsultado = animalId ?? new URLSearchParams(consultaUrl).get("animalId") ?? undefined;
      const resultado = propriedadeId
        ? await obterReproducao(animalConsultado, propriedadeId)
        : await obterReproducao(animalConsultado);
      if (sequencia === consultaAtual.current) setPainel(resultado);
    } catch (e) {
      if (sequencia === consultaAtual.current) setErro(e instanceof Error ? e.message : String(e));
    } finally {
      if (sequencia === consultaAtual.current) setCarregando(false);
    }
  }, [animalId, consultaUrl, propriedadeId]);
  useEffect(() => {
    void carregar();
  }, [carregar, recarregarToken]);
  useEffect(() => {
    if (animalId) return;
    const pop = () => {
      const p = new URLSearchParams(window.location.search);
      setConsultaUrl(window.location.search);
      setAnimalAcao(p.get("animalId") ?? undefined);
      setAcao(acaoDaUrl());
      setQ(p.get("q") ?? "");
      setSituacao(p.get("situacao") ?? "");
    };
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, [animalId]);
  const filtro = (chave: string, valor: string) => {
    const url = new URL(window.location.href);
    valor ? url.searchParams.set(chave, valor) : url.searchParams.delete(chave);
    window.history.replaceState(
      window.history.state,
      "",
      url.pathname + url.search + url.hash,
    );
    if (chave === "q") setQ(valor);
    else setSituacao(valor);
  };
  const fecharFormulario=()=>{setAcao(null);setDemandaAvaliada(null);const url=new URL(window.location.href);url.searchParams.delete("acao");window.history.replaceState(window.history.state,"",url.pathname+url.search+url.hash);};
  const abrir = (tipo: AcaoReprodutiva, id = animalId) => {
    setAnimalAcao(id);
    setAcao(tipo);
  };
  const animais = (painel?.animais ?? []).filter(
    (a) =>
      (!animalId || a.animalId === animalId) &&
      (!situacao || a.situacao === situacao) &&
      `${a.brinco} ${a.nome ?? ""}`.toLowerCase().includes(q.toLowerCase()),
  );
  const fatos: Array<FatoReprodutivo & { grupo: string }> = painel
    ? [
        ...(painel.gestacoes??[]).filter(g=>g.animalId&&g.encerradaEm).map(g=>({...g,animalId:g.animalId!,data:g.encerradaEm!,tipo:g.tipoEncerramento??"NAO_IDENTIFICADO",motivo:g.motivoEncerramento,grupo:"Gestação"})),
        ...painel.tentativas.map((t) => ({ ...t, grupo: "Tentativa" })),
        ...painel.avaliacoes.map((a) => ({ ...a, grupo: "Avaliação" })),
        ...painel.partos.map((p) => ({ ...p, grupo: "Parto" })),
        ...(painel.situacoesIniciais ?? []).map((p) => ({
          ...p,
          tipo: p.situacao,
          grupo: "Situação inicial",
        })),
        ...painel.restricoes.map((r) => ({
          ...r,
          data: r.data ?? "",
          grupo: "Restrição",
        })),
      ].sort((a, b) => b.data.localeCompare(a.data))
    : [];
  useEffect(() => {
    const id = new URLSearchParams(consultaUrl).get("fatoId");
    if (id && painel) setFatoAberto(fatos.find(f => f.id === id||f.exame?.id===id) ?? null);
  }, [painel, consultaUrl]);
  if (secao === "programacoes") return <div className="space-y-5">
    <ErrorBox erro={erro}/>
    {erro && <Button secondary onClick={() => void carregar()}>Tentar novamente</Button>}
    {carregando && <p role="status">Carregando programações…</p>}
    {!carregando && painel && <Iatf programacaoId={programacaoId} onFecharDetalhe={onFecharDetalhe} onMudou={carregar} animais={painel.animais} propriedadeId={propriedadeId ?? undefined} painel={painel} podeLancar={podeLancar} onAbrirProgramacao={id=>navegarPara(urlConsultaComSitio(`/pecuaria/reproducao/programacoes/${id}?retorno=${encodeURIComponent(window.location.pathname+window.location.search)}`,propriedadeId??undefined))}/>}
  </div>;
  return (
    <div className="space-y-5">
      <ErrorBox erro={erro} />
      {erro && (
        <Button secondary onClick={() => void carregar()}>
          Tentar novamente
        </Button>
      )}
      <Panel>
        <CabecalhoTabela
          titulo={animalId ? "Situação reprodutiva" : "Animais e ciclos"}
          acao={
            podeLancar && (
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ["avaliacao", "Avaliar"],
                    ["tentativa", "Tentativa"],
                    ["parto", "Parto"],
                    ["situacao", "Situação inicial"],
                    ["restricao", "Restrição"],
                  ] as [AcaoReprodutiva, string][]
                ).map(([a, r]) => (
                  <Button
                    secondary
                    key={a}
                    disabled={!painel || carregando}
                    onClick={() => abrir(a)}
                  >
                    {r}
                  </Button>
                ))}
              </div>
            )
          }
        />
        {!animalId && (
          <div className="flex flex-wrap gap-3 p-4 border-b border-border">
            <label className="flex-1 text-sm">
              Buscar animal
              <input
                aria-label="Buscar animal"
                className={classeInput}
                value={q}
                onChange={(e) => filtro("q", e.target.value)}
              />
            </label>
            <label className="text-sm">
              Situação
              <select
                aria-label="Filtrar situação reprodutiva"
                className={classeInput}
                value={situacao}
                onChange={(e) => filtro("situacao", e.target.value)}
              >
                <option value="">Todas</option>
                {Array.from(
                  new Set((painel?.animais ?? []).map((a) => a.situacao)),
                ).map((s) => (
                  <option key={s} value={s}>
                    {ROTULOS[s] ?? s}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
        {carregando && (
          <p role="status" className="p-4">
            Carregando reprodução…
          </p>
        )}
        {!carregando && painel && (
          <TabelaFinanceira
            rotulo="Animais e ciclos reprodutivos"
            itens={animais}
            chaveDe={(a) => a.animalId}
            colunas={[
              {
                chave: "animal",
                titulo: "Animal",
                principal: true,
                celula: (a) => (
                  <button
                    className="font-semibold text-mast"
                    onClick={() =>
                      navegarPara(
                        `/pecuaria/rebanho/animais/${a.animalId}#reproducao`,
                      )
                    }
                  >
                    {a.brinco} {a.nome ?? ""}
                  </button>
                ),
              },
              {
                chave: "situacao",
                titulo: "Situação",
                celula: (a) => <Pill>{ROTULOS[a.situacao] ?? a.situacao}</Pill>,
              },
              {
                chave: "ciclo",
                titulo: "Ciclo",
                celula: (a) =>
                  `${a.partos} partos · ${a.tentativasCiclo} tentativas`,
              },
              {
                chave: "gestacao",
                titulo: "Gestação",
                celula: (a) =>
                  a.gestacao
                    ? `${a.gestacao.sexoFetal ?? "Sexo pendente"} · ${a.gestacao.previsaoParto?.slice(0, 10) ?? "Previsão pendente"}`
                    : "Sem gestação confirmada",
              },
              {
                chave: "restricoes",
                titulo: "Restrições",
                celula: (a) =>
                  a.restricoes.length
                    ? a.restricoes.map((r) => r.motivo).join("; ")
                    : "Nenhuma",
              },
              {
                chave: "acao",
                titulo: "",
                acoes: true,
                celula: (a) =>
                  podeLancar && (
                    <Button
                      secondary
                      onClick={() => abrir("avaliacao", a.animalId)}
                    >
                      Avaliar
                    </Button>
                  ),
              },
            ]}
          />
        )}
      </Panel>
      {painel && (
        <Panel>
          <CabecalhoTabela titulo="Histórico reprodutivo" />
          <TabelaFinanceira
            rotulo="Histórico reprodutivo"
            onAbrir={(f) => setFatoAberto(f)}
            itens={fatos.filter((f) => !animalId || f.animalId === animalId)}
            chaveDe={(f) => `${f.grupo}-${f.id}`}
            classeLinha={(f) =>
              new URLSearchParams(window.location.search).get("tentativaId") ===
              f.id
                ? "bg-surface-2"
                : ""
            }
            colunas={[
              {
                chave: "data",
                titulo: "Data",
                principal: true,
                celula: (f) =>
                  f.data.slice(0, 10).split("-").reverse().join("/"),
              },
              {
                chave: "animal",
                titulo: "Animal",
                celula: (f) =>
                  painel.animais.find((a) => a.animalId === f.animalId)
                    ?.brinco ?? "Animal",
              },
              {
                chave: "grupo",
                titulo: "Evento",
                celula: (f) =>
                  `${f.grupo} · ${ROTULOS[f.resultado ?? ""] ?? f.resultado ?? f.tipo ?? ""}`,
              },
              {
                chave: "observacao",
                titulo: "Registro",
                celula: (f) =>
                  f.motivo ??
                  f.anotacaoOriginal ??
                  (f.crias ? `${f.crias.length} crias` : "—"),
              },
            ]}
          />
        </Panel>
      )}
      {animalId && painel && propriedadeId != null && <CustosDiretos key={`${animalId}:${recarregarToken}`} animalId={animalId} propriedadeId={propriedadeId} podeLancar={podeLancar} />}
      {animalId&&painel?.marcos&&<CirculoMarcosReprodutivos {...painel.marcos} estado={ROTULOS[painel.marcos.estado]??painel.marcos.estado}/>}
      {animalId&&painel&&propriedadeId!=null&&<DemandasAcompanhamento animalId={animalId} propriedadeId={propriedadeId} painel={painel} podeLancar={podeLancar} onAvaliar={d=>{setDemandaAvaliada(d);abrir("avaliacao",animalId);}} atualizacao={recarregarToken}/>}
      {animalId && painel && (propriedadeId != null ? <ElegibilidadeAnimal
        animalId={animalId} propriedadeId={propriedadeId} painel={painel} podeLancar={podeLancar} onMudou={() => void carregar()} />
        : <p className="text-sm">A elegibilidade exige o sítio comprovado do animal. Confira seu histórico de localização.</p>)}
      {painel && (
        <AcoesReprodutivas
          painel={painel}
          animalId={animalId}
          propriedadeId={propriedadeId ?? undefined}
          podeLancar={podeLancar}
          onMudou={carregar}
        />
      )}
      {fatoAberto && (
        <DetalheFato
          podeLancar={podeLancar}
          onMudou={() => {
            setFatoAberto(null);
            void carregar();
          }}
          fato={fatoAberto}
          onFechar={() => setFatoAberto(null)}
        />
      )}

      {!animalId && (
        <>
          <Exposicoes podeLancar={podeLancar} propriedadeId={propriedadeId ?? undefined} />
          <a className="text-sm underline" href="/configuracoes/pecuaria/reproducao/regras-sanitarias">Gerenciar regras sanitárias da reprodução</a>
        </>
      )}
      {acao && painel && (
        <FormReproducao
          acao={acao}
          painel={painel}
          animalInicial={animalAcao}
          demandaInicial={demandaAvaliada??undefined}
          finalidadeInicial={demandaAvaliada?.finalidade}
          tipoExameInicial={demandaAvaliada?.regraSnapshot.tipoExameId??undefined}
          propriedadeId={propriedadeId ?? undefined}
          onFechar={fecharFormulario}
          onSalvo={() => {
            fecharFormulario();
            void carregar();
          }}
        />
      )}
    </div>
  );
}
