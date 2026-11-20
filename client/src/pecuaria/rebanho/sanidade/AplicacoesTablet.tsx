import { ConteudoReferenciaMedicamento, PendenciasMedicamento, type ConferenciaBula, type ReferenciaMedicamento } from "@/estoque/ReferenciaMedicamento";
import { rotuloUnidade, type UnidadeMedida } from "@/lib/unidades";
import { useEffect, useState } from "react";
import { ChevronDown, Info, MapPin, Plus, Stethoscope, X } from "lucide-react";
import { SubTabs } from "@/components/SubTabs";
import { lerSitioTablet, MemorizarSitioTablet } from "./SitioTablet";
import { EmptyState } from "@/components/EmptyState";
import { DatePicker } from "@/components/DatePicker";
import { AjustesTouchTablet } from "./AjustesTouchTablet";
import { CampoNumericoTablet, numeroDigitadoTablet } from "./CampoNumericoTablet";
import { criarFiltroMedicamentos } from "./busca-medicamentos";
import { HorarioAplicacao } from "./HorarioAplicacao";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getUsuario } from "@/lib/auth";
import { navegarPara } from "@/router";
import { usePropriedades } from "@/api/propriedades";
import { reqSanidade } from "./api";
import "./aplicacoes-tablet.css";

type Animal = { id: string; brinco: string; nome: string | null };
type Produto = { id: string; nome: string; unidade: UnidadeMedida; rastrearPartidas: boolean; produtoEstoqueId?: string | null };
type Item = { produtoId: string; quantidade: number; nome: string; unidade?: UnidadeMedida };
type QuantidadesTemplate = Record<string, { quantidade: number; unidade: UnidadeMedida }>;
type Opcoes = {
  catalogo: Produto[];
  doencas: { id: string; nome: string }[];
  templates: { doencaId: string; produtoIds: string[]; quantidades?: QuantidadesTemplate }[];
  partidas: { id: string; produtoId: string; codigo: string; validade: string | null }[];
};
type Envio = {
  id: string; animais: Animal[]; itens: Item[]; autorNome: string; aplicadaEm: string; enviadoEm: string;
  revisadoEm: string | null; revisorNome: string | null; devolucao: string | null;
};
type DadosMedicamento = {
 nome: string; unidade: UnidadeMedida; apresentacao: string | null; fabricante: string | null; classificacao: string | null;
 principiosAtivos: string[]; conservacao: string | null; orientacaoUso: string | null; viaPadrao: string | null; referenciaTecnica: string | null;
 carenciaLeiteHoras: number | null; carenciaCarneHoras: number | null;
 bula: ReferenciaMedicamento | null; conferenciaBula?: ConferenciaBula | null;
};
type Conferencia = { partidaId: string; leite: string; carne: string; ciencia: boolean };
type Impacto = { animalId: string; revisao: string; itens: { protocolo: string; efeito: "AVISAR" | "BLOQUEAR" | "RETIRAR" }[] };

const base = "/pecuaria/sanidade/tablet";
const nomeAnimal = (a: Animal) => [a.brinco, a.nome].filter(Boolean).join(" · ");
const horarioLocal = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }).format(new Date()).replace(" ", "T");
const dataHora = (v: string) => new Date(v).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
const msg = (e: unknown) => e instanceof Error ? e.message : "Não foi possível concluir a operação.";
const postar = <T,>(rota: string, dados: unknown, sitio: number) => reqSanidade<T>(rota, { method: "POST", body: JSON.stringify(dados) }, sitio);
const entrada = "tablet-aplicacao-input";

export function AplicacoesTablet({ sitio: sitioGlobal, caminho }: { sitio: number | null; caminho: string }) {
  const usuario = getUsuario();
  const { data: propriedades, loading } = usePropriedades();
  const [sitioLocal, setSitioLocal] = useState<number | null>(() => lerSitioTablet(usuario?.id));
  const preferido = sitioGlobal ?? sitioLocal ?? (propriedades.length === 1 ? propriedades[0].id : null);
  const sitio = preferido && propriedades.some(p => p.id === preferido) ? preferido : null;
  const nomeSitio = propriedades.find(p => p.id === sitio)?.nome ?? "";
  const pode = (flag: string) => !!usuario && (usuario.dono || usuario.flags.includes(flag));
  const enviar = pode("enviarAplicacoesTablet");
  const revisar = pode("revisarAplicacoesTablet");
  const templates = pode("gerenciarTemplatesTablet");
  const aba = caminho.replace(/\/$/, "").endsWith("/aprovacao") ? "aprovacao" : caminho.replace(/\/$/, "").endsWith("/templates") ? "templates" : "registro";
  return <section className="tablet-aplicacao" aria-label="Aplicações no tablet"><AjustesTouchTablet />
    <SubTabs ariaLabel="Aplicações do tablet" tabs={[
      ...(enviar ? [{ id: "registro" as const, label: "Tablet" }] : []),
      ...(revisar ? [{ id: "aprovacao" as const, label: "Aprovação" }] : []),
      ...(templates ? [{ id: "templates" as const, label: "Templates" }] : []),
    ]} active={aba} onSelect={id => navegarPara(id === "registro" ? base : base + "/" + id)} />
    {sitio && usuario && <MemorizarSitioTablet usuarioId={usuario.id} sitio={sitio} />}
    {!sitio ? loading ? <p role="status">Carregando sítios…</p> : <EmptyState
      icon={MapPin}
      className="tablet-sitio-vazio"
      titulo={propriedades.length ? "Escolha um sítio" : "Nenhum sítio disponível"}
      descricao={propriedades.length ? "Selecione o sítio para continuar." : "Seu acesso não possui sítios disponíveis."}
      acao={propriedades.length > 0 ? <select aria-label="Sítio" className={entrada} value="" onChange={e => setSitioLocal(Number(e.target.value) || null)}>
        <option value="">Selecione o sítio</option>{propriedades.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
      </select> : undefined}
    /> :
      aba === "registro" && enviar ? <Registro key={sitio} sitio={sitio} autor={usuario?.nome ?? ""} nomeSitio={nomeSitio} /> :
      aba === "aprovacao" && revisar ? <Aprovacao key={sitio} sitio={sitio} nomeSitio={nomeSitio} /> :
      aba === "templates" && templates ? <Templates key={sitio} sitio={sitio} nomeSitio={nomeSitio} /> :
      <p>Seu perfil não tem acesso a esta página.</p>}
  </section>;
}

function useOpcoes(sitio: number) {
  const [opcoes, setOpcoes] = useState<Opcoes>();
  const [erro, setErro] = useState("");
  const [tentativa, tentar] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    reqSanidade<Opcoes>(`/tablet/opcoes?propriedadeId=${sitio}`, { signal: abort.signal }, sitio)
      .then(setOpcoes).catch(e => { if (!abort.signal.aborted) setErro(msg(e)); });
    return () => abort.abort();
  }, [sitio, tentativa]);
  return { opcoes, setOpcoes, erro, repetir: () => { setErro(""); tentar(v => v + 1); } };
}

