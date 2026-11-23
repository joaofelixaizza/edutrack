/**
 * EDUTRACK PROVAS - MVP APPLICATION CORE
 * Gestão de Provas, Simulados, Matérias, Pomodoro & Insights Pedagógicos
 */

// ========================================================
// UTILITÁRIO: ALTERNAR VISIBILIDADE DE SENHA
// ========================================================
function togglePasswordVisibility(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const isHidden = input.type === "password";
  input.type = isHidden ? "text" : "password";
  const icon = btn.querySelector("i");
  if (icon) {
    icon.className = isHidden ? "ph-bold ph-eye-slash text-base" : "ph-bold ph-eye text-base";
  }
}

// ========================================================
// MODO VISITANTE — LIMITE DE 1 ITEM POR TIPO
// ========================================================
function isGuest() {
  return !!(currentUser && currentUser.id === "usr-demo");
}

const GUEST_LIMITS = { subjects: 1, exams: 1, tasks: 1 };

function checkGuestLimit(tipo) {
  if (!isGuest()) return false; // não é visitante, pode criar
  const count = (appData[tipo] || []).length;
  if (count >= GUEST_LIMITS[tipo]) {
    showGuestLimitModal(tipo);
    return true; // bloqueado
  }
  return false; // dentro do limite
}

function showGuestLimitModal(tipo) {
  const nomes = { subjects: "matéria", exams: "prova", tasks: "tarefa" };
  const nome = nomes[tipo] || "item";

  const old = document.getElementById("modalGuestLimit");
  if (old) old.remove();

  const modal = document.createElement("div");
  modal.id = "modalGuestLimit";
  modal.className = "fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4";
  modal.innerHTML = `
    <div class="bg-white dark:bg-slate-900 rounded-2xl max-w-xs w-full p-8 shadow-2xl flex flex-col gap-6 text-center">
      <i class="ph-bold ph-lock-key text-4xl text-emerald-500 mx-auto"></i>
      <div class="flex flex-col gap-1">
        <h3 class="text-lg font-bold text-gray-900 dark:text-white">Crie uma conta</h3>
        <p class="text-sm text-gray-500 dark:text-gray-400">para usar o EduTrack sem limites.</p>
      </div>
      <div class="flex flex-col gap-3">
        <button onclick="guestGoToRegister()" class="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl text-sm transition">
          Criar Conta
        </button>
        <button onclick="guestGoToLogin()" class="w-full border-2 border-gray-400 dark:border-slate-500 text-gray-700 dark:text-gray-200 font-semibold py-3 rounded-xl text-sm hover:bg-gray-50 dark:hover:bg-slate-800 transition">
          Já tenho conta
        </button>
        <button onclick="document.getElementById('modalGuestLimit').remove()" class="text-xs text-gray-700 hover:text-gray-900 font-medium transition pt-1">
          Voltar
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  modal.addEventListener("click", (e) => { if (e.target === modal) modal.remove(); });
}

function guestGoToRegister() {
  document.getElementById("modalGuestLimit")?.remove();
  // Faz logout silencioso (sem toast) e vai para tela de cadastro
  currentUser = null;
  appData = createEmptyAppData();
  const appLayout = document.getElementById("appLayout");
  const authScreen = document.getElementById("authScreen");
  if (appLayout) { appLayout.classList.add("hidden"); appLayout.classList.remove("flex"); }
  if (authScreen) authScreen.classList.remove("hidden");
  // Ativa aba de Cadastro
  setAuthMode(true);
}

function guestGoToLogin() {
  document.getElementById("modalGuestLimit")?.remove();
  // Faz logout silencioso e vai para tela de login
  currentUser = null;
  appData = createEmptyAppData();
  const appLayout = document.getElementById("appLayout");
  const authScreen = document.getElementById("authScreen");
  if (appLayout) { appLayout.classList.add("hidden"); appLayout.classList.remove("flex"); }
  if (authScreen) authScreen.classList.remove("hidden");
  // Ativa aba de Login
  setAuthMode(false);
}

// ========================================================
// 1. DADOS INICIAIS & ESTADO
// ========================================================

const STORAGE_KEY = "edutrack_provas_v1";
const THEME_KEY = "edutrack_provas_theme";
const COLOR_KEY = "edutrack_provas_color";

function getOffsetDateString(daysOffset) {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

const initialMockData = {
  user: {
    id: "usr-demo",
    name: "Usuário",
    email: "visitante@edutrack.com",
    grade: "Visitante",
    goalHoursWeekly: 25,
    avatarUrl: null
  },
  subjects: [],
  exams: [],
  tasks: [],
  studyLogs: []
};

// Application State Inicial: começa rigorosamente vazio
const createEmptyAppData = () => ({
  user: null,
  subjects: [],
  exams: [],
  tasks: [],
  studyLogs: []
});

let appData = createEmptyAppData();
let currentUser = null;
let activeTab = "dashboard";
let currentTheme = localStorage.getItem(THEME_KEY) || "dark";
let currentColor = localStorage.getItem(COLOR_KEY) || "emerald";

// Preset Color Palettes for Subjects
const PALETTE_OPTIONS = [
  { label: "Verde",    hex: "#10b981" },
  { label: "Vermelho", hex: "#ef4444" },
  { label: "Amarelo",  hex: "#f59e0b" },
  { label: "Azul",     hex: "#3b82f6" },
  { label: "Laranja",  hex: "#f97316" },
  { label: "Roxo",     hex: "#8b5cf6" },
];

// ========================================================
// 2. PERSISTÊNCIA & COMUNICAÇÃO COM O BACKEND FASTAPI
// ========================================================

const API_BASE_URL = "http://127.0.0.1:8000";

async function saveData() {
  if (currentUser) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
    await syncUserDataToBackend();
  }
}

async function syncUserDataToBackend() {
  const token = sessionStorage.getItem("edutrack_token");
  if (!token) return;
  try {
    await fetch(`${API_BASE_URL}/dados/sincronizar`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        subjects: appData.subjects || [],
        exams: appData.exams || [],
        tasks: appData.tasks || [],
        studyLogs: appData.studyLogs || []
      })
    });
  } catch (err) {
    console.warn("Erro ao sincronizar dados com o backend:", err.message);
  }
}

async function fetchUserData() {
  const token = sessionStorage.getItem("edutrack_token");
  if (!token) return false;

  try {
    const res = await fetch(`${API_BASE_URL}/dados/`, {
      headers: {
        "Authorization": `Bearer ${token}`
      }
    });

    if (res.ok) {
      const data = await res.json();
      appData = {
        user: data.user || currentUser,
        subjects: Array.isArray(data.subjects) ? data.subjects : [],
        exams: Array.isArray(data.exams) ? data.exams : [],
        tasks: Array.isArray(data.tasks) ? data.tasks : [],
        studyLogs: Array.isArray(data.studyLogs) ? data.studyLogs : []
      };
      currentUser = appData.user;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
      return true;
    } else if (res.status === 401) {
      console.warn("Sessão expirada ou token inválido.");
      return false;
    }
  } catch (err) {
    console.warn("Erro ao buscar dados do usuário na API:", err.message);
  }
  return false;
}

function formatDateBR(dateStr) {
  if (!dateStr) return "--/--";
  const [yyyy, mm, dd] = dateStr.split("-");
  return `${dd}/${mm}/${yyyy}`;
}

function getDaysRemaining(dateStr) {
  if (!dateStr) return 0;
  const target = new Date(dateStr + "T00:00:00");
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diffTime = target - now;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function getUrgencyBadge(daysRemaining) {
  if (daysRemaining < 0) {
    return `<span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-500">Realizada</span>`;
  }
  if (daysRemaining === 0) {
    return `<span class="text-[10px] font-extrabold px-2 py-0.5 rounded-full badge-urgent animate-pulse">HOJE!</span>`;
  }
  if (daysRemaining <= 3) {
    return `<span class="text-[10px] font-extrabold px-2 py-0.5 rounded-full badge-urgent">Em ${daysRemaining} dias</span>`;
  }
  if (daysRemaining <= 7) {
    return `<span class="text-[10px] font-bold px-2 py-0.5 rounded-full badge-warning">Em ${daysRemaining} dias</span>`;
  }
  return `<span class="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">Em ${daysRemaining} dias</span>`;
}

function getTypeBadge(type) {
  switch (type) {
    case "PROVA":
      return `<span class="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">PROVA</span>`;
    case "SIMULADO":
      return `<span class="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">SIMULADO</span>`;
    case "REDACAO":
      return `<span class="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-violet-500/15 text-violet-400 border border-violet-500/30">REDAÇÃO</span>`;
    case "TRABALHO":
      return `<span class="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-amber-500/15 text-amber-400 border border-amber-500/30">TRABALHO</span>`;
    default:
      return `<span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-500/20 text-slate-300">AVALIAÇÃO</span>`;
  }
}



// ========================================================
// 3. TOASTS & NOTIFICAÇÕES
// ========================================================

function showToast(message, type = "success") {
  const container = document.getElementById("toastContainer");
  if (!container) return;

  const toast = document.createElement("div");
  let icon = "ph-bold ph-check-circle text-emerald-400";
  let border = "border-emerald-500/30";

  if (type === "info") {
    icon = "ph-bold ph-info text-cyan-400";
    border = "border-cyan-500/30";
  } else if (type === "warning") {
    icon = "ph-bold ph-warning text-amber-400";
    border = "border-amber-500/30";
  } else if (type === "error") {
    icon = "ph-bold ph-x-circle text-rose-400";
    border = "border-rose-500/30";
  }

  toast.className = `glass-panel ${border} text-slate-800 dark:text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-3 text-xs font-semibold pointer-events-auto animate-enter`;
  toast.innerHTML = `<i class="${icon} text-lg shrink-0"></i> <span>${message}</span>`;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(-6px)";
    toast.style.transition = "all 0.3s ease";
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}

// ========================================================
// 4. CONFIGURAÇÃO DE TEMA
// ========================================================

function applyTheme() {
  const htmlEl = document.documentElement;
  htmlEl.classList.add("dark");
}



// ========================================================
// 5. CÁLCULO DE MÉTRICAS & PROGRESSO DE ENTREGAS
// ========================================================

