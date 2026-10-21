# Registro local — ações e atendimentos de protocolos

Ampliação autorizada em 21/10/2026 e implementada localmente. As decisões vigentes foram incorporadas ao [contrato de protocolos e exames](protocolos-exames.md); este registro substitui o plano temporário e conserva os limites da verificação. A [base documental](artefatos/protocolos/index.html) reúne diagramas, catálogo físico e referências conceituais aprovadas. O [registro anterior](plano-protocolos-unificados.md) trata da padronização que precedeu esta ampliação.

O núcleo comum atende sanitário/reprodutivo e individual/coletivo. Momentos agrupam ações da versão, cada ação gera tarefa por animal e a confirmação de até cem animais grava fatos individuais atomicamente. Aplicação, exame, tentativa, avaliação, manejo e retirada usam preparação, confirmação e reenvio comuns. Ficha, protocolo e visita consultam os mesmos fatos. Estoque, custos, gestação, correções, acompanhamento, paginação e compatibilidade estão descritos no contrato, sem duplicação das regras neste registro.

## Evidências locais disponíveis

- Builds finais do cliente e do servidor concluídos e testes unitários/de componentes executados nos recortes afetados, incluindo os formulários e consultas comuns.
- Integrações PostgreSQL selecionadas de execução comum, clínica, manejo/Serviço, guardas SQL, custos, visitas e substitutos verificadas com fixtures próprias em `fazendinha_seedatev3`.
- Migrations aditivas de momentos, proteção estrutural, manejo, demanda de protocolo sem prazo, reconhecimento de inserção e guardas de fatos aplicadas no banco autorizado. Nenhuma migration aplicada foi reescrita.
- Conferência final de preservação sem alterações nas 103 tabelas verificadas, com checksums das seis migrations desta ampliação conferidos. Sem reset, recarga de seed, banco auxiliar ou clone.
- Catálogo físico de 21/10/2026 obtido somente de `pg_catalog`; gerador, scripts inline e links locais dos artefatos conferidos. O catálogo demonstra estrutura, e os HTMLs simulados não demonstram execução de serviços reais.

A implementação e a coordenação usaram principalmente `gpt-6.1-sol`, com esforço conforme o risco da entrega: coordenação/interface em `medium`, integridade transacional e clínica em `high`, documentação em `low`. `gpt-6-astra` ficou reservado às revisões críticas, sem implementação. Não há medição consolidada de tokens, economia monetária ou taxa de acerto registrada.

## Limites de validação

A revisão crítica R2 foi aprovada após correção e regressão do seletor. A inspeção real cobriu reprodução coletiva, sanidade coletiva e ficha sanitária, paginação e limite explícito da seleção, além de layout de 390 × 844 sem transbordamento lateral. Os contextos individuais têm testes automatizados e integração, mas a inspeção visual com participações individuais persistidas continua pendente: o seed não possui esses registros. CI, deploy, roteiro manual aprovado e homologação de campo não foram comprovados. Os builds finais do cliente e do servidor passaram, incluindo a correção do seletor e os ajustes de apresentação. O Vite informou o aviso de tamanho do pacote JavaScript, sem impedir o build.

CI remoto, publicação/deploy, aprovação do roteiro manual e homologação de campo não foram comprovados nesta entrega. O mockup aprovado permanece referência conceitual; sua execução não substitui persistência real ou homologação. As marcações anteriores dos roteiros manuais foram preservadas.
