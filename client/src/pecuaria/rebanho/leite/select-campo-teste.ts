import { fireEvent, screen, waitFor } from "@testing-library/react";
/** Exercita o seletor compartilhado, incluindo o popup e as opções autorizadas. */
export async function selecionarCampoLeite(rotulo: string, valor: string) {
  HTMLElement.prototype.scrollIntoView ??= () => {};
  HTMLElement.prototype.hasPointerCapture ??= () => false;
  HTMLElement.prototype.releasePointerCapture ??= () => {};
  fireEvent.click((await screen.findAllByRole("combobox", { name: rotulo }))[0]);
  const opcao = await waitFor(() => {
    const encontrada = screen.getAllByRole("option").find(item => item.getAttribute("data-value") === valor);
    if (!encontrada) throw new Error(`Opção ${valor} indisponível em ${rotulo}`);
    return encontrada;
  });
  fireEvent.click(opcao);
}