function calculateAllMetrics() {
  const totalExams = appData.exams.length;
  const completedExams = appData.exams.filter(e => e.status === "COMPLETED").length;
  
  const totalTasks = appData.tasks.length;
  const completedTasks = appData.tasks.filter(t => t.status === "COMPLETED").length;

  const totalItems = totalExams + totalTasks;
  const totalDone = completedExams + completedTasks;
  const overallProgress = totalItems > 0 ? Math.round((totalDone / totalItems) * 100) : 0;

  // Study hours logged this week
  const totalMinutes = appData.studyLogs.reduce((acc, l) => acc + (l.minutes || 0), 0);
  const totalHoursWeekly = Math.round((totalMinutes / 60) * 10) / 10;

  // Next nearest pending exam
  const pendingExams = appData.exams
    .filter(e => e.status === "PENDING" && e.date)
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  const nextExam = pendingExams[0] || null;

  // Subjects with completed vs total exams
  const subjectsStats = appData.subjects.map(s => {
    const relatedExams = appData.exams.filter(e => e.subjectId === s.id);
    const completedRelated = relatedExams.filter(e => e.status === "COMPLETED").length;
    const relatedTasks = appData.tasks.filter(t => t.subjectId === s.id);
    const completedTasksRelated = relatedTasks.filter(t => t.status === "COMPLETED").length;

    const subTotal = relatedExams.length + relatedTasks.length;
    const subDone = completedRelated + completedTasksRelated;
    const subProgress = subTotal > 0 ? Math.round((subDone / subTotal) * 100) : 0;

    let status = "Pendente";
    if (subTotal === 0) status = "Sem Entregas";
    else if (subDone === subTotal) status = "Em Dia";
    else if (subProgress >= 50) status = "Em Andamento";
    else status = "A Iniciar";

    return {
      ...s,
      progress: subProgress,
      status,
      totalExamsCount: relatedExams.length,
      completedExamsCount: completedRelated,
      totalTasksCount: relatedTasks.length,
      completedTasksCount: completedTasksRelated
    };
  });

  return {
    totalExams,
    completedExams,
    totalTasks,
    completedTasks,
    totalItems,
    totalDone,
    overallProgress,
    totalHoursWeekly,
    nextExam,
    subjects: subjectsStats
  };
}

// ========================================================
// 6. RENDERIZAÇÃO GERAL DO DASHBOARD & ABAS
// ========================================================

function renderAll() {
  const metrics = calculateAllMetrics();

  // Top Bar & Hero info
  const welcomeName = document.getElementById("welcomeUserName");
  if (welcomeName && currentUser) {
    welcomeName.innerText = currentUser.name.split(" ")[0];
  }

  // Quick Stats Cards
  const elProgress = document.getElementById("statGlobalProgress");
  const elProgressBar = document.getElementById("statGlobalProgressBar");
  if (elProgress) elProgress.innerText = `${metrics.overallProgress}%`;
  if (elProgressBar) elProgressBar.style.width = `${metrics.overallProgress}%`;

  const elTotalCompleted = document.getElementById("statTotalCompleted");
  if (elTotalCompleted) {
    elTotalCompleted.innerText = `${metrics.totalDone} / ${metrics.totalItems}`;
  }

  const elNextExamTitle = document.getElementById("statNextExamTitle");
  const elNextExamDays = document.getElementById("statNextExamDays");
  const elNextExamSub = document.getElementById("statNextExamSub");

  if (metrics.nextExam) {
    const sub = appData.subjects.find(s => s.id === metrics.nextExam.subjectId);
    const days = getDaysRemaining(metrics.nextExam.date);
    if (elNextExamTitle) elNextExamTitle.innerText = metrics.nextExam.title;
    if (elNextExamDays) {
      elNextExamDays.innerHTML = getUrgencyBadge(days);
    }
    if (elNextExamSub) {
      elNextExamSub.innerText = `${sub ? sub.name : "Geral"} • ${formatDateBR(metrics.nextExam.date)} às ${metrics.nextExam.time || "08:00"}`;
    }
  } else {
    if (elNextExamTitle) elNextExamTitle.innerText = "Nenhuma prova pendente!";
    if (elNextExamDays) elNextExamDays.innerHTML = `<span class="text-xs text-emerald-400 font-bold">Tudo em dia 🎉</span>`;
    if (elNextExamSub) elNextExamSub.innerText = "Parabéns, você não possui avaliações agendadas.";
  }

  // Render Sub-Sections
  renderDashboardExamsRadar(metrics);
  renderDashboardSubjectsOverview(metrics);
  renderExamsTab();
  renderSubjectsTab(metrics);
  renderTasksTab();
  updateProfileDisplays();
  renderSubjectSelectOptions();
}

function renderDashboardExamsRadar(metrics) {
  const container = document.getElementById("dashboardExamsRadarList");
  if (!container) return;

  const pending = appData.exams
    .filter(e => e.status === "PENDING")
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, 4);

  if (pending.length === 0) {
    container.innerHTML = `
      <div class="h-full min-h-[220px] flex flex-col items-center justify-center py-8 text-center gap-3 my-auto">
        <div class="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800/80 flex items-center justify-center text-3xl text-slate-400/60 dark:text-slate-500/60">
          <i class="ph-bold ph-calendar-check"></i>
        </div>
        <div>
          <p class="text-xs font-bold text-slate-600 dark:text-slate-300">Nenhuma prova ou simulado pendente no radar!</p>
          <span class="text-[11px] text-slate-400 dark:text-slate-500">Cadastre avaliações para acompanhar seus prazos aqui.</span>
        </div>
      </div>
    `;
    return;
  }

  container.innerHTML = pending.map(ex => {
    const sub = appData.subjects.find(s => s.id === ex.subjectId) || { name: "Geral", color: "#10b981" };
    const days = getDaysRemaining(ex.date);
    return `
      <div onclick="openExamDetailsModal('${ex.id}')" class="bento-card p-3.5 rounded-2xl bg-white/70 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 hover:border-emerald-500/50 flex items-center justify-between gap-3 cursor-pointer">
        <div class="flex items-center gap-3 min-w-0">
          <div class="w-2.5 h-10 rounded-full shrink-0" style="background-color: ${sub.color}"></div>
          <div class="truncate text-left">
            <div class="flex items-center gap-2 mb-0.5">
              ${getTypeBadge(ex.type)}
              <h4 class="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">${ex.title}</h4>
            </div>
            <p class="text-[11px] text-slate-500 dark:text-slate-400 truncate">
              <span class="font-medium" style="color: ${sub.color}">${sub.name}</span> • Data: ${formatDateBR(ex.date)} às ${ex.time || "08:00"}
            </p>
          </div>
        </div>
        <div class="shrink-0 text-right">
          ${getUrgencyBadge(days)}
        </div>
      </div>
    `;
  }).join("");
}

