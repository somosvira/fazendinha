import { useEffect, useId, useState } from "react";
import { MensagemAvisoAptidao } from "./MensagemAvisoAptidao";
import { horarioIatf } from "./CampoDataIatf";
import { ConfirmacaoCiencia } from "../../../components/ConfirmacaoCiencia";
import { Button, TabelaFinanceira } from "../../../financeiro/financeiro-ui";
import { Paginacao } from "../ui";

type Animal = { id: string; brinco: string; nome: string | null; loteNome?: string | null; aviso?: string | null };
export type AvisoProgramacao = { animalId: string; mensagem: string; descricao: string; motivos: string[] };

export function TabelaParticipantesProgramacao({ animais, selecionados, onAlterar, compactaAviso = false }: { animais: Animal[]; selecionados?: string[]; onAlterar?: (id: string) => void; compactaAviso?: boolean }) {
  const [pagina, setPagina] = useState(1);
  const idPaginacao = useId();
  const totalPaginas = Math.max(1, Math.ceil(animais.length / 10));
  const paginaAtual = Math.min(pagina, totalPaginas);
  return <><TabelaFinanceira visualizacao="tabela" compacta rotulo="Participantes" itens={animais.slice((paginaAtual - 1) * 10, paginaAtual * 10)} chaveDe={a => a.id} colunas={[
    { chave: "brinco", titulo: "Brinco", principal: true, celula: a => a.brinco },
    { chave: "nome", titulo: "Nome", celula: a => a.nome ?? "Sem nome" },
    ...(!compactaAviso ? [{ chave: "lote", titulo: "Lote", celula: (a: Animal) => a.loteNome ?? "Não informado" },
    { chave: "aviso", titulo: "Aviso", celula: (a: Animal) => a.aviso ? <MensagemAvisoAptidao mensagem={a.aviso}/> : "—" }] : []),
    ...(onAlterar ? [{ chave: "acao", titulo: "Seleção", acoes: true, celula: (a: Animal) => <Button type="button" secondary onClick={() => onAlterar(a.id)}>{selecionados?.includes(a.id) ? "Retirar" : "Desfazer retirada"}</Button> }] : []),
  ]}/>{animais.length > 10 && <Paginacao paginaAtual={paginaAtual} totalPaginas={totalPaginas} totalItens={animais.length} itensPorPagina={10} onPaginaChange={setPagina} rotulo="participantes" idSelect={idPaginacao} />}</>;
}

export function AvisosProgramacao({ avisos, animais, onCiencia }: { avisos: AvisoProgramacao[]; animais: Animal[]; onCiencia: (aceitos: AvisoProgramacao[]) => void }) {
  const [aceitos, setAceitos] = useState<string[]>([]);
  const grupos = new Map<string, { motivo: string; avisos: AvisoProgramacao[] }>();
  for (const aviso of avisos) {
    const motivo = aviso.descricao;
    const chave = JSON.stringify([aviso.motivos, motivo]);
    const grupo = grupos.get(chave) ?? { motivo, avisos: [] };
    grupo.avisos.push(aviso); grupos.set(chave, grupo);
  }
  const identidade = JSON.stringify(avisos);
  useEffect(() => { setAceitos([]); onCiencia([]); }, [identidade, onCiencia]);
  if (!avisos.length) return null;
  return <section className="programacao-bloco" aria-label="Avisos"><h3>Avisos</h3>{[...grupos].map(([chave, grupo], indice) => {
    const afetados = grupo.avisos.map(a => animais.find(x => x.id === a.animalId)).filter((a): a is Animal => !!a);
    return <div className="grid gap-3 border-t py-4" key={chave}><p><strong>Ciência necessária · {grupo.avisos.length} {grupo.avisos.length === 1 ? "animal" : "animais"}</strong></p><p><MensagemAvisoAptidao mensagem={grupo.motivo}/></p>
      <TabelaParticipantesProgramacao animais={afetados} compactaAviso/>
      <ConfirmacaoCiencia id={`ciencia-aviso-${indice}`} checked={aceitos.includes(chave)} onChange={valor => {
        const proximos = valor ? [...aceitos, chave] : aceitos.filter(c => c !== chave);
        setAceitos(proximos); onCiencia([...grupos].filter(([id]) => proximos.includes(id)).flatMap(([, g]) => g.avisos));
      }}>Estou ciente do aviso para {grupo.avisos.length} {grupo.avisos.length === 1 ? "animal" : "animais"}.</ConfirmacaoCiencia></div>;
  })}</section>;
}

