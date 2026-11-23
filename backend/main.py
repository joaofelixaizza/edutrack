"""
Backend API FastAPI - EduTrack Provas
Módulo de Gerenciamento, Autenticação e CRUD com Isolamento Estrito por Usuário
"""

import os
import base64
import hashlib
import hmac
import json
import random
import re
import secrets
import smtplib
import threading
import time
from datetime import datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import List, Optional

from dotenv import load_dotenv
import requests as _requests  # usado pela IA Tutora

# Carrega variáveis do .env
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"))

from fastapi import FastAPI, Depends, HTTPException, status, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import create_engine, Column, Integer, String, DateTime
from sqlalchemy.orm import declarative_base, sessionmaker, Session

# ==========================================
# CONEXÃO COM O BANCO DE DADOS
# ==========================================
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_SQLITE_PATH = os.path.join(BASE_DIR, "edutrack.db").replace("\\", "/")
DEFAULT_SQLITE_URL = f"sqlite:///{DEFAULT_SQLITE_PATH}"
DATABASE_URL = os.getenv("DATABASE_URL", DEFAULT_SQLITE_URL)

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

SECRET_KEY = os.getenv("SECRET_KEY", "edutrack-secret-key-2026-secure-jwt-replacement")

# ==========================================
# MODELOS DE BANCO DE DADOS (SQLALCHEMY)
# ==========================================
class UsuarioDB(Base):
    __tablename__ = "usuarios"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    nome = Column(String(100), nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=False)
    senha = Column(String(255), nullable=False)
    data_criacao = Column(DateTime, default=datetime.utcnow)

class DisciplinaDB(Base):
    __tablename__ = "disciplinas"

    id = Column(String(50), primary_key=True, index=True)
    user_id = Column(Integer, nullable=False, index=True)
    name = Column(String(100), nullable=False)
    code = Column(String(20), nullable=True, default="")
    professor = Column(String(100), nullable=True, default="")
    workloadHours = Column(Integer, default=80)
    color = Column(String(30), default="#10b981")
    data_criacao = Column(DateTime, default=datetime.utcnow)

class ProvaDB(Base):
    __tablename__ = "provas"

    id = Column(String(50), primary_key=True, index=True)
    user_id = Column(Integer, nullable=False, index=True)
    subjectId = Column(String(50), nullable=True, default="")
    title = Column(String(150), nullable=False)
    type = Column(String(30), default="PROVA")  # PROVA, REDACAO, SIMULADO, TRABALHO
    date = Column(String(20), nullable=False)
    time = Column(String(10), default="08:00")
    estimatedMinutes = Column(Integer, default=90)
    realMinutes = Column(Integer, default=0)
    status = Column(String(20), default="PENDING")  # PENDING, COMPLETED
    notes = Column(String(500), default="")
    data_criacao = Column(DateTime, default=datetime.utcnow)

class TarefaDB(Base):
    __tablename__ = "tarefas"

    id = Column(String(50), primary_key=True, index=True)
    user_id = Column(Integer, nullable=False, index=True)
    subjectId = Column(String(50), nullable=True, default="")
    title = Column(String(150), nullable=False)
    dueDate = Column(String(20), nullable=False)
    estimatedMinutes = Column(Integer, default=30)
    realMinutes = Column(Integer, default=0)
    status = Column(String(20), default="PENDING")
    data_criacao = Column(DateTime, default=datetime.utcnow)

class EstudoLogDB(Base):
    __tablename__ = "estudos_logs"

    id = Column(String(50), primary_key=True, index=True)
    user_id = Column(Integer, nullable=False, index=True)
    subjectId = Column(String(50), nullable=True, default="")
    date = Column(String(20), nullable=False)
    minutes = Column(Integer, default=0)
    data_criacao = Column(DateTime, default=datetime.utcnow)

class HistoricoSenhaDB(Base):
    __tablename__ = "historico_senhas"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, nullable=False, index=True)
    senha = Column(String(255), nullable=False)
    data_criacao = Column(DateTime, default=datetime.utcnow)

# Cria as tabelas automaticamente se não existirem
Base.metadata.create_all(bind=engine)

# ==========================================
# UTILITÁRIOS DE TOKEN (HMAC-SHA256)
# ==========================================
def create_access_token(user_id: int, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "nonce": secrets.token_hex(8),
        "exp": int(time.time()) + 86400 * 30  # 30 dias de validade
    }
    raw = json.dumps(payload, separators=(',', ':')).encode('utf-8')
    b64_payload = base64.urlsafe_b64encode(raw).decode('utf-8').rstrip('=')
    signature = hmac.new(SECRET_KEY.encode('utf-8'), b64_payload.encode('utf-8'), hashlib.sha256).hexdigest()
    return f"{b64_payload}.{signature}"

