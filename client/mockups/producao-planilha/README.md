# Produção — proposta de apresentação

Mockup em `/mockups/producao-planilha/index.html`, restrito à UI. Preserva a identidade atual e usa componentes shadcn compartilhados. Não altera o módulo operacional, API, banco, fórmulas ou contratos de cálculo.

Referência: aba OUTUBRO da planilha fornecida pelo usuário, `gid=1093933379`, consultada em 26/10/2026. O recorte local contém os valores exibidos de outubro para demonstração; a implementação deverá reutilizar as fontes e cálculos atuais do sistema, sem transformar fórmulas de planilha em regras novas.

A proposta é para Leite → Produção, consulta agregada por sítio. Não atribui volumes gerais a um animal individual. A visão visual apresenta três componentes do dia selecionado: Leite produzido, Leite consumido e Leite vendido. A alternativa tabular oferece as mesmas três subdivisões com busca, recorte, paginação e detalhe. Exportação e interação operam apenas sobre a prévia.

Definições esclarecidas pelo usuário: Funcionários é a quantidade de leite retirada pelos funcionários; Casa é a quantidade retirada para uso da casa. No bezerreiro, K corresponde ao leite limpo, L ao sujo, M ao descarte do limpo e N ao descarte do sujo. Esses campos não são fundidos com compradores. A coluna J sem título permanece consultável no detalhe. Não há mudança nas regras de cálculo do sistema.

Campos vazios não viram medições zero. O rodapé de totais representa o mês completo, independentemente da página e da busca. Não soma número de vacas nem médias. O total produzido usa os valores da coluna E, não uma nova regra calculada a partir dos turnos. Vendas resumidas somam Q e R, cada coluna uma vez. A prévia aguarda aprovação; capturas desktop não equivalem à homologação móvel.

As definições aparecem em ícones de ajuda junto a cada campo, em vez de uma explicação coletiva no título. Valores informados identificam explicitamente L, L/vaca ou vacas; ausência permanece como travessão, sem representar zero.