function Registro({ sitio, autor, nomeSitio }: { sitio: number; autor: string; nomeSitio: string }) {
  const { opcoes, erro: erroOpcoes, repetir } = useOpcoes(sitio);
  const [devolvidos, setDevolvidos] = useState<Envio[]>([]);
  const [corrigindo, setCorrigindo] = useState<Envio>();
  const [erroDevolvidos, setErroDevolvidos] = useState("");
  useEffect(() => {
    const abort = new AbortController();
    reqSanidade<Envio[]>(`/tablet/devolvidos?propriedadeId=${sitio}`, { signal: abort.signal }, sitio)
      .then(setDevolvidos).catch(e => { if (!abort.signal.aborted) setErroDevolvidos(msg(e)); });
    return () => abort.abort();
  }, [sitio]);
  const [etapa, setEtapa] = useState(0);
  const [modo, setModo] = useState<"numero" | "nome">("numero");
  const [termo, setTermo] = useState("");
  const [resultados, setResultados] = useState<Animal[] | null>(null);
  const [animais, setAnimais] = useState<Animal[]>([]);
  const [itens, setItens] = useState<Record<string, string>>({});
  const [medicamentoAberto, setMedicamentoAberto] = useState<Produto | null>(null);
  const [template, setTemplate] = useState<{ nome: string; produtos: Produto[]; quantidades: QuantidadesTemplate } | null>(null);
  const [escolhendoDoenca, setEscolhendoDoenca] = useState(false);
  const [marcados, setMarcados] = useState<string[]>([]);
  const [aplicadaEm, setAplicadaEm] = useState(horarioLocal);
  const [chave, setChave] = useState(() => crypto.randomUUID());
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const catalogo = opcoes?.catalogo ?? [];
  const selecionados = Object.entries(itens).flatMap(([produtoId, quantidade]) => {
    const produto = catalogo.find(p => p.id === produtoId);
    return produto ? [{ produtoId, nome: produto.nome, unidade: produto.unidade, quantidade: numeroDigitadoTablet(quantidade) }] : [];
  });

  function limparBusca() { setTermo(""); setResultados(null); setErro(""); }
  function mudarModo(novo: typeof modo) {
    if (modo === novo) return;
    setModo(novo);
    limparBusca();
  }
  async function pesquisar(evento: React.FormEvent) {
    evento.preventDefault();
    if (!termo.trim() || ocupado) return;
    setOcupado(true); setErro(""); setResultados(null);
    try {
      const query = new URLSearchParams({ propriedadeId: String(sitio), modo, termo: termo.trim() });
      const encontrados = await reqSanidade<Animal[]>(`/tablet/animais?${query}`, undefined, sitio);
      setResultados(encontrados.filter(a => !animais.some(b => b.id === a.id)));
    } catch (e) { setErro(msg(e)); } finally { setOcupado(false); }
  }
  function adicionar(ids: string[], quantidades: QuantidadesTemplate = {}) {
    setItens(atual => {
      const novos = { ...atual };
      for (const id of ids) {
        const q = quantidades[id];
        if (!novos[id]?.trim()) novos[id] = q && catalogo.find(p => p.id === id)?.unidade === q.unidade ? String(q.quantidade).replace(".", ",") : "";
      }
      return novos;
    });
  }
  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    if (ocupado) return;
    setOcupado(true); setErro("");
    try {
      await postar("/tablet/envios", { id: chave, corrigeId: corrigindo?.id, propriedadeId: sitio, aplicadaEm: corrigindo?.aplicadaEm ?? aplicadaEm + ":00-03:00",
        animalIds: animais.map(a => a.id), itens: selecionados.map(({ produtoId, quantidade }) => ({ produtoId, quantidade })) }, sitio);
      setAviso(`Envio recebido. A ordenha foi sinalizada para ${animais.length} ${animais.length === 1 ? "vaca" : "vacas"}.`);
      if (corrigindo) setDevolvidos(atual => atual.filter(e => e.id !== corrigindo.id));
      setCorrigindo(undefined);
      setAnimais([]); setItens({}); limparBusca(); setEtapa(0); setChave(crypto.randomUUID()); setAplicadaEm(horarioLocal());
    } catch (e) { setErro(msg(e)); } finally { setOcupado(false); }
  }

  return <>
    <header className="tablet-registro-cabecalho">
      <div><h1>Registrar aplicações</h1><p className="tablet-secundario">{nomeSitio} · {autor}</p></div>
      {etapa === 1 && <Button type="button" variant="outline" disabled={!opcoes} onClick={() => { repetir(); setEscolhendoDoenca(true); }}><Stethoscope size={20} aria-hidden />Selecionar doença</Button>}
    </header>
    {aviso && <p role="status" className="tablet-aviso">{aviso}</p>}
    {etapa === 0 && erroDevolvidos && <p role="alert">Não foi possível carregar os envios devolvidos. {erroDevolvidos}</p>}
    {etapa === 0 && devolvidos.length > 0 && <section className="tablet-bloco" aria-label="Devolvidos para correção">
      <h3>Devolvidos para correção</h3>
      {devolvidos.map(envio => <div className="tablet-linha tablet-item" key={envio.id}><span>{envio.animais.map(nomeAnimal).join(" / ")} · {envio.devolucao}</span>
        <Button variant="outline" disabled={!!animais.length || Object.keys(itens).length > 0} onClick={() => {
          setCorrigindo(envio); setChave(crypto.randomUUID()); setAnimais(envio.animais);
          setItens(Object.fromEntries(envio.itens.map(i => [catalogo.find(p => p.id === i.produtoId || p.produtoEstoqueId === i.produtoId)?.id ?? i.produtoId, String(i.quantidade)]))); setEtapa(1);
        }}>Corrigir</Button></div>)}
    </section>}
    <ol className="tablet-etapas">{["Vacas", "Medicamentos", "Revisão"].map((nome, i) =>
      <li key={nome} aria-current={i === etapa ? "step" : undefined}>{i + 1} <strong>{nome}</strong></li>)}</ol>
    <section className="tablet-painel">
      {erro && <p role="alert" className="tablet-aviso">{erro}</p>}
      {etapa === 0 && <>
        <div className="tablet-linha"><h2>Escolher a vaca</h2><div className="tablet-seletor" role="group" aria-label="Buscar vaca por">
          <Button variant="ghost" disabled={ocupado} aria-pressed={modo === "numero"} onClick={() => mudarModo("numero")}>Número</Button>
          <Button variant="ghost" disabled={ocupado} aria-pressed={modo === "nome"} onClick={() => mudarModo("nome")}>Nome</Button>
        </div></div>
        <form className="tablet-pilha" onSubmit={pesquisar}>
          {modo === "numero" ? <>
            <input id="tablet-busca-vaca" className={entrada} readOnly inputMode="none" value={termo} aria-label="Número da vaca" placeholder="Digite o número da vaca" />
            <div className="tablet-teclado">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9", "Limpar", "0", "Apagar"].map(tecla =>
                <Button key={tecla} type="button" variant="outline" disabled={ocupado} onClick={() => {
                  setResultados(null);
                  setTermo(t => tecla === "Limpar" ? "" : tecla === "Apagar" ? t.slice(0, -1) : (t + tecla).slice(0, 30));
                }}>{tecla}</Button>)}
            </div>
          </> : <input autoFocus id="tablet-busca-vaca" className={entrada} type="search" inputMode="search" autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false} enterKeyHint="search" value={termo} disabled={ocupado} onChange={e => { setTermo(e.target.value); setResultados(null); }} aria-label="Nome da vaca" placeholder="Digite o nome da vaca" maxLength={100} />}
          <Button type="submit" disabled={!termo.trim() || ocupado}>{ocupado ? "Pesquisando…" : "Pesquisar"}</Button>
        </form>
        {resultados && (resultados.length ? <ul className="tablet-resultados">{resultados.map(a => <li key={a.id}><Button variant="outline" onClick={() => { setAnimais([...animais, a]); limparBusca(); }}>{nomeAnimal(a)} · Adicionar</Button></li>)}</ul> : <p role="status">Nenhuma vaca disponível para esta busca.</p>)}
        {animais.length > 0 && <section className="tablet-vacas-selecionadas" aria-label="Vacas selecionadas"><h3>Vacas selecionadas <span>{animais.length}</span></h3>
          <ul>{animais.map(a => <li key={a.id}><div><strong>{a.brinco || a.nome || "Sem identificação"}</strong>{a.brinco && a.nome && <p>{a.nome}</p>}</div><Button type="button" variant="outline" className="tablet-vaca-remover" aria-label={`Remover ${nomeAnimal(a)}`} onClick={() => setAnimais(atual => atual.filter(v => v.id !== a.id))}><X className="!size-5" aria-hidden /></Button></li>)}</ul>
          <Button type="button" variant="outline" onClick={() => { limparBusca(); document.getElementById("tablet-busca-vaca")?.focus(); }}><Plus size={18} aria-hidden />Adicionar mais vacas</Button>
        </section>}
        <div className="tablet-acoes"><Button disabled={!animais.length || ocupado} onClick={() => { setErro(""); setAviso(""); setEtapa(1); }}>Próximo</Button></div>
      </>}
      {etapa === 1 && <>
        <h2>Medicamentos aplicados</h2><p className="tablet-secundario">{animais.map(nomeAnimal).join(" / ")}</p>
        {!opcoes ? erroOpcoes ? <><p role="alert">{erroOpcoes}</p><Button onClick={repetir}>Tentar novamente</Button></> : <p role="status">Carregando medicamentos…</p> :
          <form onSubmit={e => { e.preventDefault(); setEtapa(2); }} className="tablet-pilha">
            <SeletorMedicamentos produtos={catalogo} selecionados={itens} alterar={(id, marcado) => setItens(atual => marcado
              ? { ...atual, [id]: atual[id] ?? "" }
              : Object.fromEntries(Object.entries(atual).filter(([produtoId]) => produtoId !== id)))} />
            {selecionados.map(i => <div key={i.produtoId} className="tablet-item tablet-medicamento-selecionado"><div className="tablet-medicamento-identidade"><strong>{i.nome}</strong><Button className="tablet-medicamento-info" variant="ghost" type="button" aria-label={`Informações de ${i.nome}`} onClick={() => setMedicamentoAberto(catalogo.find(p => p.id === i.produtoId) ?? null)}><Info size={16} aria-hidden />Informações</Button></div>
              <label className="tablet-medicamento-quantidade">Qtd. ({rotuloUnidade(i.unidade ?? "UN")})<CampoNumericoTablet className={entrada} rotulo={`Quantidade em ${rotuloUnidade(i.unidade ?? "UN")} de ${i.nome}`} required inteiro={["UN", "CX", "SC"].includes(i.unidade ?? "UN")} valor={itens[i.produtoId]} onChange={valor => setItens({ ...itens, [i.produtoId]: valor })} /></label>
              <Button className="tablet-medicamento-remover" type="button" variant="outline" aria-label={`Remover ${i.nome}`} onClick={() => setItens(Object.fromEntries(Object.entries(itens).filter(([id]) => id !== i.produtoId)))}><X size={18} aria-hidden /></Button>
            </div>)}
            <div className="tablet-acoes"><Button variant="outline" type="button" onClick={() => { if (corrigindo) { setCorrigindo(undefined); setAnimais([]); setItens({}); } setEtapa(0); }}>{corrigindo ? "Cancelar correção" : "Voltar"}</Button><Button type="submit" disabled={!selecionados.length}>Revisar aplicações</Button></div>
          </form>}
      </>}
      {etapa === 2 && <form className="tablet-pilha" onSubmit={enviar}>
        <h2>Revisar aplicações</h2>
        <p><strong>Vacas:</strong> {animais.map(nomeAnimal).join(" / ")}</p>
        <h3>Medicamentos por vaca</h3><ListaItens itens={selecionados} />
        {corrigindo ? <p>Aplicado em {dataHora(corrigindo.aplicadaEm)}</p> : <fieldset className="tablet-datahora">
          <legend><span className="tablet-datahora-titulo">Data e hora da aplicação<Button type="button" variant="ghost" onClick={() => setAplicadaEm(horarioLocal())}>Agora</Button></span></legend>
          <label onFocusCapture={e => { if (e.target instanceof HTMLInputElement) e.target.select(); }} onKeyDown={e => { if (e.key === "Enter" && e.target instanceof HTMLInputElement) { e.preventDefault(); if (e.target.reportValidity()) e.currentTarget.parentElement?.querySelector<HTMLInputElement>('input[aria-label="Hora da aplicação"]')?.focus(); } }}>Data<DatePicker aria-label="Data da aplicação" popoverClassName="tablet-calendario" required max={horarioLocal().slice(0, 10)} value={aplicadaEm.split("T")[0]}
            onChange={valor => setAplicadaEm(`${valor}T${aplicadaEm.split("T")[1] ?? ""}`)} /></label>
          <label>Hora<HorarioAplicacao valor={aplicadaEm.split("T")[1] ?? ""}
            max={aplicadaEm.split("T")[0] === horarioLocal().slice(0, 10) ? horarioLocal().slice(11, 16) : undefined}
            onChange={valor => setAplicadaEm(`${aplicadaEm.split("T")[0]}T${valor}`)} /></label>
        </fieldset>}
        <div className="tablet-acoes"><Button type="button" variant="outline" disabled={ocupado} onClick={() => setEtapa(1)}>Voltar aos medicamentos</Button><Button type="submit" disabled={ocupado}>{ocupado ? "Enviando…" : "Enviar para revisão"}</Button></div>
      </form>}
    </section>
    <InformacoesMedicamento produto={medicamentoAberto} sitio={sitio} fechar={() => setMedicamentoAberto(null)} />
    <Dialog open={escolhendoDoenca} onOpenChange={setEscolhendoDoenca}>
      <DialogContent className="tablet-dialogo" aria-describedby={undefined}><DialogTitle>Selecionar doença</DialogTitle>
        {erroOpcoes ? <div role="alert">{erroOpcoes} <Button type="button" variant="outline" onClick={repetir}>Tentar novamente</Button></div> : <><div className="tablet-pilha">{opcoes?.templates.filter(t => t.produtoIds.length).map(t => {
          const nome = opcoes.doencas.find(d => d.id === t.doencaId)?.nome;
          if (!nome) return null;
          return <Button type="button" key={t.doencaId} variant="outline" onClick={() => { setEscolhendoDoenca(false); setTemplate({ nome, produtos: catalogo.filter(p => t.produtoIds.includes(p.id)), quantidades: t.quantidades ?? {} }); setMarcados(t.produtoIds); }}>{nome} ({t.produtoIds.length})</Button>;
        })}</div>
        {!opcoes?.templates.some(t => t.produtoIds.length && opcoes.doencas.some(d => d.id === t.doencaId)) && <EmptyState compacto icon={Stethoscope} titulo="Nenhum template cadastrado" descricao="Este sítio ainda não possui templates por doença. Você pode escolher os medicamentos diretamente na lista." />}</>}
      </DialogContent>
    </Dialog>
    <Dialog open={!!template} onOpenChange={aberto => { if (!aberto) setTemplate(null); }}>
      <DialogContent className="tablet-dialogo tablet-dialogo-template" aria-describedby={undefined}><DialogHeader><DialogTitle>{template?.nome}</DialogTitle></DialogHeader>
        <div className="tablet-pilha">
        {template?.produtos.map(p => <label className="tablet-check" key={p.id}><input type="checkbox" checked={marcados.includes(p.id)} onChange={e => setMarcados(e.target.checked ? [...marcados, p.id] : marcados.filter(id => id !== p.id))} />{p.nome}{template.quantidades[p.id] && <span className="tablet-template-quantidade">{template.quantidades[p.id].quantidade} {rotuloUnidade(template.quantidades[p.id].unidade)}</span>}</label>)}
        </div>
        <div className="tablet-acoes"><Button disabled={!marcados.length} onClick={() => { adicionar(marcados, template?.quantidades); setTemplate(null); }}>Usar itens marcados</Button></div>
      </DialogContent>
    </Dialog>
  </>;
}

