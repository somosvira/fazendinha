// @vitest-environment jsdom
import { afterEach, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { CartaoAnimal } from './CartaoAnimal';
import type { AnimalResumo } from '../types';
afterEach(cleanup);
const animal = { categoriaOrigem: 'AUTOMATICA', categoriaCalculada: null, idadeNaBaixa: false, dataEntrada: '2021-05-05', origem: 'NASCIDO', papelReprodutivo: null, composicaoRotulo: '', noLocalDesde: null, baixa: null, id: 'a', brinco: '001', nome: 'Mimosa', sexo: 'F', situacao: 'ATIVO', idadeMeses: 65, dataNascimento: '2021-05-05', categoria: { id: 'cat', nome: 'Vaca' }, aptidao: 'LEITE', lote: { id: 'l', nome: 'Lactantes' }, propriedade: { id: 1, nome: 'Sede' }, ultimoPeso: null, gmdRecente: null, contextoCartao: { produtivo: { dataReferencia: '2026-10-30', partosRealizados: 3, diasDesdeConfirmacao: null, situacaoProdutiva: 'LACTANTE', del: 0, diasPosParto: 0, idadeGestacionalDias: null, pendencias: [] }, ocorrencias: [{ id: 'o', nome: 'Ocorrência comprovada', inicio: '2026-10-30' }] } } as AnimalResumo;
it('preserva seleção e abertura independentes no cartão simplificado', () => {
    const abrir = vi.fn(), selecionar = vi.fn();
    render(<CartaoAnimal animal={animal} onAbrir={abrir} selecao={<input type="checkbox" aria-label="Selecionar Mimosa" onChange={selecionar}/>}/>);
    expect(screen.getByText('#001')).toBeTruthy();
    expect(screen.queryByText('Sem pesagem')).toBeNull();
    expect(screen.queryByText(/dias em lactação/)).toBeNull();
    expect(screen.queryByText(/^Pós-parto/)).toBeNull();
    fireEvent.click(screen.getByLabelText('Selecionar Mimosa'));
    expect(abrir).not.toHaveBeenCalled();
    expect(selecionar).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Ver animal' }));
    expect(abrir).toHaveBeenCalledOnce();
});
it('mostra apenas identidade, tags, lote e ações, mesmo recebendo contexto completo', () => {
    render(<CartaoAnimal animal={{...animal,papelReprodutivo:'RECEPTORA',ultimoPeso:{kg:510,data:'2026-10-29'},gmdRecente:1.5}} onAbrir={vi.fn()}/>);
    expect(screen.getByText('Mimosa')).toBeTruthy();
    expect(screen.getByText('Vaca')).toBeTruthy();
    expect(screen.queryByText('Sede')).toBeNull();
    expect(screen.queryByText('Receptora')).toBeNull();
    expect(screen.queryByText('Ocorrência comprovada')).toBeNull();
    expect(screen.getByText('Lactantes')).toBeTruthy();
    expect(screen.queryByText(/Em lactação|dias em lactação|partos registrados|Gestante|dados a conferir/)).toBeNull();
    expect(screen.queryByText(/Último peso|510 kg|GMD|Idade|Nasc\.|29\/10\/2026|05\/05\/2021/)).toBeNull();
});
it('não presume lactação, gestação ou sanidade saudável sem contexto', () => {
    render(<CartaoAnimal animal={{ ...animal, contextoCartao: undefined, nome: null }} onAbrir={() => { }}/>);
    expect(screen.queryByText(/dias em lactação/)).toBeNull();
    expect(screen.queryByText(/Gestante/)).toBeNull();
    expect(screen.queryByText(/saudável/i)).toBeNull();
});
