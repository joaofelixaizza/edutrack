# IA Tutora Acadêmica

## Purpose
Assistente inteligente integrado para estudantes do Ensino Médio e Vestibulares, auxiliando no esclarecimento de dúvidas, explicação de conceitos complexos e resolução passo a passo de exercícios com notação matemática rigorosa.

## Requirements

### Requirement: Tira-dúvidas Multidisciplinar
O assistente inteligente MUST responder prontamente a dúvidas teóricas e práticas sobre disciplinas do Ensino Médio e vestibulares.

#### Scenario: Pergunta sobre conceito ou questão de vestibular
- **WHEN** O estudante envia uma pergunta ou solicita a criação de questão estilo Mackenzie/ENEM
- **THEN** A IA formula uma resposta clara, didática e aprofundada com dicas pedagógicas

### Requirement: Renderização de Fórmulas Matemáticas e Físicas
O frontend MUST exibir fórmulas e equações científicas com tipografia matemática formatada através do KaTeX.

#### Scenario: Resposta contendo equações LaTeX
- **WHEN** A IA retorna expressões delimitadas por `$$` (bloco) ou `$` (inline)
- **THEN** A interface web renderiza os símbolos gregos, frações e expoentes formatados visualmente via KaTeX

### Requirement: Resiliência e Concorrência da API
O backend MUST gerenciar chaves e modelos da Google Gemini API, tratando oscilações de demanda sem interrupções.

#### Scenario: Pico momentâneo de demanda
- **WHEN** O modelo primário atinge indisponibilidade temporária (503/429)
- **THEN** O backend executa retry com backoff e chaveia automaticamente para modelos de fallback compatíveis
