import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { formatarDataBR } from "../lib/rotulos";
import { CartaoAmostraVisual } from "./VisuaisConsultaLeite";
import { AjudaCampo } from "@/components/Dica";
import { ListaConsultaLeite } from "./ListaConsultaLeite";
import { SelectCampo } from "../../../financeiro/SelectCampo";
import { SubTabs } from "../../../components/SubTabs";
import { BarraConsulta } from "../../../financeiro/BarraConsulta";
import { CampoFiltro } from "../../../financeiro/PainelFiltros";
import { useRascunhoConsulta } from "../../../financeiro/useRascunhoConsulta";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CabecalhoTabela, Paginacao } from "../../../financeiro/financeiro-ui";
import "./consultas-leite.css";
import { Button } from "@/components/ui/button";
import { SecaoDetalhesLeite as SecaoHistoricoLeite } from "./SecaoDetalhesLeite";
import { DialogConsultaLeite as SecaoDetalhesLeite } from "./DialogConsultaLeite";
import { useEffect, useRef, useState } from "react";
import { getPropriedadeAtiva } from "../../../propriedadeScope";
import {
  CamposFormatoExame,
  CamposResultadoExame,
  type CampoExame,
  type ObservacaoExame,
} from "../sanidade/CamposExame";
import { alterarLeite, consultarLeite, registrarLeite } from "./operacoes-api";
import { hojeOperacional } from "./modelo";
import type {
  CandidatosDestinos,
  CandidatoDestinoLeite,
} from "./destinos-types";
import type {
  AmostraQualidade,
  FormatoQualidade,
  HistoricoQualidade,
} from "./qualidade-types";
import { HistoricoParametrosQualidade } from "./HistoricoParametrosQualidade";
import { CamposDatasQualidade, DatasQualidade } from "./DatasQualidade";
import { LaudosQualidade } from "./LaudosQualidade";
const mensagem = (e: unknown) =>
  e instanceof Error ? e.message : "Não foi possível concluir a operação";