function renderDashboardSubjectsOverview(metrics) {
  const container = document.getElementById("dashboardSubjectsGrid");
  if (!container) return;

  if (metrics.subjects.length === 0) {
    container.innerHTML = `
      <div class="col-span-full h-full min-h-[220px] flex flex-col items-center justify-center py-8 text-center gap-3 my-auto">
        <div class="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800/80 flex items-center justify-center text-3xl text-slate-400/60 dark:text-slate-500/60">
          <i class="ph-bold ph-books"></i>
        </div>
        <div>
          <p class="text-xs font-bold text-slate-600 dark:text-slate-300">Nenhuma disciplina cadastrada ainda.</p>
          <span class="text-[11px] text-slate-400 dark:text-slate-500">Cadastre matérias para acompanhar o progresso dos seus estudos.</span>
        </div>
      </div>
    `;
    return;
  }

  container.innerHTML = metrics.subjects.map(s => {
    let statusClass = "text-slate-400 bg-slate-100 dark:bg-slate-800";
    if (s.status === "Em Dia") statusClass = "text-emerald-400 bg-emerald-500/10 border border-emerald-500/30";
    if (s.status === "Em Andamento") statusClass = "text-cyan-400 bg-cyan-500/10 border border-cyan-500/30";
    if (s.status === "A Iniciar") statusClass = "text-amber-400 bg-amber-500/10 border border-amber-500/30";

    return `
      <div onclick="switchTab('subjects')" class="bento-card p-4 rounded-2xl bg-white/70 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 flex flex-col justify-between cursor-pointer">
        <div>
          <div class="flex items-start justify-between gap-2 mb-2">
            <div class="flex items-center gap-2 min-w-0">
              <span class="w-3 h-3 rounded-full shrink-0" style="background-color: ${s.color}"></span>
              <h4 class="font-bold text-xs text-slate-800 dark:text-slate-100 truncate">${s.name}</h4>
            </div>
            <span class="text-[10px] font-extrabold px-2 py-0.5 rounded-md ${statusClass} shrink-0">${s.status}</span>
          </div>
          <p class="text-[11px] text-slate-500 dark:text-slate-400 truncate mb-3"><i class="ph-bold ph-chalkboard-teacher"></i> ${s.professor || "Docente"}</p>
        </div>

        <div>
          <div class="flex items-center justify-between text-xs mb-1">
            <span class="text-[11px] text-slate-400">Progresso</span>
            <span class="text-xs font-extrabold text-slate-800 dark:text-white">${s.progress}%</span>
          </div>
          <div class="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div class="h-full rounded-full transition-all duration-500" style="width: ${s.progress}%; background-color: ${s.color};"></div>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

// ========================================================
// 7. ABA: PROVAS & AVALIAÇÕES (COMPLETA)
// ========================================================

function renderExamsTab() {
  const container = document.getElementById("examsTabContainer");
  if (!container) return;

  const filterSubject = document.getElementById("filterExamSubject") ? document.getElementById("filterExamSubject").value : "ALL";
  const filterStatus = document.getElementById("filterExamStatus") ? document.getElementById("filterExamStatus").value : "ALL";
  const filterType = document.getElementById("filterExamType") ? document.getElementById("filterExamType").value : "ALL";

  let list = [...appData.exams];
  if (filterSubject !== "ALL") list = list.filter(e => e.subjectId === filterSubject);
  if (filterStatus !== "ALL") list = list.filter(e => e.status === filterStatus);
  if (filterType !== "ALL") list = list.filter(e => e.type === filterType);

  // Sort by date (pending first, nearest first)
  list.sort((a, b) => {
    if (a.status !== b.status) return a.status === "PENDING" ? -1 : 1;
    return new Date(a.date) - new Date(b.date);
  });

  const countBadge = document.getElementById("examsCountBadge");
  if (countBadge) countBadge.innerText = `${list.length} avaliações`;

  if (list.length === 0) {
    container.innerHTML = `
      <div class="py-12 text-center text-slate-400 text-xs bg-white/40 dark:bg-slate-900/30 rounded-3xl border border-dashed border-slate-300 dark:border-slate-800 flex flex-col items-center gap-3">
        <i class="ph-bold ph-exam text-4xl text-slate-400"></i>
        <span>Nenhuma prova ou avaliação encontrada com os filtros selecionados.</span>
        <button onclick="openNewExamModal()" class="btn-primary-gradient px-4 py-2 rounded-xl text-xs font-bold shadow-md">
          + Cadastrar Nova Prova
        </button>
      </div>
    `;
    return;
  }

  container.innerHTML = list.map(ex => {
    const sub = appData.subjects.find(s => s.id === ex.subjectId) || { name: "Geral", color: "#10b981" };
    const isCompleted = ex.status === "COMPLETED";
    const days = getDaysRemaining(ex.date);

    return `
      <div class="bento-card p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900/80 border ${isCompleted ? "border-slate-200 dark:border-slate-800/80 opacity-80" : "border-slate-200 dark:border-slate-800 hover:border-emerald-500/40"} flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition shadow-xs">
        <div class="flex items-start gap-3.5 min-w-0">
          <div class="w-11 h-11 rounded-2xl flex items-center justify-center text-white text-xl shrink-0 shadow-md font-bold" style="background: linear-gradient(135deg, ${sub.color}, #0f172a);">
            <i class="ph-bold ph-exam"></i>
          </div>
          <div class="truncate text-left">
            <div class="flex items-center gap-2 flex-wrap mb-1">
              ${getTypeBadge(ex.type)}
              <h3 class="text-sm font-bold text-slate-800 dark:text-white truncate ${isCompleted ? "line-through text-slate-400" : ""}">${ex.title}</h3>
            </div>
            <div class="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
              <span class="font-bold" style="color: ${sub.color}">${sub.name}</span>
              <span>•</span>
              <span class="flex items-center gap-1"><i class="ph-bold ph-calendar"></i> ${formatDateBR(ex.date)} às ${ex.time || "08:00"}</span>
              <span>•</span>
              <span>Duração: ${ex.estimatedMinutes || 90}m</span>
            </div>
          </div>
        </div>

        <div class="flex items-center gap-2.5 self-end sm:self-center shrink-0">
          ${!isCompleted ? getUrgencyBadge(days) : `<span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Concluída</span>`}
          
          <button onclick="openExamDetailsModal('${ex.id}')" class="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition">
            Detalhes
          </button>

          ${!isCompleted ? `
            <button onclick="openCompleteExamModal('${ex.id}')" class="btn-primary-gradient px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 shadow-xs">
              <i class="ph-bold ph-check"></i> Concluir
            </button>
          ` : `
            <button onclick="toggleExamStatus('${ex.id}')" class="px-3 py-1.5 rounded-xl text-xs font-bold text-amber-500 hover:bg-amber-500/10 transition">
              Reabrir
            </button>
          `}
        </div>
      </div>
    `;
  }).join("");
}

// ========================================================
// 8. ABA: MINHAS DISCIPLINAS (COMPLETA)
// ========================================================

function renderSubjectsTab(metrics) {
  const container = document.getElementById("subjectsTabGrid");
  if (!container) return;

  if (metrics.subjects.length === 0) {
    container.innerHTML = `
      <div class="col-span-full py-12 text-center text-slate-400 text-xs bg-white/40 dark:bg-slate-900/30 rounded-3xl border border-dashed border-slate-300 dark:border-slate-800 flex flex-col items-center gap-3">
        <i class="ph-bold ph-books text-4xl text-slate-400"></i>
        <span>Nenhuma disciplina cadastrada na sua grade.</span>
        <button onclick="openNewSubjectModal()" class="btn-primary-gradient px-4 py-2 rounded-xl text-xs font-bold shadow-md">
          + Cadastrar Minha Primeira Matéria
        </button>
      </div>
    `;
    return;
  }

  container.innerHTML = metrics.subjects.map(s => {
    const color = s.color || "#10b981";
    const progress = Math.min(100, Math.max(0, s.progress || 0));

    // Cor mais clara para o header (hex com opacidade via rgba)
    const hexToRgb = h => {
      if (!h || !h.startsWith('#') || h.length < 7) return "16,185,129";
      const r = parseInt(h.slice(1,3),16) || 16;
      const g = parseInt(h.slice(3,5),16) || 185;
      const b = parseInt(h.slice(5,7),16) || 129;
      return `${r},${g},${b}`;
    };
    const rgb = hexToRgb(color);

    return `
      <div class="rounded-3xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 flex flex-col shadow-md hover:shadow-lg transition-shadow overflow-hidden" style="border-top: none;">

        <!-- Header colorido -->
        <div style="background: linear-gradient(135deg, rgba(${rgb},0.18) 0%, rgba(${rgb},0.07) 100%); border-top: 5px solid ${color}; padding: 18px 20px 14px 20px;">
          <div class="flex items-start justify-between gap-3">
            <div class="flex-1 min-w-0">
              <span class="text-[10px] font-extrabold px-2.5 py-1 rounded-lg text-white shadow-sm" style="background-color:${color};">${s.code || "DISC"}</span>
              <h3 class="text-base font-extrabold text-slate-900 dark:text-white mt-2 leading-tight truncate">${s.name}</h3>
              <p class="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1.5">
                <i class="ph-bold ph-chalkboard-teacher" style="color:${color};"></i>
                <span class="truncate">${s.professor || "Docente"}</span>
              </p>
            </div>
            <!-- Círculo de progresso -->
            <div class="flex flex-col items-center flex-shrink-0">
              <div style="
                width:52px; height:52px;
                border-radius:50%;
                background: conic-gradient(${color} ${progress * 3.6}deg, #e2e8f0 0deg);
                display:flex; align-items:center; justify-content:center;
                box-shadow: 0 2px 8px rgba(${rgb},0.3);
              ">
                <div style="width:38px;height:38px;border-radius:50%;background:white;display:flex;align-items:center;justify-content:center;">
                  <span style="font-size:11px;font-weight:800;color:${color};">${progress}%</span>
                </div>
              </div>
              <span class="text-[9px] text-slate-400 mt-1 font-semibold">Progresso</span>
            </div>
          </div>

          <!-- Barra de progresso -->
          <div class="mt-3">
            <div style="height:5px;border-radius:99px;background:#e2e8f0;overflow:hidden;">
              <div style="height:100%;width:${progress}%;background:${color};border-radius:99px;transition:width 0.5s;"></div>
            </div>
          </div>
        </div>

        <!-- Corpo com stats -->
        <div style="padding: 14px 20px;">
          <div class="grid grid-cols-3 gap-2 text-center">
            <div style="background:rgba(${rgb},0.07);border-radius:12px;padding:8px 4px;">
              <i class="ph-bold ph-clock" style="color:${color};font-size:14px;"></i>
              <div class="text-[10px] text-slate-400 mt-0.5">C. Horária</div>
              <div class="text-xs font-extrabold text-slate-800 dark:text-slate-200">${s.workloadHours}h</div>
            </div>
            <div style="background:rgba(${rgb},0.07);border-radius:12px;padding:8px 4px;">
              <i class="ph-bold ph-exam" style="color:${color};font-size:14px;"></i>
              <div class="text-[10px] text-slate-400 mt-0.5">Avaliações</div>
              <div class="text-xs font-extrabold text-slate-800 dark:text-slate-200">${s.completedExamsCount}/${s.totalExamsCount}</div>
            </div>
            <div style="background:rgba(${rgb},0.07);border-radius:12px;padding:8px 4px;">
              <i class="ph-bold ph-check-square" style="color:${color};font-size:14px;"></i>
              <div class="text-[10px] text-slate-400 mt-0.5">Tarefas</div>
              <div class="text-xs font-extrabold text-slate-800 dark:text-slate-200">${s.completedTasksCount}/${s.totalTasksCount}</div>
            </div>
          </div>
        </div>

        <!-- Rodapé -->
        <div class="flex items-center justify-between px-5 pb-4 pt-1 border-t border-slate-100 dark:border-slate-800 mt-auto text-xs">
          <button onclick="openSubjectDetailsModal('${s.id}')" class="font-bold flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition" style="color:${color};background:rgba(${rgb},0.10);">
            <i class="ph-bold ph-eye text-sm"></i> Detalhes & Provas
          </button>
          <button onclick="openEditSubjectModal('${s.id}')" class="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition">
            <i class="ph-bold ph-pencil-simple text-base"></i>
          </button>
        </div>
      </div>
    `;
  }).join("");
}

// ========================================================
// 9. ABA: TAREFAS DE ESTUDO (COMPLETA)
// ========================================================

function renderTasksTab() {
  const container = document.getElementById("tasksTabContainer");
  if (!container) return;

  const list = appData.tasks;
  if (list.length === 0) {
    container.innerHTML = `
      <div class="py-10 text-center text-slate-400 text-xs">
        Nenhuma tarefa de estudo cadastrada. Clique em '+ Nova Tarefa' para começar!
      </div>
    `;
    return;
  }

  container.innerHTML = list.map(t => {
    const sub = appData.subjects.find(s => s.id === t.subjectId) || { name: "Geral", color: "#10b981" };
    const isDone = t.status === "COMPLETED";

    return `
      <div class="bento-card p-3.5 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
        <div class="flex items-center gap-3 min-w-0">
          <button onclick="toggleTaskStatus('${t.id}')" class="w-5 h-5 rounded-lg border flex items-center justify-center transition shrink-0 ${isDone ? "bg-emerald-500 border-emerald-500 text-white" : "border-slate-300 dark:border-slate-600 hover:border-emerald-400"}">
            ${isDone ? `<i class="ph-bold ph-check text-xs"></i>` : ""}
          </button>
          <div class="truncate text-left">
            <p class="text-xs font-bold truncate ${isDone ? "line-through text-slate-400" : "text-slate-800 dark:text-white"}">${t.title}</p>
            <p class="text-[11px] text-slate-500 dark:text-slate-400 truncate">
              <span class="font-semibold" style="color: ${sub.color}">${sub.name}</span> • Prazo: ${formatDateBR(t.dueDate)} • Estimado: ${t.estimatedMinutes || 30}m
            </p>
          </div>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <button onclick="deleteTask('${t.id}')" class="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/10 transition">
            <i class="ph-bold ph-trash text-sm"></i>
          </button>
        </div>
      </div>
    `;
  }).join("");
}



// ========================================================
// 12. CRUD: PROVAS & AVALIAÇÕES
// ========================================================

function openNewExamModal() {
  if (checkGuestLimit("exams")) return;
  if (appData.subjects.length === 0) {
    showToast("Cadastre pelo menos uma matéria antes de adicionar provas!", "warning");
    openNewSubjectModal();
    return;
  }

  document.getElementById("modalExamHeading").innerText = "Cadastrar Prova / Avaliação";
  document.getElementById("examFormId").value = "";
  document.getElementById("examFormTitle").value = "";
  document.getElementById("examFormDate").value = getOffsetDateString(7);
  document.getElementById("examFormTime").value = "08:00";
  document.getElementById("examFormDuration").value = "90";
  document.getElementById("examFormNotes").value = "";
  document.getElementById("examFormType").value = "PROVA";

  renderSubjectSelectOptions();
  openModal("modalExam");
}

function openEditExamModal(examId) {
  const ex = appData.exams.find(e => e.id === examId);
  if (!ex) return;

  document.getElementById("modalExamHeading").innerText = "Editar Avaliação";
  document.getElementById("examFormId").value = ex.id;
  document.getElementById("examFormSubject").value = ex.subjectId;
  document.getElementById("examFormTitle").value = ex.title;
  document.getElementById("examFormDate").value = ex.date;
  document.getElementById("examFormTime").value = ex.time || "08:00";
  document.getElementById("examFormDuration").value = ex.estimatedMinutes || 90;
  document.getElementById("examFormNotes").value = ex.notes || "";
  document.getElementById("examFormType").value = ex.type || "PROVA";

  openModal("modalExam");
}

function handleSaveExam(e) {
  e.preventDefault();
  const id = document.getElementById("examFormId").value;
  if (!id && checkGuestLimit("exams")) return;

  const subjectId = document.getElementById("examFormSubject").value;
  const title = document.getElementById("examFormTitle").value;
  const date = document.getElementById("examFormDate").value;
  const time = document.getElementById("examFormTime").value;
  const estimatedMinutes = parseInt(document.getElementById("examFormDuration").value) || 90;
  const notes = document.getElementById("examFormNotes").value;
  const type = document.getElementById("examFormType").value;

  if (id) {
    const existing = appData.exams.find(ex => ex.id === id);
    if (existing) {
      existing.subjectId = subjectId;
      existing.title = title;
      existing.date = date;
      existing.time = time;
      existing.estimatedMinutes = estimatedMinutes;
      existing.notes = notes;
      existing.type = type;
    }
    showToast("Prova atualizada com sucesso!", "success");
  } else {
    appData.exams.push({
      id: "ex-" + Date.now(),
      subjectId,
      title,
      type,
      date,
      time,
      estimatedMinutes,
      realMinutes: 0,
      status: "PENDING",
      notes
    });
    showToast("Prova cadastrada com sucesso no radar!", "success");
  }

  closeModal("modalExam");
  saveData();
  renderAll();
}

function openExamDetailsModal(examId) {
  const ex = appData.exams.find(e => e.id === examId);
  if (!ex) return;

  const sub = appData.subjects.find(s => s.id === ex.subjectId) || { name: "Geral", color: "#10b981" };
  const days = getDaysRemaining(ex.date);
  const isCompleted = ex.status === "COMPLETED";

  document.getElementById("detailExamTitle").innerText = ex.title;
  document.getElementById("detailExamSubject").innerText = sub.name;
  document.getElementById("detailExamSubject").style.color = sub.color;
  document.getElementById("detailExamTypeBadge").innerHTML = getTypeBadge(ex.type);
  document.getElementById("detailExamDate").innerText = `${formatDateBR(ex.date)} às ${ex.time || "08:00"}`;
  document.getElementById("detailExamDuration").innerText = `${ex.estimatedMinutes || 90} minutos`;
  document.getElementById("detailExamUrgency").innerHTML = !isCompleted ? getUrgencyBadge(days) : `<span class="text-xs font-bold text-emerald-400">Concluída</span>`;
  document.getElementById("detailExamNotes").innerText = ex.notes || "Nenhuma observação cadastrada para esta prova.";

  const statusTextEl = document.getElementById("detailExamStatusText");
  if (statusTextEl) {
    statusTextEl.innerText = isCompleted ? "Concluída ✓" : "Pendente";
    statusTextEl.className = isCompleted ? "text-sm font-extrabold text-emerald-400" : "text-sm font-extrabold text-amber-400";
  }

  const btnToggle = document.getElementById("detailBtnToggleComplete");
  if (btnToggle) {
    btnToggle.innerText = isCompleted ? "Reabrir Prova" : "Marcar Concluída";
    btnToggle.onclick = () => {
      closeModal("modalExamDetails");
      if (!isCompleted) {
        openCompleteExamModal(ex.id);
      } else {
        toggleExamStatus(ex.id);
      }
    };
  }

  const btnEdit = document.getElementById("detailBtnEditExam");
  if (btnEdit) {
    btnEdit.onclick = () => {
      closeModal("modalExamDetails");
      openEditExamModal(ex.id);
    };
  }

  const btnDelete = document.getElementById("detailBtnDeleteExam");
  if (btnDelete) {
    btnDelete.onclick = () => {
      closeModal("modalExamDetails");
      confirmDeleteExam(ex.id, ex.title);
    };
  }

  openModal("modalExamDetails");
}

function openCompleteExamModal(examId) {
  const ex = appData.exams.find(e => e.id === examId);
  if (!ex) return;

  document.getElementById("completeExamId").value = ex.id;
  document.getElementById("completeExamTitleLabel").innerText = ex.title;
  document.getElementById("completeExamRealMinutes").value = ex.realMinutes || ex.estimatedMinutes || 90;

  openModal("modalCompleteExam");
}

function handleCompleteExamSubmit(e) {
  e.preventDefault();
  const id = document.getElementById("completeExamId").value;
  const realMin = parseInt(document.getElementById("completeExamRealMinutes").value) || 90;

  const ex = appData.exams.find(e => e.id === id);
  if (ex) {
    ex.status = "COMPLETED";
    ex.realMinutes = realMin;
  }

  closeModal("modalCompleteExam");
  saveData();
  renderAll();
  showToast("Conclusão da prova registrada com sucesso!", "success");
}

function toggleExamStatus(examId) {
  const ex = appData.exams.find(e => e.id === examId);
  if (!ex) return;

  if (ex.status === "COMPLETED") {
    ex.status = "PENDING";
    showToast("Status da prova reaberto para Pendente.", "info");
  } else {
    ex.status = "COMPLETED";
    showToast("Prova marcada como Concluída.", "success");
  }

  saveData();
  renderAll();
}

function confirmDeleteExam(examId, title) {
  document.getElementById("confirmDeleteTitle").innerText = "Excluir Avaliação?";
  document.getElementById("confirmDeleteMessage").innerText = `A prova "${title}" será removida permanentemente.`;

  const btn = document.getElementById("btnConfirmDeleteAction");
  btn.onclick = () => {
    appData.exams = appData.exams.filter(e => e.id !== examId);
    saveData();
    renderAll();
    closeModal("modalConfirmDelete");
    showToast("Avaliação excluída com sucesso.", "info");
  };

  openModal("modalConfirmDelete");
}

// ========================================================
// 13. CRUD: MATÉRIAS & DISCIPLINAS
// ========================================================

function openNewSubjectModal() {
  if (checkGuestLimit("subjects")) return;
  document.getElementById("modalSubjectHeading").innerText = "Nova Disciplina";
  document.getElementById("subjectFormId").value = "";
  document.getElementById("subjectFormName").value = "";
  document.getElementById("subjectFormCode").value = "";
  document.getElementById("subjectFormProf").value = "";
  document.getElementById("subjectFormHours").value = "80";

  renderPaletteColorPicker("subjectColorPalette", "subjectFormColor", "#10b981");
  openModal("modalSubject");
}

function openEditSubjectModal(subjectId) {
  const s = appData.subjects.find(sub => sub.id === subjectId);
  if (!s) return;

  document.getElementById("modalSubjectHeading").innerText = "Editar Disciplina";
  document.getElementById("subjectFormId").value = s.id;
  document.getElementById("subjectFormName").value = s.name;
  document.getElementById("subjectFormCode").value = s.code || "";
  document.getElementById("subjectFormProf").value = s.professor || "";
  document.getElementById("subjectFormHours").value = s.workloadHours || 80;

  renderPaletteColorPicker("subjectColorPalette", "subjectFormColor", s.color || "#10b981");
  openModal("modalSubject");
}

function handleSaveSubject(e) {
  e.preventDefault();
  const id = document.getElementById("subjectFormId").value;
  if (!id && checkGuestLimit("subjects")) return;
  const name = document.getElementById("subjectFormName").value;
  const code = document.getElementById("subjectFormCode").value || name.substring(0, 3).toUpperCase();
  const professor = document.getElementById("subjectFormProf").value;
  const workloadHours = parseInt(document.getElementById("subjectFormHours").value) || 80;
  const color = document.getElementById("subjectFormColor").value || "#10b981";

  if (id) {
    const existing = appData.subjects.find(s => s.id === id);
    if (existing) {
      existing.name = name;
      existing.code = code;
      existing.professor = professor;
      existing.workloadHours = workloadHours;
      existing.color = color;
    }
    showToast("Disciplina atualizada!", "success");
  } else {
    appData.subjects.push({
      id: "sub-" + Date.now(),
      name,
      code,
      professor,
      workloadHours,
      color
    });
    showToast("Nova disciplina adicionada à grade!", "success");
  }

  closeModal("modalSubject");
  saveData();
  renderAll();
}

function openSubjectDetailsModal(subjectId) {
  const s = appData.subjects.find(sub => sub.id === subjectId);
  if (!s) return;

  document.getElementById("detailSubName").innerText = s.name;
  document.getElementById("detailSubProf").innerText = s.professor || "Professor(a) não informado(a)";
  document.getElementById("detailSubHours").innerText = `${s.workloadHours} horas`;

  const relatedExams = appData.exams.filter(e => e.subjectId === subjectId);
  const container = document.getElementById("detailSubExamsList");

  if (relatedExams.length === 0) {
    container.innerHTML = `<p class="text-xs text-slate-400 py-3 text-center">Nenhuma prova cadastrada para esta matéria.</p>`;
  } else {
    container.innerHTML = relatedExams.map(ex => `
      <div class="p-3 rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
        <div class="truncate text-left">
          <p class="font-bold text-slate-800 dark:text-white truncate">${ex.title}</p>
          <p class="text-[11px] text-slate-400">Data: ${formatDateBR(ex.date)} às ${ex.time || "08:00"}</p>
        </div>
        <div class="flex items-center gap-2">
          ${ex.status === "COMPLETED" ? `<span class="font-extrabold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">Concluída</span>` : `<span class="text-[10px] text-amber-400">Pendente</span>`}
        </div>
      </div>
    `).join("");
  }

  const btnDelete = document.getElementById("btnDeleteSubjectAction");
  if (btnDelete) {
    btnDelete.onclick = () => {
      closeModal("modalSubjectDetails");
      confirmDeleteSubject(s.id, s.name);
    };
  }

  openModal("modalSubjectDetails");
}

function confirmDeleteSubject(subjectId, name) {
  document.getElementById("confirmDeleteTitle").innerText = "Excluir Matéria?";
  document.getElementById("confirmDeleteMessage").innerText = `A disciplina "${name}" e todas as provas associadas serão excluídas.`;

  const btn = document.getElementById("btnConfirmDeleteAction");
  btn.onclick = () => {
    appData.subjects = appData.subjects.filter(s => s.id !== subjectId);
    appData.exams = appData.exams.filter(e => e.subjectId !== subjectId);
    appData.tasks = appData.tasks.filter(t => t.subjectId !== subjectId);
    saveData();
    renderAll();
    closeModal("modalConfirmDelete");
    showToast("Disciplina removida.", "info");
  };

  openModal("modalConfirmDelete");
}

// ========================================================
// 14. TAREFAS RÁPIDAS
// ========================================================

function openNewTaskModal() {
  if (checkGuestLimit("tasks")) return;
  if (appData.subjects.length === 0) {
    showToast("Cadastre uma matéria antes de adicionar tarefas!", "warning");
    openNewSubjectModal();
    return;
  }

  document.getElementById("taskFormTitle").value = "";
  document.getElementById("taskFormDue").value = getOffsetDateString(3);
  document.getElementById("taskFormMinutes").value = "45";

  renderSubjectSelectOptions();
  openModal("modalTask");
}

function handleSaveTask(e) {
  e.preventDefault();
  if (checkGuestLimit("tasks")) return;
  const subjectId = document.getElementById("taskFormSubject").value;
  const title = document.getElementById("taskFormTitle").value;
  const dueDate = document.getElementById("taskFormDue").value;
  const estimatedMinutes = parseInt(document.getElementById("taskFormMinutes").value) || 30;

  appData.tasks.push({
    id: "tsk-" + Date.now(),
    subjectId,
    title,
    dueDate,
    estimatedMinutes,
    realMinutes: 0,
    status: "PENDING"
  });

  closeModal("modalTask");
  saveData();
  renderAll();
  showToast("Tarefa de estudo adicionada!", "success");
}

function toggleTaskStatus(taskId) {
  const t = appData.tasks.find(tk => tk.id === taskId);
  if (!t) return;

  if (t.status === "COMPLETED") {
    t.status = "PENDING";
    showToast("Tarefa reaberta.", "info");
  } else {
    t.status = "COMPLETED";
    showToast("Tarefa concluída! Parabéns!", "success");
  }

  saveData();
  renderAll();
}

function deleteTask(taskId) {
  appData.tasks = appData.tasks.filter(t => t.id !== taskId);
  saveData();
  renderAll();
  showToast("Tarefa excluída.", "info");
}

// ========================================================
// 15. PALETAS DE CORES & SELETORES
// ========================================================

function renderPaletteColorPicker(containerId, inputId, defaultColor) {
  const container = document.getElementById(containerId);
  const input = document.getElementById(inputId);
  if (!container || !input) return;

  const selected = defaultColor || PALETTE_OPTIONS[0].hex;
  input.value = selected;

  container.innerHTML = `
    <div class="grid grid-cols-6 gap-2 w-full pt-1 pb-1">
      ${PALETTE_OPTIONS.map(c => {
        const isSel = c.hex.toLowerCase() === selected.toLowerCase();
        return `
          <button type="button"
            onclick="selectPickerColor('${containerId}', '${inputId}', '${c.hex}')"
            title="${c.label}"
            data-hex="${c.hex}"
            class="flex flex-col items-center gap-1.5 p-2 rounded-2xl transition hover:bg-slate-100 dark:hover:bg-slate-800/60 focus:outline-none">
            <span class="color-dot relative flex items-center justify-center w-9 h-9 rounded-full shadow-sm transition-all"
                  style="background-color:${c.hex}; ${isSel ? 'box-shadow: 0 0 0 3px #0f172a, 0 0 0 5px ' + c.hex + '; transform: scale(1.08);' : ''}">
              <i class="ph-bold ph-check text-white text-sm ${isSel ? '' : 'hidden'}"></i>
            </span>
            <span class="color-label text-[11px] font-bold ${isSel ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}">${c.label}</span>
          </button>
        `;
      }).join('')}
    </div>
  `;
}

function selectPickerColor(containerId, inputId, hex) {
  const input = document.getElementById(inputId);
  if (input) input.value = hex;

  const container = document.getElementById(containerId);
  if (container) {
    container.querySelectorAll("button[data-hex]").forEach(btn => {
      const btnHex = btn.getAttribute("data-hex");
      const isSelected = btnHex.toLowerCase() === hex.toLowerCase();
      const dot = btn.querySelector(".color-dot");
      const check = btn.querySelector(".ph-check");
      const label = btn.querySelector(".color-label");

      if (isSelected) {
        if (dot) {
          dot.style.boxShadow = `0 0 0 3px #0f172a, 0 0 0 5px ${btnHex}`;
          dot.style.transform = "scale(1.08)";
        }
        if (check) check.classList.remove("hidden");
        if (label) {
          label.classList.remove("text-slate-500", "dark:text-slate-400");
          label.classList.add("text-slate-900", "dark:text-white");
        }
      } else {
        if (dot) {
          dot.style.boxShadow = "none";
          dot.style.transform = "scale(1)";
        }
        if (check) check.classList.add("hidden");
        if (label) {
          label.classList.remove("text-slate-900", "dark:text-white");
          label.classList.add("text-slate-500", "dark:text-slate-400");
        }
      }
    });
  }
}

