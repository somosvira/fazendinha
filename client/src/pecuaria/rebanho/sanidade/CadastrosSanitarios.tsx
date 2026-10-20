import { useFiltrosTabelaLocal } from "@/financeiro/useFiltrosTabelaLocal";
import { BarraConsulta } from "@/financeiro/BarraConsulta";
import { SelectCampo } from "@/financeiro/SelectCampo";
import { reqV4 } from "../reproducao/api";
import { CamposFormatoExame, type CampoExame } from "./CamposExame";
import { useEffect, useRef, useState } from "react";
import { Pencil, Power, PowerOff } from "lucide-react";
import { Button, ErrorBox, Pill, TabelaFinanceira } from "../../../financeiro/financeiro-ui";
import { CampoFormulario, classeInput, PainelCadastro as PainelBase } from "../../../financeiro/PainelCadastro";
import { BuscaLista } from "@/components/BuscaLista";
import { PaginacaoLocal, usePaginacaoLocal } from "@/components/PaginacaoLocal";
import { listarTiposAplicacao, reqSanidade, salvarTipoAplicacao, type TipoAplicacao } from "./api";
import { ProtocolosCadastro } from "./ProtocolosCadastro";

const PainelCadastro = (props: Parameters<typeof PainelBase>[0]) => <PainelBase {...props} compacto />;

