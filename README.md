# EduTrack AI 🎓

Projeto da disciplina **Innovation Lab – Faculdade Impacta de Tecnologia**  
- **Autores:**  
  - Pedro Henrique Felix Aizza da Silva  
  - João Vitor Felix Aizza da Silva (`joao.felix@aluno.impacta.edu.br`)  
- **Ano:** 2025/2026  
- **Documentação Completa:** [ESPECIFICACAO_COMPLETA_EDUTRACK.pdf](./ESPECIFICACAO_COMPLETA_EDUTRACK.pdf)  

---

## 📖 Sobre o Projeto

O **EduTrack** é uma plataforma inteligente de estudos e acompanhamento acadêmico com suporte a provas, disciplinas, tarefas, histórico de notas e uma **IA Tutora** integrada para resolução de dúvidas e questões de vestibulares/concursos.

---

## ⚙️ Requisitos

- **Python 3.10+** — [python.org/downloads](https://www.python.org/downloads/)
- **Navegador Web** (Chrome, Firefox, Edge, etc.)
- **Conexão com internet** (para a IA Tutora e envio de e-mails de recuperação de senha)

---

## 🚀 Instalação e Execução

### 1. Clone o repositório

```bash
git clone https://github.com/joaofelixaizza/edutrack.git
cd edutrack
```

### 2. Instale as dependências

Abra o terminal na pasta do projeto e execute:

```bash
pip install -r requirements.txt
```

### 3. Configure as variáveis de ambiente

Copie o arquivo `.env.example` para `.env` dentro da pasta `backend/`:

```bash
cp backend/.env.example backend/.env
```

Abra o arquivo `backend/.env` e configure:

```env
SMTP_EMAIL=seu-email@gmail.com
SMTP_PASSWORD=sua-senha-de-app        # Senha de App do Google
GEMINI_API_KEY=sua-chave-gemini      # Chave da API Gemini (gratuita)
```

> **Como gerar Senha de App do Gmail:**
> 1. Acesse [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
> 2. Escolha "Outro" e nomeie como "EduTrack"
> 3. Cole a senha gerada em `SMTP_PASSWORD`

> **Como obter a chave Gemini:**
> 1. Acesse [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
> 2. Clique em "Create API key"
> 3. Cole em `GEMINI_API_KEY`

### 4. Inicie o projeto

#### Opção A — Script automático (Windows)
Dê duplo clique em **`iniciar.bat`**

#### Opção B — Manual (2 terminais)

**Terminal 1 — Backend:**
```bash
cd backend
python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

**Terminal 2 — Frontend:**
```bash
python -m http.server 8080 --directory frontend
```

### 5. Acesse no navegador

Acesse: **[http://localhost:8080](http://localhost:8080)**

---

## 📁 Estrutura do Projeto

```
edutrack/
├── backend/
│   ├── main.py            # API FastAPI (autenticação, CRUD, IA Tutora)
│   ├── .env.example       # Modelo de variáveis de ambiente
│   └── edutrack.db        # Banco de dados SQLite (gerado na execução)
├── frontend/
│   ├── index.html         # Interface web
│   ├── app.js             # Lógica e integração com API
│   └── styles.css         # Estilização
├── docs/
│   └── ESPECIFICACAO.md   # Documentação e regras de negócio
├── iniciar.bat            # Script de inicialização rápida
├── requirements.txt       # Dependências Python
├── .gitignore             # Arquivos ignorados pelo Git
└── README.md              # Documentação principal
```

---

## ✨ Principais Funcionalidades

| Funcionalidade | Descrição |
|---|---|
| 🔐 **Autenticação Segura** | Cadastro com código por e-mail, validação de senha forte, histórico de senhas |
| 📊 **Dashboard Dinâmico** | Estatísticas de horas de estudo, metas e contagem regressiva |
| 📅 **Gestão de Provas** | Datas, notas, cálculo de médias e pesos |
| 📚 **Disciplinas Customizadas** | Paleta de cores, carga horária e progresso visual |
| ✅ **Tarefas & Exercícios** | Organização com prioridades e prazos |
| 🤖 **IA Tutora (Gemini)** | Tira-dúvidas com fórmulas renderizadas em KaTeX e suporte a vestibulares |
| 🌙 **Tema Escuro & Claro** | Interface moderna responsiva |

---

## 🛠️ Tecnologias Utilizadas

- **Frontend:** HTML5, CSS3, Tailwind CSS (CDN), JavaScript Vanilla, KaTeX, Phosphor Icons
- **Backend:** Python 3, FastAPI, SQLAlchemy, SQLite, Uvicorn
- **Inteligência Artificial:** Google Gemini API
- **Versionamento & Ambiente:** Git, GitHub, VS Code

---

## 📄 Licença

Projeto desenvolvido para fins educacionais - **Faculdade Impacta** © 2026.
