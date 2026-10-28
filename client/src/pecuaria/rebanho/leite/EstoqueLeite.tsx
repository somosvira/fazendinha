import { ProdutoEstoqueVisual, ResumoEstoqueVisual } from "./VisuaisConsultaLeite";
import { AjudaCampo } from "@/components/Dica";
import { ListaConsultaLeite } from "./ListaConsultaLeite";
import { SelectCampo } from "../../../financeiro/SelectCampo";
import { BarraConsulta } from "../../../financeiro/BarraConsulta";
import { BuscaLista } from "../../../components/BuscaLista";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { DialogConsultaLeite as SecaoDetalhesLeite } from "./DialogConsultaLeite";
import { CabecalhoTabela, Paginacao } from "../../../financeiro/financeiro-ui";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import "./consultas-leite.css";
import { useEffect, useRef, useState } from "react";
import { listarProdutos, type ProdutoDTO } from "../../../estoque/api";
import { getPropriedadeAtiva } from "../../../propriedadeScope";
import { obterFolha } from "./api";
import { ConferenciaSaldoLeite } from "./ConferenciaSaldoLeite";
import { ConfirmacaoGruposLeite } from "./ConfirmacaoGruposLeite";
import type { FolhaLeite } from "./types";
import { hojeOperacional, formatarLitros } from "./modelo";
import {
  consultarLeite,
  registrarLeite,
  type EstoqueLeiteDTO,
} from "./operacoes-api";

