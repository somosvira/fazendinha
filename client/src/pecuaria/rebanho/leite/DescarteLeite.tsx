import { ListaConsultaLeite } from "./ListaConsultaLeite";
import { SelectCampo } from "../../../financeiro/SelectCampo";
import { DialogConsultaLeite } from "./DialogConsultaLeite";
import { BarraConsulta } from "../../../financeiro/BarraConsulta";
import { CampoFiltro } from "../../../financeiro/PainelFiltros";
import { useRascunhoConsulta } from "../../../financeiro/useRascunhoConsulta";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CabecalhoTabela, Paginacao } from "../../../financeiro/financeiro-ui";
import "./consultas-leite.css";
import { Button } from "@/components/ui/button";
import { useEffect, useRef, useState } from "react";
import { listarProdutos, type ProdutoDTO } from "../../../estoque/api";
import { getPropriedadeAtiva } from "../../../propriedadeScope";
import { consultarLeite, registrarLeite } from "./operacoes-api";
import { hojeOperacional, formatarLitros } from "./modelo";
import type { OrigemDestinoLeite } from "./destinos-types";
interface Descarte {
  id: string;
  propriedadeId: number;
  entradaId: string;
  produtoNome: string;
  nomeOrdenha: string;
  data: string;
  quantidadeLitros: number;
  saldoOrigemAntes: number;
  saldoOrigemDepois: number;
  motivo: string;
  status: string;
  versao: number;
  motivoEstorno: string | null;
}
export function DescarteLeite({ podeLancar }: { podeLancar: boolean }) {
  const sitio = getPropriedadeAtiva();
  const [novo, setNovo] = useState(false);
  const [produtos, setProdutos] = useState<ProdutoDTO[]>([]),
    [produto, setProduto] = useState("");
  const [data, setData] = useState(hojeOperacional),
    [origens, setOrigens] = useState<OrigemDestinoLeite[]>([]),
    [entradaId, setEntradaId] = useState("");
  const [litros, setLitros] = useState(""),
    [motivo, setMotivo] = useState("");
  const [lista, setLista] = useState<{
      propriedadeId: number;
      itens: Descarte[];
      total: number;
      tamanho: number;
    } | null>(null),
    [pagina, setPagina] = useState(1),
    [revisao, setRevisao] = useState(0);
  const filtros = useRascunhoConsulta({ data }, { data: hojeOperacional() }, v => { setData(v.data); setPagina(1); });
  const [estorno, setEstorno] = useState<Descarte | null>(null),
    [motivoEstorno, setMotivoEstorno] = useState("");
  const [erro, setErro] = useState(""),
    [aviso, setAviso] = useState(""),
    [ocupado, setOcupado] = useState(false);
  const trava = useRef(false),
    geracao = useRef(0);
  const origem = origens.find((o) => o.entradaId === entradaId);
  useEffect(() => {
    let ativo = true;
    void listarProdutos()
      .then((p) => {
        if (ativo)
          setProdutos(
            p.filter(
              (p) => p.ativo && p.unidade === "L" && !p.rastrearPartidas,
            ),
          );
      })
      .catch((e) => {
        if (ativo) setErro(e.message);
      });
    return () => {
      ativo = false;
    };
  }, [sitio]);
  useEffect(() => {
    const atual = ++geracao.current;
    setLista(null);
    setOrigens([]);
    setEntradaId("");
    setEstorno(null);
    setErro("");
    void Promise.all([
      consultarLeite<{
        propriedadeId: number;
        itens: Descarte[];
        total: number;
        tamanho: number;
      }>(
        `/descartes?${new URLSearchParams({ de: `${data.slice(0, 7)}-01`, ate: data, pagina: String(pagina) })}`,
        sitio,
      ),
      produto
        ? consultarLeite<{ itens: OrigemDestinoLeite[] }>(
            `/destinos/origens?${new URLSearchParams({ produtoId: produto, data })}`,
            sitio,
          )
        : Promise.resolve({ itens: [] }),
    ])
      .then(([l, o]) => {
        if (atual === geracao.current) {
          setLista(l);
          setOrigens(o.itens);
        }
      })
      .catch((e) => {
        if (atual === geracao.current)
          setErro(e instanceof Error ? e.message : "Falha na consulta");
      });
    return () => {
      geracao.current++;
    };
  }, [sitio, data, produto, pagina, revisao]);
  async function executar(
    caminho: string,
    body: Record<string, unknown>,
    sucesso: string,
  ) {
    if (trava.current) return;
    trava.current = true;
    setOcupado(true);
    setErro("");
    setAviso("");
    const atual = geracao.current;
    try {
      await registrarLeite(caminho, lista?.propriedadeId ?? sitio, body);
      if (atual === geracao.current) {
        setAviso(sucesso);
        setLitros("");
        setMotivo("");
        setEstorno(null);
        setRevisao((r) => r + 1);
      }
    } catch (e) {
      if (atual === geracao.current)
        setErro(e instanceof Error ? e.message : "Falha na operação");
    } finally {
      trava.current = false;
      setOcupado(false);
    }
  }
  const volume = /^\d+(?:[.,]\d{1,3})?$/.test(litros)
    ? Number(litros.replace(",", "."))
    : null;
  return (
    <section className="leite-operacoes" aria-label="Descarte físico de leite">
      <CabecalhoTabela titulo="Descarte físico" ajuda="Saídas efetivas com origem, motivo e histórico preservado." rotuloAjuda="Sobre descarte físico" acao={podeLancar ? <Button onClick={() => setNovo(true)}>Registrar descarte</Button> : undefined} />
      <BarraConsulta edicaoFiltros={filtros} adicionais={<CampoFiltro rotulo="Data do descarte"><input type="date" required max={hojeOperacional()} value={filtros.rascunho.data} onChange={e => { if(e.target.value) filtros.editar("data", e.target.value); }} /></CampoFiltro>} resumo={`Mês até ${data.split("-").reverse().join("/")}`} />
      {erro && <p role="alert">{erro} <Button variant="outline" onClick={() => setRevisao(r => r + 1)}>Tentar novamente</Button></p>}
      {aviso && <p role="status">{aviso}</p>}
      {podeLancar && novo && <Dialog open onOpenChange={v => { setNovo(v); if (!v) { setProduto(""); setEntradaId(""); setLitros(""); setMotivo(""); } }}><DialogContent className="leite-consulta-dialog" aria-describedby={undefined}><DialogHeader><DialogTitle>Registrar descarte físico</DialogTitle></DialogHeader>{erro && <p role="alert">{erro}</p>}{aviso && <p role="status">{aviso}</p>}        <label>
          Produto para descarte
          <SelectCampo disabled={ocupado} value={produto} onValueChange={(valor) => setProduto(valor)}>
            <option value="">Selecione o produto</option>
            {produtos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </SelectCampo>
        </label>

      {produto && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!origem || volume === null) return;
            void executar(
              "/descartes",
              {
                entradaId,
                data,
                quantidadeLitros: volume,
                quantidadeDisponivelEsperadaLitros: Number(
                  origem.quantidadeDisponivelLitros,
                ),
                motivo,
              },
              "Descarte registrado com uma única saída de estoque.",
            );
          }}
        >
          <fieldset disabled={ocupado}>
            <legend>Registrar leite descartado</legend>
            <div className="leite-form-inline">
              <label>
                Origem descartada
                <SelectCampo disabled={ocupado}
                  required
                  value={entradaId}
                  onValueChange={(valor) => setEntradaId(valor)}
                >
                  <option value="">Selecione a origem</option>
                  {origens.map((o) => (
                    <option key={o.entradaId} value={o.entradaId}>
                      {o.data} · {o.nomeOrdenha ?? "Ordenha"} ·{" "}
                      {formatarLitros(Number(o.quantidadeDisponivelLitros))}
                    </option>
                  ))}
                </SelectCampo>
              </label>
              <label>
                Litros descartados
                <input
                  required
                  inputMode="decimal"
                  value={litros}
                  onChange={(e) => setLitros(e.target.value)}
                />
              </label>
            </div>
            <label>
              Motivo do descarte
              <textarea
                required
                minLength={5}
                maxLength={1000}
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
              />
            </label>
            {origem && (
              <p>
                Saldo da origem antes do descarte:{" "}
                {formatarLitros(Number(origem.quantidadeDisponivelLitros))}.
              </p>
            )}
            <Button
              disabled={
                !lista ||
                ocupado ||
                !origem ||
                volume === null ||
                volume <= 0 ||
                volume > Number(origem.quantidadeDisponivelLitros) ||
                motivo.trim().length < 5
              }
            >
              Confirmar descarte físico
            </Button>
          </fieldset>
        </form>
      )}</DialogContent></Dialog>}
      {lista && (
        <>
          <ListaConsultaLeite preferencia="descartesLeiteVisualizacao" compacta rotulo="Descartes registrados" itens={lista.itens} chaveDe={d => d.id} colunas={[
            { chave: "data", titulo: "Data", principal: true, celula: d => d.data.split("-").reverse().join("/") },
            { chave: "produto", titulo: "Produto", celula: d => d.produtoNome },
            { chave: "ordenha", titulo: "Ordenha", celula: d => d.nomeOrdenha },
            { chave: "litros", titulo: "Volume", alinhamento: "direita", celula: d => formatarLitros(d.quantidadeLitros) },
            { chave: "situacao", titulo: "Situação", celula: d => d.status === "CONFIRMADO" ? "Confirmado" : "Estornado" },
            { chave: "acoes", titulo: "Ações", acoes: true, celula: d => <div className="leite-consulta-acoes"><DialogConsultaLeite titulo="Ver descarte"><p>Motivo: {d.motivo}</p><p>Saldo da origem: {formatarLitros(d.saldoOrigemAntes)} → {formatarLitros(d.saldoOrigemDepois)}</p><p>Versão {d.versao}</p>{d.motivoEstorno && <p>Motivo do estorno: {d.motivoEstorno}</p>}</DialogConsultaLeite>{podeLancar && d.status === "CONFIRMADO" && <Button variant="outline" aria-label={`Corrigir descarte de ${d.data}`} onClick={() => { setEstorno(d); setMotivoEstorno(""); }}>Corrigir</Button>}</div> },
          ]} />
          {!lista.itens.length && (
            <p>Nenhum descarte registrado neste período.</p>
          )}
          <Paginacao pagina={pagina} totalPaginas={Math.max(1, Math.ceil(lista.total / lista.tamanho))} total={lista.total} porPagina={lista.tamanho} rotulo="Paginação dos descartes" substantivo="descartes" idSelect="pagina-descartes-leite" onPagina={setPagina} />
        </>
      )}
      {estorno && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void executar(
              `/descartes/${estorno.id}/estorno`,
              {
                propriedadeId: estorno.propriedadeId,
                versaoEsperada: estorno.versao,
                motivo: motivoEstorno,
              },
              "Lançamento de descarte estornado; histórico preservado.",
            );
          }}
        >
          <fieldset disabled={ocupado}>
            <legend>Regularizar lançamento de descarte</legend>
            <p>
              O estorno desfaz a saída registrada por erro e devolve{" "}
              {formatarLitros(estorno.quantidadeLitros)} ao razão. Leite
              realmente descartado não retorna ao tanque por esta ação.
            </p>
            <label>
              Motivo da regularização
              <textarea
                required
                minLength={5}
                maxLength={1000}
                value={motivoEstorno}
                onChange={(e) => setMotivoEstorno(e.target.value)}
              />
            </label>
            <div className="leite-form-inline">
              <Button disabled={ocupado || motivoEstorno.trim().length < 5}>
                Estornar lançamento incorreto
              </Button>
              <Button variant="outline"
                type="button"
                className="leite-secondary"
                onClick={() => setEstorno(null)}
              >
                Cancelar regularização
              </Button>
            </div>
          </fieldset>
        </form>
      )}
    </section>
  );
}