def verify_token(token: str) -> Optional[dict]:
    try:
        parts = token.split('.')
        if len(parts) != 2:
            return None
        b64_payload, signature = parts
        expected_sig = hmac.new(SECRET_KEY.encode('utf-8'), b64_payload.encode('utf-8'), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(signature, expected_sig):
            return None
        rem = len(b64_payload) % 4
        padded = b64_payload + ('=' * (4 - rem) if rem else '')
        raw = base64.urlsafe_b64decode(padded)
        payload = json.loads(raw.decode('utf-8'))
        if payload.get("exp", 0) < int(time.time()):
            return None
        return payload
    except Exception:
        return None

# ==========================================
# ESQUEMAS PYDANTIC
# ==========================================
class UsuarioCreate(BaseModel):
    nome: str
    email: str
    senha: str

class UsuarioLogin(BaseModel):
    email: str
    senha: str

class UsuarioUpdate(BaseModel):
    nome: Optional[str] = None
    email: Optional[str] = None
    senha: Optional[str] = None

class UsuarioResponse(BaseModel):
    id: int
    nome: str
    email: str
    token: Optional[str] = None
    data_criacao: datetime

    class Config:
        from_attributes = True

class ProvaCreate(BaseModel):
    id: Optional[str] = None
    subjectId: Optional[str] = ""
    title: str
    type: Optional[str] = "PROVA"
    date: str
    time: Optional[str] = "08:00"
    estimatedMinutes: Optional[int] = 90
    realMinutes: Optional[int] = 0
    status: Optional[str] = "PENDING"
    notes: Optional[str] = ""

class DisciplinaCreate(BaseModel):
    id: Optional[str] = None
    name: str
    code: Optional[str] = ""
    professor: Optional[str] = ""
    workloadHours: Optional[int] = 80
    color: Optional[str] = "#10b981"

class TarefaCreate(BaseModel):
    id: Optional[str] = None
    subjectId: Optional[str] = ""
    title: str
    dueDate: str
    estimatedMinutes: Optional[int] = 30
    realMinutes: Optional[int] = 0
    status: Optional[str] = "PENDING"

class SyncDataPayload(BaseModel):
    subjects: Optional[List[dict]] = []
    exams: Optional[List[dict]] = []
    tasks: Optional[List[dict]] = []
    studyLogs: Optional[List[dict]] = []

class EsqueciSenhaRequest(BaseModel):
    email: str
    nova_senha: str

class EnviarCodigoRequest(BaseModel):
    email: str

class VerificarCodigoRequest(BaseModel):
    email: str
    codigo: str

class RedefinirSenhaComCodigoRequest(BaseModel):
    email: str
    codigo: str
    nova_senha: str

class DeletarPorEmailRequest(BaseModel):
    email: str
    senha: str

class RegistroIniciarRequest(BaseModel):
    nome: str
    email: str
    senha: str

class RegistroConfirmarRequest(BaseModel):
    email: str
    codigo: str

# ==========================================
# ARMAZENAMENTO TEMPORÁRIO DE CÓDIGOS DE RESET
# ==========================================
# Estrutura: { "email@exemplo.com": { "codigo": "123456", "expira_em": timestamp } }
reset_codes_store: dict = {}

# Armazenamento de registros pendentes (aguardando verificação de email)
# Estrutura: { "email@exemplo.com": { "nome": str, "senha": str, "codigo": str, "expira_em": timestamp } }
pending_registrations: dict = {}

# Configuração SMTP do Gmail
SMTP_EMAIL = os.getenv("SMTP_EMAIL", "EdutrackProvas@gmail.com")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_HOST = "smtp.gmail.com"
SMTP_PORT = 587

# Configuracao Gemini AI
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

# ==========================================
# INICIALIZAÇÃO FASTAPI & CORS
# ==========================================
app = FastAPI(
    title="EduTrack API - Provas e Usuários",
    description="API com autenticação, persistência e isolamento completo de dados por usuário.",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Dependência da sessão de banco
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Injeção de dependência do usuário autenticado
def get_current_user(
    authorization: Optional[str] = Header(None),
    x_auth_token: Optional[str] = Header(None, alias="X-Auth-Token"),
    db: Session = Depends(get_db)
) -> UsuarioDB:
    token = None
    if authorization:
        if authorization.lower().startswith("bearer "):
            token = authorization[7:].strip()
        else:
            token = authorization.strip()
    elif x_auth_token:
        token = x_auth_token.strip()

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token de autenticação não fornecido. Por favor, realize login."
        )

    payload = verify_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido ou expirado."
        )

    user = db.query(UsuarioDB).filter(UsuarioDB.id == payload["sub"]).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuário associado a esta sessão não foi encontrado."
        )
    return user

