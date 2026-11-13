import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MultiSelect } from "@/components/MultiSelect";
import { useState, type ReactNode } from "react";
import { ArrowDownUp, ListFilter, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PainelCadastro } from "@/financeiro/PainelCadastro";
import { SelectCampo } from "@/financeiro/SelectCampo";
import { Condicoes, enumerados, validarCriterios } from "./EditorSelecaoVisita";
import { camposNumericos, type CampoNumerico, type CampoValor, type CondicaoSelecao, type CriteriosSelecao, type OpcoesSelecao } from "./planner-api";

type Props = { criterios: CriteriosSelecao; onMudar: (c: CriteriosSelecao) => void; opcoes: OpcoesSelecao; data: string; sitio: string; contexto?: "visita" | "programacao"; categoriaInicial?: string };
const titulosModal = { caracteristicas: "Mais características", condicoes: "Condições e ordenação" };
type ModalFiltros = keyof typeof titulosModal;

export function FiltrosSelecaoLivre(props: Props) {
  const [modal, setModal] = useState<{ tipo: ModalFiltros; criterios: CriteriosSelecao } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const fechar = () => setModal(null);

  return <>
    <CamposSelecaoLivre {...props} abrirModal={tipo => {
      setErro(null);
      setModal({ tipo, criterios: structuredClone(props.criterios) });
    }} />
    {modal && <PainelCadastro aberto rascunhoPersistido titulo={titulosModal[modal.tipo]} onFechar={fechar} erroRodape={erro}
      rodape={<>
        <Button type="button" variant="outline" onClick={fechar}>Cancelar</Button>
        <Button type="button" onClick={() => {
          const problema = validarCriterios(modal.criterios);
          if (problema) {
            setErro(modal.criterios.qualquer.some(grupo => !grupo.todas.length)
              ? "Adicione um filtro a cada grupo ou remova o grupo vazio."
              : problema);
            return;
          }
          props.onMudar(modal.criterios);
          fechar();
        }}>Aplicar filtros</Button>
      </>}>
      <CamposSelecaoLivre {...props} painel={modal.tipo} criterios={modal.criterios} onMudar={criterios => {
        setErro(null);
        setModal({ ...modal, criterios });
      }} />
    </PainelCadastro>}
  </>;
}

function RegraManejo({ titulo, marcada, onMarcar, children }: {
  titulo: string;
  marcada: boolean;
  onMarcar: (marcada: boolean) => void;
  children?: ReactNode;
}) {
  return <div className="livre-regra" data-marcada={marcada}>
    <label className="livre-regra-gatilho">
      <input type="checkbox" checked={marcada} onChange={e => onMarcar(e.target.checked)} />
      {titulo}
    </label>
    {marcada && children && <div className="livre-regra-campos">{children}</div>}
  </div>;
}

