# Fase 5 da V2: Dashboard, Calendario e Relatorios

## 1. Objetivo da Fase 5

A Fase 5 liga o painel principal da V2 aos novos modulos de negocio:

- `venue_events` para Festas no Espaco;
- `external_events` e `external_event_services` para Servicos Externos;
- `workshops` e `workshop_participants` para Workshops/Formacoes.

O objetivo e deixar de usar a tabela antiga `reservations` como fonte principal do Dashboard, Calendario e Relatorios.

A pagina antiga `/reservations` pode continuar a existir como area legada, arquivo tecnico ou referencia historica, mas nao deve alimentar o painel principal da V2.

## 2. Dashboard V2

O Dashboard deve ser o ponto de entrada operacional da equipa. Deve mostrar prioridades e estado geral do negocio, sem obrigar a abrir cada modulo.

### Cards principais

Cards no topo:

- Hoje
- Proximos 7 dias
- Por receber
- Recebido

Regras sugeridas:

- `Hoje` deve incluir festas, servicos externos e workshops com data igual ao dia atual.
- `Proximos 7 dias` deve incluir os tres modulos.
- `Por receber` deve excluir eventos cancelados e participantes cancelados.
- `Recebido` deve excluir eventos cancelados e participantes cancelados.

### Secoes por area

O Dashboard deve ter tres blocos claros:

#### Festas no Espaco

Mostrar:

- proximas festas;
- valores recebidos;
- valores por receber;
- estado das festas;
- estado dos pagamentos;
- botao `Ver festas`.

Fonte:

- `venue_events`

#### Servicos Externos

Mostrar:

- proximos servicos;
- valores recebidos;
- valores por receber;
- estado dos eventos externos;
- estado dos pagamentos;
- servicos incluidos quando houver espaco;
- botao `Ver servicos`.

Fonte:

- `external_events`
- `external_event_services`

#### Workshops/Formacoes

Mostrar:

- proximos workshops;
- inscricoes ativas;
- vagas livres;
- valores recebidos;
- valores por receber;
- estado dos workshops;
- botao `Ver workshops`.

Fonte:

- `workshops`
- `workshop_participants`

### Agenda operacional

Criar uma lista unica ordenada por data e hora com:

- festas no espaco;
- servicos externos;
- workshops/formacoes.

Cada item deve mostrar:

- data;
- hora;
- tipo;
- cliente ou nome;
- local, quando existir;
- pagamento;
- proxima acao.

Exemplos de proxima acao:

- Cobrar sinal
- Cobrar restante
- Preparar evento
- Confirmar detalhes
- Ver participantes
- Concluido
- Cancelado

## 3. Calendario V2

O Calendario deve juntar os tres modulos, mas distinguir claramente o que ocupa o espaco fisico.

### Festas no Espaco

Regras:

- aparecem no calendario;
- ocupam slots do espaco;
- contam para dias livres/quase cheios/lotados;
- eventos cancelados devem aparecer apenas se houver filtro para cancelados, ou ficar ocultos por defeito.

Fonte:

- `venue_events`

### Servicos Externos

Regras:

- aparecem no calendario operacional;
- nao ocupam slots do espaco;
- devem ter indicacao visual `nao ocupa espaco`;
- ajudam a planear equipa, materiais, deslocacoes e horarios.

Fonte:

- `external_events`

### Workshops/Formacoes

Regras:

- aparecem no calendario;
- podem ocupar o espaco quando `location` for `Espaco Girafinha` ou equivalente;
- podem nao ocupar o espaco se forem realizados fora;
- devem mostrar vagas/inscricoes quando houver espaco visual.

Fonte:

- `workshops`
- `workshop_participants`

### Visual recomendado

Usar badges/cores por tipo:

- Festa no Espaco: rosa
- Servico Externo: azul
- Workshop/Formacao: violeta

Estados por dia:

- Dia livre
- Dia com eventos
- Quase cheio
- Lotado

Legenda:

- Livre
- Ocupa espaco
- Nao ocupa espaco
- Workshop
- Cancelado, se visivel

## 4. Relatorios V2

Os Relatorios devem apoiar decisoes internas, faturacao mensal e planeamento comercial.

### Geral

Indicadores:

- receita total;
- recebido;
- por receber;
- numero de eventos;
- ticket medio.

Regras:

- excluir cancelados da receita ativa;
- separar recebido e por receber;
- permitir filtros por mes, ano e intervalo personalizado.

### Por area