function renderSubjectSelectOptions() {
  const selectors = ["examFormSubject", "taskFormSubject", "filterExamSubject"];
  selectors.forEach(selId => {
    const el = document.getElementById(selId);
    if (!el) return;

    const currentValue = el.value;
    const isFilter = selId.startsWith("filter");

    let opts = "";
    if (isFilter) opts += `<option value="ALL">Todas as Disciplinas</option>`;

    opts += appData.subjects.map(s => `<option value="${s.id}">${s.name}</option>`).join("");
    el.innerHTML = opts || `<option value="">Nenhuma disciplina</option>`;

    if (currentValue && el.querySelector(`option[value="${currentValue}"]`)) {
      el.value = currentValue;
    }
  });
}

// ========================================================
// 16. PERFIL DE USUÁRIO & AUTH
// ========================================================

function updateProfileDisplays() {
  if (!currentUser) return;

  const names = document.querySelectorAll(".user-name-display");
  names.forEach(el => (el.innerText = currentUser.name));

  const emails = document.querySelectorAll(".user-email-display");
  emails.forEach(el => (el.innerText = currentUser.email));

  const avatarContainers = document.querySelectorAll(".user-avatar-display");
  const initials = currentUser.name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase();

  avatarContainers.forEach(container => {
    if (currentUser.avatarUrl) {
      container.innerHTML = `<img src="${currentUser.avatarUrl}" alt="Avatar" class="w-full h-full object-cover">`;
    } else {
      container.innerHTML = `<span>${initials}</span>`;
    }
  });
}

