// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { PainelCadastro } from './PainelCadastro';
afterEach(cleanup);
it('abre cadastro amplo em modal e conserva confirmação de saída com rascunho', async () => {
    const fechar = vi.fn();
    render(<PainelCadastro aberto titulo="Registrar animal" onFechar={fechar} rodape={<button>Salvar</button>}><input aria-label="Nome"/></PainelCadastro>);
    expect(screen.getByRole('dialog').getAttribute('data-slot')).toBe('dialog-content');
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Mimosa' } });
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    expect(await screen.findByText('Descartar alterações?')).toBeTruthy();
    expect(fechar).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Continuar editando' }));
    expect((screen.getByLabelText('Nome') as HTMLInputElement).value).toBe('Mimosa');
});
