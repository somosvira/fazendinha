import { useEffect, useState } from "react";
import { Button, ErrorBox } from "../../../financeiro/financeiro-ui";
import { classeInput } from "../../../financeiro/PainelCadastro";
import { dataHoraISO } from "../reproducao/CampoDataIatf";
import type { PaginaProtocolo } from "./EtapasProtocolo";
import { Paginacao } from "../ui";
import { reqProtocolo } from "./api";

type OpcaoInsercao = { id: string; data: string; nomeProdutoAplicado: string };
export type OrigensRetirada = PaginaProtocolo<OpcaoInsercao> & {
  sugestaoInsercaoId?: string | null;
  situacaoOrigem?: "UNIVOCA" | "AMBIGUA" | "SEM_ORIGEM" | "DATA_NECESSARIA";
};
type Pedido = { tarefaId: string; propriedadeId: number; realizadaEm: string };
type Resolucao = { dados?: OrigensRetirada; erro?: string };

export function caminhoInsercoes(tarefaId: string, realizadaEm: string, pagina = 1) {
  return `/tarefas/${tarefaId}/insercoes?pagina=${pagina}&porPagina=10&realizadaEm=${encodeURIComponent(dataHoraISO(realizadaEm))}`;
}

/** Prepara também os animais fora da página; paginação visual não define o conjunto. */
export function useOrigensRetirada(pedidos: Pedido[]) {
  const identidade = JSON.stringify(pedidos);
  const [revisao, setRevisao] = useState(0);
  const [estado, setEstado] = useState<{ identidade: string; revisao: number; itens: Record<string, Resolucao>; pronto: boolean }>({ identidade: "", revisao: 0, itens: {}, pronto: false });
  useEffect(() => {
    let vivo = true;
    const fila: Pedido[] = JSON.parse(identidade);
    const itens: Record<string, Resolucao> = {};
    setEstado({ identidade, revisao, itens, pronto: fila.length === 0 });
    let proximo = 0;
    async function trabalhador() {
      while (vivo && proximo < fila.length) {
        const p = fila[proximo++];
        try {
          if (!p.realizadaEm) throw new Error("Informe a data realizada para consultar a inserção.");
          const dados = await reqProtocolo<OrigensRetirada>(caminhoInsercoes(p.tarefaId, p.realizadaEm), p.propriedadeId);
          itens[p.tarefaId] = { dados };
        } catch (erro) {
          itens[p.tarefaId] = { erro: erro instanceof Error ? erro.message : String(erro) };
        }
      }
    }
    void Promise.all(Array.from({ length: Math.min(4, fila.length) }, trabalhador)).then(() => {
      if (vivo) setEstado({ identidade, revisao, itens: { ...itens }, pronto: true });
    });
    return () => { vivo = false; };
  }, [identidade, revisao]);
  const atual = estado.identidade === identidade && estado.revisao === revisao;
  return { itens: atual ? estado.itens : {}, pronto: atual && estado.pronto, tentarNovamente: () => setRevisao(r => r + 1) };
}

export function InsercaoRetirada({ tarefaId, propriedadeId, realizadaEm, origem, valor, onChange, onTentarNovamente }: {
  tarefaId: string; propriedadeId: number; realizadaEm: string; origem?: Resolucao; valor: string;
  onChange: (id: string) => void; onTentarNovamente: () => void;
}) {
  const [pagina, setPagina] = useState(1);
  const [outraPagina, setOutraPagina] = useState<OrigensRetirada | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => { setPagina(1); setOutraPagina(null); setErro(null); }, [tarefaId, propriedadeId, realizadaEm, origem]);
  useEffect(() => {
    if (pagina === 1) return;
    let vivo = true; setOutraPagina(null); setErro(null);
    reqProtocolo<OrigensRetirada>(caminhoInsercoes(tarefaId, realizadaEm, pagina), propriedadeId)
      .then(d => { if (vivo) setOutraPagina(d); })
      .catch(e => { if (vivo) setErro(e instanceof Error ? e.message : String(e)); });
    return () => { vivo = false; };
  }, [pagina, tarefaId, propriedadeId, realizadaEm]);
  const dados = pagina === 1 ? origem?.dados : outraPagina;
  const erroAtual = origem?.erro ?? erro;
  const mensagem = origem?.dados?.situacaoOrigem === "UNIVOCA" ? "Inserção proposta para conferência: única origem válida nesta data."
    : origem?.dados?.situacaoOrigem === "AMBIGUA" ? "Há mais de uma inserção válida. Escolha a origem efetivamente retirada."
    : origem?.dados?.situacaoOrigem === "SEM_ORIGEM" ? "Nenhuma inserção elegível nesta data. Confira a data ou regularize a origem antes de atender."
    : null;
  return <div className="grid gap-2"><ErrorBox erro={erroAtual} />
    {erroAtual && <Button secondary type="button" onClick={onTentarNovamente}>Consultar inserções novamente</Button>}
    {!origem && <p role="status">Consultando inserção deste animal…</p>}
    {mensagem && <p role="status" className="text-sm">{mensagem}</p>}
    <label>Inserção do dispositivo deste animal<select required className={classeInput} value={valor} onChange={e => onChange(e.target.value)}>
      <option value="">Selecione a inserção válida</option>
      {valor && !dados?.itens.some(i => i.id === valor) && <option value={valor}>Referência selecionada · {valor}</option>}
      {dados?.itens.map(i => <option key={i.id} value={i.id}>{i.data.slice(0, 10)} · {i.nomeProdutoAplicado}</option>)}
    </select></label>
    {dados && dados.total > 10 && <Paginacao paginaAtual={dados.pagina} totalPaginas={Math.ceil(dados.total / 10)} totalItens={dados.total} itensPorPagina={10} onPaginaChange={setPagina} rotulo="inserções válidas" idSelect={`insercoes-${tarefaId}`} />}
  </div>;
}