function openProfileModal() {
  if (!currentUser) return;
  document.getElementById("profileFormName").value = currentUser.name;
  document.getElementById("profileFormEmail").value = currentUser.email;
  document.getElementById("profileFormGrade").value = currentUser.grade || "3º Ano EM";
  document.getElementById("profileFormGoalHours").value = currentUser.goalHoursWeekly || 25;

  openModal("modalProfile");
}

function handleSaveProfile(e) {
  e.preventDefault();
  currentUser.name = document.getElementById("profileFormName").value;
  currentUser.email = document.getElementById("profileFormEmail").value;
  currentUser.grade = document.getElementById("profileFormGrade").value;
  currentUser.goalHoursWeekly = parseInt(document.getElementById("profileFormGoalHours").value) || 25;

  appData.user = currentUser;
  saveData();
  renderAll();
  closeModal("modalProfile");
  showToast("Perfil atualizado com sucesso!", "success");
}

// ==========================================
// VALIDAÇÃO DE SEGURANÇA: E-MAIL E SENHA FORTE
// ==========================================

function validateEmail(email) {
  if (!email || typeof email !== "string") return false;
  const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return re.test(email.trim());
}

const WEAK_PASSWORD_LIST = [
  "12345678", "123456789", "1234567890", "password", "senha123", "qwerty123",
  "admin123", "11111111", "00000000", "87654321", "abcdefgh", "brasil123",
  "12312312", "mudar123", "trocar123", "master123"
];

function validatePasswordStrength(password) {
  if (!password || password.length < 8) {
    return { isValid: false, message: "A senha deve ter no mínimo 8 caracteres." };
  }
  if (WEAK_PASSWORD_LIST.includes(password.toLowerCase())) {
    return { isValid: false, message: "Esta senha é muito fraca e comum. Crie uma senha combinando letras, números e símbolos." };
  }
  if (!/[A-Z]/.test(password)) {
    return { isValid: false, message: "A senha deve conter pelo menos uma letra maiúscula (A-Z)." };
  }
  if (!/[a-z]/.test(password)) {
    return { isValid: false, message: "A senha deve conter pelo menos uma letra minúscula (a-z)." };
  }
  if (!/[0-9]/.test(password)) {
    return { isValid: false, message: "A senha deve conter pelo menos um número (0-9)." };
  }
  if (!/[^a-zA-Z0-9\s]/.test(password)) {
    return { isValid: false, message: "A senha deve conter pelo menos um caractere especial (!, @, #, $, %, etc.)." };
  }
  return { isValid: true };
}

function updatePasswordRequirementUI(prefix, password) {
  const reqLength = document.getElementById(`req-${prefix}-length`);
  const reqCases = document.getElementById(`req-${prefix}-cases`);
  const reqNumber = document.getElementById(`req-${prefix}-number`);
  const reqSpecial = document.getElementById(`req-${prefix}-special`);

  const setItem = (el, valid, text) => {
    if (!el) return;
    if (valid) {
      el.className = "flex items-center gap-1.5 text-emerald-600 font-bold";
      el.innerHTML = `<i class="ph-bold ph-check-circle text-xs text-emerald-500"></i> ${text}`;
    } else {
      el.className = "flex items-center gap-1.5 text-gray-500";
      el.innerHTML = `<i class="ph-bold ph-circle text-[10px]"></i> ${text}`;
    }
  };

  setItem(reqLength, password.length >= 8, "Mínimo de 8 caracteres");
  setItem(reqCases, /[A-Z]/.test(password) && /[a-z]/.test(password), "Letra maiúscula e minúscula");
  setItem(reqNumber, /[0-9]/.test(password), "Pelo menos 1 número (0-9)");
  setItem(reqSpecial, /[^a-zA-Z0-9\s]/.test(password), "Pelo menos 1 caractere especial (!, @, #, $, %, etc.)");
}

function handleAuthPasswordInput(val) {
  if (isAuthRegisterMode) {
    updatePasswordRequirementUI("auth", val);
  }
}

function handleResetPasswordInput(val) {
  updatePasswordRequirementUI("reset", val);
  handleResetPasswordMatch();
}

function handleResetPasswordMatch() {
  const p1 = document.getElementById("resetStep3NovaSenha")?.value || "";
  const p2 = document.getElementById("resetStep3ConfirmaSenha")?.value || "";
  const matchErr = document.getElementById("resetMatchError");
  const input2 = document.getElementById("resetStep3ConfirmaSenha");
  const errBox = document.getElementById("resetStep3Error");

  if (!p2) {
    if (matchErr) matchErr.classList.add("hidden");
    if (input2) input2.classList.remove("border-red-500");
    return;
  }

  if (p1 !== p2) {
    if (matchErr) matchErr.classList.remove("hidden");
    if (input2) input2.classList.add("border-red-500");
  } else {
    if (matchErr) matchErr.classList.add("hidden");
    if (input2) input2.classList.remove("border-red-500");
    if (errBox) errBox.classList.add("hidden");
  }
}

// Authentication Handlers
let isAuthRegisterMode = false;

