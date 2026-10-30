import { useState, type ReactNode } from 'react';
import { ChevronRight, GitBranch, HeartPulse, Layers, Milk } from 'lucide-react';
import { DialogFinanceiro } from '../../../financeiro/DialogFinanceiro';
import { Button } from '../../../components/ui/button';
import type { AnimalResumo } from '../types';
import { formatarDataBR, rotuloAptidao, rotuloSituacao } from '../lib/rotulos';
import { CategoriaPill } from '../ui';
import { navegarPara } from '../../../router';
import { linkFichaAnimal } from '../lib/navegacao';
import './cartao-animal.css';
export function CartaoAnimal({ animal: a, onAbrir, selecao, acoes, selecionado = false, adicionais }: {
    animal: AnimalResumo;
    onAbrir: () => void;
    selecao?: ReactNode;
    acoes?: ReactNode;
    selecionado?: boolean;
    adicionais?: ReactNode;
}) {
    const [ocorrenciasAbertas, setOcorrenciasAbertas] = useState(false);
    const c = a.contextoCartao?.produtivo, o = a.contextoCartao?.ocorrencias ?? [];
    const ciclo = c?.idadeGestacionalDias != null ? `Gestante · ${c.idadeGestacionalDias} dias` : null;
    const fase = c?.situacaoProdutiva === 'LACTANTE' ? 'Em lactação' : c?.situacaoProdutiva === 'SECA' ? 'Seca' : null;
    return <><article className={`pec-cartao-animal${selecionado ? ' selecionado' : ''}`} aria-label={`Animal ${a.brinco}`}>
 <header>{selecao}<h3><button type="button" className="pec-animal-titulo" onClick={onAbrir} aria-label={`Abrir animal ${a.brinco}`}>{a.nome ?? a.brinco}{a.nome && <span className="pec-brinco">#{a.brinco}</span>}</button></h3><span className={`pec-animal-situacao ${a.situacao === 'ATIVO' ? 'ativo' : 'baixado'}`}><i />{rotuloSituacao(a.situacao)}</span></header>
 <div className="pec-animal-identidade"><div className="pec-animal-retrato"><img src="/images/pecuaria/vaca.png" alt="Ilustração genérica de bovino" loading="lazy"/></div><div><CategoriaPill categoria={a.categoria} categoriaOrigem={a.categoriaOrigem} categoriaCalculada={a.categoriaCalculada}/>{a.aptidao && <span className="pec-animal-finalidade">{rotuloAptidao(a.aptidao)}</span>}<p><Layers size={16}/>{a.lote?.nome ?? 'Sem lote'}</p>{fase && <span className="pec-animal-fase"><Milk size={15}/>{fase}</span>}</div></div>
 {(ciclo || fase) && <div className="pec-animal-ciclo"><span><GitBranch size={21}/></span><div>{ciclo && <strong>{ciclo}</strong>}{c?.situacaoProdutiva === 'LACTANTE' && c.del != null && <p>{c.del} dias em lactação</p>}{c?.partosRealizados != null && <p>{c.partosRealizados} {c.partosRealizados === 1 ? 'parto registrado' : 'partos registrados'}</p>}</div></div>}
 {o.length > 0 && <button type="button" className="pec-animal-alerta" onClick={() => setOcorrenciasAbertas(true)}><HeartPulse size={21}/><span><small>{o.length === 1 ? 'Ocorrência sanitária aberta' : `${o.length} ocorrências sanitárias abertas`}</small><strong>{o[0].nome}</strong></span><ChevronRight size={18}/></button>}
 {c && c.pendencias.length > 0 && <p className="pec-animal-contexto-pendente">Ciclo produtivo com dados a conferir na ficha</p>}

 {adicionais && <div className="pec-animal-adicionais">{adicionais}</div>}
 <footer>{a.papelReprodutivoEstado === 'CONFLITO' ? <span>Papel em revisão</span> : a.papelReprodutivo && a.papelReprodutivo !== 'NENHUM' && <span>{a.papelReprodutivo === 'DOADORA' ? 'Doadora' : 'Receptora'}</span>}<div className="pec-animal-acoes">{acoes}<button type="button" className="pec-animal-abrir" onClick={onAbrir}>Ver animal<ChevronRight size={17}/></button></div></footer>
 </article>{ocorrenciasAbertas && <DialogFinanceiro titulo="Ocorrências sanitárias abertas" eyebrow={`${a.nome ?? a.brinco} · #${a.brinco}`} icon={HeartPulse} onClose={() => setOcorrenciasAbertas(false)}><div className="p-5 space-y-4">{o.map(x => <div key={x.id}><strong>{x.nome}</strong><p>Início em {formatarDataBR(x.inicio)}</p></div>)}<Button onClick={() => navegarPara(linkFichaAnimal(a.id) + '#sanidade')}>Consultar sanidade</Button></div></DialogFinanceiro>}</>;
}