function SeletorMedicamentos({ produtos, selecionados, alterar }: {
  produtos: Produto[]; selecionados: Record<string, string>; alterar: (id: string, marcado: boolean) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [termo, setTermo] = useState("");
  const corresponde = criarFiltroMedicamentos(termo);
  const filtrados = produtos.filter(p => corresponde(p.nome));
  return <Popover open={aberto} onOpenChange={valor => { setAberto(valor); if (!valor) setTermo(""); }}>
    <PopoverTrigger asChild><Button type="button" variant="outline" className="tablet-medicamentos-trigger">
      Adicionar medicamentos<ChevronDown size={20} aria-hidden />
    </Button></PopoverTrigger>
    <PopoverContent align="start" side="bottom" avoidCollisions collisionPadding={12} className="tablet-medicamentos-dropdown" aria-label="Medicamentos do estoque">
      <div className="tablet-busca-campo"><input type="search" inputMode="search" autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false} enterKeyHint="search" className={entrada} aria-label="Pesquisar medicamento" placeholder="Pesquisar medicamento…"
        value={termo} onChange={e => setTermo(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); } }} />
        {termo && <Button type="button" variant="ghost" className="tablet-busca-limpar" aria-label="Limpar pesquisa de medicamento" onClick={e => { setTermo(""); e.currentTarget.parentElement?.querySelector("input")?.focus(); }}><X size={18} aria-hidden /></Button>}
      </div>
      <div className="tablet-medicamentos-lista">
        {filtrados.map(p => <label className="tablet-medicamento-opcao" key={p.id}>
          <input type="checkbox" checked={p.id in selecionados} onChange={e => alterar(p.id, e.target.checked)} />
          <span>{p.nome}</span><small>{rotuloUnidade(p.unidade)}</small>
        </label>)}
        {!filtrados.length && <p role="status">{produtos.length ? "Nenhum medicamento disponível para esta busca." : "Nenhum medicamento disponível no estoque deste sítio."}</p>}
      </div>
    </PopoverContent>
  </Popover>;
}