# ==========================================
# ROTAS GERAIS & AUTENTICAÇÃO
# ==========================================

@app.get("/")
def home():
    return {
        "status": "online",
        "app": "EduTrack Provas API",
        "version": "2.0.0",
        "docs": "/docs",
        "database": "SQLite" if DATABASE_URL.startswith("sqlite") else "MySQL"
    }

# ==========================================
# REGRAS DE VALIDAÇÃO DE SEGURANÇA (E-MAIL E SENHA)
# ==========================================
EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$")
COMMON_WEAK_PASSWORDS = {
    "12345678", "123456789", "1234567890", "password", "senha123", "qwerty123",
    "admin123", "11111111", "00000000", "87654321", "abcdefgh", "brasil123",
    "12312312", "mudar123", "trocar123", "master123"
}

def validar_formato_email(email: str):
    email = (email or "").strip()
    if not email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="O e-mail é obrigatório.")
    if len(email) > 100:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="O e-mail deve ter no máximo 100 caracteres.")
    if not EMAIL_REGEX.match(email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Por favor, insira um formato de e-mail válido (ex: seu.nome@dominio.com)."
        )
    partes = email.split("@")
    if len(partes) != 2 or "." not in partes[1]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="O domínio do e-mail é inválido. Digite um e-mail com domínio completo (ex: seu.nome@dominio.com)."
        )
    extensao = partes[1].split(".")[-1]
    if len(extensao) < 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A extensão do e-mail é inválida. Use um formato como .com ou .com.br."
        )

def validar_complexidade_senha(senha: str):
    if not senha or len(senha) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A senha deve ter no mínimo 8 caracteres."
        )
    if senha.lower() in COMMON_WEAK_PASSWORDS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Esta senha é muito fraca e previsível. Crie uma senha combinando letras maiúsculas, minúsculas, números e caracteres especiais."
        )
    if not re.search(r"[A-Z]", senha):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A senha deve conter pelo menos uma letra maiúscula (A-Z)."
        )
    if not re.search(r"[a-z]", senha):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A senha deve conter pelo menos uma letra minúscula (a-z)."
        )
    if not re.search(r"[0-9]", senha):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A senha deve conter pelo menos um número (0-9)."
        )
    if not re.search(r"[^a-zA-Z0-9\s]", senha):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A senha deve conter pelo menos um caractere especial (ex: @, #, $, %, etc.)."
        )

@app.post("/usuarios/", response_model=UsuarioResponse, status_code=status.HTTP_201_CREATED, summary="Cadastrar Usuário")
def criar_usuario(usuario: UsuarioCreate, db: Session = Depends(get_db)):
    """Cria um novo usuário garantindo unicidade do e-mail e gerando token inicial."""
    validar_formato_email(usuario.email)
    validar_complexidade_senha(usuario.senha)

    existente = db.query(UsuarioDB).filter(UsuarioDB.email == usuario.email).first()
    if existente:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email já cadastrado no sistema."
        )
    
    novo_usuario = UsuarioDB(**usuario.model_dump())
    db.add(novo_usuario)
    db.commit()
    db.refresh(novo_usuario)

    # Registra no histórico inicial de senhas
    db.add(HistoricoSenhaDB(user_id=novo_usuario.id, senha=novo_usuario.senha))
    db.commit()
    
    token = create_access_token(novo_usuario.id, novo_usuario.email)
    return {
        "id": novo_usuario.id,
        "nome": novo_usuario.nome,
        "email": novo_usuario.email,
        "token": token,
        "data_criacao": novo_usuario.data_criacao
    }

@app.post("/auth/login", response_model=UsuarioResponse, summary="Autenticação de Usuário")
def login_usuario(dados: UsuarioLogin, db: Session = Depends(get_db)):
    """Valida e-mail e senha e retorna o usuário acompanhado do token de autenticação."""
    usuario = db.query(UsuarioDB).filter(
        UsuarioDB.email == dados.email,
        UsuarioDB.senha == dados.senha
    ).first()

    if not usuario:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="E-mail ou senha incorretos."
        )
        
    token = create_access_token(usuario.id, usuario.email)
    return {
        "id": usuario.id,
        "nome": usuario.nome,
        "email": usuario.email,
        "token": token,
        "data_criacao": usuario.data_criacao
    }

@app.get("/auth/me", response_model=UsuarioResponse, summary="Dados do Usuário Autenticado")
def get_me(current_user: UsuarioDB = Depends(get_current_user)):
    return current_user

# ==========================================
# VERIFICAÇÃO DE EMAIL NO CADASTRO
# ==========================================