export type ProcedimentoPrevisto = { id: string; nome: string; previstaPara: string | null; precisaoTemporal: "DIA" | "HORA" };
export type GrupoPrevisto = { id: string; nome: string; legado: boolean; procedimentos: ProcedimentoPrevisto[] };
export function CalendarioProgramacao({ grupos, modo }: { grupos: GrupoPrevisto[]; modo: (id: string) => string }) {
  const [id, setId] = useState("");
  const grupo = grupos.find(g => g.id === id) ?? grupos[0];
  return <><div className="flex flex-wrap gap-2" role="group" aria-label="Etapas previstas">{grupos.map(g => <Button type="button" key={g.id} secondary={g.id !== grupo?.id} aria-pressed={g.id === grupo?.id} onClick={() => setId(g.id)}>{g.nome}{g.legado ? " · sem agrupamento" : ""}</Button>)}</div>
    {grupo && <ul className="programacao-calendario">{grupo.procedimentos.map(p => <li key={p.id}><strong>{p.nome}</strong><span>{p.previstaPara ? horarioIatf(p.previstaPara, p.precisaoTemporal).replace(" · horário não informado", "") : "Data a definir"}</span><span>{modo(p.id)}</span></li>)}</ul>}</>;
}
export type ConsumoPrevisto = { itens: { produtoId: string; produto: string; unidade: string; quantidade: string; saldo: string | null; falta: string | null }[]; pendentes: string[] };
export function ConsumoProgramacao({ consumo }: { consumo: ConsumoPrevisto }) {
  return <section className="programacao-bloco"><h3>Consumo previsto</h3><p>Consulta para planejamento; não reserva nem baixa estoque.</p>
    {consumo.itens.length ? <TabelaFinanceira compacta visualizacao="tabela" rotulo="Consumo previsto" itens={consumo.itens} chaveDe={i => i.produtoId} colunas={[
      {chave:"produto",titulo:"Produto",principal:true,celula:i=>i.produto},
      {chave:"quantidade",titulo:"Previsto",celula:i=>`${i.quantidade} ${i.unidade}`},
      {chave:"saldo",titulo:"Saldo físico no sítio",celula:i=>i.saldo == null ? "Indisponível" : `${i.saldo} ${i.unidade}`},
      {chave:"falta",titulo:"Falta",celula:i=>i.falta == null ? "Não calculada" : `${i.falta} ${i.unidade}`},
    ]}/> : <p>Nenhum insumo definido para consumo previsto.</p>}
    {!!consumo.pendentes.length && <><p>Produtos ou quantidades a definir:</p><ul>{consumo.pendentes.map((p,i)=><li key={`${p}-${i}`}>{p}</li>)}</ul></>}
  </section>;
}

export function ImpedimentosProgramacao({ itens, animais }: { itens: { animalId: string; descricao: string; codigo: string }[]; animais: Animal[] }) {
  const grupos = new Map<string, typeof itens>();
  for (const item of itens) { const chave = JSON.stringify([item.codigo, item.descricao]); grupos.set(chave, [...(grupos.get(chave) ?? []), item]); }
  if (!itens.length) return null;
  return <section className="programacao-bloco" aria-label="Impedimentos"><h3>Impedimentos</h3>{[...grupos].map(([chave, grupo]) => <div key={chave} className="grid gap-3 border-t py-4"><p><strong>Impedimento · {grupo.length} {grupo.length === 1 ? "animal" : "animais"}</strong></p><p>{grupo[0].descricao}</p><TabelaParticipantesProgramacao compactaAviso animais={grupo.map(i => animais.find(a => a.id === i.animalId)).filter((a): a is Animal => !!a)}/></div>)}</section>;
}
