import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/DatePicker";
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
  destino?: "CASA" | "FUNCIONARIOS";
  responsavel?: string;
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
export function DescarteLeite({ podeLancar, aoMudou, modo = "descarte" }: { podeLancar: boolean; aoMudou?: () => void; modo?: "descarte" | "retirada" }) {
  const interna = modo === "retirada";
  const base = interna ? "/retiradas-internas" : "/descartes";
  const [destino, setDestino] = useState("CASA");
  const [responsavel, setResponsavel] = useState("");
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
        `${base}?${new URLSearchParams({ de: `${data.slice(0, 7)}-01`, ate: data, pagina: String(pagina) })}`,
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
  }, [sitio, data, produto, pagina, revisao, base]);
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
        aoMudou?.();
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
    <section className="leite-operacoes" aria-label={interna ? "Retiradas para Casa e Funcionários" : "Descarte físico de leite"}>
      <CabecalhoTabela titulo={interna ? "Casa e Funcionários" : "Descarte físico"} ajuda="Saídas efetivas com origem, motivo e histórico preservado." rotuloAjuda={interna ? "Sobre retiradas internas" : "Sobre descarte físico"} acao={podeLancar ? <Button onClick={() => setNovo(true)}>{interna ? "Registrar retirada interna" : "Registrar descarte"}</Button> : undefined} />
      <BarraConsulta edicaoFiltros={filtros} adicionais={<CampoFiltro rotulo="Data de referência"><DatePicker aria-label={interna ? "Data das retiradas internas" : "Data do descarte"} value={filtros.rascunho.data} onChange={v => { if(v) filtros.editar("data", v); }} /></CampoFiltro>} resumo={`Mês até ${data.split("-").reverse().join("/")}`} />
      {erro && <p role="alert">{erro} <Button variant="outline" onClick={() => setRevisao(r => r + 1)}>Tentar novamente</Button></p>}
      {aviso && <p role="status">{aviso}</p>}
      {podeLancar && novo && <Dialog open onOpenChange={v => { setNovo(v); if (!v) { setProduto(""); setEntradaId(""); setLitros(""); setMotivo(""); } }}><DialogContent className="leite-consulta-dialog" data-fin-scroll="conteudo" aria-describedby={undefined}><DialogHeader><DialogTitle>{interna ? "Registrar retirada interna" : "Registrar descarte físico"}</DialogTitle></DialogHeader>{erro && <p role="alert">{erro}</p>}{aviso && <p role="status">{aviso}</p>}        <label>
          {interna ? "Produto de leite" : "Produto para descarte"}
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
              base,
              {
                entradaId,
                data,
                quantidadeLitros: volume,
                quantidadeDisponivelEsperadaLitros: Number(
                  origem.quantidadeDisponivelLitros,
                ),
                motivo,
                ...(interna ? { destino, responsavel } : {}),
              },
              interna ? "Retirada interna registrada com uma única saída de estoque." : "Descarte registrado com uma única saída de estoque.",
            );
          }}
        >
          <fieldset disabled={ocupado}>
            <legend>{interna ? "Retirada para consumo interno" : "Registrar leite descartado"}</legend>
            <label>Data da saída<DatePicker aria-label={interna ? "Data da retirada interna" : "Data da saída por descarte"} value={data} onChange={v=>{if(v)setData(v)}}/></label>
            {interna && <div className="leite-form-inline"><label>Destino<SelectCampo aria-label="Destino da retirada interna" value={destino} onValueChange={setDestino} disabled={ocupado}><option value="CASA">Casa</option><option value="FUNCIONARIOS">Funcionários</option></SelectCampo></label><label>Responsável<Input required minLength={2} maxLength={200} value={responsavel} onChange={e=>setResponsavel(e.target.value)}/></label></div>}
            {interna && !origens.some(o=>o.natureza==="COMERCIAL") && <p role="status">Nenhuma origem comercial disponível para este produto na data selecionada.</p>}
            <div className="leite-form-inline">
              <label>
                {interna ? "Origem do leite" : "Origem descartada"}
                <SelectCampo disabled={ocupado}
                  required
                  value={entradaId}
                  onValueChange={(valor) => setEntradaId(valor)}
                >
                  <option value="">Selecione a origem</option>
                  {origens.filter(o => !interna || o.natureza === "COMERCIAL").map((o) => (
                    <option key={o.entradaId} value={o.entradaId}>
                      {o.data} · {o.nomeOrdenha ?? "Ordenha"} ·{" "}
                      {formatarLitros(Number(o.quantidadeDisponivelLitros))}
                    </option>
                  ))}
                </SelectCampo>
              </label>
              <label>
                {interna ? "Volume (L)" : "Litros descartados"}
                <Input
                  required
                  inputMode="decimal"
                  value={litros}
                  onChange={(e) => setLitros(e.target.value)}
                />
              </label>
            </div>
            <label>
              {interna ? "Motivo da saída" : "Motivo do descarte"}
              <Textarea
                required
                minLength={5}
                maxLength={1000}
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
              />
            </label>
            {origem && (
              <p>
                Saldo da origem antes da saída:{" "}
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
                motivo.trim().length < 5 || (interna && responsavel.trim().length < 2)
              }
            >
              {interna ? "Confirmar retirada interna" : "Confirmar descarte físico"}
            </Button>
          </fieldset>
        </form>
      )}</DialogContent></Dialog>}
      {lista && (
        <>
          <ListaConsultaLeite tituloDe={d => interna ? d.destino === "CASA" ? "Casa" : "Funcionários" : d.produtoNome} detalheDe={d => d.data.split("-").reverse().join("/")} layout="linhas" destaque="litros" preferencia={interna ? "retiradasInternasLeiteVisualizacao" : "descartesLeiteVisualizacao"} compacta rotulo={interna ? "Retiradas internas registradas" : "Descartes registrados"} itens={lista.itens} chaveDe={d => d.id} colunas={[
          ...(interna ? [{ chave: "destino", titulo: "Destino", ocultarNoCartao: true, celula: (d: Descarte) => d.destino === "CASA" ? "Casa" : "Funcionários" }, { chave: "responsavel", titulo: "Responsável", celula: (d: Descarte) => d.responsavel ?? "Não informado" }] : []),
            { chave: "data", titulo: "Data", principal: true, celula: d => d.data.split("-").reverse().join("/") },
            { chave: "produto", titulo: "Produto", ocultarNoCartao: true, celula: d => d.produtoNome },
            { chave: "ordenha", titulo: "Ordenha", celula: d => d.nomeOrdenha },
            { chave: "litros", titulo: "Volume", alinhamento: "direita", celula: d => formatarLitros(d.quantidadeLitros) },
            { chave: "situacao", titulo: "Situação", celula: d => d.status === "CONFIRMADO" ? "Confirmado" : "Estornado" },
            { chave: "acoes", titulo: "Ações", acoes: true, celula: d => <div className="leite-consulta-acoes"><DialogConsultaLeite titulo={interna ? "Ver retirada" : "Ver descarte"}><p>Motivo: {d.motivo}</p><p>Saldo da origem: {formatarLitros(d.saldoOrigemAntes)} → {formatarLitros(d.saldoOrigemDepois)}</p><p>Versão {d.versao}</p>{d.motivoEstorno && <p>Motivo do estorno: {d.motivoEstorno}</p>}</DialogConsultaLeite>{podeLancar && d.status === "CONFIRMADO" && <Button variant="outline" aria-label={`Corrigir ${interna ? "retirada" : "descarte"} de ${d.data}`} onClick={() => { setEstorno(d); setMotivoEstorno(""); }}>Corrigir</Button>}</div> },
          ]} />

          <Paginacao pagina={pagina} totalPaginas={Math.max(1, Math.ceil(lista.total / lista.tamanho))} total={lista.total} porPagina={lista.tamanho} rotulo={interna ? "Paginação das retiradas internas" : "Paginação dos descartes"} substantivo={interna ? "retiradas" : "descartes"} idSelect={interna ? "pagina-retiradas-internas-leite" : "pagina-descartes-leite"} onPagina={setPagina} />
        </>
      )}
      {estorno && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void executar(
              `${base}/${estorno.id}/estorno`,
              {
                propriedadeId: estorno.propriedadeId,
                versaoEsperada: estorno.versao,
                motivo: motivoEstorno,
              },
              "Saída estornada; histórico preservado.",
            );
          }}
        >
          <fieldset disabled={ocupado}>
            <legend>Regularizar lançamento da saída</legend>
            <p>
              O estorno desfaz a saída registrada por erro e devolve{" "}
              {formatarLitros(estorno.quantidadeLitros)} ao razão. {interna ? "Use para corrigir um lançamento incorreto, conservando o fato original." : "Leite realmente descartado não retorna ao tanque por esta ação."}
            </p>
            <label>
              Motivo da regularização
              <Textarea
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