function ListaItens({ itens }: { itens: Item[] }) {
  return <ul>{itens.map(item => <li className="tablet-linha tablet-item" key={item.produtoId}><strong>{item.nome}</strong><span>{item.quantidade.toLocaleString("pt-BR", { maximumFractionDigits: 3 })} {rotuloUnidade(item.unidade ?? "UN")}</span></li>)}</ul>;
}

function Aprovacao({ sitio, nomeSitio }: { sitio: number; nomeSitio: string }) {
  const { opcoes, erro: erroOpcoes, repetir } = useOpcoes(sitio);
  const [fila, setFila] = useState<Envio[]>();
  const [filtro, setFiltro] = useState("Pendentes");
  const [aberto, setAberto] = useState<Envio>();
  const [conferencia, setConferencia] = useState<Record<string, Conferencia>>({});
  const [impactos, setImpactos] = useState<Impacto[]>();
  const [motivosImpacto, setMotivosImpacto] = useState<Record<string, string>>({});
  const [erroImpactos, setErroImpactos] = useState("");
  const [repetirImpactos, setRepetirImpactos] = useState(0);
  const [devolvendo, setDevolvendo] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState("");
  const [erroDecisao, setErroDecisao] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [versao, atualizar] = useState(0);
  const [aviso, setAviso] = useState("");
  const id = new URLSearchParams(window.location.search).get("envio");
  const idPendente = aberto && !aberto.revisadoEm ? aberto.id : undefined;

  useEffect(() => {
    if (!idPendente) return;
    const abort = new AbortController();
    setImpactos(undefined); setErroImpactos("");
    reqSanidade<Impacto[]>(`/tablet/envios/${idPendente}/previa?propriedadeId=${sitio}`, { signal: abort.signal }, sitio)
      .then(setImpactos).catch(e => { if (!abort.signal.aborted) setErroImpactos(msg(e)); });
    return () => abort.abort();
  }, [sitio, idPendente, repetirImpactos]);

  useEffect(() => {
    const abort = new AbortController();
    setErro("");
    const consultar = (registro?: string) => reqSanidade<Envio[]>(`/tablet/envios?propriedadeId=${sitio}${registro ? "&id=" + encodeURIComponent(registro) : ""}`, { signal: abort.signal }, sitio);
    consultar().then(setFila).catch(e => { if (!abort.signal.aborted) setErro(msg(e)); });
    if (id) consultar(id).then(([envio]) => {
      if (abort.signal.aborted) return;
      if (envio) abrir(envio);
      else setErro("Envio não encontrado neste sítio.");
    }).catch(e => { if (!abort.signal.aborted) setErro(msg(e)); });
    return () => abort.abort();
  }, [sitio, versao, id]);

  function abrir(envio: Envio) {
    setAberto(envio); setConferencia({}); setImpactos(undefined); setMotivosImpacto({}); setDevolvendo(false); setMotivo(""); setErroDecisao("");
  }
  function fechar() {
    setAberto(undefined);
    if (id) navegarPara(base + "/aprovacao");
  }
  const dados = (id: string): Conferencia => conferencia[id] ?? { partidaId: "", leite: "", carne: "", ciencia: false };
  const editar = (id: string, valores: Partial<Conferencia>) => setConferencia({ ...conferencia, [id]: { ...dados(id), ...valores } });
  async function decidir(e: React.FormEvent) {
    e.preventDefault();
    if (!aberto || ocupado) return;
    setOcupado(true); setErroDecisao("");
    const prazo = (v: string) => v === "" ? null : numeroDigitadoTablet(v);
    try {
      await postar(`/tablet/envios/${aberto.id}/revisao`, { propriedadeId: sitio, ...(devolvendo ? { motivo } : { conferencia: aberto.itens.map(i => {
        const c = dados(i.produtoId);
        return { produtoId: i.produtoId, partidaId: c.partidaId || null, cienciaValidadeDesconhecida: c.ciencia, carenciaLeiteHoras: prazo(c.leite), carenciaCarneHoras: prazo(c.carne) };
      }), impactos: impactos?.map(i => ({ animalId: i.animalId, confirmacao: { revisao: i.revisao, motivo: motivosImpacto[i.animalId] } })) }) }, sitio);
      setAviso(devolvendo ? "Envio devolvido para correção." : "Aplicações aprovadas e estoque baixado.");
      fechar(); atualizar(v => v + 1);
    } catch (e) {
      setErroDecisao(msg(e));
      if (e instanceof Error && e.message.includes("prévia")) setRepetirImpactos(v => v + 1);
    } finally { setOcupado(false); }
  }
  const situacao = (e: Envio) => e.devolucao ? "Devolvidos" : e.revisadoEm ? "Aprovados" : "Pendentes";
  return <>
    <h1>Aprovação de aplicações</h1><p className="tablet-secundario">{nomeSitio}</p>
    {aviso && <p role="status" className="tablet-aviso">{aviso}</p>}
    <section className="tablet-painel tablet-painel-fila">
      <div className="tablet-linha"><div className="tablet-seletor" role="group" aria-label="Situação do envio">
        {["Pendentes", "Aprovados", "Devolvidos"].map(v => <Button key={v} variant="ghost" aria-pressed={filtro === v} onClick={() => setFiltro(v)}>{v}</Button>)}
      </div><Button variant="outline" onClick={() => atualizar(v => v + 1)}>Atualizar</Button></div>
      {erro ? <p role="alert">{erro}</p> : !fila ? <p role="status">Carregando envios…</p> : <div className="tablet-tabela">
        <table><thead><tr><th>Vacas</th><th>Aplicação</th><th>Enviado por</th><th>Itens</th><th>Ordenha</th><th>Ação</th></tr></thead>
          <tbody>{fila.filter(e => situacao(e) === filtro).map(e => <tr key={e.id}>
            <td>{e.animais.map(nomeAnimal).join(" / ")}</td><td>{dataHora(e.aplicadaEm)}</td><td>{e.autorNome}</td><td>{e.itens.length}</td><td>{situacao(e) === "Aprovados" ? "Aplicações registradas" : "Aviso ativo"}</td><td><Button variant="outline" onClick={() => abrir(e)}>{e.revisadoEm ? "Detalhes" : "Conferir"}</Button></td>
          </tr>)}
          {!fila.some(e => situacao(e) === filtro) && <tr><td colSpan={6}>Nenhum envio nesta situação.</td></tr>}</tbody>
        </table>
      </div>}
    </section>
    <Dialog open={!!aberto} onOpenChange={v => { if (!v && !ocupado) fechar(); }}>
      <DialogContent className="tablet-dialogo">
        <DialogTitle>{aberto?.revisadoEm ? "Detalhes do envio" : "Conferir aplicações"}</DialogTitle>
        <DialogDescription>{aberto?.animais.map(nomeAnimal).join(" / ")}</DialogDescription>
        {aberto && <>
          <p>Aplicado em {dataHora(aberto.aplicadaEm)}<br />Enviado por {aberto.autorNome} em {dataHora(aberto.enviadoEm)}</p>
          <ListaItens itens={aberto.itens} />
          {aberto.revisadoEm ? <p>{aberto.devolucao ? "Devolvido" : "Aprovado"} por {aberto.revisorNome} em {dataHora(aberto.revisadoEm)}{aberto.devolucao && <><br />Motivo: {aberto.devolucao}</>}</p> :
            <form onSubmit={decidir} className="tablet-pilha">
              {erroDecisao && <p role="alert" className="tablet-aviso">{erroDecisao}</p>}
              <fieldset disabled={ocupado} className="tablet-pilha">
                {devolvendo ? <label>Motivo da devolução<textarea className={entrada} value={motivo} required minLength={5} maxLength={500} onChange={e => setMotivo(e.target.value)} /></label> :
                  !opcoes ? erroOpcoes ? <><p role="alert">{erroOpcoes}</p><Button type="button" onClick={repetir}>Tentar novamente</Button></> : <p>Carregando partidas…</p> :
                  aberto.itens.map(i => {
                    const c = dados(i.produtoId);
                    const produto = opcoes.catalogo.find(p => p.id === i.produtoId || p.produtoEstoqueId === i.produtoId);
                    const partidas = opcoes.partidas.filter(p => p.produtoId === (produto?.produtoEstoqueId ?? i.produtoId));
                    const validadeDesconhecida = c.partidaId && !partidas.find(p => p.id === c.partidaId)?.validade;
                    return <fieldset className="tablet-bloco tablet-pilha" key={i.produtoId}><legend>{i.nome}</legend>
                      {produto?.rastrearPartidas && <label>Partida<select className={entrada} required value={c.partidaId} onChange={e => editar(i.produtoId, { partidaId: e.target.value, ciencia: false })}><option value="">Selecione a partida</option>{partidas.map(p => <option key={p.id} value={p.id}>{p.codigo}{p.validade ? " · " + p.validade.slice(0, 10) : " · validade desconhecida"}</option>)}</select></label>}
                      {validadeDesconhecida && <label className="tablet-check"><input type="checkbox" required checked={c.ciencia} onChange={e => editar(i.produtoId, { ciencia: e.target.checked })} />Estou ciente de que a validade da partida é desconhecida</label>}
                      <div className="tablet-linha tablet-prazos">
                        <label>Carência de leite (h)<CampoNumericoTablet className={entrada} rotulo={`Carência de leite de ${i.nome} em horas`} inteiro min={0} max={2147483647} valor={c.leite} placeholder="Não informada" onChange={valor => editar(i.produtoId, { leite: valor })} /></label>
                        <label>Carência de carne (h)<CampoNumericoTablet className={entrada} rotulo={`Carência de carne de ${i.nome} em horas`} inteiro min={0} max={2147483647} valor={c.carne} placeholder="Não informada" onChange={valor => editar(i.produtoId, { carne: valor })} /></label>
                      </div>
                    </fieldset>;
                  })}
                {!devolvendo && <>
                  {erroImpactos ? <div role="alert">{erroImpactos} <Button type="button" variant="outline" onClick={() => setRepetirImpactos(v => v + 1)}>Recarregar impactos</Button></div> :
                    !impactos ? <p role="status">Conferindo impactos em protocolos…</p> : impactos.map(i => <fieldset className="tablet-bloco tablet-pilha" key={i.animalId}>
                      <legend>Impactos em protocolos de {aberto.animais.find(a => a.id === i.animalId)?.brinco}</legend>
                      <ul>{i.itens.map((item, index) => <li key={index}>{item.protocolo} · {{ AVISAR: "Avisar", BLOQUEAR: "Bloquear", RETIRAR: "Retirar" }[item.efeito]}</li>)}</ul>
                      <label>Motivo da confirmação<textarea className={entrada} required minLength={5} maxLength={1000} value={motivosImpacto[i.animalId] ?? ""} onChange={e => setMotivosImpacto({ ...motivosImpacto, [i.animalId]: e.target.value })} /></label>
                    </fieldset>)}
                </>}
                <div className="tablet-acoes">
                  <Button type="button" variant="outline" onClick={() => setDevolvendo(!devolvendo)}>{devolvendo ? "Voltar à conferência" : "Devolver para correção"}</Button>
                  <Button type="submit" disabled={!devolvendo && (!opcoes || !impactos)}>{devolvendo ? "Confirmar devolução" : "Aprovar aplicações"}</Button>
                </div>
              </fieldset>
            </form>}
        </>}
      </DialogContent>
    </Dialog>
  </>;
}