export function QualidadeLeite({ podeLancar }: { podeLancar: boolean }) {
  const sitio = getPropriedadeAtiva();
  const tituloAmostra = useRef<HTMLHeadingElement>(null);
  const [aba, setAba] = useState<"amostras" | "resultados">("amostras");
  const [propriedadeResolvida, setPropriedadeResolvida] = useState<
    number | null
  >(sitio);
  const [formatos, setFormatos] = useState<FormatoQualidade[]>([]);
  const [amostras, setAmostras] = useState<{
    itens: AmostraQualidade[];
    total: number;
    propriedadeId: number;
  } | null>(null);
  const [data, setData] = useState(hojeOperacional);
  const filtros = useRascunhoConsulta({ data }, { data: hojeOperacional() }, v => { setData(v.data); setPagina(1); setSelecionada(null); });
  const [pagina, setPagina] = useState(1),
    [revisao, setRevisao] = useState(0);
  const [erro, setErro] = useState(""),
    [aviso, setAviso] = useState("");
  const [nova, setNova] = useState(false),
    [novoFormato, setNovoFormato] = useState(false);
  const [derivar, setDerivar] = useState<FormatoQualidade | null>(null);
  const [selecionada, setSelecionada] = useState<AmostraQualidade | null>(null);
  const [carregando, setCarregando] = useState(false);
  const geracao = useRef(0);
  useEffect(() => {
    const atual = ++geracao.current;
    setCarregando(true);
    setErro("");
    setAmostras(null);
    void Promise.all([
      consultarLeite<FormatoQualidade[]>(
        "/qualidade/formatos?incluirInativos=true",
        sitio,
      ),
      consultarLeite<{
        itens: AmostraQualidade[];
        total: number;
        propriedadeId: number;
      }>(
        `/qualidade/amostras?fim=${data}&pagina=${pagina}&tamanho=20`,
        sitio,
      ),
    ])
      .then(([f, a]) => {
        if (atual === geracao.current) {
          setFormatos(f);
          setAmostras(a);
          setPropriedadeResolvida(a.propriedadeId);
        }
      })
      .catch((e) => {
        if (atual === geracao.current) setErro(mensagem(e));
      })
      .finally(() => {
        if (atual === geracao.current) setCarregando(false);
      });
    return () => {
      geracao.current++;
    };
  }, [sitio, data, pagina, revisao]);
  async function mudarAtivo(formato: FormatoQualidade) {
    setErro("");
    try {
      await alterarLeite(`/qualidade/formatos/${formato.id}`, sitio, {
        ativo: !formato.ativo,
      });
      setRevisao((r) => r + 1);
    } catch (e) {
      setErro(mensagem(e));
    }
  }
  function salvo(texto: string) {
    setAviso(texto);
    setRevisao((r) => r + 1);
    setNova(false);
    setNovoFormato(false);
    setDerivar(null);
    setSelecionada(null);
  }
  return (
    <section className="leite-operacoes">
      <CabecalhoTabela titulo="Qualidade do leite" ajuda="Amostras individuais e coletivas, com o histórico de cada laudo." rotuloAjuda="Sobre qualidade do leite" />
      <SubTabs variant="financeiro" ariaLabel="Consultas da qualidade" tabs={[{ id: "amostras", label: "Amostras" }, { id: "resultados", label: "Resultados" }]} active={aba} onSelect={setAba} />
      {aba === "amostras" && <BarraConsulta edicaoFiltros={filtros} adicionais={<CampoFiltro rotulo="Consultar até"><input type="date" required value={filtros.rascunho.data} onChange={e => { if(e.target.value) filtros.editar("data", e.target.value); }} /></CampoFiltro>} acao={<>
        {podeLancar && (
          <Button disabled={!propriedadeResolvida}
            onClick={() => {
              setNova(true);
              setSelecionada(null);
            }}>
            Registrar amostra
          </Button>
        )}
        {podeLancar && (
          <Button variant="outline" className="leite-secondary"
            onClick={() => {
              setNovoFormato(true);
              setDerivar(null);
            }}>
            Criar formato de laudo
          </Button>
        )}
      </>} />}
      {aba === "resultados" && <HistoricoParametrosQualidade sitio={sitio} formatos={formatos} data={data} revisao={revisao} />}
      {erro && <p role="alert">{erro} <Button type="button" variant="outline" onClick={() => setRevisao(r => r + 1)}>Tentar novamente</Button></p>}
      {aviso && <p role="status">{aviso}</p>}
      {carregando && <p role="status">Consultando laudos…</p>}
      {(novoFormato || derivar) && (
        <Dialog open onOpenChange={v => { if (!v) { setNovoFormato(false); setDerivar(null); } }}><DialogContent className="leite-consulta-dialog" data-fin-scroll="conteudo" aria-describedby={undefined}><DialogHeader><DialogTitle>Formato do laudo</DialogTitle></DialogHeader><EditorFormato
          key={derivar?.id ?? "novo"}
          anterior={derivar}
          sitio={sitio}
          onCancelar={() => {
            setNovoFormato(false);
            setDerivar(null);
          }}
          onSalvo={() =>
            salvo(
              "Formato de laudo salvo. As amostras anteriores conservam a versão original.",
            )
          }
        /></DialogContent></Dialog>
      )}
      {nova && (
        <Dialog open onOpenChange={v => { if (!v) setNova(false); }}><DialogContent className="leite-consulta-dialog" data-fin-scroll="conteudo" aria-describedby={undefined}><DialogHeader><DialogTitle>Registrar amostra</DialogTitle></DialogHeader><NovaAmostra
          formatos={formatos.filter((f) => f.ativo)}
          sitio={propriedadeResolvida}
          onCancelar={() => setNova(false)}
          onSalvo={() => salvo("Amostra registrada.")}
        /></DialogContent></Dialog>
      )}
      {aba === "amostras" && amostras && (
        <>
          <p>
            Amostras até {data} · {amostras.total}{" "}
            registro(s).
          </p>
          {!amostras.itens.length && (
            <p>
              Nenhuma amostra neste período. Registre a coleta mesmo se o
              resultado ainda não chegou.
            </p>
          )}
          <ListaConsultaLeite layout="grade" renderizarVisual={a => <CartaoAmostraVisual amostra={a} abrir={() => { setSelecionada(a); setNova(false); }}/>} preferencia="qualidadeLeiteVisualizacao" compacta rotulo="Amostras e resultados" itens={amostras.itens} chaveDe={a => a.id} colunas={[
            { chave: "data", titulo: "Coleta", principal: true, celula: a => a.data.slice(0, 10).split("-").reverse().join("/") },
            { chave: "tipo", titulo: "Tipo", celula: a => a.sujeito.tipo === "ANIMAL" ? "Individual" : "Coletiva" },
            { chave: "origem", titulo: "Origem", celula: a => a.sujeito.tipo === "ANIMAL" ? a.animal?.brinco ?? "Sem brinco" : a.sujeito.origem },
            { chave: "formato", titulo: "Formato", celula: a => a.formatoSnapshot.nome },
            { chave: "situacao", titulo: "Situação", celula: a => a.status === "ANULADO" ? "Anulada" : a.realizacao === "COLETA_REGISTRADA" ? "Aguardando resultado" : "Resultado informado" },
            { chave: "acoes", titulo: "Ações", acoes: true, celula: a => <Button variant="outline" onClick={() => { setSelecionada(a); setNova(false); }}>Abrir amostra</Button> },
          ]} />
          <Paginacao pagina={pagina} totalPaginas={Math.max(1, Math.ceil(amostras.total / 20))} total={amostras.total} porPagina={20} rotulo="Paginação das amostras" substantivo="amostras" idSelect="pagina-amostras-leite" onPagina={setPagina} />
        </>
      )}
      {selecionada && (
        <Dialog open onOpenChange={v => { if (!v) setSelecionada(null); }}><DialogContent className="leite-consulta-dialog leite-laudo-dialog" data-fin-scroll="conteudo" aria-describedby={undefined} onOpenAutoFocus={e=>{e.preventDefault();tituloAmostra.current?.focus()}}><DialogHeader><DialogTitle ref={tituloAmostra} tabIndex={-1}>Detalhes da amostra</DialogTitle></DialogHeader><DetalheAmostra
          key={selecionada.id}
          inicial={selecionada}
          sitio={selecionada.propriedadeId}
          podeLancar={podeLancar}
          onFechar={() => setSelecionada(null)}
          onSalvo={() => salvo("Amostra atualizada com histórico preservado.")}
        /></DialogContent></Dialog>
      )}
      <SecaoDetalhesLeite  titulo={<>Formatos de laudo</>} acoes={<AjudaCampo rotulo="Sobre os formatos de laudo" texto={"Campos e unidades vêm do laudo. Alterar um formato já utilizado exige nova versão; não altera amostras anteriores."} />}>


        {!formatos.length && <p>Nenhum formato configurado.</p>}
        {formatos.map((f) => (
          <div className="leite-form-inline" key={f.id}>
            <span>
              {f.nome} · versão {f.versaoFormato} ·{" "}
              {f.ativo ? "Ativo" : "Inativo"}
            </span>
            {podeLancar && (
              <>
                <Button variant="outline" className="leite-secondary"
                  onClick={() => {
                    setDerivar(f);
                    setNovoFormato(false);
                  }}>
                  Nova versão de {f.nome}
                </Button>
                <Button variant="outline" className="leite-secondary"
                  onClick={() => void mudarAtivo(f)}>
                  {f.ativo ? "Inativar" : "Reativar"} {f.nome}
                </Button>
              </>
            )}
          </div>
        ))}
      </SecaoDetalhesLeite>
    </section>
  );
}
function Resultados({ amostra }: { amostra: AmostraQualidade }) {
  if (!amostra.resultados.length)
    return <small>Resultado ainda não informado.</small>;
  return (
    <dl className="leite-laudo-resultados">
      {amostra.resultados.map((r) => {
        const campo = amostra.formatoSnapshot.campos.find(
          (c) => c.codigo === r.campo,
        );
        return (
          <div key={r.campo} data-tipo={campo?.tipo}>
            <dt>{campo?.rotulo ?? r.campo}</dt>
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
              {campo?.unidade ?? ""}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
function EditorFormato({
  anterior,
  sitio,
  onCancelar,
  onSalvo,
}: {
  anterior: FormatoQualidade | null;
  sitio: number | null;
  onCancelar: () => void;
  onSalvo: () => void;
}) {
  const [nome, setNome] = useState(anterior?.nome ?? ""),
    [campos, setCampos] = useState<CampoExame[]>(anterior?.campos ?? []);
  const [erro, setErro] = useState(""),
    [ocupado, setOcupado] = useState(false);
  const trava = useRef(false);
  async function salvar() {
    if (trava.current) return;
    trava.current = true;
    setOcupado(true);
    setErro("");
    try {
      await registrarLeite(
        `/qualidade/formatos${anterior ? `/${anterior.id}/versoes` : ""}`,
        sitio,
        { nome, campos },
      );
      onSalvo();
    } catch (e) {
      setErro(mensagem(e));
    } finally {
      trava.current = false;
      setOcupado(false);
    }
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void salvar();
      }}
    >
      <fieldset disabled={ocupado}>
        <legend>
          {anterior ? "Nova versão do formato" : "Criar formato de laudo"}
        </legend>
        <label>
          Nome do formato
          <input
            required
            maxLength={120}
            value={nome}
            onChange={(e) => setNome(e.target.value)}
          />
        </label>
        <CamposFormatoExame
          campos={campos}
          onChange={setCampos}
          disabled={ocupado}
        />
        {erro && <p role="alert">{erro}</p>}
        <div className="leite-form-inline">
          <Button disabled={!campos.length || ocupado}>Salvar formato</Button>
          <Button variant="outline" type="button"
            className="leite-secondary"
            onClick={onCancelar}>
            Cancelar formato
          </Button>
        </div>
      </fieldset>
    </form>
  );
}
export function NovaAmostra({
  formatos,
  sitio,
  onCancelar,
  onSalvo,
}: {
  formatos: FormatoQualidade[];
  sitio: number | null;
  onCancelar: () => void;
  onSalvo: (amostra: AmostraQualidade) => void;
}) {
  const [data, setData] = useState(hojeOperacional),
    [tipoId, setTipoId] = useState("");
  const [sujeito, setSujeito] = useState("ANIMAL"),
    [animal, setAnimal] = useState<CandidatoDestinoLeite | null>(null),
    [origem, setOrigem] = useState("");
  const [entradaId, setEntradaId] = useState("");
  const [dataResultado, setDataResultado] = useState("");
  const [dataRecebimento, setDataRecebimento] = useState("");
  const [responsavel, setResponsavel] = useState(""),
    [anotacao, setAnotacao] = useState("");
  const [valores, setValores] = useState<ObservacaoExame[]>([]),
    [informar, setInformar] = useState(false);
  const [erro, setErro] = useState(""),
    [ocupado, setOcupado] = useState(false);
  const trava = useRef(false);
  const formato = formatos.find((f) => f.id === tipoId);
  async function salvar() {
    if (trava.current) return;
    if (!sitio || !formato || (sujeito === "ANIMAL" && !animal)) {
      setErro("Selecione o sítio, o formato e a origem da amostra.");
      return;
    }
    trava.current = true;
    setOcupado(true);
    setErro("");
    try {
      const amostra = await registrarLeite<AmostraQualidade>("/qualidade/amostras", sitio, {
        propriedadeId: sitio,
        data,
        tipoExameId: formato.id,
        formatoExameHash: formato.formatoExameHash,
        sujeito:
          sujeito === "ANIMAL"
            ? { tipo: "ANIMAL", animalId: animal!.animalId }
            : { tipo: "COLETIVO", origem, ...(entradaId ? { entradaId } : {}) },
        resultados: informar ? valores : [],
        ...(dataResultado ? { dataResultadoLaboratorial: dataResultado } : {}),
        ...(dataRecebimento ? { dataRecebimentoLaudo: dataRecebimento } : {}),
        ...(responsavel.trim() ? { responsavel } : {}),
        ...(anotacao.trim() ? { anotacaoOriginal: anotacao } : {}),
      });
      onSalvo(amostra);
    } catch (e) {
      setErro(mensagem(e));
    } finally {
      trava.current = false;
      setOcupado(false);
    }
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void salvar();
      }}
    >
      <fieldset disabled={ocupado}>
        <legend>Registrar amostra de leite</legend>
        <div className="leite-form-inline">
          <label>
            Data da coleta
            <input
              required
              type="date"
              value={data}
              max={hojeOperacional()}
              onChange={(e) => {
                setData(e.target.value);
                setAnimal(null);
                setEntradaId("");
              }}
            />
          </label>
          <label>
            Formato do laudo
            <SelectCampo disabled={ocupado}
              required
              value={tipoId}
              onValueChange={(valor) => {
                setTipoId(valor);
                setValores([]);
              }}
            >
              <option value="">Selecione um formato</option>
              {formatos.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nome} · v{f.versaoFormato}
                </option>
              ))}
            </SelectCampo>
          </label>
          <label>
            Origem da amostra
            <SelectCampo disabled={ocupado}
              value={sujeito}
              onValueChange={(valor) => setSujeito(valor)}
            >
              <option value="ANIMAL">Individual — um animal</option>
              <option value="COLETIVO">Coletiva — origem identificada</option>
            </SelectCampo>
          </label>
        </div>
        {sujeito === "ANIMAL" ? (
          <SeletorAnimal
            key={data}
            sitio={sitio}
            data={data}
            animal={animal}
            onChange={setAnimal}
          />
        ) : (
          <>
            <label>
              Identificação da origem coletiva
              <input
                required
                maxLength={300}
                value={origem}
                onChange={(e) => setOrigem(e.target.value)}
                placeholder="Identifique o tanque ou a amostra conforme o laudo"
              />
            </label>
            <OrigemQualidade
              key={data}
              sitio={sitio}
              data={data}
              entradaId={entradaId}
              onChange={setEntradaId}
            />
          </>
        )}
        <div className="leite-form-inline">
          <label>
            Responsável (opcional)
            <input
              maxLength={120}
              value={responsavel}
              onChange={(e) => setResponsavel(e.target.value)}
            />
          </label>
          <label>
            Transcrição do laudo (opcional)
            <textarea
              maxLength={4000}
              value={anotacao}
              onChange={(e) => setAnotacao(e.target.value)}
            />
          </label>
        </div>
        <CamposDatasQualidade resultado={dataResultado} recebimento={dataRecebimento} onResultado={setDataResultado} onRecebimento={setDataRecebimento} />
        <label className="leite-checkbox">
          <input
            type="checkbox"
            checked={informar}
            onChange={(e) => setInformar(e.target.checked)}
          />
          O resultado já está disponível
        </label>
        {informar && formato && (
          <CamposResultadoExame
            campos={formato.campos}
            valores={valores}
            onChange={setValores}
          />
        )}
        {!informar && (
          <p>
            A coleta ficará aguardando resultado. Nenhum valor será presumido.
          </p>
        )}
        {erro && <p role="alert">{erro}</p>}
        <div className="leite-form-inline">
          <Button disabled={ocupado || !formato || (informar && !valores.length)}>
            Registrar amostra
          </Button>
          <Button variant="outline" className="leite-secondary"
            type="button"
            onClick={onCancelar}>
            Cancelar amostra
          </Button>
        </div>
      </fieldset>
    </form>
  );
}
function SeletorAnimal({
  sitio,
  data,
  animal,
  onChange,
}: {
  sitio: number | null;
  data: string;
  animal: CandidatoDestinoLeite | null;
  onChange: (a: CandidatoDestinoLeite | null) => void;
}) {
  const [busca, setBusca] = useState(""),
    [pagina, setPagina] = useState(1),
    [lista, setLista] = useState<CandidatosDestinos | null>(null),
    [erro, setErro] = useState("");
  useEffect(() => {
    let ativo = true;
    setLista(null);
    setErro("");
    void consultarLeite<CandidatosDestinos>(
      `/destinos/candidatos?${new URLSearchParams({ data, busca, pagina: String(pagina) })}`,
      sitio,
    )
      .then((r) => {
        if (ativo) setLista(r);
      })
      .catch((e) => {
        if (ativo) setErro(mensagem(e));
      });
    return () => {
      ativo = false;
    };
  }, [sitio, data, busca, pagina]);
  return (
    <fieldset>
      <legend>Animal da amostra</legend>
      {animal ? (
        <p>
          {animal.brinco} · {animal.nome ?? "Sem nome"}{" "}
          <Button variant="outline" type="button"
            className="leite-secondary"
            onClick={() => onChange(null)}>
            Trocar animal
          </Button>
        </p>
      ) : (
        <>
          <label>
            Buscar animal por brinco ou nome
            <input
              value={busca}
              onChange={(e) => {
                setBusca(e.target.value);
                setPagina(1);
              }}
            />
          </label>
          {erro && <p role="alert">{erro}</p>}
          {lista?.itens.map((a) => (
            <div key={a.animalId} className="leite-form-inline">
              <span>
                {a.brinco} · {a.nome ?? "Sem nome"}
              </span>
              <Button variant="outline" type="button"
                className="leite-secondary"
                onClick={() => onChange(a)}>
                Selecionar {a.brinco}
              </Button>
            </div>
          ))}
          {lista && (
            <div className="leite-form-inline">
              <Button type="button"
                disabled={pagina === 1}
                onClick={() => setPagina((p) => p - 1)}>
                Animais anteriores
              </Button>
              <Button type="button"
                disabled={pagina * lista.porPagina >= lista.total}
                onClick={() => setPagina((p) => p + 1)}>
                Próximos animais
              </Button>
            </div>
          )}
        </>
      )}
    </fieldset>
  );
}
function DetalheAmostra({
  inicial,
  sitio,
  podeLancar,
  onFechar,
  onSalvo,
}: {
  inicial: AmostraQualidade;
  sitio: number | null;
  podeLancar: boolean;
  onFechar: () => void;
  onSalvo: () => void;
}) {
  const [abaDetalhe,setAbaDetalhe] = useState(inicial.resultados.length ? "resultado" : podeLancar && inicial.status !== "ANULADO" ? "corrigir" : "resultado");
  const [paginaHistorico, setPaginaHistorico] = useState(1);
  const [dataResultado, setDataResultado] = useState(inicial.dataResultadoLaboratorial ?? "");
  const [dataRecebimento, setDataRecebimento] = useState(inicial.dataRecebimentoLaudo ?? "");
  const [valores, setValores] = useState<ObservacaoExame[]>(inicial.resultados),
    [motivo, setMotivo] = useState(""),
    [anular, setAnular] = useState(false);
  const [erro, setErro] = useState(""),
    [ocupado, setOcupado] = useState(false),
    [historico, setHistorico] = useState<HistoricoQualidade | null>(null);
  const datasAlteradas = dataResultado !== (inicial.dataResultadoLaboratorial ?? "") || dataRecebimento !== (inicial.dataRecebimentoLaudo ?? "");
  const resultadosAlterados = JSON.stringify(valores) !== JSON.stringify(inicial.resultados);
  const somenteDatas = datasAlteradas && !resultadosAlterados;
  const trava = useRef(false);
  useEffect(() => {
    let ativo = true;
    void consultarLeite<HistoricoQualidade>(
      `/qualidade/amostras/${inicial.id}/historico?pagina=${paginaHistorico}&tamanho=20`,
      sitio,
    )
      .then((h) => {
        if (ativo) setHistorico(h);
      })
      .catch((e) => {
        if (ativo) setErro(mensagem(e));
      });
    return () => {
      ativo = false;
    };
  }, [inicial.id, sitio, paginaHistorico]);
  async function salvar() {
    if (trava.current) return;
    trava.current = true;
    setOcupado(true);
    setErro("");
    try {
      await registrarLeite(
        `/qualidade/amostras/${inicial.id}/correcoes`,
        sitio,
        {
          propriedadeId: inicial.propriedadeId,
          versaoEsperada: inicial.versao,
          motivo,
          anular,
          ...(anular ? {} : {
            ...(somenteDatas ? {} : { resultados: valores }),
            ...(dataResultado !== (inicial.dataResultadoLaboratorial ?? "") ? { dataResultadoLaboratorial: dataResultado || null } : {}),
            ...(dataRecebimento !== (inicial.dataRecebimentoLaudo ?? "") ? { dataRecebimentoLaudo: dataRecebimento || null } : {}),
          }),
        },
      );
      onSalvo();
    } catch (e) {
      setErro(mensagem(e));
    } finally {
      trava.current = false;
      setOcupado(false);
    }
  }
  return (
    <section className="leite-operacoes" aria-label="Detalhe da amostra">
      <header className="leite-laudo-identidade"><div><h2>{inicial.sujeito.tipo === "COLETIVO" ? inicial.sujeito.origem : [inicial.animal?.brinco,inicial.animal?.nome].filter(Boolean).join(" · ")}</h2><span>{inicial.formatoSnapshot.nome}</span></div><Badge variant="outline">{inicial.status === "ANULADO" ? "Anulada" : inicial.realizacao === "COLETA_REGISTRADA" ? "Aguardando resultado" : "Resultado informado"}</Badge></header>
      <dl className="leite-laudo-metadados"><div><dt>Coleta</dt><dd>{formatarDataBR(inicial.data.slice(0,10))}</dd></div><div><dt>Resultado</dt><dd>{inicial.dataResultadoLaboratorial ? formatarDataBR(inicial.dataResultadoLaboratorial) : "Não informado"}</dd></div><div><dt>Recebimento</dt><dd>{inicial.dataRecebimentoLaudo ? formatarDataBR(inicial.dataRecebimentoLaudo) : "Não informado"}</dd></div><div><dt>Formato</dt><dd>Versão {inicial.formatoSnapshot.versao ?? 1}<AjudaCampo rotulo="Sobre o formato preservado" texto="O formato utilizado na coleta permanece preservado; alterações posteriores não reescrevem o laudo."/></dd></div>{inicial.criadoEm&&<div><dt>Cadastro da amostra</dt><dd>{new Date(inicial.criadoEm).toLocaleString("pt-BR",{timeZone:"America/Sao_Paulo"})}</dd></div>}</dl>
      <SubTabs variant="financeiro" ariaLabel="Detalhes da amostra" tabs={[{id:"resultado",label:"Resultados"},...(podeLancar&&inicial.status!=="ANULADO"?[{id:"corrigir",label:"Informar ou corrigir"}]:[]),{id:"arquivos",label:"Arquivos"},{id:"historico",label:"Histórico"}]} active={abaDetalhe} onSelect={setAbaDetalhe}/>
      <div hidden={abaDetalhe!=="resultado"}><Resultados amostra={inicial}/>{inicial.anotacaoOriginal&&<section className="leite-laudo-observacao"><h3>Observação</h3><p>{inicial.anotacaoOriginal}</p></section>}</div>
      <div hidden={abaDetalhe!=="corrigir"}>
      {podeLancar && inicial.status !== "ANULADO" ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void salvar();
          }}
        >
          <fieldset disabled={ocupado}>
            <legend>Informar ou corrigir resultado</legend>
            <label className="leite-checkbox">
              <input
                type="checkbox"
                checked={anular}
                onChange={(e) => setAnular(e.target.checked)}
              />
              Anular a amostra mantendo o histórico
            </label>
            {!anular && <>
              <CamposDatasQualidade resultado={dataResultado} recebimento={dataRecebimento} onResultado={setDataResultado} onRecebimento={setDataRecebimento} />
              <CamposResultadoExame usarShadcn
                campos={inicial.formatoSnapshot.campos}
                valores={valores}
                onChange={setValores}
              />
            </>}
            <label>
              Motivo da atualização
              <Textarea
                required
                minLength={5}
                maxLength={1000}
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
              />
            </label>
            <Button disabled={ocupado || (!anular && !somenteDatas && !valores.length)}>
              Confirmar atualização
            </Button>
          </fieldset>
        </form>
      ) : (
        <Resultados amostra={inicial} />
      )}
      </div>
      <div hidden={abaDetalhe!=="arquivos"}><LaudosQualidade
        amostra={inicial}
        sitio={sitio}
        podeLancar={podeLancar}
      />
      </div>
      {erro && <p role="alert">{erro}</p>}
      <div hidden={abaDetalhe!=="historico"}>
      <section className="leite-laudo-historico" aria-label="Histórico da amostra"><h3>Histórico da amostra</h3>

        {historico ? (
          <ol>
            {historico.itens.map((h) => (
              <li key={h.id}>
                <p>
                  {h.em
                    ? new Date(h.em).toLocaleString("pt-BR")
                    : "Data não informada"}{" "}
                  · {h.autor?.nome ?? "Autoria não informada"} ·{" "}
                  {h.acao === "ANULACAO"
                    ? "Anulação"
                    : h.acao === "DATAS_CORRIGIDAS"
                      ? "Datas corrigidas"
                      : h.acao === "RESULTADO_CORRIGIDO"
                      ? "Resultado corrigido"
                      : h.acao === "REGISTRO"
                        ? "Registro"
                        : "Atualização"}
                </p>
                {h.motivo && <p>{h.motivo}</p>}
                <ValoresHistoricos
                  valor={h.antes}
                  rotulo="Antes"
                  campos={inicial.formatoSnapshot.campos}
                />
                <ValoresHistoricos
                  valor={h.depois}
                  rotulo="Depois"
                  campos={inicial.formatoSnapshot.campos}
                />
              </li>
            ))}
          </ol>
        ) : (
          <p>Carregando histórico…</p>
        )}
        {historico && (
          <div className="leite-form-inline">
            <Button type="button"
              disabled={paginaHistorico === 1}
              onClick={() => setPaginaHistorico((p) => p - 1)}>
              Histórico anterior
            </Button>
            <span>Página {paginaHistorico}</span>
            <Button type="button"
              disabled={paginaHistorico * historico.tamanho >= historico.total}
              onClick={() => setPaginaHistorico((p) => p + 1)}>
              Próximo histórico
            </Button>
          </div>
        )}
      </section>
      </div>
      <Button variant="outline" type="button" className="leite-secondary" onClick={onFechar}>
        Fechar amostra
      </Button>
    </section>
  );
}