export type Doenca = { id: string; nome: string; ativo: boolean };
export type TipoExame = Doenca & { formatoExameHash?: string; padraoReprodutivo?: boolean; versaoFormato?: number; versaoAnteriorId?: string | null; tipoResultado: "TEXTO" | "NUMERO" | "OPCAO" | "MULTIPLO"; campos?: CampoExame[] | null; contexto?: string; unidade: string | null; opcoes: string[] | null; formatoBloqueado: boolean };
const abas = [
  { id: "protocolos", nome: "Protocolos sanitários" },
  { id: "aplicacao", nome: "Tipos de aplicação" },
  { id: "doenca", nome: "Doenças" },
  { id: "exame", nome: "Tipos de exame" },
] as const;
export type AbaCadastroSanitario = typeof abas[number]["id"];
type Tipo = Exclude<AbaCadastroSanitario, "protocolos">;
type Item = TipoAplicacao | Doenca | TipoExame;
const formatos = { TEXTO: "Texto", NUMERO: "Número", OPCAO: "Opção", MULTIPLO: "Vários resultados" };
const lerAba = (): AbaCadastroSanitario => {
  const valor = new URLSearchParams(window.location.search).get("cadastroSanitario");
  return abas.find((aba) => aba.id === valor)?.id ?? "protocolos";
};
export function CadastrosSanitarios({ podeLancar, cadastro, embutido = false, contextoExames = "SANITARIO" }: { podeLancar: boolean; cadastro?: AbaCadastroSanitario; embutido?: boolean; contextoExames?: "SANITARIO" | "REPRODUTIVO" }) {
  const [aba, setAba] = useState<AbaCadastroSanitario>(() => cadastro ?? lerAba());
  const [itens, setItens] = useState<Item[]>([]);
  const [busca, setBusca] = useState("");
  const [versao, setVersao] = useState(0);
  const [painel, setPainel] = useState<{ tipo: Tipo; id?: string; versaoAnteriorId?: string } | null>(null);
  const [nome, setNome] = useState("");
  const [campos, setCampos] = useState<CampoExame[]>([]);
  const [formato, setFormato] = useState<TipoExame["tipoResultado"]>("TEXTO");
  const [unidade, setUnidade] = useState("");
  const [opcoes, setOpcoes] = useState("");
  const [formatoBloqueado, setFormatoBloqueado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const geracao = useRef(0);
  const trava = useRef(false);
  useEffect(() => {
    const voltar = () => { setAba(cadastro ?? lerAba()); setPainel(null); };
    window.addEventListener("popstate", voltar);
    return () => window.removeEventListener("popstate", voltar);
  }, [cadastro]);
  useEffect(() => {
    const atual = ++geracao.current;
    setItens([]); setErro(null); setAviso(null); setPainel(null);
    if (aba === "protocolos") { setCarregando(false); return; }
    setCarregando(true);
    const pedido = aba === "aplicacao" ? listarTiposAplicacao() : aba === "exame" && contextoExames === "REPRODUTIVO" ? reqV4<Item[]>("/reproducao/tipos-exame?incluirInativos=true") : reqSanidade<Item[]>(`/${aba === "doenca" ? "doencas" : "tipos-exame"}?incluirInativos=true`);
    pedido.then((dados) => { if (geracao.current === atual) setItens(dados); })
      .catch((e: unknown) => { if (geracao.current === atual) setErro(e instanceof Error ? e.message : "Não conseguimos carregar. Tente novamente."); })
      .finally(() => { if (geracao.current === atual) setCarregando(false); });
    return () => { geracao.current++; };
  }, [aba, versao, contextoExames]);
  function selecionar(proxima: AbaCadastroSanitario) {
    if (trava.current) return;
    const url = new URL(window.location.href);
    url.searchParams.set("cadastroSanitario", proxima);
    window.history.pushState(window.history.state, "", url);
    setAba(proxima);
  }
  function abrir(tipo: Tipo, item?: Item) {
    if (!podeLancar || trava.current) return;
    setErro(null); setPainel({ tipo, id: item?.id }); setNome(item?.nome ?? "");
    const exame = item && "tipoResultado" in item ? item : undefined;
    setFormatoBloqueado(exame?.formatoBloqueado ?? false);
    setCampos(exame?.campos ?? (contextoExames === "REPRODUTIVO" ? [{ codigo: "CONCLUSAO_GESTACIONAL", rotulo: "Conclusão sobre a gestação", tipo: "OPCAO", obrigatorio: false, opcoes: ["POSITIVO", "NEGATIVO", "INCONCLUSIVO"] }, { codigo: "SEXO_FETAL", rotulo: "Sexo fetal", tipo: "OPCAO", obrigatorio: false, opcoes: ["M", "F"] }] : []));
    setFormato(exame?.tipoResultado ?? (contextoExames === "REPRODUTIVO" ? "MULTIPLO" : "TEXTO")); setUnidade(exame?.unidade ?? "");
    setOpcoes(exame?.opcoes?.join("\n") ?? "");
  }
  function novaVersao(item: Item) {
    abrir("exame", item);
    setPainel({ tipo: "exame", versaoAnteriorId: item.id }); setFormatoBloqueado(false);
    setNome(`${item.nome.replace(/ · versão \d+$/, "")} · versão ${"versaoFormato" in item ? (item.versaoFormato ?? 1) + 1 : 2}`);
  }
  async function executar(tipo: Tipo, id: string | undefined, body: object) {
    if (!podeLancar || trava.current) return;
    trava.current = true; setOcupado(true); setErro(null); setAviso(null);
    const atual = geracao.current;
    try {
      const dado = tipo === "aplicacao"
        ? await salvarTipoAplicacao(body, id)
        : tipo === "exame" && contextoExames === "REPRODUTIVO" ? await reqV4<Item>(`/reproducao/tipos-exame${id ? `/${id}` : ""}`, body, id ? "PATCH" : "POST") : await reqSanidade<Item>(`/${tipo === "doenca" ? "doencas" : "tipos-exame"}${id ? `/${id}` : ""}`, { method: id ? "PATCH" : "POST", body: JSON.stringify(body) });
      if (geracao.current !== atual) return;
      setItens((lista) => id ? lista.map((item) => item.id === id ? dado : item) : [...lista, dado]);
      setAviso("Cadastro atualizado."); setPainel(null);
    } catch (e: unknown) {
      if (geracao.current === atual) setErro(e instanceof Error ? e.message : "Não conseguimos salvar. Tente novamente.");
    } finally { trava.current = false; setOcupado(false); }
  }
  const titulo = abas.find((a) => a.id === aba)!.nome;
  const normalizar = (texto: string) => texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
  const consulta = useFiltrosTabelaLocal<Item>([
    {chave:"nome", naBarra: true,rotulo:"Nome",tipo:"texto",obter:i=>i.nome},
    {chave:"situacao",rotulo:"Situação",tipo:"opcoes",obter:i=>i.ativo?"ATIVO":"INATIVO",opcoes:[{valor:"ATIVO",texto:"Ativo"},{valor:"INATIVO",texto:"Inativo"}]},
    ...(aba==="exame"?[{chave:"formato",rotulo:"Formato do resultado",tipo:"texto" as const,obter:(i: Item)=>"tipoResultado" in i?formatos[i.tipoResultado]:null}]:[]),
  ]);
  const itensExibidos = consulta.filtrar(itens).filter(item => normalizar(item.nome).includes(normalizar(busca.trim())));
  const paginacao = usePaginacaoLocal(itensExibidos, `${aba}|${busca}|${consulta.criterios.map(c=>c.rotulo).join("|")}`);
  const novo = aba === "aplicacao" ? "Novo tipo de aplicação" : aba === "doenca" ? "Nova doença" : "Novo tipo de exame";
  function salvar() {
    if (!painel) return;
    void executar(painel.tipo, painel.id, painel.tipo === "exame"
      ? formatoBloqueado ? { nome } : { nome, versaoAnteriorId: painel.versaoAnteriorId, tipoResultado: formato, ...(formato === "MULTIPLO" ? { campos } : {}), unidade: unidade || null, opcoes: formato === "OPCAO" ? opcoes.split("\n").map((s) => s.trim()).filter(Boolean) : null }
      : { nome });
  }
  return <section className="mt-5 grid min-w-0 gap-5">
    {embutido && <h1 className="text-2xl font-semibold">{titulo}</h1>}
    {!embutido && <div role="tablist" aria-label="Cadastros sanitários" className="abas-pasta">
      {abas.map((a) => <button key={a.id} type="button" role="tab" aria-selected={aba === a.id} aria-controls={`cadastro-${a.id}`} disabled={ocupado} onClick={() => selecionar(a.id)} className={`rounded-lg px-4 py-2 text-sm font-semibold ${aba === a.id ? "bg-mast text-white" : "border border-border text-ink-2"}`}>{a.nome}</button>)}
    </div>}
    <div role="tabpanel" className="min-w-0" id={`cadastro-${aba}`} aria-label={titulo}>
      {aba === "protocolos" ? <ProtocolosCadastro podeLancar={podeLancar} /> : <section className="pec-catalogo-sanitario rounded-xl border border-border bg-card">

        {aba === "aplicacao" && <p className="px-4 pb-4 text-sm text-ink-3">Descrevem a finalidade, sem determinar estoque, Serviço ou carência. Renomear preserva o histórico.</p>}
        {aba === "exame" && <p className="px-4 pb-4 text-sm text-ink-3">Após a primeira coleta, o formato do resultado fica bloqueado, mesmo se a coleta estiver pendente ou anulada. Isso preserva a interpretação do histórico.</p>}
        <BarraConsulta campos={consulta.campos} edicaoFiltros={consulta.edicao} criterios={consulta.criterios} acao={podeLancar && <Button disabled={ocupado || carregando} onClick={() => abrir(aba)}>{novo}</Button>}><BuscaLista rotulo={`Buscar ${titulo.toLocaleLowerCase("pt-BR")}`} placeholder="Buscar pelo nome" valor={busca} onChange={setBusca} /></BarraConsulta>
        {!carregando && !erro && itens.length > 0 && !itensExibidos.length && <p role="status" className="px-4 pb-4 text-sm text-ink-3">Nenhum cadastro corresponde à busca. Altere ou limpe o nome pesquisado.</p>}
        <div className="px-4"><ErrorBox erro={erro} />{aviso && <p role="status" className="py-3 text-sm">{aviso}</p>}
          {ocupado && <p role="status" className="py-3 text-sm">Atualizando cadastro…</p>}
          {erro && !painel && <Button secondary disabled={ocupado} onClick={() => setVersao((v) => v + 1)}>Tentar novamente</Button>}
        </div>
        {carregando ? <p role="status" className="p-4">Carregando {titulo.toLowerCase()}…</p> : !erro && !itens.length ? <p className="p-4 text-sm text-ink-3">Nenhum cadastro. {podeLancar ? "Use o botão acima para cadastrar." : ""}</p> : <TabelaFinanceira filtrosColunas={consulta.colunas}
          rotulo={titulo} itens={paginacao.itens} chaveDe={(item) => item.id}
          colunas={[
            { chave: "nome", titulo: "Nome", principal: true, celula: (item) => item.nome },
            ...(aba === "exame" ? [{ chave: "formato", titulo: "Resultado", celula: (item: Item) => "tipoResultado" in item ? `${formatos[item.tipoResultado]}${item.unidade ? ` · ${item.unidade}` : ""}` : "—" }] : []),
            { chave: "situacao", titulo: "Situação", celula: (item) => <Pill tone={item.ativo ? "green" : "neutral"}>{item.ativo ? "Ativo" : "Inativo"}</Pill> },
            ...(podeLancar ? [{ chave: "acoes", titulo: "Ações", acoes: true, celula: (item: Item) => <div className="flex justify-end gap-1">
              {aba === "exame" && <Button secondary disabled={ocupado} onClick={() => novaVersao(item)}>Nova versão</Button>}
              <button type="button" aria-label={`Editar ${item.nome}`} disabled={ocupado} onClick={() => abrir(aba, item)} className="rounded-lg p-2 text-ink-2 hover:bg-surface-2 disabled:opacity-45"><Pencil size={16} /></button>
              <button type="button" aria-label={`${item.ativo ? "Inativar" : "Ativar"} ${item.nome}`} disabled={ocupado} onClick={() => void executar(aba, item.id, { ativo: !item.ativo })} className="rounded-lg p-2 text-ink-2 hover:bg-surface-2 disabled:opacity-45">{item.ativo ? <PowerOff size={16} /> : <Power size={16} />}</button>
            </div> }] : []),
          ]} />}
        {!carregando && !erro && <PaginacaoLocal controles={paginacao.controles} substantivo={titulo.toLocaleLowerCase("pt-BR")} id={`pagina-cadastro-${aba}`} />}
      </section>}
    </div>
    {painel && podeLancar && <PainelCadastro aberto titulo={painel.tipo === "aplicacao" ? "Tipo de aplicação" : painel.tipo === "doenca" ? "Doença" : "Tipo de exame"} onFechar={() => { if (!ocupado) setPainel(null); }} rodape={<><Button secondary disabled={ocupado} onClick={() => setPainel(null)}>Cancelar</Button><Button type="submit" form="cadastro-sanitario" disabled={ocupado}>{ocupado ? "Salvando…" : "Salvar"}</Button></>}>
      <form data-pec-formulario id="cadastro-sanitario" className="grid gap-4" onSubmit={(e) => { e.preventDefault(); salvar(); }}>
        <ErrorBox erro={erro} />
        <CampoFormulario id="cad-san-nome" rotulo="Nome" obrigatorio>{(p) => <input {...p} required minLength={2} maxLength={120} className={classeInput} value={nome} onChange={(e) => setNome(e.target.value)} />}</CampoFormulario>
        {painel.tipo === "exame" && <>
          <p className="text-sm text-ink-3">{formatoBloqueado ? "Já houve coleta deste exame. Formato, unidade e opções estão bloqueados. Para mudar esses campos, crie uma nova versão do formato." : "Após usar o exame em coleta ou protocolo publicado, o formato fica bloqueado. Uma nova versão preserva as coletas e os planos anteriores."}</p>
          <CampoFormulario id="cad-san-formato" rotulo="Formato do resultado">{(p) => <SelectCampo {...p} disabled={formatoBloqueado || ocupado || contextoExames === "REPRODUTIVO"} className={classeInput} value={formato} onValueChange={(valorSelecionado) => setFormato(valorSelecionado as typeof formato)}>{Object.entries(formatos).map(([valor, label]) => <option key={valor} value={valor}>{label}</option>)}</SelectCampo>}</CampoFormulario>
          {formato === "MULTIPLO" && <CamposFormatoExame campos={campos} onChange={setCampos} disabled={formatoBloqueado || ocupado} protegerClinicos={contextoExames === "REPRODUTIVO"} />}
          <CampoFormulario id="cad-san-unidade" rotulo="Unidade (opcional)">{(p) => <input {...p} disabled={formatoBloqueado || ocupado} className={classeInput} value={unidade} onChange={(e) => setUnidade(e.target.value)} />}</CampoFormulario>
          {formato === "OPCAO" && <CampoFormulario id="cad-san-opcoes" rotulo="Uma opção por linha" obrigatorio>{(p) => <textarea {...p} disabled={formatoBloqueado || ocupado} required className={classeInput} value={opcoes} onChange={(e) => setOpcoes(e.target.value)} />}</CampoFormulario>}
        </>}
      </form>
    </PainelCadastro>}
  </section>;
}