@app.post("/auth/registro-iniciar", summary="Etapa 1 do Cadastro: Enviar Código de Verificação")
def registro_iniciar(dados: RegistroIniciarRequest, db: Session = Depends(get_db)):
    """Valida dados, guarda registro pendente e envia código de verificação por e-mail."""
    validar_formato_email(dados.email)
    validar_complexidade_senha(dados.senha)

    # Verifica se email já está em uso
    existente = db.query(UsuarioDB).filter(UsuarioDB.email == dados.email).first()
    if existente:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="E-mail já cadastrado no sistema.")

    if not dados.nome.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Nome não pode ser vazio.")

    # Gera código de 6 dígitos
    codigo = str(random.randint(100000, 999999))
    email_key = dados.email.lower()

    # Armazena registro pendente por 2 minutos
    pending_registrations[email_key] = {
        "nome": dados.nome.strip(),
        "email": dados.email,
        "senha": dados.senha,
        "codigo": codigo,
        "expira_em": int(time.time()) + 120
    }

    # Envia email em thread separada (não trava a resposta)
    threading.Thread(target=_enviar_email_verificacao, args=(dados.email, dados.nome.strip(), codigo), daemon=True).start()

    return {"mensagem": f"Código de verificação enviado para {dados.email}.", "email_enviado": True}


@app.post("/auth/registro-confirmar", response_model=UsuarioResponse, summary="Etapa 2 do Cadastro: Confirmar Código e Criar Conta")
def registro_confirmar(dados: RegistroConfirmarRequest, db: Session = Depends(get_db)):
    """Valida o código, cria o usuário no banco e retorna o token de acesso."""
    email_key = dados.email.lower()
    pending = pending_registrations.get(email_key)

    if not pending:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Nenhum cadastro pendente para este e-mail. Reinicie o processo.")

    if int(time.time()) > pending["expira_em"]:
        del pending_registrations[email_key]
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Código expirado. Faça o cadastro novamente.")

    if dados.codigo.strip() != pending["codigo"]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Código incorreto. Verifique e tente novamente.")

    # Verifica novamente se email não foi cadastrado enquanto aguardava
    existente = db.query(UsuarioDB).filter(UsuarioDB.email == pending["email"]).first()
    if existente:
        del pending_registrations[email_key]
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="E-mail já cadastrado.")

    # Cria o usuário
    novo_usuario = UsuarioDB(nome=pending["nome"], email=pending["email"], senha=pending["senha"])
    db.add(novo_usuario)
    db.commit()
    db.refresh(novo_usuario)

    # Registra no histórico de senhas
    db.add(HistoricoSenhaDB(user_id=novo_usuario.id, senha=novo_usuario.senha))
    db.commit()

    # Remove pendência
    del pending_registrations[email_key]

    token = create_access_token(novo_usuario.id, novo_usuario.email)
    return {
        "id": novo_usuario.id,
        "nome": novo_usuario.nome,
        "email": novo_usuario.email,
        "token": token,
        "data_criacao": novo_usuario.data_criacao
    }

# ==========================================
# ROTAS DE CARREGAMENTO & SINCRONIZAÇÃO ISOLADA
# ==========================================

