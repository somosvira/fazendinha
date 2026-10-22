import { useEffect, useRef, useState } from "react";
import { getPropriedadeAtiva, comPropriedade } from "../../../propriedadeScope";
import { consultarLeite, registrarLeite } from "./operacoes-api";
import { hojeOperacional, formatarLitros } from "./modelo";
import { RitmoLeite, type DiaRitmoLeite } from "./RitmoLeite";
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
    <section className="leite-operacoes">
      <h2 className="leite-titulo-secao">Relatórios preservados de leite</h2>
      <p>
        Uma emissão conserva os dados consultados e a cobertura daquele momento.
        Abrir novamente não recalcula os números após correções.
      </p>
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
          <button disabled={ocupado || !lista}>
            Emitir relatório preservado
          </button>
        </form>
      ) : (
        <p>
          Seu acesso permite consultar as emissões. Criar e exportar exige
          permissão de exportação.
        </p>
      )}
      {erro && <p role="alert">{erro}</p>}
      {lista && (
        <details open>
          <summary>Emissões disponíveis</summary>
          {lista.itens.length ? (
            <div className="leite-tabela-scroll">
              <table>
                <caption>Relatórios emitidos neste sítio</caption>
                <thead>
                  <tr>
                    <th>Período</th>
                    <th>Corte da consulta</th>
                    <th>Conteúdo</th>
                    <th>Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {lista.itens.map((i) => (
                    <tr key={i.id}>
                      <td>
                        {dataPt(i.inicio)} a {dataPt(i.fim)}
                      </td>
                      <td>{new Date(i.corteEm).toLocaleString("pt-BR")}</td>
                      <td>
                        {i.valoresIncluidos
                          ? "Operacional e financeiro"
                          : "Operacional"}
                      </td>
                      <td>
                        <button
                          className="leite-secondary"
                          onClick={() => void abrir(i.id)}
                        >
                          Abrir relatório de {dataPt(i.inicio)}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p>Nenhum relatório emitido neste sítio.</p>
          )}
          <div className="leite-form-inline">
            <button
              className="leite-secondary"
              disabled={pagina === 1}
              onClick={() => setPagina((p) => p - 1)}
            >
              Emissões anteriores
            </button>
            <span>Página {pagina}</span>
            <button
              className="leite-secondary"
              disabled={pagina * lista.tamanho >= lista.total}
              onClick={() => setPagina((p) => p + 1)}
            >
              Próximas emissões
            </button>
            <button
              className="leite-secondary"
              onClick={() => setRevisao((r) => r + 1)}
            >
              Atualizar lista de emissões
            </button>
          </div>
        </details>
      )}
      {emissao && (
        <>
          <div className="leite-form-inline">
            {podeExportar && (
              <button disabled={ocupado} onClick={() => void baixar()}>
                Exportar esta emissão em CSV
              </button>
            )}
          </div>
          <ConteudoEmissao key={emissao.id} emissao={emissao} />
        </>
      )}
    </section>
  );
}
function ConteudoEmissao({ emissao }: { emissao: Emissao }) {
  const s = emissao.snapshot;
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
        <table>
          <caption>Produção individual preservada</caption>
          <thead>
            <tr>
              <th>Animal</th>
              <th>Litros medidos</th>
              <th>Medições pendentes</th>
            </tr>
          </thead>
          <tbody>
            {s.dados.producao.animais
              .slice((paginaAnimal - 1) * 50, paginaAnimal * 50)
              .map((a) => (
                <tr key={a.animalId}>
                  <td>
                    {a.brinco ?? "Sem brinco"} · {a.nome ?? "Sem nome"}
                  </td>
                  <td>{formatarLitros(a.producao.litros)}</td>
                  <td>{a.producao.pendentes}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <PaginasPreservadas
        titulo="Animais"
        pagina={paginaAnimal}
        total={s.dados.producao.animais.length}
        onChange={setPaginaAnimal}
      />
      <div className="leite-tabela-scroll">
        <table>
          <caption>Balanço do razão de estoque</caption>
          <thead>
            <tr>
              <th>Produto</th>
              <th>Abertura</th>
              <th>Produção confirmada</th>
              <th>Vendas</th>
              <th>Alimentação</th>
              <th>Descarte</th>
              <th>Outros movimentos</th>
              <th>Encerramento calculado</th>
              <th>Medição física</th>
              <th>Diferença observada</th>
            </tr>
          </thead>
          <tbody>
            {s.dados.balanco.map((b) => (
              <tr key={b.produtoId}>
                <td>
                  {b.produtoNome}
                  {!b.confiavel && <small>Há pendências no lastro.</small>}
                </td>
                {[
                  b.abertura,
                  b.producaoConfirmada,
                  b.vendas,
                  b.interno,
                  b.descarte,
                  b.outrosMovimentos,
                  b.encerramentoRazao,
                ].map((v, i) => (
                  <td key={i}>
                    {formatarLitros(v === null ? null : Number(v))}
                  </td>
                ))}
                <td>
                  {b.medicaoCampo
                    ? formatarLitros(Number(b.medicaoCampo.litrosObservados))
                    : "Não informada"}
                </td>
                <td>
                  {formatarLitros(
                    b.divergenciaLitros == null
                      ? null
                      : Number(b.divergenciaLitros),
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
        <table>
          <caption>Saídas internas preservadas</caption>
          <thead>
            <tr>
              <th>Data</th>
              <th>Destino</th>
              <th>Litros</th>
              <th>Motivo</th>
            </tr>
          </thead>
          <tbody>
            {s.dados.destinos
              .slice((paginaSaida - 1) * 50, paginaSaida * 50)
              .map((d) => (
                <tr key={d.id}>
                  <td>{dataPt(d.data)}</td>
                  <td>
                    {d.natureza === "COLOSTRO"
                      ? "Colostro aos animais"
                      : ["LEITE_NAO_COMERCIAL", "NAO_COMERCIAL"].includes(d.natureza)
                        ? "Leite não comercial aos animais"
                        : d.natureza === "MISTA" ? "Mistura de origens aos animais" : "Leite comum aos animais"}
                  </td>
                  <td>{formatarLitros(Number(d.quantidadeLitros))}</td>
                  <td>Conforme registro do destino</td>
                </tr>
              ))}
            {s.dados.descartes
              .slice((paginaSaida - 1) * 50, paginaSaida * 50)
              .map((d) => (
                <tr key={d.id}>
                  <td>{dataPt(d.data)}</td>
                  <td>Descarte físico</td>
                  <td>{formatarLitros(Number(d.quantidadeLitros))}</td>
                  <td>{d.motivo}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <PaginasPreservadas
        titulo="Saídas"
        pagina={paginaSaida}
        total={Math.max(s.dados.destinos.length, s.dados.descartes.length)}
        onChange={setPaginaSaida}
      />
      {!!s.dados.comercial?.length && <section aria-label="Retiradas comerciais preservadas">
        <h2>Retiradas comerciais</h2>
        <p>A retirada física conserva sua data mesmo com preço pendente; não representa recebimento.</p>
        <div className="leite-tabela-scroll" tabIndex={0} aria-label="Retiradas preservadas, com rolagem horizontal"><table>
          <caption>Retiradas comerciais e inversos no período</caption><thead><tr><th>Data</th><th>Produto</th><th>Litros</th><th>Movimento</th><th>Venda</th></tr></thead>
          <tbody>{s.dados.comercial.map(r => <tr key={r.movimentoId}><td>{dataPt(r.data)}</td><td>{r.produtoNome}</td><td>{formatarLitros(Number(r.quantidadeLitros))}</td><td>{r.tipo === "ENTRADA" ? "Inverso" : "Retirada"}</td><td>{r.numeroOperacao === null ? "Preço não inferido" : `Nº ${r.numeroOperacao}`}</td></tr>)}</tbody>
        </table></div>
      </section>}
      {s.dados.comercialDocumental && (
        <ComercialPreservado
          dados={s.dados.comercialDocumental}
          valores={s.valores?.documental ?? null}
        />
      )}
      {s.valores ? (
        <>
          <h2>Valores preservados</h2>
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
          <p>
            Os valores são os conhecidos no corte da emissão. Custo direto não
            representa custo total nem lucro.
          </p>
        </>
      ) : (
        <p>
          Valores financeiros não incluídos ou ocultos pela permissão atual.
        </p>
      )}
      <details>
        <summary>Fontes e limites desta emissão</summary>
        <ul>
          {s.limitacoes.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </details>
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
      <button
        className="leite-secondary"
        disabled={pagina === 1}
        onClick={() => onChange(pagina - 1)}
      >
        {titulo} anteriores
      </button>
      <span>
        Página {pagina} de {Math.ceil(total / 50)}
      </span>
      <button
        className="leite-secondary"
        disabled={pagina * 50 >= total}
        onClick={() => onChange(pagina + 1)}
      >
        Próximos registros de {titulo.toLowerCase()}
      </button>
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
      <h2>Expedição, aceite e faturamento</h2>
      <p>
        As parcelas consideradas pertencem às entregas do período consultado.
        Cabeçalhos e componentes dos demonstrativos conservam o período integral
        declarado pelo comprador.
      </p>
      <div className="leite-tabela-scroll">
        <table>
          <caption>Entregas e volumes preservados</caption>
          <thead>
            <tr>
              <th>Data e comprovante</th>
              <th>Comprador e venda</th>
              <th>Expedido</th>
              <th>Aceito</th>
              <th>Faturado documentado</th>
            </tr>
          </thead>
          <tbody>
            {dados.entregas.slice((pagina - 1) * 50, pagina * 50).map((e) => (
              <tr key={e.id}>
                <td>
                  {dataPt(e.data)} · {e.referencia}
                  <small>{e.produtoNome}</small>
                </td>
                <td>
                  {e.parceiroNome}
                  <small>
                    {e.numeroOperacao === null
                      ? "Venda sem número informado"
                      : `Venda #${e.numeroOperacao}`}
                  </small>
                </td>
                <td>{formatarLitros(Number(e.expedidoLitros))}</td>
                <td>
                  {formatarLitros(
                    e.volumeAceito === null ? null : Number(e.volumeAceito),
                  )}
                </td>
                <td>{formatarLitros(Number(e.quantidadeFaturadaLitros))}</td>
              </tr>
            ))}
          </tbody>
        </table>
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
          <details key={d.id}>
            <summary>
              {d.referencia} · {d.parceiroNome} · versão {d.versao}
            </summary>
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
          </details>
        );
      })}
      <PaginasPreservadas
        titulo="Documentos"
        pagina={pagina}
        total={total}
        onChange={setPagina}
      />
      <p>
        Faturamento documentado, preço da venda e recebimento são referências
        distintas. O demonstrativo não confirma entrada de dinheiro.
      </p>
    </section>
  );
}
