import { useId, useState } from "react";
import { MensagemAvisoAptidao } from "./MensagemAvisoAptidao";
import { horarioIatf } from "./CampoDataIatf";
import { AjudaCampo } from "../../../components/Dica";
import { ConfirmacaoCiencia } from "../../../components/ConfirmacaoCiencia";
import { Button, TabelaFinanceira } from "../../../financeiro/financeiro-ui";
import { Paginacao } from "../ui";

export type AnimalProgramacao = { id: string; brinco: string; nome: string | null; loteNome?: string | null; aviso?: string | null; situacao?: string | null; situacaoProdutiva?: string | null; del?: number | null; ultimoParto?: string | null; partos?: number | null; tentativasCiclo?: number | null; aptidao?: string | null };
type Animal = AnimalProgramacao;
export type AvisoProgramacao = { animalId: string; mensagem: string; descricao: string; motivos: string[] };

export function TabelaParticipantesProgramacao({ animais, selecionados, onAlterar, compactaAviso = false, contexto = false, marcados, onMarcar }: { animais: Animal[]; selecionados?: string[]; onAlterar?: (id: string) => void; compactaAviso?: boolean; contexto?: boolean; marcados?: string[]; onMarcar?: (ids: string[]) => void }) {
  const [pagina, setPagina] = useState(1);
  const idPaginacao = useId();
  const totalPaginas = Math.max(1, Math.ceil(animais.length / 10));
  const paginaAtual = Math.min(pagina, totalPaginas);
  return <><TabelaFinanceira compacta rotulo="Participantes" itens={animais.slice((paginaAtual - 1) * 10, paginaAtual * 10)} chaveDe={a => a.id} colunas={[
    ...(onMarcar ? [{ chave: "marcar", titulo: "Marcar", cabecalho: <input type="checkbox" aria-label="Marcar página" checked={animais.slice((paginaAtual - 1) * 10, paginaAtual * 10).length > 0 && animais.slice((paginaAtual - 1) * 10, paginaAtual * 10).every(a => marcados?.includes(a.id))} onChange={e => { const ids = animais.slice((paginaAtual - 1) * 10, paginaAtual * 10).map(a => a.id); onMarcar(e.target.checked ? [...new Set([...(marcados ?? []), ...ids])] : (marcados ?? []).filter(id => !ids.includes(id))); }}/>, celula: (a: Animal) => <input type="checkbox" aria-label={`Marcar ${a.brinco}`} checked={marcados?.includes(a.id) ?? false} onChange={e => onMarcar(e.target.checked ? [...(marcados ?? []), a.id] : (marcados ?? []).filter(id => id !== a.id))}/> }] : []),
    { chave: "brinco", titulo: "Brinco", principal: true, celula: a => a.brinco },
    { chave: "nome", titulo: "Nome", celula: a => a.nome ?? "Sem nome" },
    ...(!compactaAviso ? [{ chave: "lote", titulo: "Lote", celula: (a: Animal) => a.loteNome ?? "Não informado" },
    ...(!contexto ? [{ chave: "aviso", titulo: "Aviso", celula: (a: Animal) => a.aviso ? <MensagemAvisoAptidao mensagem={a.aviso}/> : "—" }] : [])] : []),
    ...(contexto ? [
      { chave: "situacao", titulo: "Situação reprodutiva", celula: (a: Animal) => ({ VAZIA: "Vazia", GESTANTE: "Gestante", DESCONHECIDA: "Desconhecida", AGUARDANDO_DIAGNOSTICO: "Aguardando diagnóstico" } as Record<string, string>)[a.situacao ?? ""] ?? a.situacao ?? "—" },
      { chave: "aptidao", titulo: "Aptidão", celula: (a: Animal) => ({ APTA: "Apta", NAO_APTA: "Não apta", PENDENTE: "Pendente" } as Record<string, string>)[a.aptidao ?? ""] ?? a.aptidao ?? "—" },
      { chave: "del", titulo: "DEL", celula: (a: Animal) => a.situacaoProdutiva === "SECA" ? "Seca" : a.del ?? "—" },
      { chave: "ultimoParto", titulo: "Último parto", celula: (a: Animal) => a.ultimoParto?.split("-").reverse().join("/") ?? "—" },
      { chave: "partos", titulo: "Partos", celula: (a: Animal) => a.partos ?? "—" },
      { chave: "tentativas", titulo: "Tentativas no ciclo", celula: (a: Animal) => a.tentativasCiclo ?? "—" },
    ] : []),
    ...(onAlterar ? [{ chave: "acao", titulo: "Seleção", acoes: true, celula: (a: Animal) => <Button type="button" secondary onClick={() => onAlterar(a.id)}>{selecionados?.includes(a.id) ? "Retirar" : "Desfazer retirada"}</Button> }] : []),
  ]}/>{animais.length > 10 && <Paginacao paginaAtual={paginaAtual} totalPaginas={totalPaginas} totalItens={animais.length} itensPorPagina={10} onPaginaChange={setPagina} rotulo="participantes" idSelect={idPaginacao} />}</>;
}

