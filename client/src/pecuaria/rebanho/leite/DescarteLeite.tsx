import { Button } from "@/components/ui/button";
import { Table, TableCaption, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
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
      <h2>Descarte físico</h2>
      <p>
        Registre somente leite efetivamente descartado. Alimentação de animais
        usa o destino acima. Uma carência ou uma análise não informa
        automaticamente quantos litros foram descartados.
      </p>
      <div className="leite-form-inline">
        <label>
          Data do descarte
          <input
            type="date"
            required
            max={hojeOperacional()}
            value={data}
            onChange={(e) => {
              setData(e.target.value);
              setPagina(1);
            }}
          />
        </label>
        <label>
          Produto para descarte
          <select value={produto} onChange={(e) => setProduto(e.target.value)}>
            <option value="">Selecione o produto</option>
            {produtos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
        </label>
      </div>
      {erro && <p role="alert">{erro}</p>}
      {aviso && <p role="status">{aviso}</p>}
      {podeLancar && produto && (
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
                <select
                  required
                  value={entradaId}
                  onChange={(e) => setEntradaId(e.target.value)}
                >
                  <option value="">Selecione a origem</option>
                  {origens.map((o) => (
                    <option key={o.entradaId} value={o.entradaId}>
                      {o.data} · {o.nomeOrdenha ?? "Ordenha"} ·{" "}
                      {formatarLitros(Number(o.quantidadeDisponivelLitros))}
                    </option>
                  ))}
                </select>
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
      )}
      {lista && (
        <>
          <div className="leite-tabela-scroll">
            <Table semContainer>
              <TableCaption>Descartes do mês até a data selecionada</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Data e origem</TableHead>
                  <TableHead>Litros</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead>Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lista.itens.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>
                      {d.data} · {d.nomeOrdenha}
                      <small>{d.produtoNome}</small>
                    </TableCell>
                    <TableCell>{formatarLitros(d.quantidadeLitros)}</TableCell>
                    <TableCell>{d.motivo}</TableCell>
                    <TableCell>
                      {d.status === "CONFIRMADO" ? "Confirmado" : "Estornado"}
                      {d.motivoEstorno && <small>{d.motivoEstorno}</small>}
                    </TableCell>
                    <TableCell>
                      {podeLancar && d.status === "CONFIRMADO" && (
                        <Button variant="outline"
                          className="leite-secondary"
                          onClick={() => {
                            setEstorno(d);
                            setMotivoEstorno("");
                          }}
                        >
                          Corrigir descarte de {d.data}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {!lista.itens.length && (
            <p>Nenhum descarte registrado neste período.</p>
          )}
          <div className="leite-form-inline">
            <Button variant="outline"
              className="leite-secondary"
              disabled={pagina === 1}
              onClick={() => setPagina((p) => p - 1)}
            >
              Descartes anteriores
            </Button>
            <span>Página {pagina}</span>
            <Button variant="outline"
              className="leite-secondary"
              disabled={pagina * lista.tamanho >= lista.total}
              onClick={() => setPagina((p) => p + 1)}
            >
              Próximos descartes
            </Button>
          </div>
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
