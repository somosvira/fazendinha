import { Component, type ReactNode } from "react";

/** Uma falha ao baixar/renderizar uma área não derruba navegação e sessão. */
export class LimiteCarregamentoArea extends Component<{ contexto: string; children: ReactNode }, { falhou: boolean }> {
  state = { falhou: false };
  static getDerivedStateFromError() { return { falhou: true }; }
  componentDidUpdate(anterior: Readonly<{ contexto: string; children: ReactNode }>) {
    if (this.state.falhou && anterior.contexto !== this.props.contexto) this.setState({ falhou: false });
  }
  render() {
    if (!this.state.falhou) return this.props.children;
    return <section className="shell-wide pagina-financeira" role="alert">
      <h1 className="h1">Não foi possível abrir esta área</h1>
      <p className="mt-3 text-sm text-muted-foreground">Confira sua conexão e recarregue a página. Você também pode acessar outra área pelo menu.</p>
      <button type="button" className="btn-primary mt-4" onClick={() => window.location.reload()}>Recarregar página</button>
    </section>;
  }
}
