import { SelectCampo } from "../../../financeiro/SelectCampo";
import { BarraConsulta } from "../../../financeiro/BarraConsulta";
import { CampoFiltro } from "../../../financeiro/PainelFiltros";
import { useRascunhoConsulta } from "../../../financeiro/useRascunhoConsulta";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader, TabelaFinanceira, Paginacao } from "../../../financeiro/financeiro-ui";
import { Button } from "@/components/ui/button";
import { DialogConsultaLeite as SecaoDetalhesLeite } from "./DialogConsultaLeite";
import { useEffect, useRef, useState } from "react";
import { listarProdutos, type ProdutoDTO } from "../../../estoque/api";
import { getPropriedadeAtiva } from "../../../propriedadeScope";
import { consultarLeite, registrarLeite } from "./operacoes-api";
import { dataValida, formatarLitros, hojeOperacional } from "./modelo";
import {
  nomeNaturezaDestino,
  somarParcelasDestino,
  type NaturezaDestinoLeite,
  type OrigemDestinoLeite,
  type DestinoLeiteDTO,
  type CandidatosDestinos,
  type CandidatoDestinoLeite,
  type ParcelaDestinoDraft,
} from "./destinos-types";
import "./operacoes.css";
interface HistoricoDestinos {
  itens: DestinoLeiteDTO[];
  total: number;
  pagina: number;
  porPagina: number;
}
interface RascunhoDestino {
  propriedadeId: number | null;
  produto: string;
  origem: OrigemDestinoLeite | null;
  natureza: NaturezaDestinoLeite;
  parcelas: ParcelaDestinoDraft[];
  declaracao: string;
  responsavel: string;
  observacao: string;
}
const novoRascunho = (): RascunhoDestino => ({
  propriedadeId: null,
  produto: "",
  origem: null,
  natureza: "LEITE_COMUM",
  parcelas: [],
  declaracao: "",
  responsavel: "",
  observacao: "",
});
const dataPt = (data: string) =>
  data.slice(0, 10).split("-").reverse().join("/");
