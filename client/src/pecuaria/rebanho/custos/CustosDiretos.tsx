import { useCallback, useEffect, useRef, useState } from "react";
import { classeInput } from "../../../financeiro/PainelCadastro";
import { getUsuario } from "../../../lib/auth";
import { temAcessoArea } from "../../../lib/areas";
import { obterCustos, type CustosDTO, type EscopoCustos } from "./api";
import { ResumoCustosDiretos } from "./ResumoCustosDiretos";
import { EditorClassificacaoCusto } from "./EditorClassificacaoCusto";
import { VinculosPreparatorios } from "./VinculosPreparatorios";

export function CustosDiretos({ propriedadeId, podeLancar, ...escopo }: { propriedadeId: number; podeLancar: boolean } & EscopoCustos) {
  const [resposta, setResposta] = useState<CustosDTO | null>(null);
  const [respostaIdentidade, setRespostaIdentidade] = useState("");
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [finalidade, setFinalidade] = useState("");
  const [pagina, setPagina] = useState(1);
  const [atualizacao, setAtualizacao] = useState(0);
  const [motivo, setMotivo] = useState("");
  const [chave, setChave] = useState(() => crypto.randomUUID());
  const usuario = getUsuario();
  const podeEditar = podeLancar && !!usuario && temAcessoArea(usuario.areas, "financeiro", !!usuario.dono) && (!!usuario.dono || usuario.flags.includes("verValores"));
  const { animalId, tentativaId, participacaoId, aplicacaoId, exameId, programacaoId } = escopo;
  const identidade = JSON.stringify([propriedadeId, animalId, tentativaId, participacaoId, aplicacaoId, exameId, programacaoId]);
  const contextoAtual = useRef({ identidade });
  if (contextoAtual.current.identidade !== identidade) contextoAtual.current = { identidade };
  const contexto = contextoAtual.current;
  const sequencia = useRef(0);
  const dados = respostaIdentidade === identidade ? resposta : null;

  const carregar = useCallback(async () => {
    const pedido = ++sequencia.current;
    setCarregando(true);
    setResposta(null);
    try {
      const r = await obterCustos({ animalId, tentativaId, participacaoId, aplicacaoId, exameId, programacaoId }, propriedadeId, inicio, fim, pagina, finalidade);
      if (contexto === contextoAtual.current && pedido === sequencia.current) {
        setResposta(r);
        setRespostaIdentidade(identidade);
        setErro("");
      }
    } catch (e) {
      if (contexto === contextoAtual.current && pedido === sequencia.current) {
        setResposta(null);
        setErro(e instanceof Error ? e.message : String(e));
      }
    } finally {
      if (contexto === contextoAtual.current && pedido === sequencia.current) setCarregando(false);
    }
  }, [animalId, tentativaId, participacaoId, aplicacaoId, exameId, programacaoId, propriedadeId, inicio, fim, pagina, finalidade, contexto, identidade]);

  useEffect(() => { void carregar(); }, [carregar, atualizacao]);
  useEffect(() => {
    setMotivo(""); setErro(""); setOcupado(false); setPagina(1); setChave(crypto.randomUUID());
  }, [identidade]);

  const alterar = () => setChave(crypto.randomUUID());
  async function gravar(acao: () => Promise<unknown>) {
    setOcupado(true);
    setErro("");
    try {
      await acao();
      if (contexto === contextoAtual.current) {
        setAtualizacao(v => v + 1);
        setChave(crypto.randomUUID());
      }
    } catch (e) {
      if (contexto === contextoAtual.current) setErro(e instanceof Error ? e.message : String(e));
    } finally {
      if (contexto === contextoAtual.current) setOcupado(false);
    }
  }

  const visivel = !!dados && !carregando;
  return <section className="space-y-3 rounded-lg border border-border p-4" aria-label="Composição dos custos diretos">
    <h3 className="font-semibold">Custo direto registrado</h3>
    <div className="flex flex-wrap gap-3">
      <label>Início do período<input type="date" className={classeInput} value={inicio} onChange={e => { setInicio(e.target.value); setPagina(1); }} /></label>
      <label>Fim do período<input type="date" className={classeInput} value={fim} onChange={e => { setFim(e.target.value); setPagina(1); }} /></label>
      <label>Finalidade do custo<select className={classeInput} value={finalidade} onChange={e => { setFinalidade(e.target.value); setPagina(1); }}>
        <option value="">Todas as finalidades</option><option value="REPRODUCAO">Reprodução</option><option value="SANIDADE">Sanidade</option><option value="ROTINA">Rotina/manutenção</option><option value="SEM_CLASSIFICACAO">Sem classificação</option>
      </select></label>
    </div>
    {carregando && <p role="status">Consultando custos…</p>}
    {erro && <p role="alert" className="text-destructive">{erro}</p>}
    {dados && visivel && <ResumoCustosDiretos dados={dados} propriedadeId={propriedadeId} porAnimal={!!animalId} tentativaId={tentativaId} comRecorte={!!(inicio || fim || finalidade)} pagina={pagina} aoMudarPagina={setPagina} />}
    {/* Os editores conservam rascunhos durante a recarga e reiniciam ao trocar o alvo/sítio. */}
    <EditorClassificacaoCusto key={`classificacao:${identidade}`} dados={dados} visivel={visivel && podeEditar} propriedadeId={propriedadeId} chave={chave} ocupado={ocupado} motivo={motivo} aoMudarMotivo={setMotivo} aoAlterar={alterar} gravar={gravar} />
    {tentativaId && <VinculosPreparatorios key={`preparatorios:${identidade}`} dados={dados} visivel={visivel && podeEditar} propriedadeId={propriedadeId} tentativaId={tentativaId} chave={chave} ocupado={ocupado} motivo={motivo} aoMudarMotivo={setMotivo} aoAlterar={alterar} aoErro={setErro} gravar={gravar} />}
  </section>;
}