function DetalheEstoqueLeite({
  podeLancar,
  podeFinanceiro,
  produtoInicial,
}: {
  podeLancar: boolean;
  podeFinanceiro: boolean;
  produtoInicial: string;
}) {
  const sitio = getPropriedadeAtiva();
  const [produtos, setProdutos] = useState<ProdutoDTO[]>([]),
    [produto, setProduto] = useState(produtoInicial);
  const [data, setData] = useState(hojeOperacional),
    [folha, setFolha] = useState<FolhaLeite | null>(null);
  const [estoque, setEstoque] = useState<EstoqueLeiteDTO | null>(null);
  const [erro, setErro] = useState(""),
    [aviso, setAviso] = useState(""),
    [ocupado, setOcupado] = useState(false),
    [revisao, setRevisao] = useState(0);
  const [entrada, setEntrada] = useState(""),
    [valor, setValor] = useState(""),
    [referencia, setReferencia] = useState(""),
    [evidencia, setEvidencia] = useState(""),
    [motivo, setMotivo] = useState("");
  const [operacaoOrigem, setOperacaoOrigem] = useState<{
    id: string;
    acao: "classificar" | "anular";
  } | null>(null);
  const [natureza, setNatureza] = useState("COMERCIAL"),
    [motivoOperacao, setMotivoOperacao] = useState("");
  const geracao = useRef(0);
  useEffect(() => {
    let vivo = true;
    listarProdutos({ ativo: true })
      .then((p) => {
        if (vivo)
          setProdutos(
            p.filter((x) => x.unidade === "L" && !x.rastrearPartidas),
          );
      })
      .catch((e) => {
        if (vivo) setErro(String(e.message));
      });
    return () => {
      vivo = false;
    };
  }, [podeFinanceiro]);
  useEffect(() => {
    const atual = ++geracao.current;
    setEstoque(null);
    setFolha(null);
    setErro("");
    setEntrada("");
    setOperacaoOrigem(null);
    if (!produto) return;
    Promise.all([
      consultarLeite<EstoqueLeiteDTO>(
        `/estoque?produtoId=${encodeURIComponent(produto)}`,
        sitio,
      ),
      obterFolha(data, sitio),
    ])
      .then(([e, f]) => {
        if (atual === geracao.current) {
          setEstoque(e);
          setFolha(f);
        }
      })
      .catch((e) => {
        if (atual === geracao.current) setErro(e.message);
      });
    return () => {
      geracao.current++;
    };
  }, [produto, data, sitio, revisao]);
  async function executar(
    caminho: string,
    dados: Record<string, unknown>,
    sucesso: string,
    chave = true,
  ) {
    if (ocupado || !podeLancar) return;
    const contexto = geracao.current;
    setOcupado(true);
    setErro("");
    setAviso("");
    try {
      await registrarLeite(
        caminho,
        folha?.propriedadeId ?? sitio,
        dados,
        chave,
      );
      if (contexto !== geracao.current) return;
      setAviso(sucesso);
      setRevisao((r) => r + 1);
    } catch (e) {
      if (contexto === geracao.current)
        setErro(e instanceof Error ? e.message : "Não foi possível registrar");
    } finally {
      setOcupado(false);
    }
  }
  const origem = estoque?.origens.find((o) => o.entradaId === entrada);
  const alvo = estoque?.origens.find((o) => o.entradaId === operacaoOrigem?.id);
  return (
    <section className="leite-operacoes">
      <h2 className="leite-titulo-secao">Da ordenha ao estoque <AjudaCampo rotulo="Sobre a confirmação de estoque" texto={"Salvar a folha registra as medições. A confirmação de cada grupo dá entrada apenas nas medições selecionadas, uma única vez, com custo a apurar."} /></h2>

      <div className="leite-form-inline">
        <label>
          Produto de leite
          <SelectCampo
            value={produto}
            disabled={ocupado}
            onValueChange={(valor) => {
              setProduto(valor);
              setAviso("");
            }}
          >
            <option value="">Selecione o produto</option>
            {produtos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </SelectCampo>
        </label>
        <label>
          Dia da produção / retirada
          <input
            type="date"
            value={data}
            disabled={ocupado}
            onChange={(e) => {
              setData(e.target.value);
              setAviso("");
            }}
          />
        </label>
      </div>
      {!produtos.length && (
        <p>
          Cadastre no Estoque um produto de leite em litros, sem rastreio por
          partida, antes da confirmação.
        </p>
      )}
      {erro && <p role="alert">{erro}</p>}
      {aviso && <p role="status">{aviso}</p>}
      {estoque && (
        <>
          <dl className="leite-indicadores">
            <div>
              <dt>Saldo físico disponível</dt>
              <dd>
                {estoque.confiavel && estoque.quantidadeLitros !== null
                  ? formatarLitros(Number(estoque.quantidadeLitros))
                  : "Não aferível"}
              </dd>
            </div>
            <div>
              <dt>Saldo comercial declarado</dt>
              <dd>
                {estoque.comercial.confiavel &&
                estoque.comercial.quantidadeLitros !== null
                  ? formatarLitros(Number(estoque.comercial.quantidadeLitros))
                  : "Não aferível"}
              </dd>
            </div>
            <div>
              <dt>Valor do saldo</dt>
              <dd>
                {estoque.estadoValor === "OCULTO"
                  ? "Sem acesso a valores"
                  : estoque.estadoValor === "PENDENTE"
                    ? "A apurar"
                    : Number(estoque.valorTotal).toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
              </dd>
            </div>
          </dl>
          {!estoque.confiavel && (
            <p role="status">{estoque.motivoNaoAferivel}</p>
          )}
          <h2>Confirmar grupos da produção do dia</h2>
          <Button variant="outline" type="button"
            className="leite-secondary"
            disabled={ocupado}
            onClick={() => setRevisao((r) => r + 1)}>
            Atualizar conferência das medições
          </Button>
          {folha?.configuracao.fonteProducao === "GERAL" ? <p>A produção desta data é aferida nos tanques. Confirme as aferições em Ordenhas → Produção geral; o controle individual não cria outra entrada.</p> : !folha?.id ? (
            <p>
              A folha desse dia ainda não foi salva. Registre as medições em
              Ordenhas.
            </p>
          ) : (
            <>
              <ConfirmacaoGruposLeite
                folha={folha}
                produtoId={produto}
                produtos={produtos}
                podeLancar={podeLancar}
                ocupado={ocupado}
                executar={executar}
              />
            </>
          )}
          <h2>Origens, natureza e apuração <AjudaCampo rotulo="Sobre a apuração do custo" texto={"O custo pode ser documentado depois da retirada. Apurar não altera os litros e não cria outra despesa."} /></h2>

          {!estoque.origens.length ? (
            <p>Nenhuma produção confirmada para este produto neste sítio.</p>
          ) : (
            <div className="leite-tabela-scroll">
              <Table semContainer>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data de origem</TableHead>
                    <TableHead>Saldo da origem</TableHead>
                    <TableHead>Natureza declarada</TableHead>
                    <TableHead>Valor do saldo</TableHead>
                    <TableHead>Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {estoque.origens.map((o) => (
                    <TableRow key={o.entradaId}>
                      <TableCell>
                        {o.data.slice(0, 10).split("-").reverse().join("/")} ·{" "}
                        {o.nomeOrdenha}
                      </TableCell>
                      <TableCell>{formatarLitros(Number(o.quantidadeLitros))}</TableCell>
                      <TableCell>
                        {(
                          {
                            NAO_INFORMADA: "A declarar",
                            COMERCIAL: "Comercial",
                            COLOSTRO: "Colostro",
                            NAO_COMERCIAL: "Descarte",
                          } as Record<string, string>
                        )[o.natureza] ?? "A declarar"}
                      </TableCell>
                      <TableCell>
                        {o.estadoValor === "OCULTO"
                          ? "Restrito"
                          : o.valorTotal === null
                            ? "A apurar"
                            : Number(o.valorTotal).toLocaleString("pt-BR", {
                                style: "currency",
                                currency: "BRL",
                              })}
                      </TableCell>
                      <TableCell>
                        {podeLancar && (
                          <div className="leite-form-inline">
                            {!["COLOSTRO", "NAO_COMERCIAL"].includes(
                              o.natureza,
                            ) && (
                              <Button variant="outline" className="leite-secondary"
                                disabled={ocupado}
                                onClick={() => {
                                  setOperacaoOrigem({
                                    id: o.entradaId,
                                    acao: "classificar",
                                  });
                                  setMotivoOperacao("");
                                }}>
                                Declarar natureza
                              </Button>
                            )}
                            <Button variant="outline" className="leite-secondary"
                              disabled={ocupado}
                              onClick={() => {
                                setOperacaoOrigem({
                                  id: o.entradaId,
                                  acao: "anular",
                                });
                                setMotivoOperacao("");
                              }}>
                              Regularizar entrada
                            </Button>
                          </div>
                        )}
                        {podeFinanceiro && podeLancar && (
                          <Button variant="outline" className="leite-secondary"
                            disabled={ocupado}
                            onClick={() => {
                              setEntrada(o.entradaId);
                              setValor("");
                              setMotivo("");
                            }}>
                            {o.versaoApuracao
                              ? "Corrigir apuração"
                              : "Apurar custo"}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          {alvo && operacaoOrigem && podeLancar && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const classificar = operacaoOrigem.acao === "classificar";
                void executar(
                  classificar
                    ? "/estoque/classificacoes"
                    : "/estoque/anulacoes",
                  {
                    entradaId: alvo.entradaId,
                    motivo: motivoOperacao,
                    ...(classificar
                      ? { natureza, versaoEsperada: alvo.versaoClassificacao }
                      : {}),
                  },
                  classificar
                    ? "Natureza da entrada declarada."
                    : "Entrada anulada; confira a ordenha antes de confirmar novamente.",
                  classificar,
                );
              }}
            >
              <fieldset disabled={ocupado}>
                <legend>
                  {operacaoOrigem.acao === "classificar"
                    ? "Declarar natureza do grupo de origem"
                    : "Regularizar entrada da ordenha"}
                </legend>
                <p>
                  {alvo.data.slice(0, 10)} · {alvo.nomeOrdenha}
                </p>
                {operacaoOrigem.acao === "classificar" ? (
                  <>
                    <p>
                      Esta declaração afeta apenas este grupo de origem, sem
                      alterar os outros animais ou grupos da ordenha. A
                      declaração comercial é uma informação de vocês; não
                      certifica aptidão sanitária. Uma restrição não poderá ser
                      desfeita por esta tela.
                    </p>
                    <label>
                      Natureza
                      <SelectCampo disabled={ocupado}
                        value={natureza}
                        onValueChange={(valor) => setNatureza(valor)}
                      >
                        <option value="COMERCIAL">Comercial</option>
                        <option value="COLOSTRO">Colostro</option>
                        <option value="NAO_COMERCIAL">Descarte</option>
                      </SelectCampo>
                    </label>
                  </>
                ) : (
                  <p>
                    A anulação preserva o histórico e só é permitida sem litros
                    consumidos ou vendidos. Depois de regularizar todos os
                    grupos que bloqueiam uma alteração, a folha poderá ser
                    corrigida e as medições reconfirmadas, respeitando a
                    cronologia do estoque.
                  </p>
                )}
                <label>
                  Justificativa
                  <textarea
                    required
                    minLength={5}
                    maxLength={500}
                    value={motivoOperacao}
                    onChange={(e) => setMotivoOperacao(e.target.value)}
                  />
                </label>
                <div className="leite-form-inline">
                  <Button >
                    Confirmar{" "}
                    {operacaoOrigem.acao === "classificar"
                      ? "declaração"
                      : "anulação"}
                  </Button>
                  <Button variant="outline" className="leite-secondary"
                    type="button"
                    onClick={() => setOperacaoOrigem(null)}>
                    Cancelar
                  </Button>
                </div>
              </fieldset>
            </form>
          )}
          {origem && podeFinanceiro && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void executar(
                  "/estoque/apuracoes",
                  {
                    entradaId: entrada,
                    versaoEsperada: origem.versaoApuracao,
                    valorTotal: Number(valor),
                    referencia,
                    evidencia,
                    motivo,
                  },
                  "Custo documentado e apropriado às saídas e ao saldo.",
                );
              }}
            >
              <fieldset disabled={ocupado || !podeLancar}>
                <legend>Valor total da produção de origem</legend>
                <p>
                  Informe o custo de toda a entrada, inclusive os litros que já
                  saíram.
                </p>
                <div className="leite-form-inline">
                  <label>
                    Valor total (R$)
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      required
                      value={valor}
                      onChange={(e) => setValor(e.target.value)}
                    />
                  </label>
                  <label>
                    Referência do fechamento
                    <input
                      required
                      minLength={2}
                      maxLength={200}
                      value={referencia}
                      onChange={(e) => setReferencia(e.target.value)}
                    />
                  </label>
                </div>
                <label>
                  Evidência do custo
                  <textarea
                    required
                    minLength={5}
                    maxLength={2000}
                    value={evidencia}
                    onChange={(e) => setEvidencia(e.target.value)}
                  />
                </label>
                <label>
                  Justificativa
                  <textarea
                    required
                    minLength={5}
                    maxLength={500}
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                  />
                </label>
                <Button >Confirmar apuração</Button>
              </fieldset>
            </form>
          )}

        </>
      )}
      {produto && estoque && <ConferenciaSaldoLeite key={`${produto}:${data}:${sitio}`} produtoId={produto} data={data} propriedadeId={folha?.propriedadeId ?? sitio} podeLancar={podeLancar} />}

    </section>
  );
}

interface ItemResumoEstoque { produtoId: string; nome: string; quantidadeLitros: string | null; comercial: { quantidadeLitros: string | null }; classificacaoPendenteLitros?: string | null; custoPendenteLitros?: string | null; descarteLitros: string | null; colostroLitros: string | null; estadoValor: string; valorTotal: string | null; confiavel: boolean }
interface ResumoEstoque { resumo: { classificacaoPendenteLitros?: string | null; custoPendenteLitros?: string | null; estadoValor?: string; quantidadeLitros: string | null; comercial: { quantidadeLitros: string | null }; descarteLitros: string | null; colostroLitros: string | null; produtosSemLastro: number }; itens: ItemResumoEstoque[]; total: number; pagina: number; porPagina: number }
const litrosResumo = (v: string | null) => formatarLitros(v === null ? null : Number(v));
export function EstoqueLeite({ podeLancar, podeFinanceiro }: { podeLancar: boolean; podeFinanceiro: boolean }) {
  const sitio = getPropriedadeAtiva();
  const [dados, setDados] = useState<ResumoEstoque | null>(null), [erro, setErro] = useState("");
  const [busca, setBusca] = useState(""), [pagina, setPagina] = useState(1), [revisao, setRevisao] = useState(0);
  const [selecionado, setSelecionado] = useState<ItemResumoEstoque | null>(null);
  const [confirmacao, setConfirmacao] = useState(false);
  useEffect(() => { let ativo = true; setDados(null); setErro(""); void consultarLeite<ResumoEstoque>(`/estoque/resumo?${new URLSearchParams({ busca, pagina: String(pagina), porPagina: "20" })}`, sitio).then(r => { if (ativo) setDados(r); }).catch(e => { if (ativo) setErro(e instanceof Error ? e.message : "Não foi possível consultar o estoque."); }); return () => { ativo = false; }; }, [sitio, busca, pagina, revisao]);
  return <section className="leite-operacoes leite-consultas"><CabecalhoTabela titulo="Estoque de leite" ajuda="Saldo das origens confirmadas, por produto." rotuloAjuda="Sobre estoque de leite" acao={podeLancar ? <Button onClick={() => setConfirmacao(true)}>Confirmar produção individual</Button> : undefined} />
    <BarraConsulta><BuscaLista rotulo="Buscar produto" placeholder="Buscar produto de leite" valor={busca} onChange={v => { setBusca(v); setPagina(1); }} /></BarraConsulta>
    {erro ? <p role="alert">{erro} <Button variant="outline" onClick={() => setRevisao(r => r + 1)}>Tentar novamente</Button></p> : !dados ? <p role="status">Consultando estoque…</p> : <>
      <ResumoEstoqueVisual resumo={dados.resumo}/>
      {dados.resumo.produtosSemLastro > 0 && <p role="status">Há produtos com saldo sem lastro conciliado.</p>}
      <ListaConsultaLeite layout="linhas" renderizarVisual={i => <ProdutoEstoqueVisual item={i} abrir={() => setSelecionado(i)}/>} preferencia="estoqueLeiteVisualizacao" destaque="saldo" rotulo="Saldos de leite por produto" itens={dados.itens} chaveDe={i => i.produtoId} colunas={[
        { chave: "produto", titulo: "Produto", principal: true, celula: i => i.nome },
        { chave: "saldo", titulo: "Saldo físico", alinhamento: "direita", celula: i => litrosResumo(i.quantidadeLitros) },
        { chave: "comercial", titulo: "Comercial", alinhamento: "direita", celula: i => litrosResumo(i.comercial.quantidadeLitros) },
        { chave: "valor", titulo: "Valor", alinhamento: "direita", celula: i => i.estadoValor === "OCULTO" ? "Restrito" : i.valorTotal === null ? "A apurar" : Number(i.valorTotal).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) },
        { chave: "acao", titulo: "Ações", celula: i => <Button variant="outline" onClick={() => setSelecionado(i)}>Ver origens</Button> },
      ]} />
      <Paginacao pagina={pagina} totalPaginas={Math.max(1, Math.ceil(dados.total / dados.porPagina))} total={dados.total} porPagina={dados.porPagina} rotulo="Paginação do estoque de leite" substantivo="produtos" idSelect="pagina-estoque-leite" onPagina={setPagina} />
    </>}
    <Dialog open={!!selecionado || confirmacao} onOpenChange={v => { if (!v) { setSelecionado(null); setConfirmacao(false); setRevisao(r => r + 1); } }}><DialogContent className="leite-consulta-dialog" data-fin-scroll="conteudo" aria-describedby={undefined}><DialogHeader><DialogTitle>{confirmacao ? "Confirmar produção individual" : `${selecionado?.nome} · origens e operações`}</DialogTitle></DialogHeader>{(selecionado || confirmacao) && <DetalheEstoqueLeite key={selecionado?.produtoId ?? "confirmar"} produtoInicial={selecionado?.produtoId ?? ""} podeLancar={podeLancar} podeFinanceiro={podeFinanceiro} />}</DialogContent></Dialog>
  </section>;
}
