import { AjudaCampo } from "@/components/Dica";
import { Table, TableCaption, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ExportacaoProducaoLeite } from "./ExportacaoProducaoLeite";
import { SecaoDetalhesLeite } from "./SecaoDetalhesLeite";
import { useEffect, useRef, useState } from "react";
import { getPropriedadeAtiva, comPropriedade } from "../../../propriedadeScope";
import { consultarLeite, registrarLeite } from "./operacoes-api";
import { hojeOperacional, formatarLitros } from "./modelo";
import { RitmoLeite, type DiaRitmoLeite } from "./RitmoLeite";
import { DatasQualidade } from "./DatasQualidade";
import type { AmostraQualidade } from "./qualidade-types";
interface ListaEmissoes {
  propriedadeId: number;
  total: number;
  pagina: number;
  tamanho: number;
  itens: {
    id: string;
    inicio: string;
    fim: string;
    corteEm: string;
    versaoCalculo: string;
    valoresIncluidos: boolean;
  }[];
}
interface Balanco {
  produtoId: string;
  produtoNome: string;
  abertura: string;
  producaoConfirmada: string;
  vendas: string;
  interno: string;
  descarte: string;
  outrosMovimentos: string;
  encerramentoRazao: string | null;
  medicaoCampo?: {
    litrosObservados: string;
    data: string;
    referencia: string;
    versao: number;
  } | null;
  divergenciaLitros?: string | null;
  confiavel: boolean;
  pendencias: string[];
}
interface ComercialDocumental {
  entregas: {
    id: string;
    referencia: string;
    produtoNome: string;
    data: string;
    numeroOperacao: number | null;
    parceiroNome: string;
    expedidoLitros: string;
    volumeAceito: string | null;
    quantidadeFaturadaLitros: string;
    motivo: string | null;
  }[];
  demonstrativos: {
    id: string;
    referencia: string;
    inicio: string;
    fim: string;
    parceiroNome: string;
    versao: number;
    volumeReconhecidoLitros: string;
    alocacoes: {
      id: string;
      dataEntrega: string;
      numeroOperacao: number;
      quantidadeLitros: string;
    }[];
  }[];
}
interface ValoresDocumentais {
  faturamento: {
    quantidadeLitros: string;
    valorFaturado: string;
    precoFaturadoPorLitro: string | null;
  };
  demonstrativos: {
    id: string;
    precoBase: string;
    valorComercial: string;
    valorPagamentoInformado: string | null;
    componentes: { natureza: string; valor: number; referencia: string }[];
  }[];
}
interface OperacaoPeriodoPreservada {
  id: string;
  parceiroNome: string;
  referencia: string;
  inicio: string;
  fim: string;
  parcialForaFiltro: boolean;
  situacao: string;
  fechamento: null | {
    id: string;
    versao: number;
    numeroOperacao: number;
    data: string;
    statusFinanceiro: string;
    volumeReconhecidoLitros: string;
    amostras: { amostraId: string; versaoAmostra: number; data?: string | null; dataResultadoLaboratorial?: string | null; dataRecebimentoLaudo?: string | null; criadoEm?: string }[];
  };
}
interface ValorOperacaoPeriodo {
  comercialId: string;
  fechamentoId: string;
  precoUnitario: string;
  ajuste: string;
  valorTotal: string;
}
interface Emissao {
  id: string;
  criadoEm: string;
  snapshot: {
    corteEm: string;
    versaoCalculo: string;
    propriedade: { id: number; nome: string };
    filtros: { inicio: string; fim: string };
    valoresIncluidos: boolean;
    cobertura: {
      producao: {
        diasInformados: number;
        diasSemFolha: string[];
        diasParciais: string[];
        completa: boolean;
      };
      producaoNaoConfirmadaLitros: string | null;
    };
    dados: {
      producao: {
        ritmo: DiaRitmoLeite[];
        consolidado: { litros: number | null };
        animais: {
          animalId: string;
          nome: string | null;
          brinco: string | null;
          producao: { litros: number | null; pendentes: number };
        }[];
      };
      qualidade: AmostraQualidade[];
      destinos: {
        id: string;
        data: string;
        natureza: string;
        quantidadeLitros: string;
      }[];
      descartes: {
        id: string;
        data: string;
        quantidadeLitros: string;
        motivo: string;
      }[];
      balanco: Balanco[];
      comercial?: { movimentoId: string; data: string; produtoNome: string; quantidadeLitros: string; tipo: string; numeroOperacao: number | null; naturezaComercial?: string }[];
      comercialDocumental?: ComercialDocumental;
      operacoesComerciais?: OperacaoPeriodoPreservada[];
    };
    valores: null | {
      custos: {
        consolidado: {
          custoPorLitro: string | null;
          custos: { totalConhecido: string | null };
        };
      };
      comercial: { operacaoId: string; valorTotal: string }[];
      documental?: ValoresDocumentais;
      operacoesComerciais?: ValorOperacaoPeriodo[];
    };
    limitacoes: string[];
  };
}
const dinheiro = (v: string | null) =>
  v === null
    ? "Não apurado"
    : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataPt = (data: string) =>
  data.slice(0, 10).split("-").reverse().join("/");
