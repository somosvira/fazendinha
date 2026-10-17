import {CirculoMarcosReprodutivos} from "./CirculoMarcosReprodutivos";
import {DemandasAcompanhamento,type DemandaAcompanhamento} from "./DemandasAcompanhamento";
import { CustosDiretos } from "../custos/CustosDiretos";
import { SubTabs } from "../../../components/SubTabs";
import { getPropriedadeAtiva } from "../../../propriedadeScope";
import { IndicadoresReprodutivos } from "./IndicadoresReprodutivos";
import { ConfiguracaoReprodutiva } from "./ConfiguracaoReprodutiva";
import { RelatorioPartos } from "./RelatorioPartos";
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
const ROTULOS: Record<string, string> = {
  VAZIA: "Vazia",
  GESTANTE: "Gestante",
  DESCONHECIDA: "Desconhecida",
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
  propriedadeId,
}: {
  animalId: string;
  propriedadeId?: number | null;
  podeLancar: boolean;
  recarregarToken?: number;
}) {
  return (
    <ConteudoReproducao
      animalId={animalId}
      podeLancar={podeLancar}
      recarregarToken={recarregarToken}
      propriedadeId={propriedadeId ?? null}
    />
  );
}
const ROTINAS = [
  { id: "ciclos", label: "Ciclos e manejo" },
  { id: "partos", label: "Partos e pós-parto" },
  { id: "indicadores", label: "Indicadores" },
  { id: "configuracao", label: "Política reprodutiva" },
] as const;
type Rotina = typeof ROTINAS[number]["id"];
function rotinaDaUrl(): Rotina {
  const valor = new URLSearchParams(window.location.search).get("rotina");
  return ROTINAS.find(r => r.id === valor)?.id ?? "ciclos";
}
export function Reproducao({ podeLancar }: { podeLancar: boolean }) {
  const [rotina, setRotina] = useState<Rotina>(rotinaDaUrl);
  const propriedadeId = getPropriedadeAtiva();
  useEffect(() => {
    const atualizar = () => setRotina(rotinaDaUrl());
    window.addEventListener("popstate", atualizar);
    return () => window.removeEventListener("popstate", atualizar);
  }, []);
  function selecionarRotina(valor: Rotina) {
    const url = new URL(window.location.href);
    url.searchParams.set("rotina", valor);
    navegarPara(url.pathname + url.search + url.hash);
  }
  function conteudoDaRotina() {
    if (rotina === "ciclos") return <ConteudoReproducao podeLancar={podeLancar} propriedadeId={propriedadeId} />;
    if (propriedadeId == null) {
      const consulta = rotina === "partos" ? "a ficha de partos e pós-parto"
        : rotina === "indicadores" ? "os indicadores reprodutivos" : "a política reprodutiva";
      return <Panel>
        <p className="p-5 text-sm" role="status">
          Selecione um sítio para consultar {consulta}. A visão consolidada permanece disponível em Ciclos e manejo.
        </p>
      </Panel>;
    }
    if (rotina === "partos") return <RelatorioPartos key={propriedadeId} propriedadeId={propriedadeId} podeLancar={podeLancar} />;
    if (rotina === "indicadores") return <IndicadoresReprodutivos key={propriedadeId} propriedadeId={propriedadeId} podeLancar={podeLancar} />;
    return <ConfiguracaoReprodutiva key={propriedadeId} propriedadeId={propriedadeId} podeLancar={podeLancar} />;
  }
  return (
    <PaginaFinanceira>
      <PageHeader
        eyebrow="Pecuária"
        titulo="Reprodução"
        descricao="Ciclos, partos e pós-parto, indicadores e regras de elegibilidade."
      />
      <SubTabs variant="financeiro" ariaLabel="Rotinas da reprodução" tabs={[...ROTINAS]}
        active={rotina} onSelect={selecionarRotina} />
      {conteudoDaRotina()}
    </PaginaFinanceira>
  );
}
function ConteudoReproducao({
  animalId,
  propriedadeId,
  podeLancar,
  recarregarToken = 0,
}: {
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
  const [acao, setAcao] = useState<AcaoReprodutiva | null>(() =>
    new URLSearchParams(window.location.search).get("acao") === "parto"
      ? "parto"
      : null,
  );
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
      setAcao(p.get("acao") === "parto" ? "parto" : null);
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
      {!animalId && painel && <AcompanhamentoReprodutivo atualizacao={painel} />}
      {!animalId && painel && (
        <Iatf
          onMudou={carregar}
          animais={painel.animais}
          propriedadeId={propriedadeId ?? undefined}
          painel={painel}
          podeLancar={podeLancar}
        />
      )}
      {!animalId && (
        <>
          <Exposicoes podeLancar={podeLancar} />
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
