import { useEffect, useRef, useState } from "react";
import { Pencil, Power, PowerOff } from "lucide-react";
import { Button, ErrorBox, Pill, TabelaFinanceira } from "../../../financeiro/financeiro-ui";
import { CampoFormulario, classeInput, PainelCadastro } from "../../../financeiro/PainelCadastro";
import { listarTiposAplicacao, reqSanidade, salvarTipoAplicacao, type TipoAplicacao } from "./api";
import { ProtocolosCadastro } from "./ProtocolosCadastro";

export type Doenca = { id: string; nome: string; ativo: boolean };
export type TipoExame = Doenca & { tipoResultado: "TEXTO" | "NUMERO" | "OPCAO"; unidade: string | null; opcoes: string[] | null; formatoBloqueado: boolean };
const abas = [
  { id: "protocolos", nome: "Protocolos sanitários" },
  { id: "aplicacao", nome: "Tipos de aplicação" },
  { id: "doenca", nome: "Doenças" },
  { id: "exame", nome: "Tipos de exame" },
] as const;
type Aba = typeof abas[number]["id"];
type Tipo = Exclude<Aba, "protocolos">;
type Item = TipoAplicacao | Doenca | TipoExame;
const formatos = { TEXTO: "Texto", NUMERO: "Número", OPCAO: "Opção" };
const lerAba = (): Aba => {
  const valor = new URLSearchParams(window.location.search).get("cadastroSanitario");
  return abas.find((aba) => aba.id === valor)?.id ?? "protocolos";
};
export function CadastrosSanitarios({ podeLancar }: { podeLancar: boolean }) {
  const [aba, setAba] = useState<Aba>(lerAba);
  const [itens, setItens] = useState<Item[]>([]);
  const [versao, setVersao] = useState(0);
  const [painel, setPainel] = useState<{ tipo: Tipo; id?: string } | null>(null);
  const [nome, setNome] = useState("");
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
    const voltar = () => { setAba(lerAba()); setPainel(null); };
    window.addEventListener("popstate", voltar);
    return () => window.removeEventListener("popstate", voltar);
  }, []);
  useEffect(() => {
    const atual = ++geracao.current;
    setItens([]); setErro(null); setAviso(null); setPainel(null);
    if (aba === "protocolos") { setCarregando(false); return; }
    setCarregando(true);
    const pedido = aba === "aplicacao" ? listarTiposAplicacao() : reqSanidade<Item[]>(`/${aba === "doenca" ? "doencas" : "tipos-exame"}?incluirInativos=true`);
    pedido.then((dados) => { if (geracao.current === atual) setItens(dados); })
      .catch((e: unknown) => { if (geracao.current === atual) setErro(e instanceof Error ? e.message : "Não conseguimos carregar. Tente novamente."); })
      .finally(() => { if (geracao.current === atual) setCarregando(false); });
    return () => { geracao.current++; };
  }, [aba, versao]);
  function selecionar(proxima: Aba) {
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
    setFormato(exame?.tipoResultado ?? "TEXTO"); setUnidade(exame?.unidade ?? "");
    setOpcoes(exame?.opcoes?.join("\n") ?? "");
  }
  async function executar(tipo: Tipo, id: string | undefined, body: object) {
    if (!podeLancar || trava.current) return;
    trava.current = true; setOcupado(true); setErro(null); setAviso(null);
    const atual = geracao.current;
    try {
      const dado = tipo === "aplicacao"
        ? await salvarTipoAplicacao(body, id)
        : await reqSanidade<Item>(`/${tipo === "doenca" ? "doencas" : "tipos-exame"}${id ? `/${id}` : ""}`, { method: id ? "PATCH" : "POST", body: JSON.stringify(body) });
      if (geracao.current !== atual) return;
      setItens((lista) => id ? lista.map((item) => item.id === id ? dado : item) : [...lista, dado]);
      setAviso("Cadastro atualizado."); setPainel(null);
    } catch (e: unknown) {
      if (geracao.current === atual) setErro(e instanceof Error ? e.message : "Não conseguimos salvar. Tente novamente.");
    } finally { trava.current = false; setOcupado(false); }
  }
  const titulo = abas.find((a) => a.id === aba)!.nome;
  const novo = aba === "aplicacao" ? "Novo tipo de aplicação" : aba === "doenca" ? "Nova doença" : "Novo tipo de exame";
  function salvar() {
    if (!painel) return;
    void executar(painel.tipo, painel.id, painel.tipo === "exame"
      ? formatoBloqueado ? { nome } : { nome, tipoResultado: formato, unidade: unidade || null, opcoes: formato === "OPCAO" ? opcoes.split("\n").map((s) => s.trim()).filter(Boolean) : null }
      : { nome });
  }
  return <section className="mt-5 grid gap-5">
    <div role="tablist" aria-label="Cadastros sanitários" className="flex flex-wrap gap-2">
      {abas.map((a) => <button key={a.id} type="button" role="tab" aria-selected={aba === a.id} aria-controls={`cadastro-${a.id}`} disabled={ocupado} onClick={() => selecionar(a.id)} className={`rounded-lg px-4 py-2 text-sm font-semibold ${aba === a.id ? "bg-mast text-white" : "border border-border text-ink-2"}`}>{a.nome}</button>)}
    </div>
    <div role="tabpanel" id={`cadastro-${aba}`} aria-label={titulo}>
      {aba === "protocolos" ? <ProtocolosCadastro podeLancar={podeLancar} /> : <section className="rounded-xl border border-border">
        <div className="flex flex-wrap items-center justify-between gap-3 p-4">
          <h2 className="h2">{titulo}</h2>
          {podeLancar && <Button disabled={ocupado || carregando} onClick={() => abrir(aba)}>{novo}</Button>}
        </div>
        {aba === "aplicacao" && <p className="px-4 pb-4 text-sm text-ink-3">Descrevem a finalidade, sem determinar estoque, Serviço ou carência. Renomear preserva o histórico.</p>}
        <div className="px-4"><ErrorBox erro={erro} />{aviso && <p role="status" className="py-3 text-sm">{aviso}</p>}
          {ocupado && <p role="status" className="py-3 text-sm">Atualizando cadastro…</p>}
          {erro && !painel && <Button secondary disabled={ocupado} onClick={() => setVersao((v) => v + 1)}>Tentar novamente</Button>}
        </div>
        {carregando ? <p role="status" className="p-4">Carregando {titulo.toLowerCase()}…</p> : !erro && !itens.length ? <p className="p-4 text-sm text-ink-3">Nenhum cadastro. {podeLancar ? "Use o botão acima para cadastrar." : ""}</p> : <TabelaFinanceira
          rotulo={titulo} itens={itens} chaveDe={(item) => item.id}
          colunas={[
            { chave: "nome", titulo: "Nome", principal: true, celula: (item) => item.nome },
            ...(aba === "exame" ? [{ chave: "formato", titulo: "Resultado", celula: (item: Item) => "tipoResultado" in item ? `${formatos[item.tipoResultado]}${item.unidade ? ` · ${item.unidade}` : ""}` : "—" }] : []),
            { chave: "situacao", titulo: "Situação", celula: (item) => <Pill tone={item.ativo ? "green" : "neutral"}>{item.ativo ? "Ativo" : "Inativo"}</Pill> },
            ...(podeLancar ? [{ chave: "acoes", titulo: "Ações", acoes: true, celula: (item: Item) => <div className="flex justify-end gap-1">
              <button type="button" aria-label={`Editar ${item.nome}`} disabled={ocupado} onClick={() => abrir(aba, item)} className="rounded-lg p-2 text-ink-2 hover:bg-surface-2 disabled:opacity-45"><Pencil size={16} /></button>
              <button type="button" aria-label={`${item.ativo ? "Inativar" : "Ativar"} ${item.nome}`} disabled={ocupado} onClick={() => void executar(aba, item.id, { ativo: !item.ativo })} className="rounded-lg p-2 text-ink-2 hover:bg-surface-2 disabled:opacity-45">{item.ativo ? <PowerOff size={16} /> : <Power size={16} />}</button>
            </div> }] : []),
          ]} />}
      </section>}
    </div>
    {painel && podeLancar && <PainelCadastro aberto titulo={painel.tipo === "aplicacao" ? "Tipo de aplicação" : painel.tipo === "doenca" ? "Doença" : "Tipo de exame"} onFechar={() => { if (!ocupado) setPainel(null); }} rodape={<><Button secondary disabled={ocupado} onClick={() => setPainel(null)}>Cancelar</Button><Button type="submit" form="cadastro-sanitario" disabled={ocupado}>{ocupado ? "Salvando…" : "Salvar"}</Button></>}>
      <form id="cadastro-sanitario" className="grid gap-4" onSubmit={(e) => { e.preventDefault(); salvar(); }}>
        <ErrorBox erro={erro} />
        <CampoFormulario id="cad-san-nome" rotulo="Nome" obrigatorio>{(p) => <input {...p} required minLength={2} maxLength={120} className={classeInput} value={nome} onChange={(e) => setNome(e.target.value)} />}</CampoFormulario>
        {painel.tipo === "exame" && <>
          <p className="text-sm text-ink-3">{formatoBloqueado ? "Já houve coleta deste exame. Formato, unidade e opções estão bloqueados. Para mudar esses campos, crie outro tipo de exame." : "Após a primeira coleta, formato, unidade e opções ficam bloqueados."}</p>
          <CampoFormulario id="cad-san-formato" rotulo="Formato do resultado">{(p) => <select {...p} disabled={formatoBloqueado || ocupado} className={classeInput} value={formato} onChange={(e) => setFormato(e.target.value as typeof formato)}>{Object.entries(formatos).map(([valor, label]) => <option key={valor} value={valor}>{label}</option>)}</select>}</CampoFormulario>
          <CampoFormulario id="cad-san-unidade" rotulo="Unidade (opcional)">{(p) => <input {...p} disabled={formatoBloqueado || ocupado} className={classeInput} value={unidade} onChange={(e) => setUnidade(e.target.value)} />}</CampoFormulario>
          {formato === "OPCAO" && <CampoFormulario id="cad-san-opcoes" rotulo="Uma opção por linha" obrigatorio>{(p) => <textarea {...p} disabled={formatoBloqueado || ocupado} required className={classeInput} value={opcoes} onChange={(e) => setOpcoes(e.target.value)} />}</CampoFormulario>}
        </>}
      </form>
    </PainelCadastro>}
  </section>;
}
