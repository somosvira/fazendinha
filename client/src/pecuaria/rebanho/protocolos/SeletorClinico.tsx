import { useEffect, useId, useRef, useState } from "react";
import { ErrorBox } from "../../../financeiro/financeiro-ui";
import { Button } from "../../../components/ui/button";
import { classeInput } from "../../../financeiro/PainelCadastro";
import { Paginacao } from "../ui";
import { obterOpcoesClinicas, type EscolhaClinica, type OpcaoClinica, type PaginaClinica } from "./clinica-api";
export function SeletorClinico({ tarefaId, propriedadeId, opcao, rotulo, valor, materialId, tipoTentativa, externo, onChange, onHidratar }: {
  tarefaId: string; propriedadeId: number; opcao: OpcaoClinica; rotulo: string; valor: string; materialId?: string; tipoTentativa?: "IA" | "TE"; externo?: boolean;
  onChange: (valor: string, opcao?: EscolhaClinica) => void;
  onHidratar?: (opcao: EscolhaClinica) => void;
}) {
  const id = useId();
  const [aberto, setAberto] = useState(false), [pagina, setPagina] = useState(1), [busca, setBusca] = useState("");
  const [dados, setDados] = useState<PaginaClinica<EscolhaClinica> | null>(null);
  const [selecionada, setSelecionada] = useState<EscolhaClinica | null>(null);
  const [erro, setErro] = useState<string | null>(null), [carregando, setCarregando] = useState(false), [revisao, setRevisao] = useState(0);
  const hidratarRef = useRef(onHidratar); hidratarRef.current = onHidratar;
  useEffect(() => {
    if (!aberto && !valor) return;
    let vivo = true; setCarregando(true); setErro(null); setDados(null);
    obterOpcoesClinicas(tarefaId, propriedadeId, opcao, pagina, busca, !aberto ? valor : undefined, materialId, tipoTentativa, externo).then(p => {
      if (!vivo) return; setDados(p);
      const escolha = p.itens.find(i => i.id === valor);
      if (escolha) { setSelecionada(escolha); hidratarRef.current?.(escolha); }
    }).catch(e => { if (vivo) setErro(e instanceof Error ? e.message : String(e)); }).finally(() => { if (vivo) setCarregando(false); });
    return () => { vivo = false; };
  }, [aberto, tarefaId, propriedadeId, opcao, pagina, busca, materialId, tipoTentativa, externo, valor, revisao]);
  return <div className="grid gap-2"><div className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm font-medium">{rotulo}: {valor ? selecionada?.id === valor ? selecionada.nome : "Referência planejada" : "Não selecionado"}</span><Button variant="outline" type="button" aria-label={`Selecionar ${rotulo}`} aria-expanded={aberto} onClick={() => setAberto(!aberto)}>{aberto ? "Fechar seleção" : "Selecionar"}</Button>{valor && <Button variant="outline" type="button" aria-label={`Limpar ${rotulo}`} onClick={() => { setSelecionada(null); onChange(""); }}>Limpar</Button>}</div><ErrorBox erro={erro} />{erro && <Button variant="outline" type="button" onClick={() => setRevisao(v => v + 1)}>Tentar carregar {rotulo} novamente</Button>}{carregando && <p role="status">Carregando {rotulo}…</p>}{aberto && <><label>Buscar {rotulo}<input type="search" className={classeInput} value={busca} onChange={e => { setBusca(e.target.value); setPagina(1); }} /></label>{dados && !dados.itens.length && <p className="text-sm">Nenhuma opção disponível para esta tarefa e sítio.</p>}<ul className="divide-y divide-border">{dados?.itens.map(i => <li key={i.id} className="flex items-center justify-between gap-3 py-2"><span>{i.nome}{i.versaoFormato ? ` · v${i.versaoFormato}` : ""}{i.data ? ` · ${i.data.slice(0, 10)}` : ""}{i.validade ? ` · validade ${i.validade.slice(0, 10)}` : ""}</span><Button variant="outline" type="button" aria-label={`Usar ${i.nome}`} onClick={() => { setSelecionada(i); onChange(i.id, i); setAberto(false); }}>Usar</Button></li>)}</ul>{dados && dados.total > 10 && <Paginacao paginaAtual={dados.pagina} totalPaginas={Math.ceil(dados.total / 10)} totalItens={dados.total} itensPorPagina={10} onPaginaChange={setPagina} rotulo={rotulo} idSelect={id} />}</>}</div>;
}
