import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { consultarBezerreiro } from './api';
import { RebanhoApiError } from '../api';
export function useConsultaBezerreiro<T>(path: string | null, sitio: number | null, revisao = 0) {
  const [dados, setDados] = useState<T | null>(null), [erro, setErro] = useState('');
  const [tentativa, setTentativa] = useState(0);
  useEffect(() => {
    let vivo = true; setDados(null); setErro('');
    if (sitio != null && path != null) void consultarBezerreiro<T>(path, sitio).then(v => {if (vivo) setDados(v);}).catch((e: unknown) => {if (vivo) setErro(e instanceof Error ? e.message : 'Não foi possível carregar.');});
    return () => {vivo = false;};
  }, [path, sitio, revisao, tentativa]);
  return {dados, erro, tentar: () => setTentativa(n => n+1)};
}
export function EstadoConsulta({erro, carregando, tentar, children}: {erro: string; carregando: boolean; tentar: () => void; children: ReactNode}) {
  return erro ? <div className="bez-estado" role="alert"><p>{erro}</p><Button type="button" variant="outline" onClick={tentar}>Tentar novamente</Button></div> : carregando ? <div className="bez-estado" role="status" aria-live="polite">Carregando registros…</div> : <>{children}</>;
}
/** `alvo` inclui recurso/data/animal para invalidar respostas ao mudar o formulário. */
export function useComando(sitio: number, aoSalvar: () => void, alvo = '') {
  const identidade = JSON.stringify([sitio, alvo]);
  const escopo = useRef({identidade, geracao: 0});
  if (escopo.current.identidade !== identidade) escopo.current = {identidade, geracao: escopo.current.geracao + 1};
  const geracao = escopo.current.geracao;
  const [estado, setEstado] = useState<{geracao: number; ocupado: boolean; erro: string; erroTipado: Error | null}>({geracao, ocupado: false, erro: '', erroTipado: null});
  const atual = estado.geracao === geracao ? estado : {ocupado: false, erro: '', erroTipado: null};
  const montado = useRef(true);
  useEffect(() => {montado.current = true; return () => {montado.current = false;};}, []);
  const trava = useRef<number | null>(null), pedido = useRef<{conteudo: string; chave: string} | null>(null);
  function setErro(erro: string) {setEstado(s => ({geracao, ocupado: s.geracao === geracao && s.ocupado, erro, erroTipado: null}));}
  function limparErro() {setErro('');}
  async function salvar(path: string, body: Record<string, unknown>) {
    if (trava.current === geracao) return;
    // O sítio e o alvo fazem parte da identidade, inclusive quando o payload é igual.
    const conteudo = JSON.stringify({identidade, path, body});
    if (pedido.current?.conteudo !== conteudo) pedido.current = {conteudo, chave: crypto.randomUUID()};
    const chave = pedido.current.chave;
    trava.current = geracao;
    setEstado({geracao, ocupado: true, erro: '', erroTipado: null});
    const vigente = () => montado.current && escopo.current.geracao === geracao;
    try {
      await consultarBezerreiro(path, sitio, {...body, propriedadeId: sitio, chave});
      if (vigente()) {pedido.current = null; aoSalvar();}
    } catch (e: unknown) {
      if (vigente()) {
        const erroTipado = e instanceof Error ? e : new Error('Não foi possível salvar. Revise os dados e tente novamente.');
        setEstado({geracao, ocupado: true, erro: erroTipado.message, erroTipado});
      }
    } finally {
      if (trava.current === geracao) trava.current = null;
      if (vigente()) setEstado(s => ({...s, ocupado: false}));
    }
  }
  return {...atual, conflito: atual.erroTipado instanceof RebanhoApiError && atual.erroTipado.status === 409, setErro, limparErro, salvar};
}

