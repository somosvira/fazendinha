import { SecaoRecolhivel } from "../components/SecaoRecolhivel";
import { Check, Clock3, X, Minus, ChevronDown } from "lucide-react";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../../../components/ui/table";
import { Dica, AjudaCampo } from "../../../components/Dica";
import { PainelCadastro } from "../../../financeiro/PainelCadastro";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "../../../components/ui/dropdown-menu";
import { ContextoTentativaParticipacao, type ContextoTentativaParticipacaoDTO } from "../protocolos/ContextoTentativaParticipacao";
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { ErrorBox } from "../../../financeiro/financeiro-ui";
import { Paginacao } from "../ui";
import { consultaProtocolo, obterTarefasProtocolo, obterEtapasProtocolo, reqProtocolo, type EtapaProtocolo, type TarefaOperacional } from "../protocolos/api";
import type { PaginaProtocolo } from "../protocolos/EtapasProtocolo";
import type { ParticipanteIatf, TarefaIatf } from "./Iatf";
import { horarioIatf } from "./CampoDataIatf";
import { LinkReproducao } from "./ConsultaReproducaoUI";
import { ProtocoloTimeline } from "./ProtocoloTimeline";
import { Empty } from "@/financeiro/financeiro-ui";

type Participacao = Omit<ParticipanteIatf, "tarefas"> & { contextoTentativa?: ContextoTentativaParticipacaoDTO };
/** Consulta individual explícita: nenhuma data coletiva substitui a participação. */
export function ParticipacoesProgramacao({ id, propriedadeId, revisao, aoRetirar, acoes }: { id: string; propriedadeId?: number; revisao: number; aoRetirar?: (id: string) => void; acoes?: ReactNode }) {
  const [etapas, setEtapas] = useState<EtapaProtocolo[]>([]);
  const [tarefas, setTarefas] = useState<Record<string,TarefaOperacional[]>>({});
  const [pagina, setPagina] = useState(1);
  const [busca, setBusca] = useState("");
  const [dados, setDados] = useState<PaginaProtocolo<Participacao> | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);
  const [aberta, setAberta] = useState<string | null>(null);
  useEffect(() => {
    let vigente = true; setDados(null); setErro(null); setAberta(null);
    reqProtocolo<PaginaProtocolo<Participacao>>(`/programacoes/${encodeURIComponent(id)}/participantes${consultaProtocolo({ pagina, busca })}`, propriedadeId)
      .then(async d => {
        const primeira = await obterEtapasProtocolo({programacaoId:id}, 1, propriedadeId);
        const todas = [...primeira.itens];
        for (let pagina = 2; vigente && pagina <= Math.ceil(primeira.total / primeira.porPagina); pagina++) todas.push(...(await obterEtapasProtocolo({programacaoId:id}, pagina, propriedadeId)).itens);
        const linhas = await Promise.all(d.itens.map(async p => {
          const primeira = await obterTarefasProtocolo({participacaoId:p.id}, {pagina:1}, propriedadeId);
          const itens = [...primeira.itens];
          for(let pagina=2; vigente && pagina<=Math.ceil(primeira.total/primeira.porPagina); pagina++) itens.push(...(await obterTarefasProtocolo({participacaoId:p.id},{pagina},propriedadeId)).itens);
          return [p.id,itens] as const;
        }));
        if(vigente){setEtapas(todas);setTarefas(Object.fromEntries(linhas));setDados(d);}
      }).catch(e => { if (vigente) setErro(e instanceof Error ? e.message : "Não foi possível consultar as participações."); });
    return () => { vigente = false; };
  }, [id, propriedadeId, pagina, busca, revisao, tentativa]);
  return <SecaoRecolhivel recolhivel={false} className="ficha-geral-secao protocolo-etapa-ficha repro-participacoes" titulo={<span className="inline-flex items-center gap-2">Participantes <AjudaCampo rotulo="Legenda das etapas" texto="Check: atendido. Relógio: pendente, inclusive agendado. X: não atendido, dispensado ou retirado. Passe o mouse ou foque o ícone para ver o detalhe."/></span>} acoes={acoes}>
    <Input aria-label="Buscar animal nas participações" placeholder="Buscar animal nas participações" value={busca} onChange={e => { setBusca(e.target.value); setPagina(1); }}/>
    <ErrorBox erro={erro}/>{erro ? <Button variant="outline" onClick={() => setTentativa(v => v + 1)}>Atualizar participações individuais</Button> : !dados ? <p role="status">Consultando participações individuais…</p> : <>
      <div className="protocolo-tabela mt-4"><Table containerLabel="Participantes por etapa" aria-label="Participantes por etapa"><TableHeader><TableRow><TableHead>Animal</TableHead>{etapas.map(e=><TableHead key={e.id}>{e.unidadeIntervalo === "HORAS" ? "H" : "D"}{e.diaRelativo} · {e.nome}</TableHead>)}<TableHead>Ações</TableHead></TableRow></TableHeader><TableBody>
      {dados.itens.map(p=><TableRow key={p.id}><TableCell><LinkReproducao sitio={propriedadeId} href={`/pecuaria/rebanho/animais/${encodeURIComponent(p.animalId)}?participacaoId=${encodeURIComponent(p.id)}&programacaoId=${encodeURIComponent(id)}&retorno=${encodeURIComponent(window.location.pathname + window.location.search + window.location.hash)}#reproducao`}>{p.animal?.brinco ?? "Animal"}{p.animal?.nome ? ` · ${p.animal.nome}` : ""}</LinkReproducao></TableCell>{etapas.map(e=>{
        const t=tarefas[p.id]?.find(t=>t.etapaId===e.id);
        const feito=t?.situacao === "ATENDIDO";
        const ausente=!!t && ["NAO_ATENDIDO","RETIRADO","DISPENSADO","ENCERRADO"].includes(t.situacao);
        const rotulos:Record<string,string>={ATENDIDO:"Atendido",NAO_ATENDIDO:"Não atendido",RETIRADO:"Retirado do protocolo",DISPENSADO:"Dispensado",ENCERRADO:"Encerrado sem substituição",PREVISTO:"Pendente · agendado",SEM_REGISTRO:"Sem atendimento registrado",ADIADO:"Pendente · adiado",REGULARIZACAO_PENDENTE:"Pendente · regularização"};
        const rotulo=t ? rotulos[t.situacao] ?? "Pendente" : "Sem tarefa vinculada";
        const Icone=feito ? Check : ausente ? X : t ? Clock3 : Minus;
        return <TableCell key={e.id}><Dica rotulo={`${e.nome}: ${rotulo}`} conteudo={<>{rotulo}{t?.ultimoEvento?.motivo && <p>{t.ultimoEvento.motivo}</p>}</>}><Icone size={18} className={feito ? "text-emerald-700" : ausente ? "text-red-600" : "text-ink-3"}/></Dica></TableCell>;
      })}<TableCell><DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" aria-label={`Ações de ${p.animal?.brinco}`}>Ações<ChevronDown size={14}/></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onSelect={()=>setAberta(p.id)}>Detalhes da participação</DropdownMenuItem>{aoRetirar && !p.encerradoEm && <DropdownMenuItem className="text-destructive" onSelect={()=>aoRetirar(p.id)}>Retirar do protocolo</DropdownMenuItem>}</DropdownMenuContent></DropdownMenu></TableCell></TableRow>)}
      </TableBody></Table></div>
      {dados.itens.filter(p=>p.id===aberta).map(p=><PainelCadastro key={p.id} aberto titulo={`Participação · ${p.animal?.brinco}`} onFechar={()=>setAberta(null)} rodape={<Button variant="outline" onClick={()=>setAberta(null)}>Fechar</Button>}><p>Início efetivo: {p.inicioEfetivo ? horarioIatf(p.inicioEfetivo,p.precisaoInicioEfetivo ?? p.precisaoTemporal).replace(" · horário não informado","") : "Não confirmado"}</p><ContextoTentativaParticipacao contexto={p.contextoTentativa}/>{p.motivoEncerramento && <p>{p.motivoEncerramento}</p>}<EtapasParticipacao participante={p} propriedadeId={propriedadeId}/></PainelCadastro>)}
      {!dados.total && <Empty>Nenhuma participação corresponde à busca.</Empty>}
      {dados.total > dados.porPagina && <Paginacao paginaAtual={dados.pagina} totalPaginas={Math.max(1, Math.ceil(dados.total / dados.porPagina))} totalItens={dados.total} itensPorPagina={dados.porPagina} onPaginaChange={setPagina} rotulo="participações" idSelect="participacoes-individuais-programacao"/>}
    </>}
  </SecaoRecolhivel>;
}
function EtapasParticipacao({ participante, propriedadeId }: { participante: Participacao; propriedadeId?: number }) {
  const [tarefas, setTarefas] = useState<TarefaIatf[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [revisao, setRevisao] = useState(0);
  useEffect(() => {
    let vigente = true; setTarefas(null); setErro(null);
    async function carregar() {
      const contexto = { participacaoId: participante.id };
      const primeira = await obterTarefasProtocolo(contexto, { pagina: 1 }, propriedadeId);
      const itens = [...primeira.itens];
      for (let pagina = 2; vigente && pagina <= Math.ceil(primeira.total / primeira.porPagina); pagina++) itens.push(...(await obterTarefasProtocolo(contexto, { pagina }, propriedadeId)).itens);
      if (vigente) setTarefas(itens.map((t, i) => ({ ...t.tarefaOrigem, situacaoOperacional: t.situacao, motivoOperacional: t.ultimoEvento?.motivo, etapa: i, previstaEm: t.previstaPara ?? "", previsaoPendente: t.previsaoPendente || !t.previstaPara, precisaoTemporal: t.precisaoTemporal, realizadaEm: t.realizadaEm, precisaoRealizacao: t.precisaoRealizacao })));
    }
    void carregar().catch(e => { if (vigente) setErro(e instanceof Error ? e.message : "Não foi possível consultar as etapas individuais."); });
    return () => { vigente = false; };
  }, [participante.id, propriedadeId, revisao]);
  return <div className="repro-participacao-etapas"><ErrorBox erro={erro}/>{erro ? <Button variant="outline" onClick={() => setRevisao(v => v + 1)}>Atualizar etapas individuais</Button> : tarefas ? <ProtocoloTimeline participante={{ ...participante, tarefas }}/> : <p role="status">Consultando etapas individuais…</p>}</div>;
}