function CamposSelecaoLivre({ criterios: c, onMudar, opcoes, data, sitio, contexto = "visita", categoriaInicial = "cadastro", painel, abrirModal }: Props & {
  painel?: ModalFiltros;
  abrirModal?: (tipo: ModalFiltros) => void;
}) {
  const mudar = (valor: CriteriosSelecao) => onMudar({...valor,versao:2});
  const condicao = (campo: CondicaoSelecao["campo"]) => c.todas.find(v=>v.campo===campo);
  const alterar = (campo: CondicaoSelecao["campo"], valor?: CondicaoSelecao) => mudar({...c,todas:[...c.todas.filter(v=>v.campo!==campo),...(valor?[valor]:[])]});
  const valores = (campo: CampoValor) => {const v=condicao(campo);return v?.tipo==="VALORES"?v.valores:[];};
  const escolhas = {...enumerados,CATEGORIA:opcoes.categorias,LOTE:opcoes.lotes,RACA:opcoes.racas,PROTOCOLO:opcoes.protocolos};
  function seletor(campo: CampoValor, nome: string) {
    return <MultiSelect compacto contentClassName={painel ? "z-[1200]" : undefined} label={nome} placeholder="Todos" options={(escolhas[campo] ?? []).map(o => ({ value: o.id, label: o.nome }))} value={valores(campo)} onValueChange={novos => alterar(campo, novos.length ? { tipo: "VALORES", campo, valores: novos } : undefined)} />;
  }
  function faixa(campo: CampoNumerico, nome: string) {
    const v=condicao(campo), f=v?.tipo==="FAIXA"?v:null;
    return <fieldset className="livre-faixa"><legend>{nome}</legend><div>{(["min","max"] as const).map((limite,i)=><label key={limite}><span className="sr-only">{nome}: {i?"máximo":"mínimo"}</span><input type="number" placeholder={i?"Máximo":"Mínimo"} min={campo==="DIAS_ATE_RETORNO"?-100000:0} max={100000} step={campo==="PESO_KG"?"0.01":1} value={f?.[limite]??""} onChange={e=>{const novo={tipo:"FAIXA" as const,campo,incluirMin:true,incluirMax:true,...f,[limite]:e.target.value===""?undefined:Number(e.target.value)};alterar(campo,novo.min==null&&novo.max==null?undefined:novo);}}/></label>)}</div></fieldset>;
  }
  function manejo(id: string, titulo: string, situacoes: string[], campo: CampoNumerico) {
    const bloco = c.qualquer.find(grupo => grupo.id === id);
    const faixa = bloco?.todas.find(criterio => criterio.tipo === "FAIXA" && criterio.campo === campo);
    return <RegraManejo titulo={titulo} marcada={!!bloco} onMarcar={marcada => mudar({
      ...c,
      qualquer: marcada ? [...c.qualquer, { id, todas: [
        { tipo: "VALORES", campo: "SITUACAO", valores: situacoes },
        { tipo: "FAIXA", campo, min: 0, incluirMin: false, incluirMax: true },
      ] }] : c.qualquer.filter(grupo => grupo.id !== id),
    })}>
      <label className="livre-regra-dias">Mais de
        <input type="number" aria-label={`Dias: ${titulo}`} min={0} max={100000} step={1}
          value={faixa?.tipo === "FAIXA" ? faixa.min ?? "" : ""} onChange={e => {
            const min = e.target.value === "" ? undefined : Number(e.target.value);
            mudar({ ...c, qualquer: c.qualquer.map(grupo => grupo.id !== id ? grupo : {
              ...grupo,
              todas: grupo.todas.map(criterio => criterio.tipo === "FAIXA" && criterio.campo === campo ? { ...criterio, min } : criterio),
            }) });
          }} />
        dias
      </label>
    </RegraManejo>;
  }

  if (contexto === "programacao") {
    const secoes = [
      { id: "identificacao", nome: "Identificação", campos: <>
        <label>Brinco ou nome<input value={valores("BUSCA")[0] ?? ""} onChange={e => alterar("BUSCA", e.target.value.trim()
          ? { tipo: "VALORES", campo: "BUSCA", valores: [e.target.value] } : undefined)} /></label>
        {seletor("SEXO", "Sexo")}
      </> },
      { id: "cadastro", nome: "Cadastro e localização", campos: <>
        {seletor("LOTE", "Lotes")}{seletor("CATEGORIA", "Categorias")}
        {seletor("RACA", "Raças na composição")}{seletor("ORIGEM", "Origem")}
        {faixa("IDADE_DIAS", "Idade em dias")}{seletor("NASCIMENTO_ESTIMADO", "Precisão do nascimento")}
      </> },
      { id: "producao", nome: "Produção e lactação", campos: <>
        {faixa("DEL", "DEL · Dias em lactação")}{seletor("SITUACAO_PRODUTIVA", "Situação de lactação")}
        {faixa("PESO_KG", "Último peso conhecido (kg)")}{seletor("APTIDAO", "Finalidade")}
      </> },
      { id: "parto", nome: "Parto e pós-parto", campos: <>
        {faixa("DIAS_POS_PARTO", "Dias pós-parto")}{faixa("PARTOS", "Número de partos")}
        {seletor("HISTORICO_PARTO", "Histórico de parto")}{seletor("RP", "Retenção de placenta")}
      </> },
      { id: "aptidao", nome: "PEV e aptidão", campos: <>
        {seletor("PEV", "Situação do PEV")}{seletor("APTIDAO_REPRODUTIVA", "Aptidão reprodutiva")}
        {faixa("DIAS_APTIDAO", "Dias desde a aptidão")}
      </> },
      { id: "reproducao", nome: "Situação reprodutiva", campos: <>
        {seletor("SITUACAO", "Situação reprodutiva")}{seletor("PAPEL_REPRODUTIVO", "Papel reprodutivo")}
        {seletor("DESCARTE", "Descarte reprodutivo")}{faixa("IDADE_GESTACIONAL", "Idade gestacional")}
      </> },
      { id: "tentativas", nome: "Tentativas e diagnóstico", campos: <>
        {faixa("TENTATIVAS_CICLO", "Tentativas no ciclo")}{faixa("DIAS_TENTATIVA", "Dias desde a tentativa")}
        {faixa("DIAS_CONFIRMACAO", "Dias desde a confirmação")}{faixa("DIAS_ATE_RETORNO", "Dias até o retorno")}
        {seletor("RETORNO_INFORMADO", "Retorno informado")}
      </> },
      { id: "protocolos", nome: "Protocolos", campos: <>
        {seletor("PROTOCOLO_ATIVO", "Participação ativa")}{seletor("PROTOCOLO", "Protocolo específico")}
      </> },
    ];
    return <Tabs defaultValue={categoriaInicial} orientation="vertical" className="programacao-filtros">
      <TabsList variant="line" aria-label="Categorias de filtros">
        {secoes.map(secao => <TabsTrigger key={secao.id} value={secao.id}>{secao.nome}</TabsTrigger>)}
        <TabsTrigger value="combinacoes">Condições e alternativas</TabsTrigger>
      </TabsList>
      {secoes.map(secao => <TabsContent key={secao.id} value={secao.id}>
        <h3 className="mb-4 font-semibold">{secao.nome}</h3>
        <div className="livre-grid">{secao.campos}</div>
      </TabsContent>)}
      <TabsContent value="combinacoes" className="grid gap-4">
        <h3 className="font-semibold">Condições e alternativas</h3>
        <Condicoes compacto valor={c.todas} mudar={todas => mudar({ ...c, todas })} opcoes={escolhas} />
        {c.qualquer.map((grupo, indice) => <fieldset key={grupo.id} className="grid gap-2 rounded-lg border p-3">
          <legend>Alternativa {indice + 1}</legend>
          <Condicoes compacto valor={grupo.todas} opcoes={escolhas} mudar={todas => mudar({
            ...c, qualquer: c.qualquer.map(item => item.id === grupo.id ? { ...item, todas } : item),
          })} />
          <button type="button" className="visita-link" onClick={() => mudar({
            ...c, qualquer: c.qualquer.filter(item => item.id !== grupo.id),
          })}>Remover alternativa</button>
        </fieldset>)}
        <button type="button" className="visita-link" disabled={c.qualquer.length >= 20}
          onClick={() => mudar({ ...c, qualquer: [...c.qualquer, { id: crypto.randomUUID(), todas: [] }] })}>
          Adicionar alternativa
        </button>
        <label className="livre-politica">Dados ausentes<select value={c.politicaDesconhecidos}
          onChange={e => mudar({ ...c, politicaDesconhecidos: e.target.value as CriteriosSelecao["politicaDesconhecidos"] })}>
          <option value="EXCLUIR">Excluir da seleção</option><option value="INCLUIR">Incluir e sinalizar</option>
        </select></label>
      </TabsContent>
    </Tabs>;
  }
  if (painel === "caracteristicas") {
    return <div className="livre-grid livre-filtros-modal">
      {seletor("RACA", "Raças na composição")}
      {seletor("ORIGEM", "Origem")}
      {seletor("APTIDAO", "Finalidade")}
      {seletor("NASCIMENTO_ESTIMADO", "Precisão do nascimento")}
      {faixa("IDADE_DIAS", "Idade em dias")}
      {faixa("PESO_KG", "Último peso conhecido (kg)")}
      {faixa("DEL", "Dias em lactação (DEL)")}
      {faixa("PARTOS", "Número de partos")}
      {faixa("TENTATIVAS_CICLO", "Tentativas no ciclo")}
      {seletor("RP", "Retenção de placenta no parto de referência")}
      {seletor("PROTOCOLO_ATIVO", "Protocolos ativos por domínio")}
      {seletor("PROTOCOLO", "Protocolo específico")}
      <label>Brinco ou nome
        <input placeholder="Ex. Aurora ou 042" value={valores("BUSCA")[0] ?? ""} onChange={e => alterar(
          "BUSCA", e.target.value.trim() ? { tipo: "VALORES", campo: "BUSCA", valores: [e.target.value] } : undefined,
        )} />
      </label>
    </div>;
  }

  if (painel === "condicoes") {
    const ordem = c.ordenacao[0];
    const mudarOrdem = (primeira: typeof ordem) => mudar({ ...c, ordenacao: [primeira, ...c.ordenacao.slice(1)] });
    return <div className="livre-filtros-modal grid gap-5">
      <section className="grid gap-3">
        <h3>Filtros obrigatórios</h3>
        <Condicoes compacto valor={c.todas} mudar={todas => mudar({ ...c, todas })} opcoes={escolhas} />
      </section>
      <section className="grid gap-3 border-t border-border pt-4">
        <div className="flex flex-wrap items-center gap-2">
          <h3>Grupos de filtros</h3>
          <span className="rounded bg-muted px-2 py-1 text-xs text-muted-foreground">Pelo menos um grupo</span>
        </div>
        {c.qualquer.map((grupo, indice) => <fieldset key={grupo.id} className="grid min-w-0 gap-3 rounded-lg border border-border p-3">
          <legend className="px-1 font-medium">Grupo {indice + 1}</legend>
          <Condicoes compacto valor={grupo.todas} mudar={todas => mudar({
            ...c, qualquer: c.qualquer.map(item => item.id === grupo.id ? { ...item, todas } : item),
          })} opcoes={escolhas} />
          <Button type="button" variant="ghost" className="w-fit" onClick={() => mudar({
            ...c, qualquer: c.qualquer.filter(item => item.id !== grupo.id),
          })}>Remover grupo</Button>
        </fieldset>)}
        <Button type="button" variant="outline" className="w-fit" disabled={c.qualquer.length >= 20} onClick={() => mudar({
          ...c, qualquer: [...c.qualquer, { id: crypto.randomUUID(), todas: [] }],
        })}><Plus aria-hidden />Adicionar grupo de filtros</Button>
      </section>
      <section className="grid gap-3 border-t border-border pt-4">
        <h3>Ordem da lista</h3>
        <div className="livre-grid">
          <label>Ordenar por
            <SelectCampo value={ordem.campo} onValueChange={campo => mudarOrdem({ ...ordem, campo: campo as typeof ordem.campo })}>
              {Object.entries({ BRINCO: "Brinco", NOME: "Nome", ...camposNumericos }).map(([campo, nome]) =>
                <option key={campo} value={campo}>{nome}</option>)}
            </SelectCampo>
          </label>
          <label>Direção
            <SelectCampo value={ordem.direcao} onValueChange={direcao => mudarOrdem({ ...ordem, direcao: direcao as typeof ordem.direcao })}>
              <option value="ASC">Crescente</option>
              <option value="DESC">Decrescente</option>
            </SelectCampo>
          </label>
        </div>
        <label>Quando faltar um dado do filtro
          <SelectCampo value={c.politicaDesconhecidos} onValueChange={politicaDesconhecidos => mudar({
            ...c, politicaDesconhecidos: politicaDesconhecidos as CriteriosSelecao["politicaDesconhecidos"],
          })}>
            <option value="EXCLUIR">Excluir o animal da lista</option>
            <option value="INCLUIR">Incluir o animal com aviso</option>
          </SelectCampo>
        </label>
      </section>
    </div>;
  }

  const gestacoes = c.qualquer.filter(grupo => grupo.id.startsWith("gestacao-"));
  const semParto = c.qualquer.some(grupo => grupo.id === "sem-parto");
  return <>
    <section className="visita-painel">
      <div className="visita-painel-cabecalho"><h2>Onde e quando procurar</h2></div>
      <div className="livre-corpo livre-grid">
        <label>Sítio<input readOnly value={sitio} /></label>
        <label>Data da visita<input type="date" readOnly value={data} /></label>
        {seletor("LOTE", "Lotes")}
        {seletor("CATEGORIA", "Categorias")}
      </div>
    </section>
    <section className="visita-painel">
      <div className="visita-painel-cabecalho"><h2>Quais animais deseja avaliar?</h2></div>
      {manejo("vazias", "Vazias após o parto", ["VAZIA"], "DIAS_POS_PARTO")}
      {manejo("tentativa", "Aguardando diagnóstico após tentativa", ["AGUARDANDO_DIAGNOSTICO"], "DIAS_TENTATIVA")}
      <RegraManejo titulo="Gestantes nas faixas escolhidas" marcada={gestacoes.length > 0} onMarcar={marcada => mudar({
        ...c,
        qualquer: marcada ? [...c.qualquer, { id: "gestacao-1", todas: [
          { tipo: "VALORES", campo: "SITUACAO", valores: ["GESTANTE"] },
          { tipo: "FAIXA", campo: "IDADE_GESTACIONAL", min: 0, incluirMin: true, incluirMax: true },
        ] }] : c.qualquer.filter(grupo => !grupo.id.startsWith("gestacao-")),
      })}>
        {gestacoes.map((grupo, indice) => {
          const faixa = grupo.todas.find(criterio => criterio.tipo === "FAIXA");
          return <div className="livre-faixa-gestacao" key={grupo.id}>
            <span>Faixa {indice + 1}</span>
            {(["min", "max"] as const).map(limite => <input key={limite}
              aria-label={`Gestação faixa ${indice + 1}: ${limite === "min" ? "mínimo" : "máximo"}`}
              placeholder={limite === "min" ? "Mín." : "Máx."} type="number" min={0} max={100000}
              value={faixa?.tipo === "FAIXA" ? faixa[limite] ?? "" : ""} onChange={e => {
                const valor = e.target.value === "" ? undefined : Number(e.target.value);
                mudar({ ...c, qualquer: c.qualquer.map(item => item.id !== grupo.id ? item : {
                  ...item, todas: item.todas.map(criterio => criterio.tipo === "FAIXA" ? { ...criterio, [limite]: valor } : criterio),
                }) });
              }} />)}
            <span>dias</span>
            <button type="button" className="visita-link" onClick={() => mudar({
              ...c, qualquer: c.qualquer.filter(item => item.id !== grupo.id),
            })}>Remover</button>
          </div>;
        })}
        <button type="button" className="visita-link" disabled={c.qualquer.length >= 20} onClick={() => mudar({
          ...c, qualquer: [...c.qualquer, { ...structuredClone(gestacoes[0]), id: `gestacao-${crypto.randomUUID()}` }],
        })}>Adicionar faixa de gestação</button>
      </RegraManejo>
      {manejo("aptidao", "Não gestantes após aptidão reprodutiva (aptas ou vazias)", ["APTA", "VAZIA"], "DIAS_APTIDAO")}
      <RegraManejo titulo="Sem registro de parto" marcada={semParto} onMarcar={marcada => mudar({
        ...c,
        qualquer: marcada ? [...c.qualquer, { id: "sem-parto", todas: [
          { tipo: "VALORES", campo: "HISTORICO_PARTO", valores: ["SEM_REGISTRO"] },
        ] }] : c.qualquer.filter(grupo => grupo.id !== "sem-parto"),
      })} />
      <RegraManejo titulo="Desconsiderar animais em protocolo ativo" marcada={valores("PROTOCOLO_ATIVO").includes("NENHUM")}
        onMarcar={marcada => alterar("PROTOCOLO_ATIVO", marcada ? { tipo: "VALORES", campo: "PROTOCOLO_ATIVO", valores: ["NENHUM"] } : undefined)} />
    </section>
    <section className="visita-painel">
      <div className="visita-painel-cabecalho"><h2>Características do animal</h2></div>
      <div className="livre-corpo grid gap-4">
        <div className="livre-grid tres">
          {seletor("SEXO", "Sexo")}
          {seletor("PAPEL_REPRODUTIVO", "Papel reprodutivo")}
          {seletor("SITUACAO_PRODUTIVA", "Situação de lactação")}
          {seletor("SITUACAO", "Situação reprodutiva")}
          {seletor("DESCARTE", "Descarte reprodutivo")}
        </div>
        <div className="flex flex-wrap gap-2 border-t border-border pt-4">
          <Button type="button" variant="outline" aria-haspopup="dialog" onClick={() => abrirModal?.("caracteristicas")}>
            <ListFilter aria-hidden />Mais características
          </Button>
          <Button type="button" variant="outline" aria-haspopup="dialog" onClick={() => abrirModal?.("condicoes")}>
            <ArrowDownUp aria-hidden />Condições e ordenação
          </Button>
        </div>
      </div>
    </section>
  </>;
}