function ValoresHistoricos({
  valor,
  rotulo,
  campos,
}: {
  valor: unknown;
  rotulo: string;
  campos: CampoExame[];
}) {
  if (!valor || typeof valor !== "object") return null;
  const registro = valor as Record<string, unknown>;
  const resultados = Array.isArray(registro.resultados)
    ? registro.resultados
    : [];
  return (
    <div>
      <strong>{rotulo}</strong>
      <DatasQualidade
        dataResultadoLaboratorial={typeof registro.dataResultadoLaboratorial === "string" ? registro.dataResultadoLaboratorial.slice(0, 10) : null}
        dataRecebimentoLaudo={typeof registro.dataRecebimentoLaudo === "string" ? registro.dataRecebimentoLaudo.slice(0, 10) : null}
      />
      {typeof registro.status === "string" && (
        <p>{registro.status === "ANULADO" ? "Anulada" : "Válida"}</p>
      )}
      {resultados.map((item: unknown, i) => {
        if (!item || typeof item !== "object") return null;
        const r = item as Record<string, unknown>;
        return (
          <p key={i}>
            {campos.find((c) => c.codigo === r.campo)?.rotulo ?? "Resultado"}:{" "}
            {typeof r.valor === "boolean"
              ? r.valor
                ? "Sim"
                : "Não"
              : String(r.valor ?? "Não informado")}{" "}
            {typeof r.unidade === "string" ? r.unidade : ""}
          </p>
        );
      })}
    </div>
  );
}

