// @vitest-environment jsdom
import {afterEach,expect,it} from 'vitest';
import {cleanup,render,screen} from '@testing-library/react';
import {DistribuicaoConsumoLeite} from './DistribuicaoConsumoLeite';
import {resumirOperacionalPeriodo} from './resumo-producao';
afterEach(cleanup);
it('não desenha proporções para ausência de dados, preservando os destinos em aberto',()=>{render(<DistribuicaoConsumoLeite dados={resumirOperacionalPeriodo([],'2026-10-01')} compacto/>);expect(screen.queryByRole('img')).toBeNull();expect(screen.getAllByText('Em aberto')).toHaveLength(2);expect(screen.getAllByText('Não informado').length).toBeGreaterThan(0)});
it('mostra zero conhecido sem inventar porcentagens ou barras de volume',()=>{const dados=resumirOperacionalPeriodo([],'2026-10-01');dados.consumo={...dados.consumo,totalLitros:'0',comumLitros:'0',naoComercialLitros:'0',colostroLitros:'0'};render(<DistribuicaoConsumoLeite dados={dados}/>);expect(screen.queryByRole('img')).toBeNull();expect(screen.getAllByText('0 L').length).toBe(4);expect(screen.queryByText(/NaN|Infinity/)).toBeNull()});