function Templates({ sitio, nomeSitio }: { sitio: number; nomeSitio: string }) {
  const { opcoes, setOpcoes, erro, repetir } = useOpcoes(sitio);
  const [doenca, setDoenca] = useState("");
  const [ids, setIds] = useState<string[]>([]);
  const [quantidades, setQuantidades] = useState<Record<string, string>>({});
  const [termo, setTermo] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState("");
  const [erroGravacao, setErroGravacao] = useState("");
  const corresponde = criarFiltroMedicamentos(termo);
  async function salvar(e: React.FormEvent) {
    e.preventDefault(); setOcupado(true); setAviso(""); setErroGravacao("");
    try {
      const template = await postar<Opcoes["templates"][number]>("/tablet/templates", { propriedadeId: sitio, doencaId: doenca, produtoIds: ids, quantidades: Object.fromEntries(ids.filter(id => quantidades[id]?.trim()).map(id => [id, { quantidade: numeroDigitadoTablet(quantidades[id]), unidade: opcoes!.catalogo.find(p => p.id === id)!.unidade }])) }, sitio);
      setOpcoes(atual => atual && ({ ...atual, templates: [...atual.templates.filter(t => t.doencaId !== doenca), template] }));
      setAviso(ids.length ? "Template salvo." : "Template removido.");
    } catch (e) { setErroGravacao(msg(e)); } finally { setOcupado(false); }
  }
  return <><h1>Templates por doença</h1><p className="tablet-secundario">{nomeSitio}</p><section className="tablet-painel">
    {erro ? <><p role="alert">{erro}</p><Button onClick={repetir}>Tentar novamente</Button></> : !opcoes ? <p role="status">Carregando templates…</p> :
      <form onSubmit={salvar} className="tablet-pilha">
        <fieldset disabled={ocupado} className="tablet-pilha">
          <label>Doença<select className={entrada} required value={doenca} onChange={e => {
            setDoenca(e.target.value); setIds(opcoes.templates.find(t => t.doencaId === e.target.value)?.produtoIds ?? []); setQuantidades(Object.fromEntries(Object.entries(opcoes.templates.find(t => t.doencaId === e.target.value)?.quantidades ?? {}).map(([id, q]) => [id, String(q.quantidade).replace(".", ",")]))); setTermo(""); setAviso(""); setErroGravacao("");
          }}><option value="">Selecione a doença</option>{opcoes.doencas.map(d => <option key={d.id} value={d.id}>{d.nome}</option>)}</select></label>
          {doenca && <>
            <label>Buscar medicamento<input type="search" inputMode="search" autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false} enterKeyHint="search" className={entrada} value={termo} onChange={e => setTermo(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); } }} /></label>
            {opcoes.catalogo.filter(p => ids.includes(p.id) || termo.trim() && corresponde(p.nome)).map(p =>
              <div key={p.id} className="tablet-linha">
                <label className="tablet-check"><input type="checkbox" checked={ids.includes(p.id)} onChange={e => setIds(e.target.checked ? [...ids, p.id] : ids.filter(id => id !== p.id))} />{p.nome}</label>
                {ids.includes(p.id) && <label className="tablet-medicamento-quantidade">Qtd. ({rotuloUnidade(p.unidade)})<CampoNumericoTablet className={entrada} rotulo={`Quantidade padrão de ${p.nome}`} inteiro={["UN", "CX", "SC"].includes(p.unidade)} valor={quantidades[p.id] ?? ""} placeholder="—" onChange={valor => setQuantidades(atual => ({ ...atual, [p.id]: valor }))} /></label>}
              </div>)}
            <Button type="submit">{ids.length ? "Salvar template" : "Remover template"}</Button>
          </>}
        </fieldset>
      </form>}
    {aviso && <p role="status">{aviso}</p>}{erroGravacao && <p role="alert">{erroGravacao}</p>}
  </section></>;
}

