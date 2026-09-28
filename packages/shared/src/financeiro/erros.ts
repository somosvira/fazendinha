export class ErroValidacaoFinanceira extends Error {
  constructor(message: string, public campo?: string) {
    super(message);
    this.name = "ErroValidacaoFinanceira";
  }
}
