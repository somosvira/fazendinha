# Homologação V5 — finalidade na produção leiteira

Roteiro de conferência manual da compatibilização entre produção leiteira V5 e finalidade do animal. Este documento descreve casos esperados; não registra execução nem aprovação. Todos os casos permanecem pendentes.

## Pré-condições

- Executar somente em ambiente de homologação autorizado, após aplicar e conferir as migrations da V5 e da finalidade. Esta condição não está atendida pela validação local registrada em 21/10/2026.
- Usar registros previamente designados para a homologação e conferir sítio, localização, lactação e finalidade na data. Não alterar dados do `fazendinha_seedatev3` nem iniciar cargas para preparar este roteiro.
- Registrar caso, sítio, período, animal, finalidade vigente, versão observada, resultado e evidência. Se faltar um cenário adequado, marcar como bloqueado por falta de massa; não inferir aprovação.
- Não editar ou desfazer fatos produtivos confirmados para montar cenário. Alterações de cadastro ou lançamentos de teste exigem autorização e registros específicos do ambiente de homologação.

## Casos

| ID | Conferência | Resultado esperado |
|---|---|---|
| LF-01 | Abrir a folha em uma data cuja finalidade única seja Leite e verificar população, localização e lactação | Animal elegível aparece conforme as regras existentes de localização/lactação; evidência mostra a finalidade usada naquela data |
| LF-02 | Consultar uma data em que a finalidade seja Reprodução, inclusive com lactação aberta | Animal não pode ser incluído na produção; interface explica o impedimento. Papel DOADORA/RECEPTORA não altera o resultado |
| LF-03 | Consultar data de finalidade Corte | Animal é inelegível, com motivo correspondente |
| LF-04 | Consultar data com lacuna ou sobreposição de finalidade | Sistema apresenta pendência explícita e não presume Leite nem cria zero de produção |
| LF-05 | Conferir Leite até uma data e Reprodução a partir da próxima, em folha, histórico e consulta | Intervalo `[desde, ate)` respeita a fronteira; fatos anteriores continuam visíveis e não são reclassificados pela finalidade atual |
| LF-06 | Conferir inclusão explícita, gravação, prévia e confirmação de estoque para uma data inelegível | Todos os caminhos aplicam o mesmo impedimento; confirmação não cria origem física para animal inelegível |
| LF-07 | Com fatos produtivos existentes, tentar alteração retroativa, desfazer ou ajuste de entrada que alcance o período | Alteração incompatível é recusada ou exige a regularização explícita prevista; medições, origens e histórico não desaparecem |
| LF-08 | Reenviar uma operação já confirmada após mudança posterior de finalidade | Retry idempotente recupera o resultado original sem duplicar medição ou estoque |
| LF-09 | Consultar custo pontual e consumo que cruzem uma mudança Leite/Reprodução | Custo pontual usa finalidade na data; componente agregado sem parcela comprovada deixa custo/L pendente, sem rateio presumido |
| LF-10 | Conferir ficha/Nutrição, referência comercial R07, qualidade, colostragem e venda de estoque anterior | Esses fatos não são ocultados ou alterados por filtro genérico da finalidade atual; permissões financeiras seguem aplicadas |
| LF-11 | Comparar histórico, painel, CSV e emissão nova, além de abrir emissão V1/V2 já existente | Consultas concordam na população histórica; nova emissão registra a versão vigente; emissão antiga abre sem regravação |

## Estado da execução

Nenhum caso deste roteiro foi executado manualmente nesta compatibilização. Testes automatizados, typecheck ou leitura estrutural de SQL não aprovam estes casos. Aplicação de migration, concorrência real no PostgreSQL, inspeção visual, revisão independente Astra e aceite da fazenda são evidências separadas.

## Regressões da revisão independente — ainda não homologadas

- [ ] Registrar ordenha e depois baixa no mesmo dia; conferir também a ordem inversa. A evidência deve apontar a baixa que encerrou aquela finalidade, sem admitir Corte/Reprodução.
- [ ] Estornar a baixa pelo fluxo normal e verificar preservação da ordenha e reabertura coerente da finalidade.
- [ ] Conferir que fêmea Leite sem lactação e nunca incluída na folha não transfere seu custo nutricional ao custo por litro das vacas ordenhadas.
- [ ] Excluir participante sem estoque, regularizar a finalidade e reincluir com motivo: conferir nova evidência, versões, auditoria e confirmação posterior.