interface OrigemQualidadeDTO {
  entradaId: string;
  data: string;
  nomeOrdenha: string;
  produtoNome: string;
  quantidadeLitros: string | number;
}
function OrigemQualidade({
  sitio,
  data,
  entradaId,
  onChange,
}: {
  sitio: number | null;
  data: string;
  entradaId: string;
  onChange: (id: string) => void;
}) {
  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(1);
  const [dados, setDados] = useState<{
    itens: OrigemQualidadeDTO[];
    total: number;
    tamanho: number;
  } | null>(null);
  const [erro, setErro] = useState("");
  const [selecionada, setSelecionada] = useState<OrigemQualidadeDTO | null>(
    null,
  );
  useEffect(() => {
    let ativa = true;
    setErro("");
    setDados(null);
    void consultarLeite<{
      itens: OrigemQualidadeDTO[];
      total: number;
      tamanho: number;
    }>(
      `/qualidade/origens?${new URLSearchParams({ data, busca, pagina: String(pagina) })}`,
      sitio,
    )
      .then((r) => {
        if (ativa) setDados(r);
      })
      .catch((e) => {
        if (ativa) setErro(mensagem(e));
      });
    return () => {
      ativa = false;
    };
  }, [sitio, data, busca, pagina]);
  return (
    <SecaoDetalhesLeite  titulo={<>Vincular à origem de estoque (opcional)</>}>

      <p>
        Escolha apenas quando o laudo comprovar o vínculo. Origens já consumidas
        também permanecem disponíveis para consulta.
      </p>
      {entradaId && selecionada ? (
        <p>
          {selecionada.produtoNome} · {selecionada.data.slice(0, 10)} ·{" "}
          {selecionada.nomeOrdenha}{" "}
          <Button variant="outline" className="leite-secondary"
            type="button"
            onClick={() => {
              onChange("");
              setSelecionada(null);
            }}>
            Remover vínculo de origem
          </Button>
        </p>
      ) : (
        <>
          <label>
            Buscar origem de estoque
            <input
              value={busca}
              onChange={(e) => {
                setBusca(e.target.value);
                setPagina(1);
              }}
            />
          </label>
          {dados?.itens.map((o) => (
            <div className="leite-form-inline" key={o.entradaId}>
              <span>
                {o.produtoNome} · {o.data.slice(0, 10)} · {o.nomeOrdenha} ·{" "}
                {o.quantidadeLitros} L
              </span>
              <Button variant="outline" type="button"
                className="leite-secondary"
                onClick={() => {
                  onChange(o.entradaId);
                  setSelecionada(o);
                }}>
                Vincular origem {o.nomeOrdenha} de {o.data.slice(0, 10)}
              </Button>
            </div>
          ))}
          {dados && !dados.itens.length && (
            <p>Nenhuma origem registrada neste recorte.</p>
          )}
          {dados && (
            <div className="leite-form-inline">
              <Button type="button"
                disabled={pagina === 1}
                onClick={() => setPagina((p) => p - 1)}>
                Origens anteriores
              </Button>
              <Button type="button"
                disabled={pagina * dados.tamanho >= dados.total}
                onClick={() => setPagina((p) => p + 1)}>
                Próximas origens
              </Button>
            </div>
          )}
        </>
      )}
      {erro && <p role="alert">{erro}</p>}
    </SecaoDetalhesLeite>
  );
}
