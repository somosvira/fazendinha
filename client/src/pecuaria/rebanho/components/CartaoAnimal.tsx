import { useState, type ReactNode } from 'react';
import { CalendarDays, ChevronRight, GitBranch, HeartPulse, Layers, MapPin, Milk, Scale, TrendingDown, TrendingUp } from 'lucide-react';
import { DialogFinanceiro } from '../../../financeiro/DialogFinanceiro';
import { Button } from '../../../components/ui/button';
import type { AnimalResumo } from '../types';
import { formatarDataBR, formatarIdade, rotuloAptidao, rotuloSituacao } from '../lib/rotulos';
import { formatarGmd } from '../lib/peso';
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
    const ciclo = c?.idadeGestacionalDias != null ? `Gestante · ${c.idadeGestacionalDias} dias` : c?.diasPosParto != null ? `Pós-parto · ${c.diasPosParto} dias` : null;
    const fase = c?.situacaoProdutiva === 'LACTANTE' ? 'Em lactação' : c?.situacaoProdutiva === 'SECA' ? 'Seca' : null;
    const GmdIcone = a.gmdRecente != null && a.gmdRecente < 0 ? TrendingDown : TrendingUp;
    return <><article className={`pec-cartao-animal${selecionado ? ' selecionado' : ''}`} aria-label={`Animal ${a.brinco}`}>
 <header>{selecao}<h3><button type="button" onClick={onAbrir} aria-label={`Abrir animal ${a.brinco}`}>{a.nome ?? a.brinco}{a.nome && <span className="pec-brinco">#{a.brinco}</span>}</button></h3><span className={`pec-animal-situacao ${a.situacao === 'ATIVO' ? 'ativo' : 'baixado'}`}><i />{rotuloSituacao(a.situacao)}</span></header>
 <div className="pec-animal-identidade"><div className="pec-animal-retrato"><img src="/images/pecuaria/vaca.png" alt="Ilustração genérica de bovino" loading="lazy"/></div><div><CategoriaPill categoria={a.categoria} categoriaOrigem={a.categoriaOrigem} categoriaCalculada={a.categoriaCalculada}/>{a.aptidao && <span className="pec-animal-finalidade">{rotuloAptidao(a.aptidao)}</span>}<p><Layers size={16}/>{a.lote?.nome ?? 'Sem lote'}</p>{fase && <span className="pec-animal-fase"><Milk size={15}/>{fase}</span>}</div></div>
 <div className="pec-animal-medidas"><section><span><Scale size={17}/>Último peso</span><strong>{a.ultimoPeso ? `${a.ultimoPeso.kg.toLocaleString('pt-BR')} kg` : 'Sem pesagem'}</strong><p className={a.gmdRecente != null && a.gmdRecente < 0 ? 'perda' : ''}><GmdIcone size={15}/>{formatarGmd(a.gmdRecente)}</p></section><section><span><CalendarDays size={17}/>{a.idadeNaBaixa ? 'Idade na baixa' : 'Idade'}</span><strong>{formatarIdade(a.idadeMeses)}</strong><p>Nasc. {formatarDataBR(a.dataNascimento)}</p></section></div>
 {(ciclo || fase) && <div className="pec-animal-ciclo"><span><GitBranch size={21}/></span><div>{ciclo && <strong>{ciclo}</strong>}{c?.situacaoProdutiva === 'LACTANTE' && c.del != null && <p>{c.del} dias em lactação</p>}{c?.partosRealizados != null && <p>{c.partosRealizados} {c.partosRealizados === 1 ? 'parto registrado' : 'partos registrados'}</p>}</div></div>}
 {o.length > 0 && <button type="button" className="pec-animal-alerta" onClick={() => setOcorrenciasAbertas(true)}><HeartPulse size={21}/><span><small>{o.length === 1 ? 'Ocorrência sanitária aberta' : `${o.length} ocorrências sanitárias abertas`}</small><strong>{o[0].nome}</strong></span><ChevronRight size={18}/></button>}
 {c && c.pendencias.length > 0 && <p className="pec-animal-contexto-pendente">Ciclo produtivo com dados a conferir na ficha</p>}
 <div className="pec-animal-sitio"><MapPin size={14}/>{a.propriedade?.nome ?? 'Sem localização'}{a.papelReprodutivoEstado === 'CONFLITO' ? <span>Papel em revisão</span> : a.papelReprodutivo && a.papelReprodutivo !== 'NENHUM' && <span>{a.papelReprodutivo === 'DOADORA' ? 'Doadora' : 'Receptora'}</span>}</div>
 {adicionais && <div className="pec-animal-adicionais">{adicionais}</div>}
 <footer><span><CalendarDays size={15}/>{a.ultimoPeso ? formatarDataBR(a.ultimoPeso.data) : 'Sem pesagem'}</span><div>{acoes}<button type="button" className="pec-animal-abrir" onClick={onAbrir}>Ver animal<ChevronRight size={17}/></button></div></footer>
 </article>{ocorrenciasAbertas && <DialogFinanceiro titulo="Ocorrências sanitárias abertas" eyebrow={`${a.nome ?? a.brinco} · #${a.brinco}`} icon={HeartPulse} onClose={() => setOcorrenciasAbertas(false)}><div className="p-5 space-y-4">{o.map(x => <div key={x.id}><strong>{x.nome}</strong><p>Início em {formatarDataBR(x.inicio)}</p></div>)}<Button onClick={() => navegarPara(linkFichaAnimal(a.id) + '#sanidade')}>Consultar sanidade</Button></div></DialogFinanceiro>}</>;
}
