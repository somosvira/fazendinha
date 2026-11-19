# Auditoria de fontes de leilão

Avaliação de 13/11/2026. A nota soma catálogo e identidade (0–3), confirmação de compra por lote e comprador (0–4), e rapidez e estabilidade do canal (0–3). Recursos anunciados recebem nota parcial. Latência real e acesso a contas de compradores ainda não foram homologados.

| Fonte | Catálogo | Compra | Canal | Nota | Evidência e lacuna |
|---|---:|---:|---:|---:|---|
| [eRural](https://www.erural.net/evento/1-leilao-univida-969a/lotes/lote-40-4157) | 3 | 1 | 1 | 5 | Ficha com registro declarado e status vendido. Falta confirmação por comprador e preço final. |
| [MF Leilões](https://www.mfleiloes.com.br/leilao/2-etapa-leilao-liquidacao-girolando-fazenda-limeira/7382) | 3 | 1 | 1 | 5 | Fichas e lance atual. Fechamento homologado precisa de amostra. |
| [Suporte Leilões](https://www.suporteleiloes.com.br/documentacao-api) | 2 | 1 | 2 | 5 | API por instância. Verificar cliente pecuário e disponibilidade de webhook de compra. |
| [NC Brasil](https://www.ncbrasil.com.br/sistema-de-leilao-rural) | 2 | 2 | 1 | 5 | ERP anuncia registro e fechamento. Solicitar formato e acesso. |
| [Programa Leilões](https://programaleiloes.com/appportal) | 3 | 0 | 1 | 4 | Agenda e PDF. RGN extraído no catálogo Mafra. Feed de compras a confirmar. |
| [Connect](https://www.conectleiloes.com.br/files/arquivos/f68911fd2dad400069159aa2d23b6698.pdf) | 2 | 0 | 1 | 3 | Catálogo PDF. Solicitar exportação de fechamento. |
| [Central](https://centralleiloes.com.br/arquivos/Catalogo_Corte%2815%29.pdf) | 2 | 0 | 1 | 3 | Catálogo PDF. Preço final e comprador a confirmar. |
| [MB Leilões](https://www.mbleiloes.com.br/) | 2 | 0 | 1 | 3 | Agenda, lotes e catálogo. Verificar comprovante digital. |
| [Capitaliza](https://www.capitalizaleiloes.com.br/) | 2 | 0 | 1 | 3 | Catálogo, cadastro e lances. Verificar confirmação de compra. |
| [LeiloApp](https://leiloapp.com.br/) | 1 | 1 | 1 | 3 | Compra e venda digital anunciada. Pedir amostras e acesso parceiro. |
| [LN Leilões](https://www.lnleiloes.com.br/resultados) | 1 | 1 | 1 | 3 | Médias de pós-leilão, úteis como referência de mercado. |
| [Gralha Azul](https://gralhaazulleiloes.com.br/results) | 1 | 1 | 1 | 3 | Resultados por evento. Validar unidade e identidade por lote. |
| [Remate Web](https://remateweb.com/) | 1 | 0 | 1 | 2 | Agenda e transmissão. Deduplicar eventos em comum com a leiloeira. |
| [EB Leilões](https://ebleiloes.com.br/home) | 1 | 0 | 1 | 2 | Agenda e transmissão. Verificar ficha e fechamento. |
| [Lance Rural](https://www.lancerural.com.br/wp-content/uploads/2026/02/CATALOGO-EAO-TOUROS.pdf) | 2 | 0 | 0 | 2 | Catálogos e transmissão. Fechamento depende da leiloeira. |
| [Leiloboi](https://leiloboi.com/home/) | 1 | 0 | 1 | 2 | Agenda virtual. Verificar registro e resultado individual. |
| [Unaí](https://www.unaileiloes.com.br/) | 1 | 0 | 1 | 2 | Agenda de corte. Verificar fechamento estruturado. |
| [Parceria](https://www.parcerialeiloes.com.br/agenda/leiloes-realizados) | 1 | 0 | 1 | 2 | Arquivo de eventos. Conferir anexos e fechamento por evento. |
| [Ricardo Nicolau](https://www.ricardonicolauleiloes.com.br/) | 1 | 0 | 1 | 2 | Agenda e transmissão. Solicitar resultado de exemplo. |
| [Arroba Brasil](https://arrobabrasil.com/) | 0 | 1 | 1 | 2 | Indicadores de resultados publicados. |
| [DBO](https://portaldbo.com.br/jornal-de-leiloes/) | 1 | 1 | 0 | 2 | Histórico e médias, em cadência editorial. |

[ABCZ](https://www.abcz.org.br/produtos-e-servicos/produz/conheca-os-modulos-do-sistema/11/utilitarios) e [Girolando](https://intranet.girolando.com.br/consulta-publica) complementam identidade e genealogia. A confirmação comercial vem do operador do leilão.

Para testar paridade, pedir o mesmo catálogo antes e depois de uma substituição, junto do arremate final. Verificar ID estável de lote, versão ou data de publicação, registro do animal substituto, vínculo autorizado do comprador, total, parcelas e cancelamentos. Medir do horário de publicação até a proposta na Terrano. Webhook reduz o atraso após publicação. A consulta periódica acrescenta até um intervalo ao atraso da fonte. Um PDF sem versão ou data dificulta medir quando a alteração ficou disponível.
