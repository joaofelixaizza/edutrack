# Gestão de Avaliações e Provas

## Purpose
Acompanhamento centralizado de datas críticas, exames, provas e prazos acadêmicos, oferecendo contagem regressiva e controle de desempenho sem sobrecarga desnecessária.

## Requirements

### Requirement: Cadastro e Listagem de Provas
O sistema MUST permitir que o estudante cadastre suas avaliações vinculadas a disciplinas com data, horário, tipo e observações.

#### Scenario: Nova prova cadastrada
- **WHEN** O estudante informa título, disciplina, data e hora da avaliação
- **THEN** A prova é registrada e listada com destaque para a proximidade da data

### Requirement: Contagem Regressiva e Alertas
O dashboard MUST exibir de forma imediata o tempo restante (dias e horas) para as próximas avaliações.

#### Scenario: Exibição no painel
- **WHEN** Existem provas agendadas para os próximos dias
- **THEN** O dashboard exibe cards com cronômetro regressivo ordenado pelas datas mais próximas

### Requirement: Registro de Desempenho
O sistema MUST registrar a nota obtida pelo estudante após a realização da prova para histórico de aproveitamento.

#### Scenario: Atualização de nota
- **WHEN** A prova foi realizada e o usuário informa a nota
- **THEN** O sistema armazena a pontuação e atualiza os indicadores de rendimento da disciplina