@app.get("/dados/", summary="Carregar Dados Exclusivos do Usuário Logado")
def obter_dados_usuario(
    current_user: UsuarioDB = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Retorna única e exclusivamente os registros pertencentes ao usuário logado.
    Se a conta acabou de ser criada, todas as listas retornam vazias [].
    """
    subjects = db.query(DisciplinaDB).filter(DisciplinaDB.user_id == current_user.id).all()
    exams = db.query(ProvaDB).filter(ProvaDB.user_id == current_user.id).all()
    tasks = db.query(TarefaDB).filter(TarefaDB.user_id == current_user.id).all()
    study_logs = db.query(EstudoLogDB).filter(EstudoLogDB.user_id == current_user.id).all()

    return {
        "user": {
            "id": str(current_user.id),
            "name": current_user.nome,
            "email": current_user.email,
            "grade": "Estudante",
            "goalHoursWeekly": 20,
            "avatarUrl": None
        },
        "subjects": [
            {
                "id": s.id,
                "name": s.name,
                "code": s.code,
                "professor": s.professor,
                "workloadHours": s.workloadHours,
                "color": s.color
            } for s in subjects
        ],
        "exams": [
            {
                "id": e.id,
                "subjectId": e.subjectId,
                "title": e.title,
                "type": e.type,
                "date": e.date,
                "time": e.time,
                "estimatedMinutes": e.estimatedMinutes,
                "realMinutes": e.realMinutes,
                "status": e.status,
                "notes": e.notes
            } for e in exams
        ],
        "tasks": [
            {
                "id": t.id,
                "subjectId": t.subjectId,
                "title": t.title,
                "dueDate": t.dueDate,
                "estimatedMinutes": t.estimatedMinutes,
                "realMinutes": t.realMinutes,
                "status": t.status
            } for t in tasks
        ],
        "studyLogs": [
            {
                "id": l.id,
                "subjectId": l.subjectId,
                "date": l.date,
                "minutes": l.minutes
            } for l in study_logs
        ]
    }

@app.post("/dados/sincronizar", summary="Sincronizar Dados do Usuário")
def sincronizar_dados_usuario(
    payload: SyncDataPayload,
    current_user: UsuarioDB = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Atualiza e salva as listas de dados do usuário autenticado no banco,
    garantindo que todo INSERT/UPDATE seja vinculado ao user_id do usuário logado.
    """
    # 1. Sincroniza Disciplinas
    if payload.subjects is not None:
        db.query(DisciplinaDB).filter(DisciplinaDB.user_id == current_user.id).delete()
        for s in payload.subjects:
            db.add(DisciplinaDB(
                id=str(s.get("id") or f"sub-{secrets.token_hex(6)}"),
                user_id=current_user.id,
                name=s.get("name", ""),
                code=s.get("code", ""),
                professor=s.get("professor", ""),
                workloadHours=int(s.get("workloadHours") or 80),
                color=s.get("color", "#10b981")
            ))

    # 2. Sincroniza Provas & Avaliações
    if payload.exams is not None:
        db.query(ProvaDB).filter(ProvaDB.user_id == current_user.id).delete()
        for e in payload.exams:
            db.add(ProvaDB(
                id=str(e.get("id") or f"ex-{secrets.token_hex(6)}"),
                user_id=current_user.id,
                subjectId=e.get("subjectId", ""),
                title=e.get("title", ""),
                type=e.get("type", "PROVA"),
                date=e.get("date", ""),
                time=e.get("time", "08:00"),
                estimatedMinutes=int(e.get("estimatedMinutes") or 90),
                realMinutes=int(e.get("realMinutes") or 0),
                status=e.get("status", "PENDING"),
                notes=e.get("notes", "")
            ))

    # 3. Sincroniza Tarefas
    if payload.tasks is not None:
        db.query(TarefaDB).filter(TarefaDB.user_id == current_user.id).delete()
        for t in payload.tasks:
            db.add(TarefaDB(
                id=str(t.get("id") or f"tsk-{secrets.token_hex(6)}"),
                user_id=current_user.id,
                subjectId=t.get("subjectId", ""),
                title=t.get("title", ""),
                dueDate=t.get("dueDate", ""),
                estimatedMinutes=int(t.get("estimatedMinutes") or 30),
                realMinutes=int(t.get("realMinutes") or 0),
                status=t.get("status", "PENDING")
            ))

    # 4. Sincroniza Histórico de Estudo (Pomodoro)
    if payload.studyLogs is not None:
        db.query(EstudoLogDB).filter(EstudoLogDB.user_id == current_user.id).delete()
        for l in payload.studyLogs:
            db.add(EstudoLogDB(
                id=str(l.get("id") or f"log-{secrets.token_hex(6)}"),
                user_id=current_user.id,
                subjectId=l.get("subjectId", ""),
                date=l.get("date", ""),
                minutes=int(l.get("minutes") or 0)
            ))

    db.commit()
    return {"status": "ok", "mensagem": "Dados salvos e sincronizados com sucesso."}

# ==========================================
# ROTAS CRUD INDIVIDUAIS DE PROVAS / AVALIAÇÕES
# ==========================================

@app.get("/provas/", summary="Listar Provas do Usuário Logado")
def listar_provas(
    current_user: UsuarioDB = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retorna somente as provas do usuário autenticado."""
    return db.query(ProvaDB).filter(ProvaDB.user_id == current_user.id).all()

@app.post("/provas/", status_code=status.HTTP_201_CREATED, summary="Criar Prova")
def criar_prova(
    prova: ProvaCreate,
    current_user: UsuarioDB = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Insere uma nova prova vinculando obrigatoriamente user_id = current_user.id."""
    nova_prova = ProvaDB(
        id=prova.id or f"ex-{secrets.token_hex(6)}",
        user_id=current_user.id,
        subjectId=prova.subjectId,
        title=prova.title,
        type=prova.type,
        date=prova.date,
        time=prova.time,
        estimatedMinutes=prova.estimatedMinutes,
        realMinutes=prova.realMinutes,
        status=prova.status,
        notes=prova.notes
    )
    db.add(nova_prova)
    db.commit()
    db.refresh(nova_prova)
    return nova_prova

@app.delete("/provas/{prova_id}", summary="Excluir Prova")
def excluir_prova(
    prova_id: str,
    current_user: UsuarioDB = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Exclui a prova garantindo que ela pertence ao usuário logado."""
    prova = db.query(ProvaDB).filter(
        ProvaDB.id == prova_id,
        ProvaDB.user_id == current_user.id
    ).first()
    if not prova:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Avaliação não encontrada ou não pertence a este usuário."
        )
    db.delete(prova)
    db.commit()
    return {"mensagem": "Avaliação excluída com sucesso."}

# ==========================================
# RECUPERAÇÃO DE SENHA (3 ETAPAS COM EMAIL)
# ==========================================

def _enviar_email_smtp(destinatario: str, assunto: str, html_body: str, texto_simples: str):
    """Função base para envio de emails via Gmail SMTP."""
    if not SMTP_PASSWORD or SMTP_PASSWORD == "COLE_SUA_SENHA_DE_APP_AQUI":
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Servidor de e-mail não configurado. Configure SMTP_PASSWORD no arquivo .env"
        )
    msg = MIMEMultipart("alternative")
    msg["Subject"] = assunto
    msg["From"] = f"EduTrack Provas <{SMTP_EMAIL}>"
    msg["To"] = destinatario
    msg.attach(MIMEText(texto_simples, "plain", "utf-8"))
    msg.attach(MIMEText(html_body, "html", "utf-8"))
    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_EMAIL, SMTP_PASSWORD)
            server.sendmail(SMTP_EMAIL, destinatario, msg.as_string())
    except smtplib.SMTPAuthenticationError:
        raise HTTPException(status_code=500, detail="Falha na autenticação SMTP. Verifique a Senha de App no .env")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao enviar e-mail: {str(e)}")


def _enviar_email_verificacao(destinatario: str, nome: str, codigo: str):
    """Envia email de verificação de cadastro."""
    html = f"""
    <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#ffffff;border-radius:16px;border:1px solid #e2e8f0;">
      <div style="text-align:center;margin-bottom:20px;">
        <span style="font-size:32px">✅</span>
        <h2 style="color:#1e293b;font-size:22px;margin:8px 0;">Confirme seu e-mail</h2>
        <p style="color:#64748b;font-size:14px;">Olá, <strong>{nome}</strong>! Use o código abaixo para confirmar seu cadastro no EduTrack Provas.</p>
      </div>
      <div style="text-align:center;background:#f0fdf4;border:2px dashed #10b981;border-radius:12px;padding:20px;margin:20px 0;">
        <span style="font-size:36px;font-weight:800;letter-spacing:8px;color:#059669;">{codigo}</span>
      </div>
      <p style="text-align:center;color:#94a3b8;font-size:12px;">Este código expira em <strong>15 minutos</strong>.<br>Se não foi você, ignore este e-mail.</p>
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0;">
      <p style="text-align:center;color:#cbd5e1;font-size:11px;">EduTrack Provas &copy; 2026</p>
    </div>"""
    _enviar_email_smtp(destinatario, f"✅ EduTrack Provas - Confirme seu cadastro: {codigo}", html,
                       f"Olá {nome}! Seu código de verificação do EduTrack Provas é: {codigo}. Expira em 15 minutos.")


def _enviar_email_codigo(destinatario: str, codigo: str):
    """Envia o código de recuperação de senha por email via Gmail SMTP."""
    html = f"""
    <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#ffffff;border-radius:16px;border:1px solid #e2e8f0;">
      <div style="text-align:center;margin-bottom:20px;">
        <span style="font-size:32px">🔐</span>
        <h2 style="color:#1e293b;font-size:22px;margin:8px 0;">Código de Verificação</h2>
        <p style="color:#64748b;font-size:14px;">Use o código abaixo para redefinir sua senha no EduTrack Provas.</p>
      </div>
      <div style="text-align:center;background:#f0fdf4;border:2px dashed #10b981;border-radius:12px;padding:20px;margin:20px 0;">
        <span style="font-size:36px;font-weight:800;letter-spacing:8px;color:#059669;">{codigo}</span>
      </div>
      <p style="text-align:center;color:#94a3b8;font-size:12px;">Este código expira em <strong>10 minutos</strong>.<br>Se não foi você, ignore este e-mail.</p>
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0;">
      <p style="text-align:center;color:#cbd5e1;font-size:11px;">EduTrack Provas &copy; 2026</p>
    </div>"""
    _enviar_email_smtp(destinatario, f"🔐 EduTrack Provas - Código de Verificação: {codigo}", html,
                       f"Seu código de verificação do EduTrack Provas é: {codigo}. Expira em 10 minutos.")


@app.post("/auth/enviar-codigo", summary="Etapa 1: Enviar Código de Verificação por E-mail")
def enviar_codigo_reset(dados: EnviarCodigoRequest, db: Session = Depends(get_db)):
    """Gera um código de 6 dígitos, armazena temporariamente e envia por e-mail."""
    validar_formato_email(dados.email)

    usuario = db.query(UsuarioDB).filter(UsuarioDB.email == dados.email).first()
    if not usuario:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Nenhuma conta encontrada com este e-mail."
        )

    # Gera código de 6 dígitos
    codigo = str(random.randint(100000, 999999))

    # Armazena com expiração de 10 minutos
    reset_codes_store[dados.email.lower()] = {
        "codigo": codigo,
        "expira_em": int(time.time()) + 600  # 10 minutos
    }

    # Envia por e-mail
    threading.Thread(target=_enviar_email_codigo, args=(dados.email, codigo), daemon=True).start()

    return {
        "mensagem": f"Código de verificação enviado para {dados.email}.",
        "email_enviado": True
    }


@app.post("/auth/verificar-codigo", summary="Etapa 2: Verificar Código de Verificação")
def verificar_codigo_reset(dados: VerificarCodigoRequest):
    """Valida se o código informado é correto e ainda está dentro da validade."""
    email_key = dados.email.lower()
    stored = reset_codes_store.get(email_key)

    if not stored:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nenhum código foi solicitado para este e-mail. Solicite um novo código."
        )

    if int(time.time()) > stored["expira_em"]:
        del reset_codes_store[email_key]
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Código expirado. Solicite um novo código."
        )

    if dados.codigo.strip() != stored["codigo"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Código incorreto. Verifique e tente novamente."
        )

    return {"mensagem": "Código verificado com sucesso!", "verificado": True}


@app.post("/auth/redefinir-senha", summary="Etapa 3: Redefinir Senha com Código Verificado")
def redefinir_senha_com_codigo(dados: RedefinirSenhaComCodigoRequest, db: Session = Depends(get_db)):
    """Redefine a senha após verificação do código. Remove o código após uso."""
    email_key = dados.email.lower()
    stored = reset_codes_store.get(email_key)

    if not stored:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nenhum código válido encontrado. Solicite um novo código."
        )

    if int(time.time()) > stored["expira_em"]:
        del reset_codes_store[email_key]
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Código expirado. Solicite um novo código."
        )

    if dados.codigo.strip() != stored["codigo"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Código incorreto."
        )

    validar_formato_email(dados.email)
    validar_complexidade_senha(dados.nova_senha)

    usuario = db.query(UsuarioDB).filter(UsuarioDB.email == dados.email).first()
    if not usuario:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Nenhuma conta encontrada com este e-mail."
        )

    # Verifica se a nova senha e igual a senha atual
    if dados.nova_senha == usuario.senha:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A nova senha não pode ser igual à sua senha atual. Escolha uma senha diferente."
        )

    # Verifica se a nova senha foi usada nas ultimas 5 senhas
    ultimas_senhas = db.query(HistoricoSenhaDB).filter(
        HistoricoSenhaDB.user_id == usuario.id
    ).order_by(HistoricoSenhaDB.id.desc()).limit(5).all()

    for h in ultimas_senhas:
        if h.senha == dados.nova_senha:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Você não pode reutilizar nenhuma das suas últimas 5 senhas anteriores. Escolha uma nova senha."
            )

    # Armazena a senha anterior no historico
    db.add(HistoricoSenhaDB(user_id=usuario.id, senha=usuario.senha))

    usuario.senha = dados.nova_senha
    db.commit()

    # Remove o código usado
    del reset_codes_store[email_key]

    return {"mensagem": "Senha redefinida com sucesso! Você já pode entrar com a nova senha."}


# Mantém endpoint legado para compatibilidade
@app.post("/auth/esqueci-senha", summary="Redefinir Senha (Legado)", include_in_schema=False)
def redefinir_senha_legado(dados: EsqueciSenhaRequest, db: Session = Depends(get_db)):
    """Endpoint legado — redireciona para o novo fluxo."""
    usuario = db.query(UsuarioDB).filter(UsuarioDB.email == dados.email).first()
    if not usuario:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Nenhuma conta encontrada com este e-mail."
        )
    usuario.senha = dados.nova_senha
    db.commit()
    return {"mensagem": "Senha redefinida com sucesso! Você já pode entrar com a nova senha."}

@app.post("/auth/deletar-conta", summary="Deletar Conta e Dados Associados")
def deletar_conta_por_email(dados: DeletarPorEmailRequest, db: Session = Depends(get_db)):
    """Valida as credenciais e remove permanentemente a conta e todos os seus dados do banco."""
    usuario = db.query(UsuarioDB).filter(
        UsuarioDB.email == dados.email,
        UsuarioDB.senha == dados.senha
    ).first()
    if not usuario:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="E-mail ou senha incorretos para exclusão da conta."
        )

    # Exclui todos os dados atrelados a este usuário
    db.query(DisciplinaDB).filter(DisciplinaDB.user_id == usuario.id).delete()
    db.query(ProvaDB).filter(ProvaDB.user_id == usuario.id).delete()
    db.query(TarefaDB).filter(TarefaDB.user_id == usuario.id).delete()
    db.query(EstudoLogDB).filter(EstudoLogDB.user_id == usuario.id).delete()
    db.delete(usuario)
    db.commit()
    return {"mensagem": "Conta e todos os dados associados foram excluídos com sucesso!"}

# ==========================================
# ENDPOINT: IA TUTORA (Gemini API REST)
# ==========================================

class IAChatRequest(BaseModel):
    mensagem: str
    historico: Optional[List[dict]] = []

_SYSTEM_PROMPT = (
    "Você é a IA Tutora do EduTrack Provas, especialista em ensino fundamental, médio e vestibulares brasileiros (ENEM, FUVEST, etc.).\n"
    "DIRETRIZES FUNDAMENTAIS PARA SUAS RESPOSTAS:\n"
    "1. CLAREZA E OBJETIVIDADE: Vá direto ao ponto. Explique o conceito de forma didática, simples e sem rodeios ou jargões desnecessários.\n"
    "2. FÓRMULAS E CONTAS: Sempre destaque a fórmula principal de forma clara e visível (usando notação padrão ou LaTeX $$...$$) e explique o significado e unidade de cada variável (ex: v_m = velocidade média em m/s).\n"
    "3. EXEMPLO PRÁTICO RÁPIDO: Sempre que relevante, inclua um exemplo curto e fácil de entender com números para ilustrar.\n"
    "4. FORMATAÇÃO: Use negrito para conceitos essenciais, tópicos com marcadores e espaçamento limpo para facilitar a leitura rápida do estudante."
)

_ai_session = _requests.Session()

@app.post("/ia/chat")
def ia_chat(dados: IAChatRequest, current_user: UsuarioDB = Depends(get_current_user)):
    if not GEMINI_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="GEMINI_API_KEY não configurada. Adicione GEMINI_API_KEY=SuaChave no arquivo backend/.env"
        )
    # Modelo principal de alta capacidade (Flash completo) com fallback
    MODELOS = [
        "gemini-3-flash-preview",
        "gemini-3.5-flash-lite",
        "gemini-3.8-flash",
    ]
    contents = []
    for msg in (dados.historico or []):
        role = msg.get("role", "user")
        text = msg.get("text", "")
        if role in ("user", "model") and text:
            contents.append({"role": role, "parts": [{"text": text}]})
    contents.append({"role": "user", "parts": [{"text": dados.mensagem}]})
    payload = {
        "system_instruction": {"parts": [{"text": _SYSTEM_PROMPT}]},
        "contents": contents,
        "generationConfig": {"temperature": 0.6, "maxOutputTokens": 2048}
    }
    ultimo_erro = "Nenhum modelo disponível"
    
    # Tenta diretamente os modelos compatíveis com retry automático
    for modelo in MODELOS:
        url = (
            f"https://generativelanguage.googleapis.com/v1beta/models/"
            f"{modelo}:generateContent?key={GEMINI_API_KEY}"
        )
        for tentativa in range(2):
            try:
                resp = _requests.post(url, json=payload, timeout=18)
                if resp.status_code == 200:
                    data = resp.json()
                    cands = data.get("candidates", [])
                    if cands and "content" in cands[0] and "parts" in cands[0]["content"]:
                        texto = cands[0]["content"]["parts"][0].get("text", "")
                        if texto:
                            return {"resposta": texto, "modelo": modelo}
                
                # Se for 503 (alta demanda) ou 429 (limite por minuto), aguarda brevemente e tenta novamente
                if resp.status_code in (503, 429):
                    time.sleep(1.5)
                    continue

                data_err = resp.json().get("error", {})
                ultimo_erro = data_err.get("message", f"HTTP {resp.status_code}")
                break
            except _requests.exceptions.Timeout:
                ultimo_erro = f"Tempo esgotado no modelo {modelo}"
                continue
            except Exception as e:
                ultimo_erro = str(e)
                break
    
    raise HTTPException(
        status_code=502,
        detail=f"Erro da API Gemini: {ultimo_erro}"
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