export function AvisosProgramacao({ avisos, animais, aceitos, onCiencia }: { avisos: AvisoProgramacao[]; animais: Animal[]; aceitos: AvisoProgramacao[]; onCiencia: (aceitos: AvisoProgramacao[]) => void }) {
  const grupos = new Map<string, { motivo: string; avisos: AvisoProgramacao[] }>();
  for (const aviso of avisos) {
    const motivo = aviso.descricao;
    const chave = JSON.stringify([aviso.motivos, motivo]);
    const grupo = grupos.get(chave) ?? { motivo, avisos: [] };
    grupo.avisos.push(aviso); grupos.set(chave, grupo);
  }
  if (!avisos.length) return null;
  return <section className="programacao-bloco" aria-label="Avisos"><h3>Avisos</h3>{[...grupos].map(([chave, grupo], indice) => {
    const afetados = grupo.avisos.map(a => animais.find(x => x.id === a.animalId)).filter((a): a is Animal => !!a);
    return <div className="grid gap-3 border-t py-4" key={chave}><p><strong>Ciência necessária · {grupo.avisos.length} {grupo.avisos.length === 1 ? "animal" : "animais"}</strong></p><p><MensagemAvisoAptidao mensagem={grupo.motivo}/></p>
      <TabelaParticipantesProgramacao animais={afetados} compactaAviso/>
      <ConfirmacaoCiencia id={`ciencia-aviso-${indice}`} checked={grupo.avisos.every(aviso => aceitos.some(a => JSON.stringify(a) === JSON.stringify(aviso)))} onChange={valor => {
        const outros = aceitos.filter(a => !grupo.avisos.some(aviso => aviso.animalId === a.animalId && JSON.stringify(aviso.motivos) === JSON.stringify(a.motivos) && aviso.descricao === a.descricao));
        onCiencia(valor ? [...outros, ...grupo.avisos] : outros);
      }}>Estou ciente do aviso para {grupo.avisos.length} {grupo.avisos.length === 1 ? "animal" : "animais"}.</ConfirmacaoCiencia></div>;
  })}</section>;
}

export type ProcedimentoPrevisto = { id: string; nome: string; previstaPara: string | null; precisaoTemporal: "DIA" | "HORA" };
export type GrupoPrevisto = { id: string; nome: string; legado: boolean; procedimentos: ProcedimentoPrevisto[] };
export function CalendarioProgramacao({ grupos, modo }: { grupos: GrupoPrevisto[]; modo: (id: string) => import("react").ReactNode }) {
  return <div>{grupos.map(grupo => <section key={grupo.id}><h4><strong>{grupo.nome}{grupo.legado ? " · sem agrupamento" : ""}</strong></h4><ul className="programacao-calendario">{grupo.procedimentos.map(p => <li key={p.id}><strong>{p.nome}</strong><span>{p.previstaPara ? horarioIatf(p.previstaPara, p.precisaoTemporal).replace(" · horário não informado", "") : "Data a definir"}</span><span>{modo(p.id)}</span></li>)}</ul></section>)}</div>;
}
export type ConsumoPrevisto = { itens: { produtoId: string; produto: string; unidade: string; quantidade: string; saldo: string | null; falta: string | null }[]; pendentes: string[] };
export function ConsumoProgramacao({ consumo, total }: { consumo: ConsumoPrevisto; total?: number }) {
  return <section className="programacao-bloco"><h3>Consumo previsto <AjudaCampo rotulo="Como o consumo é calculado" texto="A quantidade por animal da versão é multiplicada pelo total de participantes. A consulta não reserva nem movimenta estoque."/></h3><div className="programacao-base-consumo"><strong>{total ?? "—"} {total === 1 ? "animal" : "animais"}</strong><span>Base do cálculo · saldo físico do sítio</span></div>
    {consumo.itens.length ? <TabelaFinanceira compacta rotulo="Consumo previsto" itens={consumo.itens} chaveDe={i => i.produtoId} colunas={[
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