function setAuthMode(register) {
  isAuthRegisterMode = register;
  const heading = document.getElementById("authHeading");
  const subheading = document.getElementById("authSubheading");
  const btn = document.getElementById("authSubmitBtn");
  const nameGroup = document.getElementById("authFieldNameGroup");
  const tabLogin = document.getElementById("tabAuthLogin");
  const tabRegister = document.getElementById("tabAuthRegister");
  const reqBox = document.getElementById("authPasswordRequirements");

  if (isAuthRegisterMode) {
    if (heading) heading.innerText = "Crie sua conta no EduTrack";
    if (subheading) subheading.innerText = "Cadastre-se para acompanhar suas provas e prazos";
    if (btn) btn.innerText = "Criar Conta";
    if (nameGroup) nameGroup.classList.remove("hidden");
    if (reqBox) reqBox.classList.remove("hidden");
    if (tabRegister) {
      tabRegister.className = "flex-1 py-2 text-xs font-bold rounded-lg bg-emerald-600 text-white shadow-xs transition";
    }
    if (tabLogin) {
      tabLogin.className = "flex-1 py-2 text-xs font-bold rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition";
    }
  } else {
    if (heading) heading.innerText = "Bem-vindo de volta!";
    if (subheading) subheading.innerText = "Acesse sua conta para acompanhar seus estudos";
    if (btn) btn.innerText = "Entrar";
    if (nameGroup) nameGroup.classList.add("hidden");
    if (reqBox) reqBox.classList.add("hidden");
    if (tabLogin) {
      tabLogin.className = "flex-1 py-2 text-xs font-bold rounded-lg bg-emerald-600 text-white shadow-xs transition";
    }
    if (tabRegister) {
      tabRegister.className = "flex-1 py-2 text-xs font-bold rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition";
    }
  }
}