export function DestinosLeite({ podeLancar }: { podeLancar: boolean }) {
  const sitio = getPropriedadeAtiva();
  const [novo, setNovo] = useState(false);
  const [data, setData] = useState(hojeOperacional);
  const [historico, setHistorico] = useState<HistoricoDestinos | null>(null);
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [pagina, setPagina] = useState(1);
  const filtros = useRascunhoConsulta({ de, ate }, { de: "", ate: "" }, v => { setDe(v.de); setAte(v.ate); setPagina(1); });
  const [revisao, setRevisao] = useState(0);
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState("");
  const [estorno, setEstorno] = useState<DestinoLeiteDTO | null>(null);
  const [motivo, setMotivo] = useState("");
  const [estornando, setEstornando] = useState(false);
  const geracao = useRef(0);
  useEffect(() => {
    const atual = ++geracao.current;
    setOcupado(true);
    setErro("");
    setHistorico(null);
    const params = new URLSearchParams({
      pagina: String(pagina),
      ...(de ? { de } : {}),
      ...(ate ? { ate } : {}),
    });
    void consultarLeite<HistoricoDestinos>(`/destinos?${params}`, sitio)
      .then((r) => {
        if (atual === geracao.current) setHistorico(r);
      })
      .catch((e) => {
        if (atual === geracao.current)
          setErro(
            e instanceof Error
              ? e.message
              : "Não foi possível carregar o histórico.",
          );
      })
      .finally(() => {
        if (atual === geracao.current) setOcupado(false);
      });
    return () => {
      geracao.current++;
    };
  }, [sitio, de, ate, pagina, revisao]);
  async function confirmarEstorno() {
    if (!estorno || estornando || !podeLancar) return;
    if (motivo.trim().length < 5) {
      setErro("Informe o motivo do estorno com ao menos 5 caracteres.");
      return;
    }
    const atual = geracao.current;
    setEstornando(true);
    setErro("");
    try {
      await registrarLeite(
        `/destinos/${estorno.id}/estorno`,
        estorno.propriedadeId,
        {
          propriedadeId: estorno.propriedadeId,
          versaoEsperada: estorno.versao,
          motivo: motivo.trim(),
        },
      );
      if (atual !== geracao.current) return;
      setEstorno(null);
      setMotivo("");
      setAviso("Destino estornado. O histórico foi preservado.");
      setRevisao((r) => r + 1);
    } catch (e) {
      if (atual === geracao.current)
        setErro(
          e instanceof Error
            ? e.message
            : "Não foi possível estornar. O motivo foi preservado.",
        );
    } finally {
      setEstornando(false);
    }
  }
  return (
    <section className="leite-operacoes">
      <PageHeader titulo="Destinos internos" descricao="Fornecimentos com origem e volume por animal." acao={podeLancar ? <Button onClick={() => setNovo(true)}>Registrar fornecimento</Button> : undefined} />
      {podeLancar && novo ? (
        <Dialog open onOpenChange={setNovo}><DialogContent className="leite-consulta-dialog" aria-describedby={undefined}><DialogHeader><DialogTitle>Registrar fornecimento</DialogTitle></DialogHeader>
          <label>
            Data do fornecimento
            <input
              type="date"
              value={data}
              max={hojeOperacional()}
              onChange={(e) => setData(e.target.value)}
            />
          </label>
          {dataValida(data) && (
            <FormularioDestino
              key={`${sitio}:${data}:${revisao}`}
              data={data}
              sitio={sitio}
              aoSalvar={() => {
                setAviso(
                  "Destino registrado e volume baixado uma vez do estoque.",
                );
                setRevisao((r) => r + 1);
                setNovo(false);
              }}
            />
          )}
        </DialogContent></Dialog>
      ) : !podeLancar ? (
        <p>
          Acesso de consulta. Os destinos registrados permanecem disponíveis no
          histórico.
        </p>
      ) : null}
      {aviso && <p role="status">{aviso}</p>}
      <h2>Histórico de fornecimentos</h2>
      <BarraConsulta edicaoFiltros={filtros} adicionais={<><CampoFiltro rotulo="Desde"><input type="date" value={filtros.rascunho.de} onChange={e => filtros.editar("de", e.target.value)} /></CampoFiltro><CampoFiltro rotulo="Até"><input type="date" value={filtros.rascunho.ate} min={filtros.rascunho.de || undefined} onChange={e => filtros.editar("ate", e.target.value)} /></CampoFiltro></>} />
      {erro && <p role="alert">{erro} <Button variant="outline" onClick={() => setRevisao(r => r + 1)}>Tentar novamente</Button></p>}
      {ocupado && <p role="status">Consultando os destinos…</p>}
      {historico && (
        <>
          <TabelaFinanceira compacta rotulo="Destinos registrados" itens={historico.itens} chaveDe={d => d.id} colunas={[
            { chave: "data", titulo: "Data", principal: true, celula: d => dataPt(d.data) },
            { chave: "natureza", titulo: "Natureza", celula: d => nomeNaturezaDestino(d.natureza) },
            { chave: "litros", titulo: "Volume", alinhamento: "direita", celula: d => formatarLitros(d.quantidadeLitros) },
            { chave: "animais", titulo: "Animais", alinhamento: "direita", celula: d => d.parcelas.length },
            { chave: "situacao", titulo: "Situação", celula: d => d.status === "ESTORNADO" ? "Estornado" : "Confirmado" },
            { chave: "acoes", titulo: "Ações", acoes: true, celula: d => <div className="leite-consulta-acoes">                      <SecaoDetalhesLeite  titulo={<>Ver detalhes</>}>

                      {d.parcelas.map((p) => (
                        <div key={p.id}>
                          {p.nome || p.brinco} ·{" "}
                          {formatarLitros(p.quantidadeLitros)}
                          {p.fornecimentoColostroId && (
                            <small>
                              {p.criadoNoDestino
                                ? "Colostro registrado neste destino"
                                : "Fornecimento de colostro vinculado"}
                            </small>
                          )}
                        </div>
                      ))}

                        <p>{d.declaracaoOrigem}</p>
                        <p>Versão {d.versao}</p>
                        <p>
                          Saldo da origem no ato:{" "}
                          {formatarLitros(d.saldoOrigemAntes)} →{" "}
                          {formatarLitros(d.saldoOrigemDepois)}. Estes valores
                          são históricos.
                        </p>
                        {d.responsavel && <p>Responsável: {d.responsavel}</p>}
                        {d.observacao && <p>{d.observacao}</p>}
                        {d.motivoEstorno && (
                          <p>Motivo do estorno: {d.motivoEstorno}</p>
                        )}
                      </SecaoDetalhesLeite>
                      {podeLancar && d.status !== "ESTORNADO" && (
                        <Button variant="outline" className="leite-secondary" aria-label={`Estornar destino de ${dataPt(d.data)}`}
                          disabled={estornando}
                          onClick={() => {
                            setEstorno(d);
                            setMotivo("");
                          }}>
                          Estornar
                        </Button>
                      )}
</div> },
          ]} />
          {!historico.itens.length && (
            <p>Nenhum destino registrado no período.</p>
          )}
          <Paginacao pagina={pagina} totalPaginas={Math.max(1, Math.ceil(historico.total / historico.porPagina))} total={historico.total} porPagina={historico.porPagina} rotulo="Paginação dos destinos" substantivo="fornecimentos" idSelect="pagina-destinos-leite" onPagina={setPagina} />
        </>
      )}
      {podeLancar && estorno && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void confirmarEstorno();
          }}
        >
          <fieldset disabled={estornando}>
            <legend>
              Estornar destino de {formatarLitros(estorno.quantidadeLitros)}
            </legend>
            <p>
              O estorno recompõe o estoque e conserva o registro original e seus
              vínculos. Confira o motivo antes de confirmar.
            </p>
            <label>
              Motivo do estorno
              <textarea
                value={motivo}
                required
                minLength={5}
                maxLength={1000}
                onChange={(e) => setMotivo(e.target.value)}
              />
            </label>
            <div className="leite-form-inline">
              <Button variant="outline" type="button"
                className="leite-secondary"
                onClick={() => setEstorno(null)}>
                Cancelar estorno
              </Button>
              <Button >
                {estornando ? "Estornando…" : "Confirmar estorno"}
              </Button>
            </div>
          </fieldset>
        </form>
      )}
    </section>
  );
}
function FormularioDestino({
  data,
  sitio,
  aoSalvar,
}: {
  data: string;
  sitio: number | null;
  aoSalvar: () => void;
}) {
  const armazenamento = `terrano:leite:destinos:rascunho:${sitio}:${data}`;
  const [rascunho, setRascunho] = useState<RascunhoDestino>(() => {
    try {
      return (
        JSON.parse(sessionStorage.getItem(armazenamento) ?? "null") ??
        novoRascunho()
      );
    } catch {
      return novoRascunho();
    }
  });
  const origemEscolhida = rascunho.origem;
  const [produtos, setProdutos] = useState<ProdutoDTO[]>([]);
  const [origens, setOrigens] = useState<OrigemDestinoLeite[]>([]);
  const [revisao, setRevisao] = useState(0);
  const [erro, setErro] = useState("");
  const [erroOrigens, setErroOrigens] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(1);
  const [candidatos, setCandidatos] = useState<CandidatosDestinos | null>(null);
  const [erroCandidatos, setErroCandidatos] = useState("");
  const [buscando, setBuscando] = useState(false);
  const vivo = useRef(true);
  const confirmou = useRef(false);
  useEffect(() => {
    vivo.current = true;
    return () => {
      vivo.current = false;
    };
  }, []);
  useEffect(() => {
    let atual = true;
    void listarProdutos({ ativo: true })
      .then((r) => {
        if (atual)
          setProdutos(
            r.filter((p) => p.unidade === "L" && !p.rastrearPartidas),
          );
      })
      .catch((e) => {
        if (atual)
          setErro(
            e instanceof Error
              ? e.message
              : "Não foi possível consultar produtos.",
          );
      });
    return () => {
      atual = false;
    };
  }, [revisao]);
  useEffect(() => {
    if (confirmou.current) return;
    try {
      sessionStorage.setItem(armazenamento, JSON.stringify(rascunho));
    } catch {
      /* O formulário em memória permanece disponível. */
    }
  }, [rascunho, armazenamento]);
  useEffect(() => {
    let atual = true;
    setOrigens([]);
    setErroOrigens("");
    if (!rascunho.produto) return;
    setCarregando(true);
    void consultarLeite<{ propriedadeId: number; itens: OrigemDestinoLeite[] }>(
      `/destinos/origens?${new URLSearchParams({ produtoId: rascunho.produto, data })}`,
      sitio,
    )
      .then((r) => {
        if (atual) {
          setOrigens(r.itens);
          setRascunho((anterior) => ({
            ...anterior,
            propriedadeId: r.propriedadeId,
          }));
        }
      })
      .catch((e) => {
        if (atual)
          setErroOrigens(
            e instanceof Error
              ? e.message
              : "Não foi possível consultar origens.",
          );
      })
      .finally(() => {
        if (atual) setCarregando(false);
      });
    return () => {
      atual = false;
    };
  }, [rascunho.produto, data, sitio, revisao]);
  useEffect(() => {
    let atual = true;
    setCandidatos(null);
    setErroCandidatos("");
    setBuscando(true);
    const timer = setTimeout(() => {
      const caminho = rascunho.natureza === "COLOSTRO" ? "crias" : "candidatos";
      void consultarLeite<CandidatosDestinos>(
        `/destinos/${caminho}?${new URLSearchParams({ data, busca, pagina: String(pagina) })}`,
        sitio,
      )
        .then((r) => {
          if (atual) setCandidatos(r);
        })
        .catch((e) => {
          if (atual)
            setErroCandidatos(
              e instanceof Error
                ? e.message
                : "Não foi possível consultar destinatários.",
            );
        })
        .finally(() => {
          if (atual) setBuscando(false);
        });
    }, 250);
    return () => {
      atual = false;
      clearTimeout(timer);
    };
  }, [rascunho.natureza, data, busca, pagina, sitio, revisao]);
  function mudar(patch: Partial<RascunhoDestino>) {
    setRascunho((r) => ({ ...r, ...patch }));
    setErro("");
  }
  function mudarParcela(animalId: string, patch: Partial<ParcelaDestinoDraft>) {
    setRascunho((r) => ({
      ...r,
      parcelas: r.parcelas.map((p) =>
        p.animalId === animalId ? { ...p, ...patch } : p,
      ),
    }));
    setErro("");
  }
  function adicionar(a: CandidatoDestinoLeite) {
    setRascunho((r) =>
      r.parcelas.some((p) => p.animalId === a.animalId)
        ? r
        : {
            ...r,
            parcelas: [
              ...r.parcelas,
              {
                animalId: a.animalId,
                brinco: a.brinco,
                nome: a.nome,
                litros: "",
                ...(r.natureza === "COLOSTRO" && a.criaId
                  ? { criaId: a.criaId, fornecimentos: a.fornecimentos ?? [] }
                  : {}),
              },
            ],
          },
    );
  }
  const resumo = somarParcelasDestino(
    rascunho.parcelas,
    origemEscolhida?.quantidadeDisponivelLitros ?? null,
  );
  async function salvar() {
    if (salvando) return;
    setErro("");
    if (
      !(sitio ?? rascunho.propriedadeId) ||
      !origemEscolhida ||
      !resumo.validas ||
      resumo.excedeu ||
      rascunho.declaracao.trim().length < 10
    ) {
      setErro(
        "Selecione a origem, informe litros positivos por animal dentro do saldo e descreva a origem com ao menos 10 caracteres.",
      );
      return;
    }
    if (
      rascunho.natureza === "COLOSTRO" &&
      rascunho.parcelas.some((p) => !p.criaId)
    ) {
      setErro("Escolha crias de partos reais para o colostro.");
      return;
    }
    setSalvando(true);
    try {
      await registrarLeite("/destinos", sitio ?? rascunho.propriedadeId, {
        propriedadeId: sitio ?? rascunho.propriedadeId,
        entradaId: origemEscolhida.entradaId,
        data,
        natureza: rascunho.natureza,
        declaracaoOrigem: rascunho.declaracao.trim(),
        quantidadeDisponivelEsperadaLitros:
          origemEscolhida.quantidadeDisponivelLitros,
        parcelas: rascunho.parcelas.map((p) => ({
          animalId: p.animalId,
          quantidadeLitros: Number(p.litros.replace(",", ".")),
          ...(rascunho.natureza === "COLOSTRO"
            ? {
                criaId: p.criaId,
                ...(p.fornecimentoColostroId
                  ? { fornecimentoColostroId: p.fornecimentoColostroId }
                  : {}),
              }
            : {}),
        })),
        responsavel: rascunho.responsavel.trim() || null,
        observacao: rascunho.observacao.trim() || null,
      });
      confirmou.current = true;
      try {
        sessionStorage.removeItem(armazenamento);
      } catch {
        /* O fato confirmado já foi registrado. */
      }
      if (vivo.current) aoSalvar();
    } catch (e) {
      if (vivo.current)
        setErro(
          e instanceof Error
            ? e.message
            : "Não foi possível registrar. O rascunho foi preservado.",
        );
    } finally {
      if (vivo.current) setSalvando(false);
    }
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void salvar();
      }}
    >
      <fieldset disabled={salvando}>
        <legend>Registrar fornecimento interno</legend>
        <div className="leite-form-inline">
          <label>
            Produto de origem
            <SelectCampo disabled={salvando}
              required
              value={rascunho.produto}
              onValueChange={(valor) => mudar({ produto: valor, origem: null })}
            >
              <option value="">Selecione</option>
              {produtos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </SelectCampo>
          </label>
          <label>
            Natureza declarada
            <SelectCampo disabled={salvando}
              value={rascunho.natureza}
              onValueChange={(valor) => {
                mudar({
                  natureza: valor as NaturezaDestinoLeite,
                  parcelas: [],
                });
                setPagina(1);
              }}
            >
              <option value="LEITE_COMUM">Leite comum</option>
              <option value="LEITE_NAO_COMERCIAL">Leite não comercial</option>
              <option value="COLOSTRO">Colostro</option>
            </SelectCampo>
          </label>
        </div>
        {carregando && <p role="status">Consultando as origens do estoque…</p>}
        {erroOrigens && <p role="alert">{erroOrigens}</p>}
        {rascunho.produto && (
          <label>
            Origem confirmada
            <SelectCampo disabled={salvando}
              value={origemEscolhida?.entradaId ?? ""}
              required
              onValueChange={(valor) =>
                mudar({
                  origem:
                    origens.find((o) => o.entradaId === valor) ?? null,
                })
              }
            >
              <option value="">Selecione a ordenha de origem</option>
              {origemEscolhida &&
                !origens.some(
                  (o) => o.entradaId === origemEscolhida?.entradaId,
                ) && (
                  <option value={origemEscolhida.entradaId}>
                    Origem do rascunho · {dataPt(origemEscolhida.data)} · saldo
                    conferido{" "}
                    {formatarLitros(origemEscolhida.quantidadeDisponivelLitros)}
                  </option>
                )}
              {origens.map((o) => (
                <option key={o.entradaId} value={o.entradaId}>
                  {dataPt(o.data)} ·{" "}
                  {formatarLitros(o.quantidadeDisponivelLitros)} disponíveis ·
                  ordenha {o.nomeOrdenha ?? "Ordenha sem nome informado"}
                </option>
              ))}
            </SelectCampo>
          </label>
        )}
        {rascunho.produto && !carregando && !erroOrigens && !origens.length && (
          <p>
            Nenhuma origem com saldo disponível na data. Confirme produção no
            estoque antes de registrar o destino.
          </p>
        )}
        <Button variant="outline" className="leite-secondary"
          type="button"
          onClick={() => setRevisao((r) => r + 1)}>
          Consultar produtos, origens e destinatários novamente
        </Button>
        {origemEscolhida &&
          origens.some(
            (o) =>
              o.entradaId === origemEscolhida?.entradaId &&
              o.quantidadeDisponivelLitros !==
                origemEscolhida.quantidadeDisponivelLitros,
          ) && (
            <p role="alert">
              O saldo consultado mudou.{" "}
              <Button variant="outline" className="leite-secondary"
                type="button"
                onClick={() =>
                  mudar({
                    origem:
                      origens.find(
                        (o) => o.entradaId === origemEscolhida?.entradaId,
                      ) ?? null,
                  })
                }>
                Usar saldo atualizado e revisar parcelas
              </Button>{" "}
              O retry da tentativa anterior conserva o saldo conferido.
            </p>
          )}
        {origemEscolhida && (
          <p>
            Natureza declarada do grupo de origem selecionado:{" "}
            {origemEscolhida.natureza === "COMERCIAL"
              ? "Comercial"
              : origemEscolhida.natureza === "COLOSTRO"
                ? "Colostro"
                : origemEscolhida.natureza === "NAO_COMERCIAL"
                  ? "Não comercial"
                  : "Não informada"}
            .
          </p>
        )}
        {rascunho.natureza !== "LEITE_COMUM" ? (
          <p role="note">
            Ao confirmar{" "}
            {nomeNaturezaDestino(rascunho.natureza).toLocaleLowerCase("pt-BR")},
            apenas o grupo de origem selecionado fica restrito para venda,
            inclusive seu saldo remanescente. Os demais animais e grupos da
            ordenha conservam suas naturezas. Estornar este destino conserva a
            classificação do grupo.
          </p>
        ) : (
          <p>
            Leite comum não autoriza a venda da sobra. Uma origem declarada como
            colostro não pode ser utilizada como leite comum.
          </p>
        )}
        <label>
          Declaração da origem e da prática registrada
          <textarea
            value={rascunho.declaracao}
            required
            minLength={10}
            maxLength={1000}
            onChange={(e) => mudar({ declaracao: e.target.value })}
          />
        </label>
        <small>
          A natureza não certifica segurança sanitária. Trocar a natureza exige
          selecionar novamente os destinatários.
        </small>
        <h2>Destinatários na data do fornecimento</h2>
        <label>
          Buscar nome ou brinco
          <input
            type="search"
            value={busca}
            onChange={(e) => {
              setBusca(e.target.value);
              setPagina(1);
            }}
          />
        </label>
        {buscando && <p role="status">Consultando destinatários…</p>}
        {erroCandidatos && <p role="alert">{erroCandidatos}</p>}
        {candidatos && (
          <>
            <TabelaFinanceira compacta rotulo="Destinatários disponíveis" itens={candidatos.itens} chaveDe={a => a.animalId} colunas={[
              { chave: "nome", titulo: "Animal", principal: true, celula: a => a.nome || a.brinco },
              { chave: "brinco", titulo: "Brinco", celula: a => a.brinco },
              { chave: "selecao", titulo: "Seleção", celula: a => (                        <Button variant="outline" type="button"
                          className="leite-secondary"
                          disabled={
                            rascunho.parcelas.some(
                              (p) => p.animalId === a.animalId,
                            ) || rascunho.parcelas.length >= 200
                          }
                          onClick={() => adicionar(a)}>
                          {rascunho.parcelas.some(
                            (p) => p.animalId === a.animalId,
                          )
                            ? "Adicionado"
                            : `Adicionar ${a.nome || a.brinco}`}
                        </Button>) },
            ]} />
            {!candidatos.itens.length && (
              <p>Nenhum destinatário encontrado nesta busca e data.</p>
            )}
            <Paginacao pagina={pagina} totalPaginas={Math.max(1, Math.ceil(candidatos.total / candidatos.porPagina))} total={candidatos.total} porPagina={candidatos.porPagina} rotulo="Paginação dos destinatários" substantivo="animais" idSelect="pagina-destinatarios-leite" onPagina={setPagina} />
          </>
        )}
        <h2>Litros por destinatário</h2>
        <small>
          Informe litros positivos com até três casas decimais. Cada parcela
          corresponde à quantidade servida ao animal.
        </small>
        {!rascunho.parcelas.length ? (
          <p>
            Adicione animais e informe a quantidade servida a cada um. Não há
            divisão automática.
          </p>
        ) : (
          <TabelaFinanceira compacta rotulo="Parcelas por destinatário" itens={rascunho.parcelas} chaveDe={p => p.animalId} colunas={[
            { chave: "animal", titulo: "Animal", principal: true, celula: p => p.nome || p.brinco },
            { chave: "litros", titulo: "Litros servidos", celula: p => (                      <input
                        aria-label={`Litros servidos a ${p.nome || p.brinco}`}
                        aria-invalid={
                          p.litros !== "" &&
                          !somarParcelasDestino([p], null).validas
                        }
                        pattern="[0-9]+([.,][0-9]{1,3})?"
                        inputMode="decimal"
                        required
                        value={p.litros}
                        disabled={!!p.fornecimentoColostroId}
                        onChange={(e) =>
                          mudarParcela(p.animalId, { litros: e.target.value })
                        }
                      />) },
            { chave: "colostro", titulo: "Registro de colostro", celula: p => rascunho.natureza === "COLOSTRO" ? (                        <SelectCampo disabled={salvando}
                          aria-label={`Registro de colostro de ${p.nome || p.brinco}`}
                          value={p.fornecimentoColostroId ?? ""}
                          onValueChange={(valor) => {
                            const f = p.fornecimentos?.find(
                              (f) => f.id === valor,
                            );
                            mudarParcela(p.animalId, {
                              fornecimentoColostroId:
                                valor || undefined,
                              ...(f?.quantidadeLitros !== null &&
                              f?.quantidadeLitros !== undefined
                                ? { litros: String(f.quantidadeLitros) }
                                : {}),
                            });
                          }}
                        >
                          <option value="">
                            Criar fornecimento com estes litros
                          </option>
                          {p.fornecimentos?.map((f) => (
                            <option
                              disabled={
                                f.quantidadeLitros === null ||
                                f.quantidadeLitros <= 0
                              }
                              key={f.id}
                              value={f.id}
                            >
                              Vincular {dataPt(f.data)} ·{" "}
                              {formatarLitros(f.quantidadeLitros)}
                            </option>
                          ))}
                        </SelectCampo>) : "Não se aplica" },
            { chave: "acao", titulo: "Ação", acoes: true, celula: p => (                      <Button variant="outline" type="button"
                        className="leite-secondary"
                        onClick={() =>
                          mudar({
                            parcelas: rascunho.parcelas.filter(
                              (a) => a.animalId !== p.animalId,
                            ),
                          })
                        }>
                        Remover {p.nome || p.brinco}
                      </Button>) },
          ]} />
        )}
        <dl className="leite-indicadores">
          <div>
            <dt>Saldo conferido da origem</dt>
            <dd>
              {formatarLitros(
                origemEscolhida?.quantidadeDisponivelLitros ?? null,
              )}
            </dd>
          </div>
          <div>
            <dt>Soma das parcelas informadas</dt>
            <dd>{formatarLitros(resumo.total)}</dd>
          </div>
          <div>
            <dt>Saldo remanescente previsto</dt>
            <dd>{formatarLitros(resumo.remanescente)}</dd>
          </div>
        </dl>
        {resumo.excedeu && (
          <p role="alert">
            As parcelas excedem o saldo da origem. Revise as quantidades.
          </p>
        )}
        <div className="leite-form-inline">
          <label>
            Responsável (opcional)
            <input
              value={rascunho.responsavel}
              maxLength={160}
              onChange={(e) => mudar({ responsavel: e.target.value })}
            />
          </label>
          <label>
            Observação (opcional)
            <textarea
              value={rascunho.observacao}
              maxLength={1000}
              onChange={(e) => mudar({ observacao: e.target.value })}
            />
          </label>
        </div>
        {erro && <p role="alert">{erro}</p>}
        <Button disabled={
            salvando ||
            !(sitio ?? rascunho.propriedadeId) ||
            !origemEscolhida ||
            !resumo.validas ||
            resumo.excedeu ||
            rascunho.declaracao.trim().length < 10
          }>
          {salvando
            ? "Registrando…"
            : `Confirmar destino e baixar ${formatarLitros(resumo.total)}`}
        </Button>
        <small>
          A confirmação registra as parcelas e uma única baixa do estoque. Em
          caso de falha, o rascunho e a chave do retry são preservados.
        </small>
      </fieldset>
    </form>
  );
}