Separar claramente:

- Festas no Espaco;
- Servicos Externos;
- Workshops/Formacoes.

Cada area deve mostrar:

- numero de eventos;
- receita;
- recebido;
- por receber;
- ticket medio;
- evolucao mensal.

### Festas no Espaco

Relatorios uteis:

- packs mais vendidos;
- receita por pack;
- numero medio de criancas;
- origem dos clientes;
- temas mais comuns, se vier a ser util;
- taxa de pagamento: pago, parcial, por pagar.

Fonte:

- `venue_events`

### Servicos Externos

Relatorios uteis:

- servicos mais vendidos;
- combinacoes de servicos;
- receita por tipo de servico;
- ticket medio;
- numero medio de convidados;
- locais/tipos de evento mais frequentes, se for util.

Fonte:

- `external_events`
- `external_event_services`

### Workshops/Formacoes

Relatorios uteis:

- workshops realizados;
- inscricoes;
- vagas ocupadas;
- vagas livres;
- taxa de ocupacao;
- recebido;
- por receber;
- participantes pagos/parciais/por pagar;
- workshops mais vendidos.

Fonte:

- `workshops`
- `workshop_participants`

Regras:

- participantes cancelados nao contam para ocupacao;
- participantes cancelados nao contam para receita ativa;
- `amount_paid` conta para recebido;
- `amount_due` conta para por receber.

## 5. Estrategia de implementacao

### Fase 5.1

Plano tecnico.

Resultado:

- documento de orientacao da Fase 5;
- decisoes sobre agregacao de dados;
- divisao clara entre Dashboard, Calendario e Relatorios.

### Fase 5.2

Dashboard V2 ligado aos novos modulos.

Implementar:

- endpoint agregado ou hooks coordenados;
- cards principais;
- secoes por area;
- agenda operacional unificada;
- links para as paginas reais.

### Fase 5.3

Calendario V2 ligado aos novos modulos.

Implementar:

- eventos de festas;
- eventos externos sem ocupar espaco;
- workshops com regra de ocupacao por `location`;
- legenda e badges por tipo;
- estados do dia.

### Fase 5.4

Relatorios V2 ligados aos novos modulos.

Implementar:

- filtros por mes, ano e intervalo;
- resumo geral;
- relatorios por area;
- metricas especificas de festas, servicos externos e workshops.

### Fase 5.5

Polimento visual, mobile e testes.

Implementar:

- refinamento visual;
- revisao mobile;
- estados vazios;
- mensagens claras;
- validacao de valores.

### Fase 5.6

Commits finais e preparacao para futura publicacao.

Implementar:

- commits pequenos e seguros;
- typecheck;
- checklist antes de deploy futuro;
- confirmar migrations aplicadas no Supabase antes de publicar.

## 6. Riscos e decisoes

### Como juntar dados de tabelas diferentes

Dashboard, Calendario e Relatorios precisam de cruzar dados de varios modulos.

Risco:

- duplicar calculos no frontend;
- criar diferencas entre Dashboard e Relatorios;
- aumentar complexidade de manutencao.

Decisao recomendada:

- centralizar agregacoes importantes no backend.

### Endpoints agregados vs multiplos hooks no frontend

Opcao A: criar endpoints agregados no backend:

- `/api/dashboard`
- `/api/calendar`
- `/api/reports`

Vantagens:

- regras de negocio num so lugar;
- menos duplicacao;
- melhor performance;
- respostas ja prontas para UI;
- mais facil testar calculos.

Desvantagens:

- mais trabalho no backend;
- precisa definir contratos OpenAPI novos.

Opcao B: calcular tudo no frontend com multiplas chamadas:

- `useListVenueEvents`
- `useListExternalEvents`
- `useListWorkshops`

Vantagens:

- mais rapido para prototipar;
- menos endpoints novos;
- reaproveita hooks existentes.

Desvantagens:

- duplica calculos;
- mais dificil garantir consistencia;
- pode fazer chamadas desnecessarias;
- relatorios ficam pesados no browser.

Recomendacao clara:

Criar endpoints agregados no backend para Dashboard, Calendario e Relatorios.

O frontend deve focar-se em apresentacao. Os calculos de recebido, por receber, ocupacao e estado operacional devem viver no backend, porque sao regras de negocio.

### Como calcular recebido e por receber

Festas:

- recebido = `amount_paid`
- por receber = `max(total_price - amount_paid, 0)`
- excluir `status = cancelled`

Servicos Externos:

- recebido = `amount_paid`
- por receber = `max(total_price - amount_paid, 0)`
- excluir `status = cancelled`

Workshops:

- recebido = soma de `workshop_participants.amount_paid`
- por receber = soma de `workshop_participants.amount_due`
- excluir participantes `cancelled`
- excluir workshops `cancelled`

### Como evitar duplicar logica

Criar helpers de dominio partilhados no backend, por exemplo:

- calcular pagamento;
- normalizar eventos;
- construir agenda unificada;
- calcular ocupacao;
- filtrar cancelados.

### Como manter `/reservations` como legado

Manter `/reservations` acessivel, mas fora do centro da navegacao operacional da V2.

Uso recomendado:

- arquivo;
- consulta historica;
- migracao manual;
- comparacao durante transicao.

Nao usar:

- Dashboard V2;
- Calendario V2;
- Relatorios V2.

### Performance

Riscos:

- carregar listas completas em todos os ecras;
- relatorios ficarem lentos com muitos dados;
- multiplas chamadas em paralelo desnecessarias.

Mitigacao:

- endpoints agregados com filtros por periodo;
- indices ja existentes por data/status;
- respostas especificas por pagina;
- pagina de relatorios deve pedir apenas o periodo selecionado.

### Eventos cancelados

Regras:

- nao entram em receita ativa;
- nao entram em ocupacao ativa;
- podem aparecer em relatorios se houver filtro especifico;
- podem aparecer visualmente como cancelados em detalhe, mas nao devem inflacionar metricas.

## 7. Recomendacao tecnica

Recomendacao principal:

Criar endpoints agregados no backend:

- `GET /api/dashboard`
- `GET /api/calendar`
- `GET /api/reports`

Ou, se preferirmos manter compatibilidade com os nomes atuais:

- `GET /api/dashboard/stats-v2`
- `GET /api/dashboard/agenda-v2`
- `GET /api/calendar/v2`
- `GET /api/reports/v2`

Preferencia:

Usar nomes limpos da V2 se a app antiga ja nao depender dos endpoints atuais. Se ainda houver risco, criar endpoints `*-v2` temporarios e depois substituir com calma.

### Porque backend

O backend deve calcular:

- totais;
- recebido;
- por receber;
- ocupacao;
- cancelados;
- participantes ativos;
- combinacoes de servicos;
- agenda unificada.

O frontend deve:

- chamar endpoints;
- apresentar cards, listas e graficos;
- controlar filtros;
- lidar com loading, erro e estados vazios.

### Prós

- mais consistente;
- mais facil testar;
- melhor performance;
- reduz duplicacao;
- evita divergencias entre Dashboard, Calendario e Relatorios.

### Contras

- exige novos contratos OpenAPI/Zod/client;
- exige mais cuidado ao desenhar respostas;
- precisa manter endpoints antigos ate a V2 estar estavel.

## 8. Plano de testes

Testes recomendados:

- Dashboard mostra dados de festas;
- Dashboard mostra dados de servicos externos;
- Dashboard mostra dados de workshops;
- Dashboard soma recebido e por receber corretamente;
- Agenda operacional ordena festas, servicos e workshops por data/hora;
- Calendario mostra festas no espaco;
- Calendario mostra servicos externos como nao ocupando o espaco;
- Calendario mostra workshops;
- Workshop no Espaco Girafinha conta como ocupacao do espaco;
- Workshop fora do espaco nao ocupa slot do espaco;
- Relatorios calculam valores corretamente;
- Relatorios separam resultados por area;
- Packs de festas aparecem corretamente;
- Servicos externos mais vendidos aparecem corretamente;
- Workshops mostram vagas, inscricoes e taxa de ocupacao;
- eventos cancelados nao entram em receita ativa;
- participantes cancelados nao contam para ocupacao;
- filtros de mes/ano/intervalo funcionam;
- mobile funciona;
- `corepack pnpm run typecheck` passa.

## Estrategia recomendada

Implementar a Fase 5 em pequenas partes, mantendo Dashboard, Calendario e Relatorios independentes ate todos estarem estaveis.

Ordem recomendada:

1. Criar contratos agregados no backend.
2. Implementar Dashboard V2.
3. Implementar Calendario V2.
4. Implementar Relatorios V2.
5. Fazer polimento visual e testes.
6. Fazer commits seguros por fase.

Esta abordagem evita misturar calculos de negocio no frontend e prepara a app para uso real no subdominio de reservas.