async function handleAuthSubmit(e) {
  e.preventDefault();
  const emailInput = document.getElementById("authInputEmail") || document.getElementById("email");
  const passwordInput = document.getElementById("authInputPassword") || document.getElementById("senha");
  const nameInput = document.getElementById("authInputName") || document.getElementById("name") || document.getElementById("nome");
  const submitBtn = document.getElementById("authSubmitBtn") || document.getElementById("btn-login");

  const email = emailInput ? emailInput.value.trim() : "";
  const password = passwordInput ? passwordInput.value : "";
  const name = (nameInput && nameInput.value.trim()) ? nameInput.value.trim() : (isAuthRegisterMode ? "Novo Estudante" : "Estudante");

  const originalText = submitBtn ? submitBtn.innerText : "Aguarde...";

  // Validação de formato de email
  if (!validateEmail(email)) {
    showToast("Por favor, insira um e-mail válido (ex: seu.nome@dominio.com).", "warning");
    if (emailInput) emailInput.focus();
    return;
  }

  // Validação de senha forte se for cadastro
  if (isAuthRegisterMode) {
    const strength = validatePasswordStrength(password);
    if (!strength.isValid) {
      showToast(strength.message, "warning");
      if (passwordInput) passwordInput.focus();
      return;
    }
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerText = "Conectando...";
  }

  try {
    if (isAuthRegisterMode) {
      // Mostra o modal imediatamente, envia código em background
      showEmailVerificationModal(email, name, password);

      const response = await fetch(`${API_BASE_URL}/auth/registro-iniciar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: name, email: email, senha: password })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        document.getElementById("modalEmailVerificacao")?.remove();
        throw new Error(errData.detail || "Erro ao iniciar cadastro.");
      }

      showToast(`Código enviado para ${email}!`, "info");
      return;
    } else {
      // 2. Login via API
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email, senha: password })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || "E-mail ou senha inválidos.");
      }

      const usuarioLogado = await response.json();

      // Limpar resquícios anteriores de outra conta
      localStorage.clear();
      sessionStorage.clear();

      if (usuarioLogado.token) {
        sessionStorage.setItem("edutrack_token", usuarioLogado.token);
      }
      sessionStorage.setItem("edutrack_user_id", String(usuarioLogado.id));

      currentUser = {
        id: "usr-" + usuarioLogado.id,
        name: usuarioLogado.nome,
        email: usuarioLogado.email,
        grade: "Estudante",
        goalHoursWeekly: 20,
        avatarUrl: null
      };

      // Inicia vazio e carrega estritamente os dados do banco para este usuário
      appData = {
        user: currentUser,
        subjects: [],
        exams: [],
        tasks: [],
        studyLogs: []
      };

      await fetchUserData();
      loginSuccess();
      showToast(`Bem-vindo de volta, ${currentUser.name}!`, "success");
      return;
    }
  } catch (err) {
    console.warn("Erro retornado na autenticação:", err.message);
    showToast(err.message || "Erro ao conectar.", "error");
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerText = originalText;
    }
  }
}

// ========================================================
// VERIFICAÇÃO DE EMAIL NO CADASTRO
// ========================================================

function showEmailVerificationModal(email, nome, senha) {
  const old = document.getElementById("modalEmailVerificacao");
  if (old) old.remove();

  const modal = document.createElement("div");
  modal.id = "modalEmailVerificacao";
  modal.className = "fixed inset-0 bg-black/70 backdrop-blur-sm z-[200] flex items-center justify-center p-4";
  modal.innerHTML = `
    <div class="bg-white rounded-2xl max-w-sm w-full p-8 shadow-2xl flex flex-col gap-6 text-center">
      <div>
        <div class="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-3">
          <i class="ph-bold ph-envelope-simple-open text-3xl text-emerald-600"></i>
        </div>
        <h3 class="text-xl font-bold text-gray-900">Confirme seu e-mail</h3>
        <p class="text-sm text-gray-500 mt-1">Enviamos um código de 6 dígitos para<br><strong class="text-gray-700">${email}</strong></p>
      </div>

      <div>
        <input type="text" id="emailVerifCode" maxlength="6" placeholder="000000"
          class="w-full text-center text-3xl font-bold tracking-widest py-3 px-4 bg-gray-50 border-2 border-gray-200 focus:border-emerald-500 rounded-xl focus:outline-none transition text-gray-900"
          oninput="this.value=this.value.replace(/[^0-9]/g,'')">
        <p class="text-xs text-gray-400 mt-2">O código expira em <span id="emailVerifCountdown" class="font-bold text-emerald-600">02:00</span></p>
      </div>

      <div class="flex flex-col gap-3">
        <button id="btnConfirmarEmail" onclick="handleEmailVerifSubmit('${email}')"
          class="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl text-sm transition">
          Confirmar e Entrar
        </button>
        <button onclick="reenviarCodigoVerificacao('${email}', '${nome}', '${senha}')"
          class="text-xs text-emerald-600 hover:underline font-medium transition">
          Reenviar código
        </button>
        <button onclick="document.getElementById('modalEmailVerificacao').remove(); clearInterval(window._verifTimer);"
          class="text-xs text-gray-500 hover:text-gray-700 font-medium transition">
          Cancelar
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  setTimeout(() => {
    const inp = document.getElementById("emailVerifCode");
    if (inp) inp.focus();
  }, 100);

  // Countdown de 2 minutos (120 segundos)
  let secsLeft = 120;
  if (window._verifTimer) clearInterval(window._verifTimer);
  window._verifTimer = setInterval(() => {
    secsLeft--;
    const el = document.getElementById("emailVerifCountdown");
    if (!el) { clearInterval(window._verifTimer); return; }
    if (secsLeft <= 0) {
      clearInterval(window._verifTimer);
      el.textContent = "00:00";
      el.className = "font-bold text-red-500";
      showToast("Código expirado! Clique em 'Reenviar código'.", "error");
      const btn = document.getElementById("btnConfirmarEmail");
      if (btn) { btn.disabled = true; btn.classList.add("opacity-50","cursor-not-allowed"); }
    } else {
      const m = String(Math.floor(secsLeft / 60)).padStart(2, "0");
      const s = String(secsLeft % 60).padStart(2, "0");
      el.textContent = `${m}:${s}`;
      // Fica vermelho nos últimos 30 segundos
      el.className = secsLeft <= 30
        ? "font-bold text-red-500"
        : "font-bold text-emerald-600";
    }
  }, 1000);

  // Guarda dados temporários para uso no submit
  window._pendingRegEmail = email;
  window._pendingRegNome = nome;
  window._pendingRegSenha = senha;
}

async function handleEmailVerifSubmit(email) {
  const codeInput = document.getElementById("emailVerifCode");
  const btn = document.getElementById("btnConfirmarEmail");
  const code = codeInput ? codeInput.value.trim() : "";

  if (!code || code.length !== 6) {
    showToast("Digite o código de 6 dígitos recebido no e-mail.", "warning");
    return;
  }

  if (btn) { btn.disabled = true; btn.innerText = "Verificando..."; }

  try {
    const response = await fetch(`${API_BASE_URL}/auth/registro-confirmar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email, codigo: code })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.detail || "Código inválido.");

    // Remove modal
    document.getElementById("modalEmailVerificacao")?.remove();

    // Faz login com os dados retornados
    localStorage.clear();
    sessionStorage.clear();
    if (data.token) sessionStorage.setItem("edutrack_token", data.token);
    sessionStorage.setItem("edutrack_user_id", String(data.id));

    currentUser = {
      id: "usr-" + data.id,
      name: data.nome,
      email: data.email,
      grade: "Estudante",
      goalHoursWeekly: 20,
      avatarUrl: null
    };
    appData = { user: currentUser, subjects: [], exams: [], tasks: [], studyLogs: [] };
    await saveData();

    // Mostra mensagem de sucesso e entra sem alert duplicado
    showSuccessBanner("🎉 Conta criada com sucesso! Bem-vindo ao EduTrack Provas.");
    loginSuccess(false);

  } catch (err) {
    showToast(err.message, "error");
    if (btn) { btn.disabled = false; btn.innerText = "Confirmar e Entrar"; }
  }
}

async function reenviarCodigoVerificacao(email, nome, senha) {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/registro-iniciar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome, email, senha })
    });
    if (!response.ok) throw new Error("Erro ao reenviar.");
    showToast("Novo código enviado! Verifique seu e-mail.", "success");
  } catch {
    showToast("Erro ao reenviar o código. Tente novamente.", "error");
  }
}

function showSuccessBanner(msg) {
  const old = document.getElementById("successBanner");
  if (old) old.remove();
  const banner = document.createElement("div");
  banner.id = "successBanner";
  banner.className = "fixed top-6 left-1/2 -translate-x-1/2 z-[300] bg-emerald-600 text-white text-sm font-semibold px-6 py-3 rounded-2xl shadow-xl flex items-center gap-2 animate-enter";
  banner.innerHTML = `<i class="ph-bold ph-check-circle text-lg"></i><span>${msg}</span>`;
  document.body.appendChild(banner);
  setTimeout(() => banner.remove(), 4000);
}

let currentResetStep = 1;
let resetUserEmail = "";

function setResetPasswordStep(step) {
  currentResetStep = step;

  const form1 = document.getElementById("resetStep1Form");
  const form2 = document.getElementById("resetStep2Form");
  const form3 = document.getElementById("resetStep3Form");

  const heading = document.getElementById("resetModalHeading");
  const subheading = document.getElementById("resetModalSubheading");

  const ind1 = document.getElementById("resetStepIndicator1");
  const ind2 = document.getElementById("resetStepIndicator2");
  const ind3 = document.getElementById("resetStepIndicator3");

  if (!form1 || !form2 || !form3) return;

  // Esconder todos os formulários inicialmente
  form1.classList.add("hidden");
  form2.classList.add("hidden");
  form3.classList.add("hidden");

  // Resetar classes dos indicadores
  const inactiveClass = "h-1.5 flex-1 rounded-full bg-gray-200 transition-all duration-300";
  const activeClass = "h-1.5 flex-1 rounded-full bg-emerald-500 transition-all duration-300";

  ind1.className = inactiveClass;
  ind2.className = inactiveClass;
  ind3.className = inactiveClass;

  if (step === 1) {
    form1.classList.remove("hidden");
    if (heading) heading.innerText = "Redefinir Senha";
    if (subheading) subheading.innerText = "Etapa 1 de 3: Identificação da conta";
    ind1.className = activeClass;
    setTimeout(() => {
      const emailInput = document.getElementById("resetStep1Email");
      if (emailInput) emailInput.focus();
    }, 100);
  } else if (step === 2) {
    form2.classList.remove("hidden");
    if (heading) heading.innerText = "Código de Verificação";
    if (subheading) subheading.innerText = `Etapa 2 de 3: Código enviado para ${resetUserEmail}`;
    ind1.className = activeClass;
    ind2.className = activeClass;
    setTimeout(() => {
      const codeInput = document.getElementById("resetStep2Code");
      if (codeInput) {
        codeInput.value = "";
        codeInput.focus();
      }
    }, 100);
  } else if (step === 3) {
    form3.classList.remove("hidden");
    if (heading) heading.innerText = "Criar Nova Senha";
    if (subheading) subheading.innerText = "Etapa 3 de 3: Defina e confirme a nova senha";
    ind1.className = activeClass;
    ind2.className = activeClass;
    ind3.className = activeClass;
    setTimeout(() => {
      const passInput = document.getElementById("resetStep3NovaSenha");
      if (passInput) passInput.focus();
    }, 100);
  }
}

// Resetar o modal sempre que for aberto
const originalOpenModal = openModal;
openModal = function(modalId) {
  originalOpenModal(modalId);
  if (modalId === "modalEsqueciSenha") {
    const authEmail = document.getElementById("authInputEmail");
    const step1Email = document.getElementById("resetStep1Email");
    if (step1Email && authEmail && authEmail.value) {
      step1Email.value = authEmail.value;
    }
    setResetPasswordStep(1);
  }
};

// ETAPA 1: Enviar Código via API real
async function handleResetStep1Submit(e) {
  e.preventDefault();
  const emailInput = document.getElementById("resetStep1Email");
  const email = emailInput ? emailInput.value.trim() : "";
  const btn = document.getElementById("btnResetStep1");
  const originalText = btn ? btn.innerText : "Enviar Código";

  if (!email) {
    showToast("Por favor, digite seu e-mail.", "warning");
    return;
  }

  resetUserEmail = email;

  if (btn) {
    btn.disabled = true;
    btn.innerText = "Enviando...";
  }

  try {
    const response = await fetch(`${API_BASE_URL}/auth/enviar-codigo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.detail || "Erro ao enviar código.");
    }

    showToast(`Código enviado com sucesso para ${email}!`, "success");
    setResetPasswordStep(2);
  } catch (err) {
    if (err.message.includes("Failed to fetch") || err.message.includes("NetworkError")) {
      showToast("API offline. Verifique se o servidor backend está ligado.", "warning");
    } else {
      showToast(err.message, "error");
    }
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerText = originalText;
    }
  }
}

// ETAPA 2: Validar Código via API real
let resetVerifiedCode = "";

async function handleResetStep2Submit(e) {
  e.preventDefault();
  const codeInput = document.getElementById("resetStep2Code");
  const code = codeInput ? codeInput.value.trim() : "";
  const btn = document.getElementById("btnResetStep2");
  const originalText = btn ? btn.innerText : "Validar";

  if (!code || code.length < 4) {
    showToast("Digite o código de verificação recebido.", "warning");
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.innerText = "Validando...";
  }

  try {
    const response = await fetch(`${API_BASE_URL}/auth/verificar-codigo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: resetUserEmail, codigo: code })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.detail || "Código inválido.");
    }

    resetVerifiedCode = code;
    showToast("Código validado com sucesso!", "success");
    setResetPasswordStep(3);
  } catch (err) {
    if (err.message.includes("Failed to fetch") || err.message.includes("NetworkError")) {
      showToast("API offline. Verifique se o servidor backend está ligado.", "warning");
    } else {
      showToast(err.message, "error");
    }
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerText = originalText;
    }
  }
}

// ETAPA 3: Alterar Senha (comunicação com a API)
async function handleResetStep3Submit(e) {
  e.preventDefault();
  const novaSenha = document.getElementById("resetStep3NovaSenha").value;
  const confirmaSenha = document.getElementById("resetStep3ConfirmaSenha").value;
  const btn = document.getElementById("btnResetStep3");
  const errBox = document.getElementById("resetStep3Error");
  const errText = document.getElementById("resetStep3ErrorText");
  const inputConfirma = document.getElementById("resetStep3ConfirmaSenha");
  const originalText = btn ? btn.innerText : "Alterar Senha";

  const showStep3Error = (msg) => {
    if (errBox && errText) {
      errText.innerText = msg;
      errBox.classList.remove("hidden");
    }
    showToast(msg, "error");
  };

  if (!novaSenha || !confirmaSenha) {
    showStep3Error("Preencha e confirme sua nova senha.");
    return;
  }

  // Se as senhas estiverem diferentes: mandar erro dizendo que precisam ser iguais
  if (novaSenha !== confirmaSenha) {
    if (inputConfirma) {
      inputConfirma.classList.add("border-red-500");
      inputConfirma.focus();
    }
    showStep3Error("As senhas precisam ser iguais.");
    return;
  }

  // Validação de regras de senha forte
  const strength = validatePasswordStrength(novaSenha);
  if (!strength.isValid) {
    showStep3Error(strength.message);
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.innerText = "Salvando...";
  }

  try {
    const response = await fetch(`${API_BASE_URL}/auth/redefinir-senha`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: resetUserEmail, codigo: resetVerifiedCode, nova_senha: novaSenha })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.detail || "Erro ao redefinir senha.");
    }

    showToast("Senha alterada com sucesso! Você já pode entrar.", "success");
    closeModal("modalEsqueciSenha");

    // Limpar formulários e atualizar tela de login
    document.getElementById("resetStep1Form").reset();
    document.getElementById("resetStep2Form").reset();
    document.getElementById("resetStep3Form").reset();
    if (errBox) errBox.classList.add("hidden");

    const authEmail = document.getElementById("authInputEmail");
    const authPass = document.getElementById("authInputPassword");
    if (authEmail) authEmail.value = resetUserEmail;
    if (authPass) authPass.value = novaSenha;

    setResetPasswordStep(1);
  } catch (err) {
    showStep3Error(err.message);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerText = originalText;
    }
  }
}

async function handleDeletarContaSubmit(e) {
  e.preventDefault();
  const email = document.getElementById("deleteAccountEmail").value.trim();
  const senha = document.getElementById("deleteAccountPassword").value;
  const btn = document.getElementById("btnDeleteAccountSubmit");
  const originalText = btn ? btn.innerText : "Excluir Minha Conta";

  if (!email || !senha) {
    showToast("Informe o e-mail e a senha para confirmar a exclusão.", "warning");
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.innerText = "Excluindo...";
  }

  try {
    const response = await fetch(`${API_BASE_URL}/auth/deletar-conta`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email, senha: senha })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.detail || "Erro ao deletar conta.");
    }

    showToast("Sua conta foi excluída com sucesso!", "info");
    closeModal("modalDeletarConta");
    document.getElementById("formDeletarConta").reset();

    // Se o usuário logado localmente era esse mesmo, desloga
    if (currentUser && currentUser.email === email) {
      currentUser = null;
      appData.user = null;
      saveData();
      document.getElementById("appLayout").classList.add("hidden");
      document.getElementById("appLayout").classList.remove("flex");
      document.getElementById("authScreen").classList.remove("hidden");
    }
  } catch (err) {
    if (err.message.includes("Failed to fetch") || err.message.includes("NetworkError")) {
      showToast("API offline. Verifique se o servidor backend está ligado.", "warning");
    } else {
      showToast(err.message, "error");
    }
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerText = originalText;
    }
  }
}

function accessGuestDemo() {
  currentUser = {
    id: "usr-demo",
    name: "Usuário",
    email: "visitante@edutrack.com",
    grade: "3º Ano EM / Pré-Vestibular",
    goalHoursWeekly: 25,
    avatarUrl: null
  };
  appData.user = currentUser;
  saveData();
  sessionStorage.setItem("edutrack_logged_in", "true");
  loginSuccess();
}

function loginSuccess(showToastMsg = true) {
  sessionStorage.setItem("edutrack_logged_in", "true");
  const authScreen = document.getElementById("authScreen");
  const appLayout = document.getElementById("appLayout");
  if (authScreen) authScreen.classList.add("hidden");
  if (appLayout) {
    appLayout.classList.remove("hidden");
    appLayout.classList.add("flex");
  }
  renderAll();
  if (showToastMsg) {
    showToast("Acesso realizado com sucesso!", "success");
  }
}

function handleLogout(showToastMsg = true) {
  // REGRA: Limpeza completa de qualquer resquício de dados da conta anterior
  const currentTheme = localStorage.getItem("theme");
  localStorage.clear();
  sessionStorage.clear();
  if (currentTheme) {
    localStorage.setItem("theme", currentTheme);
  }

  currentUser = null;
  appData = createEmptyAppData();

  const authScreen = document.getElementById("authScreen");
  const appLayout = document.getElementById("appLayout");
  if (appLayout) {
    appLayout.classList.add("hidden");
    appLayout.classList.remove("flex");
  }
  if (authScreen) authScreen.classList.remove("hidden");
  if (showToastMsg) {
    showToast("Sessão encerrada com sucesso.", "info");
  }
}

// ========================================================
// 17. CONTROLE DE MODAIS & ABAS
// ========================================================

function openModal(modalId) {
  const el = document.getElementById(modalId);
  if (el) {
    el.classList.remove("hidden");
    el.classList.add("flex");
  }
}

function closeModal(modalId) {
  const el = document.getElementById(modalId);
  if (el) {
    el.classList.add("hidden");
    el.classList.remove("flex");
  }
}

function switchTab(tabId) {
  activeTab = tabId;

  // Toggle tab contents
  document.querySelectorAll(".tab-content").forEach(el => el.classList.add("hidden"));
  const currentTab = document.getElementById("tab-" + tabId);
  if (currentTab) currentTab.classList.remove("hidden");

  // Toggle nav buttons com alto contraste (Normal vs Ativo)
  const inactiveClasses = ["text-slate-600", "hover:bg-gray-100", "hover:text-gray-900", "dark:text-gray-300", "dark:hover:bg-slate-800", "dark:hover:text-white"];
  const activeClasses = ["bg-emerald-50", "text-emerald-600", "dark:bg-emerald-500/20", "dark:text-emerald-400", "nav-active"];

  document.querySelectorAll(".sidebar-nav-btn").forEach(btn => {
    btn.classList.remove(...activeClasses);
    btn.classList.add(...inactiveClasses);
  });

  const activeBtn = document.getElementById("navBtn-" + tabId);
  if (activeBtn) {
    activeBtn.classList.remove(...inactiveClasses);
    activeBtn.classList.add(...activeClasses);
  }
}

function toggleMobileSidebar() {
  const sidebar = document.getElementById("mobileSidebar");
  const backdrop = document.getElementById("sidebarBackdrop");
  if (!sidebar) return;

  const isOpen = !sidebar.classList.contains("-translate-x-full");
  if (isOpen) {
    sidebar.classList.add("-translate-x-full");
    if (backdrop) backdrop.classList.add("hidden");
  } else {
    sidebar.classList.remove("-translate-x-full");
    if (backdrop) backdrop.classList.remove("hidden");
  }
}

// ========================================================
// 18. CONTROLE DE MODO CLARO / MODO ESCURO (THEME)
// ========================================================

function toggleTheme() {
    document.documentElement.classList.toggle('dark');
    if (document.documentElement.classList.contains('dark')) {
        localStorage.setItem('theme', 'dark');
    } else {
        localStorage.setItem('theme', 'light');
    }
}

// Aplica o tema salvo imediatamente na leitura do script
if (localStorage.getItem('theme') === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.classList.add('dark');
} else {
    document.documentElement.classList.remove('dark');
}

document.addEventListener('DOMContentLoaded', () => {
    const themeToggleBtn = document.getElementById('theme-toggle');
    if (themeToggleBtn) {
        themeToggleBtn.onclick = toggleTheme;
    }
});

// ========================================================
// 19. INICIALIZAÇÃO NO LOAD (BUSCA EXCLUSIVA COM TOKEN NA API)
// ========================================================

window.addEventListener("DOMContentLoaded", async () => {

  const token = sessionStorage.getItem("edutrack_token");
  const isLoggedIn = sessionStorage.getItem("edutrack_logged_in") === "true";

  if (isLoggedIn && token) {
    // Busca na API apenas os dados do usuário autenticado
    const carregou = await fetchUserData();
    if (carregou && currentUser) {
      loginSuccess(false);
    } else {
      handleLogout(false);
    }
  } else {
    // Tela limpa para novo login
    handleLogout(false);
  }
});

// ==========================================
// IA TUTORA — Funcoes de Chat
// ==========================================

let iaConversationHistory = [];  // [{role: 'user'|'model', text: '...'}]
let iaIsLoading = false;

function sendIAMessage(event) {
  if (event) event.preventDefault();
  if (iaIsLoading) return;

  try {
  const input = document.getElementById('iaUserInput');
  const msg = (input.value || '').trim();
  if (!msg) return;

  // Renderiza mensagem do usuario
  renderIAMessage(msg, 'user');
  iaConversationHistory.push({ role: 'user', text: msg });
  input.value = '';
  input.style.height = 'auto';

  // Mostra indicador de digitacao
  const typingId = 'ia-typing-' + Date.now();
  const chatBox = document.getElementById('iaChatMessages');
  chatBox.insertAdjacentHTML('beforeend', `
    <div id="${typingId}" class="flex gap-3 items-start ia-msg-bot">
      <div class="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-500 text-sm shrink-0 mt-0.5">
        <i class="ph-bold ph-robot"></i>
      </div>
      <div class="bg-slate-50 dark:bg-slate-800 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-slate-400 dark:text-slate-500 shadow-sm flex items-center gap-2">
        <span class="inline-block w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" style="animation-delay:0ms"></span>
        <span class="inline-block w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" style="animation-delay:150ms"></span>
        <span class="inline-block w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" style="animation-delay:300ms"></span>
      </div>
    </div>
  `);
  chatBox.scrollTop = chatBox.scrollHeight;

  // Desabilita botao
  iaIsLoading = true;
  const btn = document.getElementById('iaSendBtn');
  if (btn) btn.disabled = true;

  // Monta historico (exclui a ultima mensagem que acabou de ser adicionada)
  const historico = iaConversationHistory.slice(0, -1).map(m => ({ role: m.role, text: m.text }));

  const iaToken = sessionStorage.getItem('edutrack_token') || '';
  const iaController = new AbortController();
  const iaTimeout = setTimeout(() => iaController.abort(), 60000);

  fetch(API_BASE_URL + '/ia/chat', {
    method: 'POST',
    signal: iaController.signal,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + iaToken
    },
    body: JSON.stringify({ mensagem: msg, historico: historico })
  })
  .then(res => res.json().then(data => ({ ok: res.ok, data })))
  .then(({ ok, data }) => {
    clearTimeout(iaTimeout);
    const typingEl = document.getElementById(typingId);
    if (typingEl) typingEl.remove();

    if (ok && data.resposta) {
      renderIAMessage(data.resposta, 'model');
      iaConversationHistory.push({ role: 'model', text: data.resposta });
    } else {
      const errMsg = data.detail || 'Erro ao obter resposta da IA.';
      let userMsg = errMsg;
      if (errMsg.includes('GEMINI_API_KEY') || errMsg.includes('.env')) {
        userMsg = '🔑 Chave da API do Gemini invalida ou nao configurada. Acesse aistudio.google.com/app/apikey para gerar uma chave valida.';
      }
      renderIAMessage(userMsg, 'error');
    }
  })
  .catch(err => {
    clearTimeout(iaTimeout);
    const typingEl = document.getElementById(typingId);
    if (typingEl) typingEl.remove();
    if (err.name === 'AbortError') {
      renderIAMessage('⏱ A IA demorou muito para responder. Verifique se a chave GEMINI_API_KEY no backend/.env e valida. Obtenha uma em aistudio.google.com/app/apikey', 'error');
    } else {
      renderIAMessage('❌ Erro de conexao com o servidor. Verifique se o backend esta rodando.', 'error');
    }
  })
  .finally(() => {
    iaIsLoading = false;
    if (btn) btn.disabled = false;
    const chatBox2 = document.getElementById('iaChatMessages');
    if (chatBox2) chatBox2.scrollTop = chatBox2.scrollHeight;
  });
  } catch(err) {
    console.error('[IA] Erro inesperado:', err);
    iaIsLoading = false;
    const btn2 = document.getElementById('iaSendBtn');
    if (btn2) btn2.disabled = false;
    renderIAMessage('Erro inesperado: ' + err.message, 'error');
  }
}

function formatIAMarkdown(text) {
  if (!text) return "";
  let s = text;
  // Processa cabeçalhos markdown: ### Titulo, ## Titulo
  s = s.replace(/^### (.*$)/gim, '<h4 class="font-bold text-sm text-emerald-600 dark:text-emerald-400 mt-2 mb-1">$1</h4>');
  s = s.replace(/^## (.*$)/gim, '<h3 class="font-extrabold text-base text-slate-900 dark:text-white mt-3 mb-1.5">$1</h3>');
  s = s.replace(/^# (.*$)/gim, '<h2 class="font-extrabold text-lg text-slate-900 dark:text-white mt-3 mb-2">$1</h2>');

  // Processa negrito **texto** e itálico *texto*
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Processa listas com marcadores (* item ou - item)
  s = s.replace(/^\s*[\*\-]\s+(.*$)/gim, '<div class="flex items-start gap-2 my-1"><span class="text-emerald-500 font-bold">•</span><span>$1</span></div>');

  // Processa código inline
  s = s.replace(/`([^`]+)`/g, '<code class="bg-slate-200 dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded text-xs font-mono font-bold">$1</code>');

  // Quebras de linha
  s = s.replace(/\n\n/g, '<div class="h-2"></div>');
  s = s.replace(/\n/g, '<br>');

  return s;
}

function renderIAMessage(text, role) {
  const chatBox = document.getElementById('iaChatMessages');
  if (!chatBox) return;

  const formatted = role === 'user'
    ? text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')
    : formatIAMarkdown(text);

  if (role === 'user') {
    chatBox.insertAdjacentHTML('beforeend', `
      <div class="flex gap-3 items-start justify-end ia-msg-user">
        <div class="bg-emerald-500 text-white rounded-2xl rounded-tr-sm px-4 py-3 max-w-[85%] text-sm leading-relaxed shadow-sm">
          ${formatted}
        </div>
        <div class="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 text-sm shrink-0 mt-0.5">
          <i class="ph-bold ph-user"></i>
        </div>
      </div>
    `);
  } else if (role === 'model') {
    chatBox.insertAdjacentHTML('beforeend', `
      <div class="flex gap-3 items-start ia-msg-bot">
        <div class="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-500 text-sm shrink-0 mt-0.5">
          <i class="ph-bold ph-robot"></i>
        </div>
        <div class="bg-slate-50 dark:bg-slate-800 rounded-2xl rounded-tl-sm px-4 py-3 max-w-[85%] text-sm text-slate-700 dark:text-slate-200 leading-relaxed shadow-sm">
          ${formatted}
        </div>
      </div>
    `);
  } else {
    // erro
    chatBox.insertAdjacentHTML('beforeend', `
      <div class="flex gap-3 items-start ia-msg-bot">
        <div class="w-8 h-8 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-500 text-sm shrink-0 mt-0.5">
          <i class="ph-bold ph-warning"></i>
        </div>
        <div class="bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-500/30 rounded-2xl rounded-tl-sm px-4 py-3 max-w-[85%] text-sm text-rose-700 dark:text-rose-300 leading-relaxed">
          ${formatted}
        </div>
      </div>
    `);
  }

  // Renderiza fórmulas matemáticas e de física via KaTeX se disponíveis
  const lastMsg = chatBox.lastElementChild;
  if (lastMsg && window.renderMathInElement) {
    try {
      window.renderMathInElement(lastMsg, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '$', right: '$', display: false },
          { left: '\\(', right: '\\)', display: false },
          { left: '\\[', right: '\\]', display: true }
        ],
        throwOnError: false
      });
    } catch (e) {
      console.warn("KaTeX error:", e);
    }
  }

  chatBox.scrollTop = chatBox.scrollHeight;
}

function clearIAChat() {
  iaConversationHistory = [];
  const chatBox = document.getElementById('iaChatMessages');
  if (!chatBox) return;
  chatBox.innerHTML = `
    <div class="flex gap-3 items-start ia-msg-bot">
      <div class="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-500 text-sm shrink-0 mt-0.5">
        <i class="ph-bold ph-robot"></i>
      </div>
      <div class="bg-slate-50 dark:bg-slate-800 rounded-2xl rounded-tl-sm px-4 py-3 max-w-[85%] text-sm text-slate-700 dark:text-slate-200 leading-relaxed shadow-sm">
        Conversa reiniciada! Como posso te ajudar?
      </div>
    </div>
  `;
}