function InformacoesMedicamento({ produto, sitio, fechar }: { produto: Produto | null; sitio: number; fechar: () => void }) {
 const [dados, setDados] = useState<DadosMedicamento>();
 const [erro, setErro] = useState("");
 useEffect(() => {
  setDados(undefined); setErro("");
  if (!produto) return;
  const abort = new AbortController();
  reqSanidade<DadosMedicamento>(`/tablet/medicamentos/${produto.id}?propriedadeId=${sitio}`, { signal: abort.signal }, sitio)
   .then(setDados).catch(e => { if (!abort.signal.aborted) setErro(msg(e)); });
  return () => abort.abort();
 }, [produto, sitio]);
 return <Dialog open={!!produto} onOpenChange={aberto => { if (!aberto) fechar(); }}>
  <DialogContent className="tablet-dialogo tablet-dialogo-medicamento" aria-describedby={undefined}>
   <DialogHeader><DialogTitle>{produto?.nome}</DialogTitle>
    </DialogHeader>
   {erro ? <p role="alert">{erro}</p> : !dados ? <p role="status">Carregando medicamento…</p> : <div className="tablet-pilha">
    <dl className="tablet-medicamento-dados">{[
     ["Apresentação", dados.apresentacao], ["Unidade do estoque", rotuloUnidade(dados.unidade)],
     ["Fabricante", dados.fabricante], ["Classificação", dados.classificacao], ["Princípios ativos", dados.principiosAtivos.join(", ")],
     ["Conservação", dados.conservacao], ["Orientação cadastrada na fazenda", dados.orientacaoUso],
     ["Via cadastrada", dados.viaPadrao], ["Referência técnica da fazenda", dados.referenciaTecnica],
     ["Carência de leite cadastrada", dados.carenciaLeiteHoras == null ? null : dados.carenciaLeiteHoras + " h"],
     ["Carência de carne cadastrada", dados.carenciaCarneHoras == null ? null : dados.carenciaCarneHoras + " h"],
    ].filter(([,valor]) => valor).map(([rotulo,valor]) => <div className="tablet-item" key={rotulo}><dt>{rotulo}</dt><dd>{valor}</dd></div>)}</dl>
    {dados.bula ? <ConteudoReferenciaMedicamento referencia={dados.bula} /> : <PendenciasMedicamento pendencias={dados.conferenciaBula?.pendencias ?? [{ campo: "pesquisa", motivo: "A referência oficial desta apresentação ainda não foi conferida; dose, via e carências permanecem pendentes." }]} fontes={dados.conferenciaBula?.fontesParaConferencia} />}
   </div>}
  </DialogContent>
 </Dialog>;
}

