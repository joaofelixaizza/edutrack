# Autenticação e Segurança de Usuário

## Purpose
Gerenciamento de contas de estudantes, garantindo autenticação segura via JWT/Session, validação rigorosa de credenciais, recuperação de senha com código por e-mail e histórico de segurança.

## Requirements

### Requirement: Registro de Conta
O sistema MUST permitir que novos estudantes se cadastrem informando nome, e-mail institucional ou pessoal e senha forte.

#### Scenario: Cadastro com sucesso
- **WHEN** O usuário envia dados válidos e senha que atende aos critérios de complexidade
- **THEN** O sistema cadastra o usuário com senha criptografada e inicia a sessão autenticada

#### Scenario: Senha fraca rejeitada
- **WHEN** O usuário tenta cadastrar uma senha com menos de 8 caracteres ou sem letras, números e símbolos
- **THEN** O sistema rejeita o cadastro e exibe os requisitos pendentes

### Requirement: Recuperação de Senha com Código por E-mail
O sistema MUST permitir que o estudante redefina sua senha através de código de 6 dígitos enviado por e-mail SMTP.

#### Scenario: Validação de código e troca de senha
- **WHEN** O usuário informa o código correto enviado por e-mail e digita uma nova senha válida
- **THEN** O sistema atualiza a senha no banco de dados e invalida o código utilizado

#### Scenario: Bloqueio de senhas anteriores
- **WHEN** O usuário tenta redefinir a senha para a senha atual ou para uma das últimas 5 senhas utilizadas
- **THEN** O sistema bloqueia a alteração informando que senhas anteriores não podem ser repetidas