export function RelatoriosLeite({
  podeExportar,
  podeFinanceiro,
}: {
  podeExportar: boolean;
  podeFinanceiro: boolean;
}) {
  const sitio = getPropriedadeAtiva();
  const [inicio, setInicio] = useState(
    () =>
      new URLSearchParams(location.search).get("inicio") ??
      `${hojeOperacional().slice(0, 7)}-01`,
  );
  const [fim, setFim] = useState(
    () => new URLSearchParams(location.search).get("fim") ?? hojeOperacional(),
  );
  const [incluirValores, setIncluirValores] = useState(false);
  const [lista, setLista] = useState<ListaEmissoes | null>(null),
    [pagina, setPagina] = useState(1),
    [revisao, setRevisao] = useState(0);
  const [emissao, setEmissao] = useState<Emissao | null>(null),
    [erro, setErro] = useState(""),
    [ocupado, setOcupado] = useState(false);
  const trava = useRef(false),
    geracao = useRef(0);
  useEffect(() => {
    const atual = ++geracao.current;
    setLista(null);
    setErro("");
    setEmissao(null);
    void consultarLeite<ListaEmissoes>(
      `/relatorios/emissoes?pagina=${pagina}`,
      sitio,
    )
      .then((r) => {
        if (atual === geracao.current) setLista(r);
      })
      .catch((e) => {
        if (atual === geracao.current)
          setErro(
            e instanceof Error ? e.message : "Falha na consulta dos relatórios",
          );
      });
    return () => {
      geracao.current++;
    };
  }, [sitio, pagina, revisao]);
  async function emitir() {
    if (trava.current) return;
    trava.current = true;
    setOcupado(true);
    setErro("");
    const atual = geracao.current;
    try {
      const r = await registrarLeite<Emissao>(
        "/relatorios/emissoes",
        lista?.propriedadeId ?? sitio,
        { inicio, fim, incluirValores: podeFinanceiro && incluirValores },
      );
      if (atual === geracao.current) {
        setEmissao(r);
      }
    } catch (e) {
      if (atual === geracao.current)
        setErro(e instanceof Error ? e.message : "Falha na emissão");
    } finally {
      trava.current = false;
      setOcupado(false);
    }
  }
  async function abrir(id: string) {
    const atual = ++geracao.current;
    setErro("");
    setEmissao(null);
    try {
      const r = await consultarLeite<Emissao>(
        `/relatorios/emissoes/${id}`,
        lista?.propriedadeId ?? sitio,
      );
      if (atual === geracao.current) setEmissao(r);
    } catch (e) {
      if (atual === geracao.current)
        setErro(e instanceof Error ? e.message : "Falha ao abrir emissão");
    }
  }
  async function baixar() {
    if (!emissao || trava.current) return;
    trava.current = true;
    setOcupado(true);
    setErro("");
    try {
      const r = await fetch(
        `/api/pecuaria/rebanho/leite/relatorios/emissoes/${emissao.id}/csv`,
        {
          headers: {
            ...comPropriedade(),
            "X-Propriedade-Id": String(emissao.snapshot.propriedade.id),
          },
        },
      );
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.error ?? "Falha na exportação");
      }
      const url = URL.createObjectURL(await r.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = `leite-${emissao.snapshot.filtros.inicio}-${emissao.snapshot.filtros.fim}.csv`;
      a.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha na exportação");
    } finally {
      trava.current = false;
      setOcupado(false);
    }
  }
  return (
    <section className="leite-operacoes leite-comercial-consulta">
      <ExportacaoProducaoLeite podeExportar={podeExportar} />
      <h2 className="leite-titulo-secao">Relatórios preservados de leite <AjudaCampo rotulo="Sobre as emissões preservadas" texto={"Uma emissão conserva os dados consultados e a cobertura daquele momento. Abrir novamente não recalcula os números após correções."} /></h2>

      {podeExportar ? (
        <form
          className="leite-form-inline"
          onSubmit={(e) => {
            e.preventDefault();
            void emitir();
          }}
        >
          <label>
            Início do relatório
            <input
              type="date"
              required
              value={inicio}
              max={fim}
              onChange={(e) => setInicio(e.target.value)}
            />
          </label>
          <label>
            Fim do relatório
            <input
              type="date"
              required
              value={fim}
              min={inicio}
              max={hojeOperacional()}
              onChange={(e) => setFim(e.target.value)}
            />
          </label>
          {podeFinanceiro && (
            <label className="leite-checkbox">
              <input
                type="checkbox"
                checked={incluirValores}
                onChange={(e) => setIncluirValores(e.target.checked)}
              />
              Incluir valores financeiros
            </label>
          )}
          <Button disabled={ocupado || !lista}>
            Emitir relatório preservado
          </Button>
        </form>
      ) : (
        <p>
          Seu acesso permite consultar as emissões. Criar e exportar exige
          permissão de exportação.
        </p>
      )}
      {erro && <p role="alert">{erro}</p>}
      {lista && (
        <SecaoDetalhesLeite inicialmenteAberto titulo={<>Emissões disponíveis</>}>

          {lista.itens.length ? (
            <div className="leite-tabela-scroll">
              <Table semContainer>
                <TableCaption>Relatórios emitidos neste sítio</TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead>Período</TableHead>
                    <TableHead>Corte da consulta</TableHead>
                    <TableHead>Conteúdo</TableHead>
                    <TableHead>Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lista.itens.map((i) => (
                    <TableRow key={i.id}>
                      <TableCell>
                        {dataPt(i.inicio)} a {dataPt(i.fim)}
                      </TableCell>
                      <TableCell>{new Date(i.corteEm).toLocaleString("pt-BR")}</TableCell>
                      <TableCell>
                        {i.valoresIncluidos
                          ? "Operacional e financeiro"
                          : "Operacional"}
                      </TableCell>
                      <TableCell>
                        <Button variant="outline" className="leite-secondary"
                          onClick={() => void abrir(i.id)}>
                          Abrir relatório de {dataPt(i.inicio)}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p>Nenhum relatório emitido neste sítio.</p>
          )}
          <div className="leite-form-inline">
            <Button variant="outline" className="leite-secondary"
              disabled={pagina === 1}
              onClick={() => setPagina((p) => p - 1)}>
              Emissões anteriores
            </Button>
            <span>Página {pagina}</span>
            <Button variant="outline" className="leite-secondary"
              disabled={pagina * lista.tamanho >= lista.total}
              onClick={() => setPagina((p) => p + 1)}>
              Próximas emissões
            </Button>
            <Button variant="outline" className="leite-secondary"
              onClick={() => setRevisao((r) => r + 1)}>
              Atualizar lista de emissões
            </Button>
          </div>
        </SecaoDetalhesLeite>
      )}
      {emissao && (
        <>
          <div className="leite-form-inline">
            {podeExportar && (
              <Button disabled={ocupado} onClick={() => void baixar()}>
                Exportar esta emissão em CSV
              </Button>
            )}
          </div>
          <ConteudoEmissao key={emissao.id} emissao={emissao} podeFinanceiro={podeFinanceiro} />
        </>
      )}
    </section>
  );
}
function ConteudoEmissao({ emissao, podeFinanceiro }: { emissao: Emissao; podeFinanceiro: boolean }) {
  const s = { ...emissao.snapshot, valores: podeFinanceiro ? emissao.snapshot.valores : null };
  const [paginaAnimal, setPaginaAnimal] = useState(1),
    [paginaQualidade, setPaginaQualidade] = useState(1),
    [paginaSaida, setPaginaSaida] = useState(1);
  return (
    <article aria-label="Relatório de leite preservado">
      <h2>
        {s.propriedade.nome} · {dataPt(s.filtros.inicio)} a{" "}
        {dataPt(s.filtros.fim)}
      </h2>
      <p>
        Consulta preservada em {new Date(s.corteEm).toLocaleString("pt-BR")} ·
        metodologia {s.versaoCalculo}.
      </p>
      <dl className="leite-indicadores">
        <div>
          <dt>Litros medidos</dt>
          <dd>{formatarLitros(s.dados.producao.consolidado.litros)}</dd>
        </div>
        <div>
          <dt>Dias sem folha</dt>
          <dd>{s.cobertura.producao.diasSemFolha.length}</dd>
        </div>
        <div>
          <dt>Dias parciais</dt>
          <dd>{s.cobertura.producao.diasParciais.length}</dd>
        </div>
      </dl>
      <RitmoLeite dias={s.dados.producao.ritmo} />
      <div className="leite-tabela-scroll">
        <Table semContainer>
          <TableCaption>Produção individual preservada</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Animal</TableHead>
              <TableHead>Litros medidos</TableHead>
              <TableHead>Medições pendentes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {s.dados.producao.animais
              .slice((paginaAnimal - 1) * 50, paginaAnimal * 50)
              .map((a) => (
                <TableRow key={a.animalId}>
                  <TableCell>
                    {a.brinco ?? "Sem brinco"} · {a.nome ?? "Sem nome"}
                  </TableCell>
                  <TableCell>{formatarLitros(a.producao.litros)}</TableCell>
                  <TableCell>{a.producao.pendentes}</TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>
      <PaginasPreservadas
        titulo="Animais"
        pagina={paginaAnimal}
        total={s.dados.producao.animais.length}
        onChange={setPaginaAnimal}
      />
      <div className="leite-tabela-scroll">
        <Table semContainer>
          <TableCaption>Balanço do razão de estoque</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Produto</TableHead>
              <TableHead>Abertura</TableHead>
              <TableHead>Produção confirmada</TableHead>
              <TableHead>Vendas</TableHead>
              <TableHead>Alimentação</TableHead>
              <TableHead>Descarte</TableHead>
              <TableHead>Outros movimentos</TableHead>
              <TableHead>Encerramento calculado</TableHead>
              <TableHead>Medição física</TableHead>
              <TableHead>Diferença observada</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {s.dados.balanco.map((b) => (
              <TableRow key={b.produtoId}>
                <TableCell>
                  {b.produtoNome}
                  {!b.confiavel && <small>Há pendências no lastro.</small>}
                </TableCell>
                {[
                  b.abertura,
                  b.producaoConfirmada,
                  b.vendas,
                  b.interno,
                  b.descarte,
                  b.outrosMovimentos,
                  b.encerramentoRazao,
                ].map((v, i) => (
                  <TableCell key={i}>
                    {formatarLitros(v === null ? null : Number(v))}
                  </TableCell>
                ))}
                <TableCell>
                  {b.medicaoCampo
                    ? formatarLitros(Number(b.medicaoCampo.litrosObservados))
                    : "Não informada"}
                </TableCell>
                <TableCell>
                  {formatarLitros(
                    b.divergenciaLitros == null
                      ? null
                      : Number(b.divergenciaLitros),
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p>
        O encerramento é calculado dos movimentos. Não comprova medição física
        do tanque nem conciliação de campo. Produção medida ainda não
        confirmada:{" "}
        {formatarLitros(
          s.cobertura.producaoNaoConfirmadaLitros === null
            ? null
            : Number(s.cobertura.producaoNaoConfirmadaLitros),
        )}
        .
      </p>
      <h2>Qualidade nas amostras</h2>
      {!s.dados.qualidade.length && (
        <p>
          Nenhuma análise registrada neste período. Isso não comprova qualidade
          nem ausência de restrição.
        </p>
      )}
      {s.dados.qualidade
        .slice((paginaQualidade - 1) * 50, paginaQualidade * 50)
        .map((a) => (
          <section key={a.id}>
            <h3>
              {a.formatoSnapshot.nome} · versão {a.formatoSnapshot.versao ?? 1}
            </h3>
            <p>
              {dataPt(a.data)} ·{" "}
              {a.sujeito.tipo === "COLETIVO"
                ? a.sujeito.origem
                : `${a.animal?.brinco ?? "Sem brinco"} · ${a.animal?.nome ?? "Sem nome"}`}
            </p>
            {("dataResultadoLaboratorial" in a || "dataRecebimentoLaudo" in a) && <DatasQualidade {...a} />}
            {a.resultados.length ? (
              <dl>
                {a.resultados.map((r) => {
                  const c = a.formatoSnapshot.campos.find(
                    (c) => c.codigo === r.campo,
                  );
                  return (
                    <div key={r.campo}>
                      <dt>{c?.rotulo ?? "Resultado"}</dt>
                      <dd>
                        {typeof r.valor === "boolean"
                          ? r.valor
                            ? "Sim"
                            : "Não"
                          : typeof r.valor === "number"
                            ? r.valor.toLocaleString("pt-BR", {
                                maximumFractionDigits: 12,
                              })
                            : String(r.valor)}{" "}
                        {c?.unidade ?? ""}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            ) : (
              <p>Aguardando resultado.</p>
            )}
          </section>
        ))}
      <PaginasPreservadas
        titulo="Amostras"
        pagina={paginaQualidade}
        total={s.dados.qualidade.length}
        onChange={setPaginaQualidade}
      />
      <h2>Alimentação e descarte</h2>
      <div className="leite-tabela-scroll">
        <Table semContainer>
          <TableCaption>Saídas internas preservadas</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Destino</TableHead>
              <TableHead>Litros</TableHead>
              <TableHead>Motivo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {s.dados.destinos
              .slice((paginaSaida - 1) * 50, paginaSaida * 50)
              .map((d) => (
                <TableRow key={d.id}>
                  <TableCell>{dataPt(d.data)}</TableCell>
                  <TableCell>
                    {d.natureza === "COLOSTRO"
                      ? "Colostro aos animais"
                      : ["LEITE_NAO_COMERCIAL", "NAO_COMERCIAL"].includes(d.natureza)
                        ? "Leite não comercial aos animais"
                        : d.natureza === "MISTA" ? "Mistura de origens aos animais" : "Leite comum aos animais"}
                  </TableCell>
                  <TableCell>{formatarLitros(Number(d.quantidadeLitros))}</TableCell>
                  <TableCell>Conforme registro do destino</TableCell>
                </TableRow>
              ))}
            {s.dados.descartes
              .slice((paginaSaida - 1) * 50, paginaSaida * 50)
              .map((d) => (
                <TableRow key={d.id}>
                  <TableCell>{dataPt(d.data)}</TableCell>
                  <TableCell>Descarte físico</TableCell>
                  <TableCell>{formatarLitros(Number(d.quantidadeLitros))}</TableCell>
                  <TableCell>{d.motivo}</TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>
      <PaginasPreservadas
        titulo="Saídas"
        pagina={paginaSaida}
        total={Math.max(s.dados.destinos.length, s.dados.descartes.length)}
        onChange={setPaginaSaida}
      />
      {!!s.dados.comercial?.length && <section aria-label="Retiradas comerciais preservadas">
        <h2>Retiradas comerciais <AjudaCampo rotulo="Sobre as retiradas físicas" texto={"A retirada física conserva sua data mesmo com preço pendente; não representa recebimento."} /></h2>

        <div className="leite-tabela-scroll" tabIndex={0} aria-label="Retiradas preservadas, com rolagem horizontal"><Table semContainer>
          <TableCaption>Retiradas comerciais e inversos no período</TableCaption><TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Produto</TableHead><TableHead>Litros</TableHead><TableHead>Movimento</TableHead><TableHead>Venda</TableHead></TableRow></TableHeader>
          <TableBody>{s.dados.comercial.map(r => <TableRow key={r.movimentoId}><TableCell>{dataPt(r.data)}</TableCell><TableCell>{r.produtoNome}</TableCell><TableCell>{formatarLitros(Number(r.quantidadeLitros))}</TableCell><TableCell>{r.tipo === "ENTRADA" ? "Inverso" : "Retirada"}</TableCell><TableCell>{r.numeroOperacao === null ? "Preço não inferido" : `Nº ${r.numeroOperacao}`}</TableCell></TableRow>)}</TableBody>
        </Table></div>
      </section>}
      {s.dados.operacoesComerciais && <OperacoesPeriodoPreservadas dados={s.dados.operacoesComerciais} valores={s.valores?.operacoesComerciais} />}
      {s.dados.comercialDocumental && (
        <ComercialPreservado
          dados={s.dados.comercialDocumental}
          valores={s.valores?.documental ?? null}
        />
      )}
      {s.valores ? (
        <>
          <h2>Valores preservados <AjudaCampo rotulo="Sobre os valores preservados" texto={"Os valores são os conhecidos no corte da emissão. Custo direto não representa custo total nem lucro."} /></h2>
          <dl className="leite-indicadores">
            <div>
              <dt>Custo direto registrado</dt>
              <dd>
                {dinheiro(s.valores.custos.consolidado.custos.totalConhecido)}
              </dd>
            </div>
            <div>
              <dt>Custo por litro</dt>
              <dd>{dinheiro(s.valores.custos.consolidado.custoPorLitro)}</dd>
            </div>
          </dl>

        </>
      ) : (
        <p>
          Valores financeiros não incluídos ou ocultos pela permissão atual.
        </p>
      )}
      <SecaoDetalhesLeite  titulo={<>Fontes e limites desta emissão</>}>

        <ul>
          {s.limitacoes.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </SecaoDetalhesLeite>
    </article>
  );
}

function PaginasPreservadas({
  titulo,
  pagina,
  total,
  onChange,
}: {
  titulo: string;
  pagina: number;
  total: number;
  onChange: (n: number) => void;
}) {
  return total > 50 ? (
    <div className="leite-form-inline">
      <Button variant="outline" className="leite-secondary"
        disabled={pagina === 1}
        onClick={() => onChange(pagina - 1)}>
        {titulo} anteriores
      </Button>
      <span>
        Página {pagina} de {Math.ceil(total / 50)}
      </span>
      <Button variant="outline" className="leite-secondary"
        disabled={pagina * 50 >= total}
        onClick={() => onChange(pagina + 1)}>
        Próximos registros de {titulo.toLowerCase()}
      </Button>
    </div>
  ) : null;
}

function ComercialPreservado({
  dados,
  valores,
}: {
  dados: ComercialDocumental;
  valores: ValoresDocumentais | null;
}) {
  const [pagina, setPagina] = useState(1);
  const total = Math.max(dados.entregas.length, dados.demonstrativos.length);
  return (
    <section aria-label="Comercial preservado no relatório">
      <h2>Expedição, aceite e faturamento  <AjudaCampo rotulo="Sobre o recorte dos documentos" texto={"Faturamento documentado, preço da venda e recebimento são referências distintas. O demonstrativo não confirma entrada de dinheiro. As parcelas consideradas pertencem às entregas do período consultado. Cabeçalhos e componentes dos demonstrativos conservam o período integral declarado pelo comprador."} /></h2>

      <div className="leite-tabela-scroll">
        <Table semContainer>
          <TableCaption>Entregas e volumes preservados</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Data e comprovante</TableHead>
              <TableHead>Comprador e venda</TableHead>
              <TableHead>Expedido</TableHead>
              <TableHead>Aceito</TableHead>
              <TableHead>Faturado documentado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {dados.entregas.slice((pagina - 1) * 50, pagina * 50).map((e) => (
              <TableRow key={e.id}>
                <TableCell>
                  {dataPt(e.data)} · {e.referencia}
                  <small>{e.produtoNome}</small>
                </TableCell>
                <TableCell>
                  {e.parceiroNome}
                  <small>
                    {e.numeroOperacao === null
                      ? "Venda sem número informado"
                      : `Venda #${e.numeroOperacao}`}
                  </small>
                </TableCell>
                <TableCell>{formatarLitros(Number(e.expedidoLitros))}</TableCell>
                <TableCell>
                  {formatarLitros(
                    e.volumeAceito === null ? null : Number(e.volumeAceito),
                  )}
                </TableCell>
                <TableCell>{formatarLitros(Number(e.quantidadeFaturadaLitros))}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {valores && (
        <dl className="leite-indicadores">
          <div>
            <dt>Volume faturado no recorte</dt>
            <dd>
              {formatarLitros(Number(valores.faturamento.quantidadeLitros))}
            </dd>
          </div>
          <div>
            <dt>Valor faturado documentado</dt>
            <dd>{dinheiro(valores.faturamento.valorFaturado)}</dd>
          </div>
          <div>
            <dt>Preço por litro faturado</dt>
            <dd>{dinheiro(valores.faturamento.precoFaturadoPorLitro)}</dd>
          </div>
        </dl>
      )}
      {!dados.demonstrativos.length && (
        <p>Nenhum demonstrativo alocado às entregas deste período.</p>
      )}
      {dados.demonstrativos.slice((pagina - 1) * 50, pagina * 50).map((d) => {
        const v = valores?.demonstrativos.find((v) => v.id === d.id);
        return (
          <SecaoDetalhesLeite key={d.id} titulo={<>
              {d.referencia} · {d.parceiroNome} · versão {d.versao}
            </>}>

            <p>
              Documento integral de {dataPt(d.inicio)} a {dataPt(d.fim)} ·{" "}
              {formatarLitros(Number(d.volumeReconhecidoLitros))} reconhecidos.
            </p>
            {v && (
              <>
                <p>
                  Preço-base:{" "}
                  {Number(v.precoBase).toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                    minimumFractionDigits: 4,
                    maximumFractionDigits: 4,
                  })}
                  /L · valor comercial: {dinheiro(v.valorComercial)}.
                </p>
                <p>
                  Pagamento informado:{" "}
                  {v.valorPagamentoInformado === null
                    ? "Não informado"
                    : dinheiro(v.valorPagamentoInformado)}
                  . Não comprova recebimento.
                </p>
                <ul>
                  {v.componentes.map((c, i) => (
                    <li key={i}>
                      {(
                        {
                          BONUS: "Bônus",
                          DESCONTO: "Desconto",
                          RETENCAO: "Retenção",
                          ADIANTAMENTO: "Adiantamento",
                        } as Record<string, string>
                      )[c.natureza] ?? "Componente informado"}
                      : {dinheiro(String(c.valor))} · {c.referencia}
                    </li>
                  ))}
                </ul>
              </>
            )}
            <ul>
              {d.alocacoes.map((a) => (
                <li key={a.id}>
                  {dataPt(a.dataEntrega)} · venda #{a.numeroOperacao} ·{" "}
                  {formatarLitros(Number(a.quantidadeLitros))}
                </li>
              ))}
            </ul>
          </SecaoDetalhesLeite>
        );
      })}
      <PaginasPreservadas
        titulo="Documentos"
        pagina={pagina}
        total={total}
        onChange={setPagina}
      />

    </section>
  );
}


function OperacoesPeriodoPreservadas({ dados, valores }: { dados: OperacaoPeriodoPreservada[]; valores?: ValorOperacaoPeriodo[] }) {
  const [pagina, setPagina] = useState(1);
  const linhas = dados.slice((pagina - 1) * 50, pagina * 50);
  return <section aria-label="Operações comerciais preservadas">
    <h2>Operações comerciais por período integral  <AjudaCampo rotulo="Sobre o período comercial integral" texto={"Vendas legadas por data da retirada e faturamento documental têm recortes próprios. Seus valores não compõem um total combinado com estes acordos. Período comercial integral por sobreposição, sem rateio diário; valores não são receita exclusiva dos dias filtrados nem recebimento."} /></h2>


    {!dados.length ? <p>Nenhuma operação comercial com período sobreposto ao filtro.</p> : <div className="leite-tabela-scroll" tabIndex={0} aria-label="Operações por período integral, com rolagem horizontal">
      <Table semContainer>
        <TableCaption>Operações e última versão de fechamento no corte da emissão</TableCaption>
        <TableHeader><TableRow><TableHead>Comprador e referência</TableHead><TableHead>Período integral</TableHead><TableHead>Abrangência</TableHead><TableHead>Situação</TableHead><TableHead>Venda nº</TableHead><TableHead>Versão do fechamento</TableHead><TableHead>Data financeira</TableHead><TableHead>Estado financeiro</TableHead><TableHead>Volume reconhecido integral (L)</TableHead>{valores && <><TableHead>Preço negociado (BRL/L)</TableHead><TableHead>Ajuste (BRL)</TableHead><TableHead>Valor integral da venda (BRL)</TableHead></>}</TableRow></TableHeader>
        <TableBody>{linhas.map(o => {
          const f = o.fechamento;
          const v = valores?.find(v => v.comercialId === o.id && v.fechamentoId === f?.id);
          return <TableRow key={o.id}>
            <TableCell>{o.parceiroNome}<small>{o.referencia}</small></TableCell>
            <TableCell>{dataPt(o.inicio)} a {dataPt(o.fim)}</TableCell>
            <TableCell>{o.parcialForaFiltro ? "Abrange datas fora do filtro" : "Integral dentro do filtro"}</TableCell>
            <TableCell>{o.situacao === "PRECO_PENDENTE" ? "Preço pendente" : o.situacao === "FECHADA" ? "Fechada" : "Inativa"}</TableCell>
            <TableCell>{f?.numeroOperacao ?? "—"}</TableCell><TableCell>{f?.versao ?? "—"}</TableCell><TableCell>{f ? dataPt(f.data) : "—"}</TableCell><TableCell>{f?.statusFinanceiro ?? "—"}</TableCell>
            <TableCell>{f ? formatarLitros(Number(f.volumeReconhecidoLitros)) : "Não reconhecido"}</TableCell>
            {valores && <><TableCell>{v ? `${Number(v.precoUnitario).toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 4, maximumFractionDigits: 4 })}/L` : "—"}</TableCell><TableCell>{v ? dinheiro(v.ajuste) : "—"}</TableCell><TableCell>{v ? dinheiro(v.valorTotal) : "—"}</TableCell></>}
          </TableRow>;
        })}</TableBody>
      </Table>
    </div>}
    {linhas.filter(o => o.fechamento?.amostras.length).map(o => <SecaoDetalhesLeite key={o.id} titulo={<>Amostras vinculadas ao fechamento · {o.referencia} · versão {o.fechamento!.versao}</>}>

      <div className="flex items-center gap-1"><span>Datas da versão preservada</span><AjudaCampo rotulo="Sobre as datas das amostras preservadas" texto="Datas preservadas no acordo; correções posteriores da amostra não alteram esta versão." /></div>
      {o.fechamento!.amostras.map(a => <div key={a.amostraId}>
        <p>Amostra {a.amostraId} · versão {a.versaoAmostra}{a.data ? ` · coleta em ${dataPt(a.data)}` : ""}</p>
        <DatasQualidade {...a} />
      </div>)}
    </SecaoDetalhesLeite>)}
    <PaginasPreservadas titulo="Operações comerciais" pagina={pagina} total={dados.length} onChange={setPagina} />
  </section>;
}
