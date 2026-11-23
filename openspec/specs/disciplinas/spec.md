# Gestão de Disciplinas

## Purpose
Organização visual e estrutural das matérias cursadas pelo estudante, permitindo categorização de provas, tarefas e métricas de horas de estudo.

## Requirements

### Requirement: Cadastro de Matérias com Paleta de Cores
O estudante MUST poder cadastrar disciplinas definindo nome, professor, meta de horas semanais e selecionando uma cor dentre a paleta de opções.

#### Scenario: Criação de matéria com cor personalizada
- **WHEN** O usuário seleciona uma cor da paleta (Verde, Vermelho, Amarelo, Azul, Laranja, Roxo) e salva a disciplina
- **THEN** A disciplina é criada e seus cards/provas adotam o acento de cor correspondente

### Requirement: Métricas e Progresso de Estudos
O sistema MUST calcular e exibir o progresso de tarefas e horas de estudo dedicadas a cada disciplina.

#### Scenario: Visualização do card de disciplina
- **WHEN** O usuário acessa a aba de disciplinas
- **THEN** Cada disciplina exibe seu anel de progresso, total de provas atreladas e tarefas pendentes
