# Base de desenvolvimento unificada

O plano foi incorporado à implementação e ao [contrato de desenvolvimento](desenvolvimento.md). A operação da carga, os cenários, a retomada e os limites estão no [guia da seed única](../server/prisma/seed/README.md).

A estrutura atual tem uma baseline, `20261025000000_base_unificada`, com as garantias SQL dos domínios ativos. A carga tem uma entrada, `server/prisma/seed.ts`, e módulos internos por domínio. Evoluções futuras usam migrations incrementais; uma baseline já aplicada não deve ser reescrita.

| Sítio demonstrativo | Animais ativos | Composição principal |
|---|---:|---|
| Sítio principal | 72 | Leite, reprodução e oito crias de partos |
| Sítio arrendado | 36 | Receptoras, novilhas, um touro e Nelore de corte |
| Sítio test | 24 | Nelore de corte |

A seed usa fatos de reprodução, sanidade, nutrição, produção, qualidade, estoque e financeiro relacionados entre si. Os acessos demonstrativos e os comandos de execução/verificação estão no guia. A substituição da base local é uma manutenção separada, com backup e autorização explícita; a carga normal não reinicializa dados.

O histórico anterior permanece no Git e nos backups/manifestos preservados. CI, instalação local, arquivos R2 e homologação da fazenda são evidências distintas. O [PR V5](https://github.com/somosvira/fazendinha/pull/328) reúne a integração.