/** A nova leitura é apenas candidata: o consumidor só a adota após `conferido`. */
export function useRecuperacaoConflito<T>(identidade: string, carregar: () => Promise<T>) {
  const escopo = useRef({identidade, geracao: 0});
  if (escopo.current.identidade !== identidade) escopo.current = {identidade, geracao: escopo.current.geracao + 1};
  const geracao = escopo.current.geracao;
  const carga = useRef(0), montado = useRef(true), leitor = useRef(carregar);
  leitor.current = carregar;
  useEffect(() => {montado.current = true; return () => {montado.current = false; carga.current++;};}, []);
  const vazio = {atual: null as T | null, carregando: false, erro: '', conferido: false};
  const [estado, setEstado] = useState({...vazio, geracao});
  const atual = estado.geracao === geracao ? estado : vazio;
  function invalidar() {carga.current++; setEstado({...vazio, geracao});}
  async function atualizar() {
    const numero = ++carga.current;
    setEstado({...vazio, geracao, carregando: true});
    const vigente = () => montado.current && escopo.current.geracao === geracao && carga.current === numero;
    try {
      const resultado = await leitor.current();
      if (vigente()) setEstado({...vazio, geracao, atual: resultado});
    } catch (e: unknown) {
      if (vigente()) setEstado({...vazio, geracao, erro: e instanceof Error ? e.message : 'Não foi possível atualizar o contexto.'});
    }
  }
  function conferir() {setEstado(s => s.geracao === geracao && s.atual !== null && !s.carregando ? {...s, conferido: true} : s);}
  return {...atual, atualizar, conferir, invalidar};
}

export function RecuperacaoConflito({conflito, carregando, erro, atualizado, conferido, aoAtualizar, aoConferir, children}: {
  conflito: boolean; carregando: boolean; erro: string; atualizado: boolean; conferido: boolean;
  aoAtualizar: () => void; aoConferir: () => void; children?: ReactNode;
}) {
  if (!conflito && !atualizado && !carregando && !erro) return null;
  return <section className="bez-estado" aria-label="Recuperação de conflito">
    <p>O registro ou contexto mudou. Seus dados foram preservados. Atualize e confira as alterações antes de tentar salvar novamente.</p>
    <Button type="button" variant="outline" disabled={carregando} onClick={aoAtualizar}>{carregando ? 'Atualizando contexto…' : 'Atualizar contexto'}</Button>
    {erro && <p role="alert" className="bez-erro">{erro}</p>}
    {atualizado && <><div aria-live="polite">{children}</div><Button type="button" variant="outline" disabled={conferido} onClick={aoConferir}>{conferido ? 'Alterações conferidas' : 'Conferi as alterações'}</Button></>}
    {carregando && <p role="status">Carregando a versão atual…</p>}
  </section>;
}
export function ModalBezerreiro({titulo, aoFechar, children, ocupado = false, erro, form, textoSalvar = 'Salvar'}: {titulo: string; aoFechar: () => void; children: ReactNode; ocupado?: boolean; erro?: string; form: string; textoSalvar?: string}) {
  return <Dialog open onOpenChange={v => {if (!v && !ocupado) aoFechar();}}><DialogContent className="bez-modal max-w-4xl" aria-describedby={undefined}><DialogHeader><DialogTitle>{titulo}</DialogTitle></DialogHeader><div className="bez-modal-corpo">{children}{erro && <p role="alert" className="bez-erro">{erro}</p>}</div><DialogFooter><Button variant="outline" type="button" disabled={ocupado} onClick={aoFechar}>Cancelar</Button><Button type="submit" form={form} disabled={ocupado}>{ocupado ? 'Salvando…' : textoSalvar}</Button></DialogFooter></DialogContent></Dialog>;
}
export function ColeiraBadge({nome, cor}: {nome?: string | null; cor?: string | null}) {return <span className="bez-coleira">{cor && <i style={{backgroundColor: cor}} aria-hidden />}{nome ?? 'Sem coleira'}</span>;}
export function PaginacaoBezerreiro({pagina, total, tamanho = 20, mudar}: {pagina: number; total: number; tamanho?: number; mudar: (pagina: number) => void}) {return total > tamanho ? <nav className="bez-paginacao" aria-label="Paginação"><Button type="button" variant="outline" disabled={pagina===1} onClick={() => mudar(pagina-1)}>Anterior</Button><span>Página {pagina} de {Math.ceil(total/tamanho)}</span><Button type="button" variant="outline" disabled={pagina*tamanho>=total} onClick={() => mudar(pagina+1)}>Próxima</Button></nav> : null;}
