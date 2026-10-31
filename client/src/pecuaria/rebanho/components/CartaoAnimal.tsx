import type { ReactNode } from 'react';
import { ChevronRight, Layers } from 'lucide-react';
import type { AnimalResumo } from '../types';
import { rotuloAptidao, rotuloSituacao } from '../lib/rotulos';
import { CategoriaPill } from '../ui';
import './cartao-animal.css';

export function CartaoAnimal({ animal: a, onAbrir, selecao, acoes, selecionado = false }: {
    animal: AnimalResumo;
    onAbrir: () => void;
    selecao?: ReactNode;
    acoes?: ReactNode;
    selecionado?: boolean;
}) {
    return <article className={`pec-cartao-animal${selecionado ? ' selecionado' : ''}`} aria-label={`Animal ${a.brinco}`}>
        <header>
            {selecao}
            <h3><button type="button" className="pec-animal-titulo" onClick={onAbrir} aria-label={`Abrir animal ${a.brinco}`}>
                {a.nome ?? a.brinco}{a.nome && <span className="pec-brinco">#{a.brinco}</span>}
            </button></h3>
            <span className={`pec-animal-situacao ${a.situacao === 'ATIVO' ? 'ativo' : 'baixado'}`}><i />{rotuloSituacao(a.situacao)}</span>
        </header>
        <div className="pec-animal-identidade">
            <div className="pec-animal-retrato"><img src="/images/pecuaria/vaca.png" alt="Ilustração genérica de bovino" loading="lazy" /></div>
            <div>
                <CategoriaPill categoria={a.categoria} categoriaOrigem={a.categoriaOrigem} categoriaCalculada={a.categoriaCalculada} />
                {a.aptidao && <span className="pec-animal-finalidade">{rotuloAptidao(a.aptidao)}</span>}
                <p><Layers size={16} />{a.lote?.nome ?? 'Sem lote'}</p>
            </div>
        </div>
        <footer><div className="pec-animal-acoes">
            {acoes}<button type="button" className="pec-animal-abrir" onClick={onAbrir}>Ver animal<ChevronRight size={17} /></button>
        </div></footer>
    </article>;
}
