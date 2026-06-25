// API-Crawler Client-Side SPA Controller
document.addEventListener("DOMContentLoaded", () => {
    // ==========================================
    // GLOBAL STATE
    // ==========================================
    const state = {
        activeView: "dashboard", // dashboard, registry, settings, history
        environments: [],
        apis: [],
        settings: {
            execution_interval: 24,
            custom_interval: null
        },
        selectedEnvId: localStorage.getItem("selectedEnvId") || "",
        selectedRegistryEnvId: "",
        csvPreviewData: null,
        chartInstances: {},
        currentFailureData: null,
        schedulerCards: []
    };

    // Base URL of current API (empty for relative paths when co-hosted)
    const API_BASE = "";

    // ==========================================
    // DOM ELEMENTS
    // ==========================================
    const elements = {
        // Navigation buttons
        navDashboard: document.getElementById("nav-dashboard"),
        navRegistry: document.getElementById("nav-registry"),
        navSettings: document.getElementById("nav-settings"),
        navHistory: document.getElementById("nav-history"),
        navComplexApis: document.getElementById("nav-complex-apis"),
        navGlobalVars: document.getElementById("nav-global-vars"),

        // Main Views
        viewDashboard: document.getElementById("view-dashboard"),
        viewRegistry: document.getElementById("view-registry"),
        viewSettings: document.getElementById("view-settings"),
        viewHistory: document.getElementById("view-history"),
        viewComplexApis: document.getElementById("view-complex-apis"),
        viewGlobalVars: document.getElementById("view-global-vars"),

        // Title and global stats in Header
        pageTitle: document.getElementById("page-title"),
        headerLastBackup: document.getElementById("header-last-backup"),
        headerLastExecution: document.getElementById("header-last-execution"),
        headerEnvSelector: document.getElementById("header-env-selector"),
        btnValidateNow: document.getElementById("btn-validate-now"),
        themeToggle: document.getElementById("theme-toggle"),

        // Dashboard Elements
        dashboardSkeleton: document.getElementById("dashboard-skeleton"),
        dashboardContent: document.getElementById("dashboard-content"),
        envPanelsContainer: document.getElementById("env-panels-container"),

        // Registry Elements
        apiSearchBar: document.getElementById("api-search-bar"),
        apiTableBody: document.getElementById("api-table-body"),
        btnAddApiFab: document.getElementById("btn-add-api-fab"),
        registryEnvSelector: document.getElementById("registry-env-selector"),
        btnRegistryAddComplexApi: document.getElementById("registry-btn-add-complex-api"),

        // Settings Elements
        environmentsGrid: document.getElementById("environments-grid"),
        settingsBackupEnv: document.getElementById("settings-backup-env"),
        btnBackupNow: document.getElementById("btn-backup-now"),
        importCsvFile: document.getElementById("import-csv-file"),
        importCsvEnvSelector: document.getElementById("import-csv-env-selector"),
        schedulerGrid: document.getElementById("scheduler-grid"),
        modalScheduler: document.getElementById("modal-scheduler"),
        schedulerForm: document.getElementById("scheduler-form"),
        schedulerModalTitle: document.getElementById("scheduler-modal-title"),
        schedulerIdField: document.getElementById("scheduler-id-field"),
        schedulerName: document.getElementById("scheduler-name"),
        schedulerTime: document.getElementById("scheduler-time"),
        btnSchedulerCancel: document.getElementById("btn-scheduler-cancel"),
        notificationChannel: document.getElementById("notification-channel"),
        webhookConfigWrapper: document.getElementById("webhook-config-wrapper"),
        emailConfigWrapper: document.getElementById("email-config-wrapper"),
        inputWebhookUrl: document.getElementById("input-webhook-url"),
        inputSmtpServer: document.getElementById("input-smtp-server"),
        inputSmtpPort: document.getElementById("input-smtp-port"),
        inputSenderEmail: document.getElementById("input-sender-email"),
        inputSenderPassword: document.getElementById("input-sender-password"),
        inputRecipientEmail: document.getElementById("input-recipient-email"),
        btnTestNotification: document.getElementById("btn-test-notification"),
        btnSaveCommunication: document.getElementById("btn-save-communication"),
        settingsFilterBackupEnv: document.getElementById("settings-filter-backup-env"),
        backupsListTableBody: document.getElementById("backups-list-table-body"),
        btnWipeDatabase: document.getElementById("btn-wipe-database"),

        // History Elements
        historyTableBody: document.getElementById("history-table-body"),

        // Modals
        modalEnv: document.getElementById("modal-env"),
        envForm: document.getElementById("env-form"),
        envModalTitle: document.getElementById("env-modal-title"),
        envIdField: document.getElementById("env-id-field"),
        envName: document.getElementById("env-name"),
        envUrl: document.getElementById("env-url"),
        btnEnvCancel: document.getElementById("btn-env-cancel"),

        modalApi: document.getElementById("modal-api"),
        apiForm: document.getElementById("api-form"),
        apiModalTitle: document.getElementById("api-modal-title"),
        apiIdField: document.getElementById("api-id-field"),
        apiEnvIdField: document.getElementById("api-env-id-field"),
        apiName: document.getElementById("api-name"),
        apiEndpoint: document.getElementById("api-endpoint"),
        btnApiCancel: document.getElementById("btn-api-cancel"),

        modalConfirm: document.getElementById("modal-confirm"),
        confirmTitle: document.getElementById("confirm-title"),
        confirmIcon: document.getElementById("confirm-icon"),
        confirmMessage: document.getElementById("confirm-message"),
        btnConfirmCancel: document.getElementById("btn-confirm-cancel"),
        btnConfirmDelete: document.getElementById("btn-confirm-delete"),

        modalCsvPreview: document.getElementById("modal-csv-preview"),
        csvPreviewBody: document.getElementById("csv-preview-body"),
        csvPreviewSummary: document.getElementById("csv-preview-summary"),
        csvImportWarning: document.getElementById("csv-import-warning"),
        btnCsvCancel: document.getElementById("btn-csv-cancel"),
        btnCsvImport: document.getElementById("btn-csv-import"),

        modalFailureDetail: document.getElementById("modal-failure-detail"),
        failureModalName: document.getElementById("failure-modal-name"),
        failureModalUrl: document.getElementById("failure-modal-url"),
        failureModalReason: document.getElementById("failure-modal-reason"),
        failureModalDiffBox: document.getElementById("failure-modal-diff-box"),
        btnFailureClose: document.getElementById("btn-failure-close"),
        btnDiffViewer: document.getElementById("btn-diff-viewer"),

        modalDiffViewer: document.getElementById("modal-diff-viewer"),
        diffViewerSubtitle: document.getElementById("diff-viewer-subtitle"),
        diffViewerVersion: document.getElementById("diff-viewer-version"),
        diffViewerLoading: document.getElementById("diff-viewer-loading"),
        diffViewerError: document.getElementById("diff-viewer-error"),
        diffViewerErrorMsg: document.getElementById("diff-viewer-error-msg"),
        diffViewerPanels: document.getElementById("diff-viewer-panels"),
        diffViewerBackup: document.getElementById("diff-viewer-backup"),
        diffViewerBackupLabel: document.getElementById("diff-viewer-backup-label"),
        diffViewerCurrent: document.getElementById("diff-viewer-current"),
        diffViewerCurrentLabel: document.getElementById("diff-viewer-current-label"),
        diffViewerChangeCount: document.getElementById("diff-viewer-change-count"),
        diffViewerLegend: document.getElementById("diff-viewer-legend"),
        btnDiffViewerClose: document.getElementById("btn-diff-viewer-close"),

        modalAlert: document.getElementById("modal-alert"),
        alertTitle: document.getElementById("alert-title"),
        alertMessage: document.getElementById("alert-message"),
        alertIcon: document.getElementById("alert-icon"),
        btnAlertClose: document.getElementById("btn-alert-close"),

        // Overlay & Toast Container
        pageOverlay: document.getElementById("page-overlay"),
        overlayText: document.getElementById("overlay-text"),
        toastContainer: document.getElementById("toast-container"),

        // Global Vars
        btnAddGlobalVar: document.getElementById("btn-add-global-var"),
        globalVarsTableBody: document.getElementById("global-vars-table-body"),
        modalGlobalVar: document.getElementById("modal-global-var"),
        modalGlobalVarTitle: document.getElementById("modal-global-var-title"),
        inputGvId: document.getElementById("input-gv-id"),
        inputGvKey: document.getElementById("input-gv-key"),
        inputGvValue: document.getElementById("input-gv-value"),
        btnGlobalVarSave: document.getElementById("btn-global-var-save"),
        btnGlobalVarClose: document.getElementById("btn-global-var-close"),
        btnGlobalVarCancel: document.getElementById("btn-global-var-cancel"),

        // Complex APIs
        btnAddComplexApi: document.getElementById("btn-add-complex-api"),
        complexApisList: document.getElementById("complex-apis-list"),
        modalComplexApi: document.getElementById("modal-complex-api"),
        modalComplexApiTitle: document.getElementById("modal-complex-api-title"),
        inputCaId: document.getElementById("input-ca-id"),
        inputCaEnv: document.getElementById("input-ca-env"),
        inputCaName: document.getElementById("input-ca-name"),
        inputCaCurl: document.getElementById("input-ca-curl"),
        caExtractRulesContainer: document.getElementById("ca-extract-rules-container"),
        btnAddExtractRule: document.getElementById("btn-add-extract-rule"),
        caAssertionsContainer: document.getElementById("ca-assertions-container"),
        btnAddAssertionRule: document.getElementById("btn-add-assertion-rule"),
        btnComplexApiSave: document.getElementById("btn-complex-api-save"),
        btnComplexApiClose: document.getElementById("btn-complex-api-close"),
        btnComplexApiCancel: document.getElementById("btn-complex-api-cancel"),

        // Tutorial Modal Elements
        modalTutorial: document.getElementById("modal-tutorial"),
        btnComplexApiTutorial: document.getElementById("btn-complex-api-tutorial"),
        registryBtnComplexApiTutorial: document.getElementById("registry-btn-complex-api-tutorial"),
        btnTutorialClose: document.getElementById("btn-tutorial-close"),
        btnTutorialCloseBottom: document.getElementById("btn-tutorial-close-bottom")
    };

    // ==========================================
    // THEME CONFIG (DARK MODE)
    // ==========================================
    function initTheme() {
        const cachedTheme = localStorage.getItem("theme");
        const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        
        if (cachedTheme === "dark" || (!cachedTheme && systemPrefersDark)) {
            document.documentElement.classList.add("dark");
            document.documentElement.classList.remove("light");
        } else {
            document.documentElement.classList.add("light");
            document.documentElement.classList.remove("dark");
        }
    }

    elements.themeToggle.addEventListener("click", () => {
        if (document.documentElement.classList.contains("dark")) {
            document.documentElement.classList.remove("dark");
            document.documentElement.classList.add("light");
            localStorage.setItem("theme", "light");
            showToast("Light mode enabled", "info");
        } else {
            document.documentElement.classList.remove("light");
            document.documentElement.classList.add("dark");
            localStorage.setItem("theme", "dark");
            showToast("Dark mode enabled", "info");
        }
    });

    initTheme();

    // ==========================================
    // TOAST NOTIFICATIONS
    // ==========================================
    function showToast(message, type = "success") {
        const toast = document.createElement("div");
        toast.className = `p-4 rounded-xl shadow-lg border text-sm font-semibold flex items-center gap-3 animate-slide-right pointer-events-auto transition-all duration-300 max-w-sm `;
        
        let icon = "fa-circle-check";
        if (type === "success") {
            toast.className += "bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/60 dark:border-emerald-900/30 dark:text-emerald-300";
            icon = "fa-circle-check";
        } else if (type === "error") {
            toast.className += "bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/60 dark:border-rose-900/30 dark:text-rose-300";
            icon = "fa-triangle-exclamation";
        } else {
            toast.className += "bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-950/60 dark:border-blue-900/30 dark:text-blue-300";
            icon = "fa-circle-info";
        }

        toast.innerHTML = `
            <i class="fa-solid ${icon} text-base"></i>
            <span>${message}</span>
        `;
        
        elements.toastContainer.appendChild(toast);
        
        // Auto remove
        setTimeout(() => {
            toast.classList.add("animate-fade-out");
            setTimeout(() => toast.remove(), 250);
        }, 3500);
    }

    // ==========================================
    // MODAL CONTROL UTILITIES
    // ==========================================
    function openModal(modalEl) {
        modalEl.classList.remove("hidden");
        modalEl.classList.add("flex");
    }

    function closeModal(modalEl) {
        modalEl.classList.add("hidden");
        modalEl.classList.remove("flex");
    }

    /**
     * Reusable confirmation modal helper.
     * @param {Object} opts
     * @param {string} opts.title - Modal title text
     * @param {string} opts.message - Modal body message
     * @param {string} [opts.confirmText="Confirm"] - Action button label
     * @param {string} [opts.confirmClass] - Action button CSS classes (defaults to red)
     * @param {string} [opts.iconClass] - Icon container CSS classes
     * @param {string} [opts.iconHtml] - Inner icon HTML
     * @param {Function} opts.onConfirm - Callback when confirm is clicked
     */
    function showConfirmModal(opts) {
        elements.confirmTitle.innerText = opts.title || "Confirm Action";
        elements.confirmMessage.innerText = opts.message || "Are you sure?";
        elements.btnConfirmDelete.innerText = opts.confirmText || "Confirm";

        // Icon styling
        if (opts.iconClass) {
            elements.confirmIcon.className = opts.iconClass;
        } else {
            elements.confirmIcon.className = "h-12 w-12 rounded-full bg-red-50 dark:bg-red-950/30 text-red-500 flex items-center justify-center mx-auto text-lg border border-red-200 dark:border-red-800";
        }
        if (opts.iconHtml) {
            elements.confirmIcon.innerHTML = opts.iconHtml;
        } else {
            elements.confirmIcon.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i>';
        }

        // Button styling
        if (opts.confirmClass) {
            elements.btnConfirmDelete.className = `h-10 px-5 rounded-xl text-white text-sm font-semibold flex-1 transition-colors ${opts.confirmClass}`;
        } else {
            elements.btnConfirmDelete.className = "h-10 px-5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold flex-1 transition-colors";
        }

        elements.btnConfirmDelete.onclick = () => {
            if (opts.onConfirm) opts.onConfirm();
        };

        openModal(elements.modalConfirm);
    }

    function showOverlay(text) {
        elements.overlayText.innerText = text;
        elements.pageOverlay.classList.remove("hidden");
        elements.pageOverlay.classList.add("flex");
    }

    function hideOverlay() {
        elements.pageOverlay.classList.add("hidden");
        elements.pageOverlay.classList.remove("flex");
    }

    function showAlert(title, message, isSuccess = false) {
        elements.alertTitle.innerText = title;
        elements.alertMessage.innerHTML = message;
        
        if (isSuccess) {
            elements.alertIcon.className = "h-12 w-12 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center mx-auto text-lg border border-emerald-200";
            elements.alertIcon.innerHTML = `<i class="fa-solid fa-circle-check"></i>`;
        } else {
            elements.alertIcon.className = "h-12 w-12 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center mx-auto text-lg border border-rose-200";
            elements.alertIcon.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i>`;
        }
        
        openModal(elements.modalAlert);
    }

    elements.btnAlertClose.addEventListener("click", () => closeModal(elements.modalAlert));

    // ==========================================
    // SYSTEM ROUTING (TAB NAVIGATION)
    // ==========================================
    const views = {
        dashboard: { btn: elements.navDashboard, panel: elements.viewDashboard, title: "Dashboard", fetch: fetchDashboard },
        registry: { btn: elements.navRegistry, panel: elements.viewRegistry, title: "API Registry", fetch: fetchAPIs },
        settings: { btn: elements.navSettings, panel: elements.viewSettings, title: "Settings", fetch: fetchSettingsData },
        history: { btn: elements.navHistory, panel: elements.viewHistory, title: "Logs", fetch: fetchExecutionHistory },
        complexApis: { btn: elements.navComplexApis, panel: elements.viewComplexApis, title: "Complex APIs", fetch: fetchComplexApis },
        globalVars: { btn: elements.navGlobalVars, panel: elements.viewGlobalVars, title: "Global Variables", fetch: fetchGlobalVars }
    };

    function switchView(viewName) {
        // Toggle view visual buttons
        Object.keys(views).forEach(key => {
            const v = views[key];
            if (key === viewName) {
                v.btn.className = "w-full flex items-center gap-3.5 px-4 py-3 rounded-xl font-medium text-sm transition-all duration-200 bg-primary-50 text-primary-600 dark:bg-primary-950/40 dark:text-primary-400 border border-primary-100/50 dark:border-primary-900/30";
                v.panel.classList.remove("hidden");
            } else {
                v.btn.className = "w-full flex items-center gap-3.5 px-4 py-3 rounded-xl font-medium text-sm transition-all duration-200 text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-900/60";
                v.panel.classList.add("hidden");
            }
        });

        state.activeView = viewName;
        elements.pageTitle.innerText = views[viewName].title;

        // Toggle FAB visibility
        if (viewName === "registry") {
            elements.btnAddApiFab.classList.remove("hidden");
        } else {
            elements.btnAddApiFab.classList.add("hidden");
        }
        
        // Trigger specific data fetches
        views[viewName].fetch();
    }

    // Expose switchView globally for inline HTML click triggers
    window.switchView = switchView;

    Object.keys(views).forEach(key => {
        views[key].btn.addEventListener("click", () => switchView(key));
    });

    // ==========================================
    // CORE GLOBAL FETCHES & DROPDOWNS
    // ==========================================
    async function loadGlobalDropdowns() {
        try {
            const res = await axios.get(`${API_BASE}/api/environments`);
            state.environments = res.data;
            
            // 1. Populate Header Selector
            elements.headerEnvSelector.innerHTML = '<option value="" disabled>Select Environment</option>';
            // 2. Populate Settings Backup Selector
            elements.settingsBackupEnv.innerHTML = '<option value="" disabled selected>Select Env</option>';
            // 3. Populate CSV Import Env Selector
            elements.importCsvEnvSelector.innerHTML = '<option value="" disabled selected>Select Environment</option>';
            // 4. Populate Registry Selector
            elements.registryEnvSelector.innerHTML = '<option value="" disabled selected>Select Environment</option>';

            state.environments.forEach(env => {
                const opt1 = document.createElement("option");
                opt1.value = env.id;
                opt1.innerText = env.name;
                if (String(env.id) === String(state.selectedEnvId)) {
                    opt1.selected = true;
                }
                elements.headerEnvSelector.appendChild(opt1);

                const opt2 = document.createElement("option");
                opt2.value = env.id;
                opt2.innerText = env.name;
                elements.settingsBackupEnv.appendChild(opt2);

                const opt3 = document.createElement("option");
                opt3.value = env.id;
                opt3.innerText = env.name;
                elements.registryEnvSelector.appendChild(opt3);

                const opt4 = document.createElement("option");
                opt4.value = env.id;
                opt4.innerText = env.name;
                elements.importCsvEnvSelector.appendChild(opt4);
            });

            // Adjust header selected reference
            if (elements.headerEnvSelector.value) {
                state.selectedEnvId = elements.headerEnvSelector.value;
            } else if (state.environments.length > 0) {
                state.selectedEnvId = state.environments[0].id;
                elements.headerEnvSelector.value = state.selectedEnvId;
                localStorage.setItem("selectedEnvId", state.selectedEnvId);
            }

            // Adjust registry env selector default
            if (state.environments.length > 0) {
                if (!state.selectedRegistryEnvId) {
                    state.selectedRegistryEnvId = state.environments[0].id;
                }
                elements.registryEnvSelector.value = state.selectedRegistryEnvId;
            }
        } catch (err) {
            loggerError("Error loading environments dropdown", err);
        }
    }

    elements.headerEnvSelector.addEventListener("change", (e) => {
        state.selectedEnvId = e.target.value;
        localStorage.setItem("selectedEnvId", state.selectedEnvId);
        showToast(`Switched active environment`, "info");
        
        // If current page is dashboard, reload dashboard
        if (state.activeView === "dashboard") {
            fetchDashboard();
        }
    });

    elements.registryEnvSelector.addEventListener("change", (e) => {
        state.selectedRegistryEnvId = e.target.value;
        fetchAPIs();
    });

    function formatDate(dateStr) {
        if (!dateStr) return "Never";
        // If it's a naive ISO datetime string from the backend, append 'Z' to mark it as UTC
        let parsedDateStr = dateStr;
        if (typeof dateStr === "string" && !dateStr.endsWith("Z") && !dateStr.includes("+") && !dateStr.includes("-", 10)) {
            parsedDateStr = dateStr + "Z";
        }
        const date = new Date(parsedDateStr);
        const formatted = date.toLocaleString('en-GB', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        });
        return formatted.replace(/\s*(am|pm)/gi, (m) => m.toUpperCase());
    }

    // ==========================================
    // VIEW 1: DASHBOARD PAGE
    // ==========================================
    async function fetchDashboard() {
        // Show loading skeletons
        elements.dashboardSkeleton.classList.remove("hidden");
        elements.dashboardContent.classList.add("hidden");

        try {
            const res = await axios.get(`${API_BASE}/api/dashboard`);
            const data = res.data;

            // Header general metrics
            elements.headerLastBackup.innerText = formatDate(data.last_backup_overall);
            elements.headerLastExecution.innerText = formatDate(data.last_execution_overall);

            // Clean previous charts
            Object.keys(state.chartInstances).forEach(key => {
                state.chartInstances[key].destroy();
            });
            state.chartInstances = {};

            // Render environment cards
            elements.envPanelsContainer.innerHTML = "";
            
            if (data.environments.length === 0) {
                elements.envPanelsContainer.innerHTML = `
                    <div class="xl:col-span-2 glass-panel p-12 rounded-2xl flex flex-col items-center justify-center text-center space-y-4">
                        <div class="h-14 w-14 rounded-full bg-blue-50 dark:bg-blue-950/30 text-primary-500 flex items-center justify-center text-xl border border-blue-200 dark:border-blue-900/50">
                            <i class="fa-solid fa-server"></i>
                        </div>
                        <div class="space-y-1">
                            <h3 class="font-bold text-lg">No Environments Registered</h3>
                            <p class="text-sm text-slate-500 dark:text-slate-400">Head over to System Settings to add up to 4 environments to get started.</p>
                        </div>
                        <button onclick="switchView('settings')" class="h-10 px-5 bg-primary-600 hover:bg-primary-700 text-white font-semibold text-sm rounded-xl">
                            Configure Environments
                        </button>
                    </div>
                `;
            } else {
                data.environments.forEach(env => {
                    const card = createEnvironmentDashboardCard(env);
                    elements.envPanelsContainer.appendChild(card);
                    
                    // Render pie chart if backup and validation run exists
                    if (env.has_baseline && env.last_execution_time) {
                        renderEnvironmentPieChart(env);
                    }
                });
            }

            // Reveal content
            elements.dashboardSkeleton.classList.add("hidden");
            elements.dashboardContent.classList.remove("hidden");
        } catch (err) {
            loggerError("Error loading dashboard data", err);
            showToast("Failed to load dashboard statistics", "error");
        }
    }

    function createEnvironmentDashboardCard(env) {
        const div = document.createElement("div");
        div.className = "glass-panel p-6 rounded-2xl flex flex-col gap-6 shadow-sm border border-slate-200/60 dark:border-slate-800/80 transition-all duration-300";
        
        // Active border glow if selected in header
        if (String(env.environment_id) === String(state.selectedEnvId)) {
            div.className += " ring-2 ring-primary-500/20 border-primary-500/50 dark:border-primary-500/30";
        }

        // Header Title section
        const header = `
            <div class="flex items-start justify-between gap-4">
                <div class="space-y-1.5 flex-1 min-w-0">
                    <h3 class="font-extrabold text-lg text-slate-900 dark:text-white flex items-center gap-2 truncate">
                        ${env.environment_name}
                        ${String(env.environment_id) === String(state.selectedEnvId) ? '<span class="text-[10px] bg-primary-100 text-primary-700 dark:bg-primary-950/60 dark:text-primary-400 font-semibold px-2 py-0.5 rounded-md whitespace-nowrap">Active</span>' : ''}
                    </h3>
                    <span class="text-[11px] font-mono text-slate-400 dark:text-slate-500 break-all select-all block">${env.base_url}</span>
                </div>
                <div class="text-right flex flex-col items-end gap-1.5 shrink-0">
                    <div>
                        <span class="text-[10px] text-slate-450 dark:text-slate-500 font-bold uppercase tracking-wider block">Baseline Version</span>
                        <span class="text-xs font-semibold text-slate-600 dark:text-slate-350 whitespace-nowrap block">
                            ${env.has_baseline ? `<i class="fa-solid fa-code-commit text-primary-500 mr-1"></i>${env.last_backup_version}` : '<span class="text-rose-500 dark:text-rose-400">No baseline backup</span>'}
                        </span>
                    </div>
                    <div class="flex items-center gap-1.5 mt-0.5">
                        <span class="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">Include in Schedule</span>
                        <label class="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" class="sr-only peer" ${env.schedule_enabled !== false ? 'checked' : ''} onchange="toggleEnvSchedule(${env.environment_id}, this.checked)">
                            <div class="w-8 h-4 bg-slate-200 dark:bg-slate-700 rounded-full peer peer-checked:bg-primary-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-350 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:after:translate-x-4"></div>
                        </label>
                    </div>
                </div>
            </div>
        `;

        // Body section depends on status
        let body = "";
        
        if (!env.has_baseline) {
            body = `
                <div class="flex-1 py-8 flex flex-col items-center justify-center text-center space-y-3 bg-slate-50/50 dark:bg-slate-950/20 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                    <i class="fa-solid fa-folder-open text-2xl text-slate-400"></i>
                    <p class="text-xs text-slate-500 dark:text-slate-400 max-w-xs px-4">No baseline backup checkpoint exists. Go to <b>System Settings</b> to generate a baseline version first.</p>
                    <button onclick="switchView('settings')" class="h-8 px-4 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900 text-xs font-semibold rounded-lg transition-colors">
                        Configure Baseline
                    </button>
                </div>
            `;
        } else if (!env.last_execution_time) {
            body = `
                <div class="flex-1 py-8 flex flex-col items-center justify-center text-center space-y-3 bg-slate-50/50 dark:bg-slate-950/20 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                    <i class="fa-solid fa-play-circle text-2xl text-slate-400 animate-pulse"></i>
                    <p class="text-xs text-slate-500 dark:text-slate-400 max-w-xs px-4">No validation runs completed yet. Click <b>Validate Now</b> in the header to execute check immediately.</p>
                    <button onclick="triggerDirectValidation(${env.environment_id})" class="h-8 px-4 bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold rounded-lg transition-colors">
                        Validate Now
                    </button>
                </div>
            `;
        } else {
            // Render Stats, Chart, Failures
            const statusClass = env.last_execution_status === "PASSED" ? "status-pill-passed" : "status-pill-failed";
            
            body = `
                <!-- Stats Row -->
                <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div class="p-3 bg-slate-50/50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/80 rounded-xl space-y-1">
                        <span class="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider block">Checked APIs</span>
                        <span class="text-lg font-bold">${env.total_apis}</span>
                    </div>
                    <div class="p-3 bg-emerald-50/10 dark:bg-emerald-950/5 border border-emerald-100/20 dark:border-emerald-900/10 rounded-xl space-y-1">
                        <span class="text-[9px] text-emerald-600 dark:text-emerald-500 font-bold uppercase tracking-wider block">Passed</span>
                        <span class="text-lg font-bold text-emerald-600 dark:text-emerald-400">${env.passed_apis}</span>
                    </div>
                    <div class="p-3 bg-rose-50/10 dark:bg-rose-950/5 border border-rose-100/20 dark:border-rose-900/10 rounded-xl space-y-1">
                        <span class="text-[9px] text-rose-600 dark:text-rose-505 font-bold uppercase tracking-wider block">Failed</span>
                        <span class="text-lg font-bold text-rose-600 dark:text-rose-400">${env.failed_apis}</span>
                    </div>
                    <div class="p-3 bg-slate-50/50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/80 rounded-xl space-y-1">
                        <span class="text-[9px] text-slate-400 dark:text-slate-505 font-bold uppercase tracking-wider block">Pass Rate</span>
                        <span class="text-lg font-bold ${env.pass_percentage === 100 ? 'text-emerald-600 dark:text-emerald-400' : 'text-primary-600 dark:text-primary-400'}">${env.pass_percentage}%</span>
                    </div>
                </div>

                <!-- Execution chart & Details -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                    <div class="h-44 flex items-center justify-center relative">
                        <canvas id="chart-env-${env.environment_id}"></canvas>
                    </div>
                    <div class="space-y-4">
                        <div class="space-y-1">
                            <span class="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider block">Last Run Timestamp</span>
                            <span class="text-xs font-semibold font-mono">${formatDate(env.last_execution_time)}</span>
                        </div>
                        <div class="space-y-1">
                            <span class="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider block">Validation Result</span>
                            <span class="inline-flex text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wide border ${statusClass}">
                                ${env.last_execution_status}
                            </span>
                        </div>
                    </div>
                </div>

                <!-- Failure Drawer List Section -->
                ${env.failed_apis > 0 ? `
                    <div class="border-t border-slate-100 dark:border-slate-800/60 pt-4 space-y-3">
                        <h4 class="text-xs font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                            <i class="fa-solid fa-bug"></i>
                            Failure Details (${env.failed_apis})
                        </h4>
                        
                        <div class="space-y-2 max-h-56 overflow-y-auto pr-1">
                            ${env.failures.map(fail => `
                                <div class="p-3 bg-red-50/10 dark:bg-red-950/10 border border-red-150/10 dark:border-red-900/20 rounded-xl flex items-center justify-between gap-4 cursor-pointer hover:bg-red-50/20 dark:hover:bg-red-950/20 hover:border-red-500/25 dark:hover:border-red-500/20 transition-all" onclick="openFailureModal(${JSON.stringify(fail).replace(/"/g, '&quot;')})">
                                    <div class="space-y-0.5 min-w-0 flex-1">
                                        <div class="font-semibold text-xs text-slate-800 dark:text-slate-150 truncate">${fail.api_name}</div>
                                        <div class="font-mono text-[10px] text-slate-450 dark:text-slate-500 truncate">${fail.api_url}</div>
                                    </div>
                                    <div class="flex items-center gap-2.5 shrink-0">
                                        <span class="text-[10px] font-bold text-rose-600 dark:text-rose-400 px-2 py-0.5 rounded-md border border-red-500/10 dark:bg-red-950/40">
                                            ${fail.failure_reason}
                                        </span>
                                        <i class="fa-solid fa-circle-chevron-right text-xs text-slate-350 dark:text-slate-600"></i>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
            `;
        }

        div.innerHTML = header + body;
        return div;
    }

    function renderEnvironmentPieChart(env) {
        const ctx = document.getElementById(`chart-env-${env.environment_id}`).getContext('2d');
        const isDark = document.documentElement.classList.contains("dark");
        
        state.chartInstances[env.environment_id] = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Passed', 'Failed'],
                datasets: [{
                    data: [env.passed_apis, env.failed_apis],
                    backgroundColor: [
                        isDark ? 'rgb(16, 185, 129)' : 'rgb(52, 211, 153)',  // Emerald
                        isDark ? 'rgb(239, 68, 68)' : 'rgb(248, 113, 113)'    // Rose
                    ],
                    borderWidth: isDark ? 2 : 1,
                    borderColor: isDark ? '#0f172a' : '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: isDark ? '#94a3b8' : '#64748b',
                            font: { family: 'Plus Jakarta Sans', size: 10, weight: 'semibold' },
                            padding: 8
                        }
                    }
                },
                cutout: '65%'
            }
        });
    }

    // Manual validation directly from Card Trigger
    window.triggerDirectValidation = async (envId) => {
        elements.headerEnvSelector.value = envId;
        state.selectedEnvId = envId;
        localStorage.setItem("selectedEnvId", envId);
        triggerManualValidation();
    };

    // Open failure modal
    window.openFailureModal = (fail) => {
        state.currentFailureData = fail;
        elements.failureModalName.innerText = fail.api_name;
        elements.failureModalUrl.innerText = fail.api_url;
        elements.failureModalReason.innerText = fail.failure_reason;

        // Show/hide diff viewer button based on whether we have an api_id
        if (fail.api_id) {
            elements.btnDiffViewer.classList.remove("hidden");
        } else {
            elements.btnDiffViewer.classList.add("hidden");
        }

        // Render json differences
        elements.failureModalDiffBox.innerHTML = "";
        
        if (!fail.difference || fail.difference.length === 0) {
            elements.failureModalDiffBox.innerHTML = `<span class="text-slate-400 italic">No structural payload differences. Connection failure or status mismatch occurred.</span>`;
        } else {
            // Render diff list
            const table = document.createElement("table");
            table.className = "w-full text-left border-collapse text-xs font-mono";
            table.innerHTML = `
                <thead>
                    <tr class="border-b border-slate-800 text-[10px] text-slate-400 uppercase font-bold">
                        <th class="py-2 w-1/3">Field Path</th>
                        <th class="py-2 w-1/3">Expected (Baseline)</th>
                        <th class="py-2 w-1/3">Actual (Live)</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-slate-800/40">
                    ${fail.difference.map(d => `
                        <tr class="align-top">
                            <td class="py-2 pr-4 text-primary-400 select-all break-all">${d.field}</td>
                            <td class="py-2 pr-4 text-emerald-400 select-all break-all">${escapeHTML(String(d.expected))}</td>
                            <td class="py-2 text-rose-450 select-all break-all">${escapeHTML(String(d.actual))}</td>
                        </tr>
                    `).join('')}
                </tbody>
            `;
            elements.failureModalDiffBox.appendChild(table);
        }

        openModal(elements.modalFailureDetail);
    };

    elements.btnFailureClose.addEventListener("click", () => {
        closeModal(elements.modalFailureDetail);
        state.currentFailureData = null;
    });

    // ==========================================
    // DIFF VIEWER MODAL LOGIC
    // ==========================================
    elements.btnDiffViewer.addEventListener("click", async () => {
        const fail = state.currentFailureData;
        if (!fail || !fail.api_id) {
            showToast("Cannot open diff viewer: API reference not available.", "error");
            return;
        }

        // Reset default side-by-side layout
        elements.diffViewerPanels.classList.remove("grid-cols-1");
        elements.diffViewerPanels.classList.add("grid-cols-2");
        elements.diffViewerCurrent.parentElement.classList.remove("hidden");
        elements.diffViewerLegend.classList.remove("hidden");

        const isComplex = fail.api_id < 0;
        if (isComplex) {
            elements.diffViewerBackupLabel.innerHTML = '<i class="fa-solid fa-square-check mr-1.5"></i> Assertions Performed';
            elements.diffViewerCurrentLabel.innerHTML = '<i class="fa-solid fa-satellite-dish mr-1.5"></i> Live Response';
        } else {
            elements.diffViewerBackupLabel.innerHTML = '<i class="fa-solid fa-cloud-arrow-down mr-1.5"></i> Baseline (Backup)';
            elements.diffViewerCurrentLabel.innerHTML = '<i class="fa-solid fa-satellite-dish mr-1.5"></i> Current (Live)';
        }

        // Show diff viewer modal with loading state
        elements.diffViewerSubtitle.innerText = `${fail.api_name} — ${fail.api_url}`;
        elements.diffViewerVersion.innerText = "";
        elements.diffViewerLoading.classList.remove("hidden");
        elements.diffViewerError.classList.add("hidden");
        elements.diffViewerPanels.classList.add("hidden");
        elements.diffViewerBackup.innerHTML = "";
        elements.diffViewerCurrent.innerHTML = "";
        elements.diffViewerChangeCount.innerText = "";
        openModal(elements.modalDiffViewer);

        try {
            // Find the environment_id from dashboard data
            let envId = null;
            for (const env of state.environments) {
                // The failure modal is opened from the dashboard card which has environment_id
                // We can find it by checking which environment's failures contain this api_id
                envId = envId || state.selectedEnvId;
            }

            const res = await axios.post(`${API_BASE}/api/validate/diff-data`, {
                api_id: fail.api_id,
                environment_id: parseInt(envId)
            });

            const data = res.data;
            elements.diffViewerLoading.classList.add("hidden");
            elements.diffViewerVersion.innerText = isComplex ? `Engine: Assertion Validation` : `Baseline: ${data.backup_version}`;

            if (data.fetch_error) {
                elements.diffViewerError.classList.remove("hidden");
                elements.diffViewerErrorMsg.innerText = data.fetch_error;
                // Still show backup data
                elements.diffViewerPanels.classList.remove("hidden");
                if (isComplex && data.assertions && data.assertions.length > 0) {
                    renderAssertionsDiffViewer(data.assertions, fail.difference);
                } else {
                    elements.diffViewerBackup.innerHTML = escapeHTML(JSON.stringify(data.backup_data, null, 2));
                }
                elements.diffViewerCurrent.innerHTML = `<span class="text-slate-400 italic">Live response unavailable.</span>`;
                elements.diffViewerChangeCount.innerText = "N/A";
            } else {
                elements.diffViewerPanels.classList.remove("hidden");
                if (isComplex && data.assertions && data.assertions.length > 0) {
                    renderAssertionsDiffViewer(data.assertions, fail.difference);
                } else {
                    renderDiffViewerPanels(data.backup_data, data.current_data);
                }
            }
        } catch (err) {
            elements.diffViewerLoading.classList.add("hidden");
            elements.diffViewerError.classList.remove("hidden");
            const detail = err.response && err.response.data && err.response.data.detail
                ? err.response.data.detail
                : "Failed to fetch diff viewer data.";
            elements.diffViewerErrorMsg.innerText = detail;
        }
    });

    elements.btnDiffViewerClose.addEventListener("click", () => closeModal(elements.modalDiffViewer));

    function renderAssertionsDiffViewer(assertions, failedDiffs) {
        // Hide the right panel's parent container and legend for assertion view
        elements.diffViewerPanels.classList.remove("grid-cols-2");
        elements.diffViewerPanels.classList.add("grid-cols-1");
        elements.diffViewerCurrent.parentElement.classList.add("hidden");
        elements.diffViewerLegend.classList.add("hidden");

        // Render left panel: Assertions
        elements.diffViewerBackup.innerHTML = "";
        const container = document.createElement("div");
        container.className = "flex flex-col gap-3.5 w-full whitespace-normal font-sans text-left";
        
        let failedCount = 0;

        assertions.forEach(assertion => {
            const failure = failedDiffs ? failedDiffs.find(d => {
                if (assertion.type === "status_code" && d.field === "status_code") return true;
                if (assertion.type === "response_time_under_ms" && d.field === "response_time") return true;
                if (assertion.type === "body_contains" && d.field === "body") return true;
                if (assertion.type === "header_contains" && d.field === "headers." + assertion.path) return true;
                if (assertion.type === "json_path_exists" && d.field === assertion.path) return true;
                if (assertion.type === "json_path_equals" && d.field === assertion.path) return true;
                if (assertion.type === "json_path_contains" && d.field === assertion.path) return true;
                if (assertion.type === "json_path_type" && d.field === assertion.path + " (type)") return true;
                if (assertion.type === "json_schema" && d.field === "json_schema") return true;
                return false;
            }) : null;

            const isFailed = !!failure;
            if (isFailed) failedCount++;

            const card = document.createElement("div");
            card.className = `p-3.5 rounded-xl border flex flex-col gap-2 transition-all ${
                isFailed 
                    ? 'bg-rose-50/10 dark:bg-rose-950/10 border-rose-200 dark:border-rose-900/50 shadow-sm shadow-rose-100/10' 
                    : 'bg-emerald-50/10 dark:bg-emerald-950/10 border-emerald-200 dark:border-emerald-900/20'
            }`;
            
            card.innerHTML = `
                <div class="flex items-center justify-between gap-3">
                    <span class="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                        <i class="${isFailed ? 'fa-solid fa-circle-xmark text-rose-500' : 'fa-solid fa-circle-check text-emerald-500'}"></i>
                        ${getAssertionDescription(assertion)}
                    </span>
                    <span class="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                        isFailed 
                            ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300' 
                            : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                    }">
                        ${isFailed ? 'Failed' : 'Passed'}
                    </span>
                </div>
                ${isFailed ? `
                    <div class="mt-1 grid grid-cols-2 gap-3 text-[11px] font-mono p-2 bg-slate-50/50 dark:bg-slate-950/50 rounded-lg border border-slate-100 dark:border-slate-800">
                        <div>
                            <span class="text-slate-400 dark:text-slate-500 block font-sans text-[10px] uppercase font-bold tracking-wide">Expected</span>
                            <span class="text-emerald-600 dark:text-emerald-400 break-all select-all whitespace-pre-wrap">${escapeHTML(String(failure.expected))}</span>
                        </div>
                        <div>
                            <span class="text-slate-400 dark:text-slate-500 block font-sans text-[10px] uppercase font-bold tracking-wide">Actual</span>
                            <span class="text-rose-600 dark:text-rose-500 break-all select-all whitespace-pre-wrap">${escapeHTML(String(failure.actual))}</span>
                        </div>
                    </div>
                ` : ''}
            `;
            container.appendChild(card);
        });
        
        elements.diffViewerBackup.appendChild(container);
        elements.diffViewerChangeCount.innerText = failedCount === 0
            ? "All assertions passed"
            : `${failedCount} assertion${failedCount !== 1 ? 's' : ''} failed`;
    }

    function getAssertionDescription(assertion) {
        switch (assertion.type) {
            case "status_code":
                return `Status Code is <b>${assertion.expected}</b>`;
            case "response_time_under_ms":
                return `Response Time under <b>${assertion.expected}ms</b>`;
            case "body_contains":
                return `Body contains string: <code>"${escapeHTML(assertion.expected)}"</code>`;
            case "header_contains":
                return `Header <code>"${escapeHTML(assertion.path)}"</code> contains <code>"${escapeHTML(assertion.expected)}"</code>`;
            case "json_path_exists":
                return `JSON Path <code>"${escapeHTML(assertion.path)}"</code> exists`;
            case "json_path_equals":
                return `JSON Path <code>"${escapeHTML(assertion.path)}"</code> equals <b>${assertion.expected}</b>`;
            case "json_path_contains":
                return `JSON Path <code>"${escapeHTML(assertion.path)}"</code> contains <b>${assertion.expected}</b>`;
            case "json_path_type":
                return `JSON Path <code>"${escapeHTML(assertion.path)}"</code> is of type <b>${assertion.expected}</b>`;
            case "json_schema":
                return `JSON body complies with Schema`;
            default:
                return `Custom assertion: ${assertion.type}`;
        }
    }

    /**
     * Renders JSON in both panels with line-level diff highlighting on the current panel.
     * Compares backup vs current by flattening both into JSON lines and marking differences.
     */
    function renderDiffViewerPanels(backupData, currentData) {
        const backupStr = JSON.stringify(backupData, null, 2);
        const currentStr = JSON.stringify(currentData, null, 2);

        // Render backup panel (clean, no highlights)
        elements.diffViewerBackup.innerHTML = escapeHTML(backupStr);

        // Build a set of changed paths from the diff data for quick lookup
        const fail = state.currentFailureData;
        const changedFields = new Set();
        if (fail && fail.difference) {
            fail.difference.forEach(d => changedFields.add(d.field));
        }

        // Deep compare to find all differences and highlight in the current JSON
        const diffPaths = collectDiffPaths(backupData, currentData, "");

        // Render current panel with highlights
        const currentLines = currentStr.split("\n");
        const backupLines = backupStr.split("\n");

        // Build a map of key paths to line indices in the current JSON
        // We'll use a simpler approach: compare line by line and highlight differences
        let changeCount = 0;
        const highlightedLines = currentLines.map((line, idx) => {
            const backupLine = idx < backupLines.length ? backupLines[idx] : undefined;
            const escapedLine = escapeHTML(line);

            if (backupLine === undefined) {
                // Extra line in current (added)
                changeCount++;
                return `<span class="diff-line-added">${escapedLine}</span>`;
            } else if (line !== backupLine) {
                // Line differs
                changeCount++;
                return `<span class="diff-line-changed">${escapedLine}</span>`;
            }
            return escapedLine;
        });

        // Check for lines removed (backup had more lines)
        if (backupLines.length > currentLines.length) {
            for (let i = currentLines.length; i < backupLines.length; i++) {
                changeCount++;
                highlightedLines.push(`<span class="diff-line-removed">${escapeHTML("// [removed]")}</span>`);
            }
        }

        elements.diffViewerCurrent.innerHTML = highlightedLines.join("\n");
        elements.diffViewerChangeCount.innerText = changeCount === 0
            ? "No changes"
            : `${changeCount} line${changeCount !== 1 ? 's' : ''} changed`;
    }

    /**
     * Recursively collects all paths where backup and current JSON differ.
     */
    function collectDiffPaths(backup, current, prefix) {
        const paths = [];
        if (backup === null || current === null || typeof backup !== typeof current) {
            if (backup !== current) paths.push(prefix || "root");
            return paths;
        }
        if (typeof backup !== "object") {
            if (backup !== current) paths.push(prefix || "root");
            return paths;
        }
        if (Array.isArray(backup) && Array.isArray(current)) {
            const maxLen = Math.max(backup.length, current.length);
            for (let i = 0; i < maxLen; i++) {
                const p = `${prefix}[${i}]`;
                if (i >= backup.length) { paths.push(p); continue; }
                if (i >= current.length) { paths.push(p); continue; }
                paths.push(...collectDiffPaths(backup[i], current[i], p));
            }
            return paths;
        }
        const allKeys = new Set([...Object.keys(backup), ...Object.keys(current)]);
        for (const key of allKeys) {
            const p = prefix ? `${prefix}.${key}` : key;
            if (!(key in backup)) { paths.push(p); continue; }
            if (!(key in current)) { paths.push(p); continue; }
            paths.push(...collectDiffPaths(backup[key], current[key], p));
        }
        return paths;
    }

    function escapeHTML(str) {
        return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    }

    // ==========================================
    // MANUAL VALIDATION TRIGGER
    // ==========================================
    async function triggerManualValidation() {
        if (!state.selectedEnvId) {
            showToast("Please configure and select an environment first.", "error");
            return;
        }

        const env = state.environments.find(e => String(e.id) === String(state.selectedEnvId));
        const envName = env ? env.name : "Environment";

        showOverlay(`Running live API check on ${envName}...`);

        try {
            const res = await axios.post(`${API_BASE}/api/validate`, {
                environment_id: parseInt(state.selectedEnvId)
            });
            const execution = res.data;

            hideOverlay();
            
            if (execution.status === "PASSED") {
                showToast(`Validation check passed successfully on ${envName}!`, "success");
            } else {
                showToast(`Validation check failed: ${execution.failed} API failures detected on ${envName}`, "error");
            }

            // Refresh Dashboard view
            fetchDashboard();
        } catch (err) {
            hideOverlay();
            const detail = err.response && err.response.data && err.response.data.detail
                ? err.response.data.detail
                : "An unexpected error occurred.";
                
            showAlert("Validation Engine Mismatch", detail, false);
            showToast("Validation run aborted", "error");
        }
    }

    elements.btnValidateNow.addEventListener("click", triggerManualValidation);

    // ==========================================
    // VIEW 2: API REGISTRY PAGE
    // ==========================================
    async function fetchAPIs() {
        if (!state.selectedRegistryEnvId) {
            elements.apiTableBody.innerHTML = `
                <tr>
                    <td colspan="4" class="px-6 py-12 text-center text-slate-400 dark:text-slate-500">
                        <i class="fa-solid fa-server text-xl mb-2 block"></i>
                        Please select an environment from the dropdown above.
                    </td>
                </tr>
            `;
            return;
        }
        try {
            const res = await axios.get(`${API_BASE}/api/apis?environment_id=${state.selectedRegistryEnvId}`);
            const complexRes = await axios.get(`${API_BASE}/api/complex-apis?environment_id=${state.selectedRegistryEnvId}`);
            
            const standardApis = res.data.map(api => ({ ...api, is_complex: false }));
            const complexApis = complexRes.data.map(api => ({ ...api, is_complex: true, endpoint: api.curl_command }));
            
            state.apis = [...standardApis, ...complexApis];
            renderAPITable(state.apis);
        } catch (err) {
            loggerError("Error loading APIs registry", err);
            showToast("Failed to fetch API registry", "error");
        }
    }

    function renderAPITable(apisList) {
        elements.apiTableBody.innerHTML = "";
        
        if (apisList.length === 0) {
            elements.apiTableBody.innerHTML = `
                <tr>
                    <td colspan="4" class="px-6 py-12 text-center text-slate-400 dark:text-slate-500">
                        <i class="fa-solid fa-network-wired text-xl mb-2 block"></i>
                        No APIs currently registered in this environment. Use the buttons or FAB to add or import.
                    </td>
                </tr>
            `;
            return;
        }

        apisList.forEach(api => {
            const tr = document.createElement("tr");
            tr.className = "hover:bg-slate-50/40 dark:hover:bg-slate-900/30 transition-colors";
            
            const typeBadge = api.is_complex
                ? `<span class="inline-flex items-center text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider bg-amber-50 border border-amber-200 text-amber-800 dark:bg-amber-950/40 dark:border-amber-900/30 dark:text-amber-400">Complex</span>`
                : `<span class="inline-flex items-center text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider bg-slate-100 border border-slate-200 text-slate-600 dark:bg-slate-800/40 dark:border-slate-800 dark:text-slate-400">Standard</span>`;

            const displayEndpoint = api.is_complex
                ? `<span class="text-slate-400 dark:text-slate-500 font-mono text-[9px] bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-1.5 py-0.5 rounded mr-1.5 font-bold uppercase select-none">CURL</span><span class="font-mono text-xs text-amber-600 dark:text-amber-400 select-all" title="${escapeHTML(api.endpoint)}">${escapeHTML(api.endpoint.substring(0, 80))}${api.endpoint.length > 80 ? '...' : ''}</span>`
                : `<span class="font-mono text-xs text-primary-500 select-all">${api.endpoint}</span>`;

            const serializedApi = JSON.stringify(api).replace(/"/g, '&quot;');

            const actionButtons = api.is_complex
                ? `<button class="h-8 w-8 text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" onclick="editComplexApiFromRegistry(${serializedApi})" title="Edit Complex API">
                        <i class="fa-solid fa-pen text-xs"></i>
                    </button>
                    <button class="h-8 w-8 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors" onclick="deleteComplexApiFromRegistry(${api.id}, '${escapeHTML(api.name.replace(/'/g, "\\'"))}')" title="Delete Complex API">
                        <i class="fa-solid fa-trash-can text-xs"></i>
                    </button>`
                : `<button class="h-8 w-8 text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" onclick="openAPIModal(${serializedApi})" title="Edit API">
                        <i class="fa-solid fa-pen text-xs"></i>
                    </button>
                    <button class="h-8 w-8 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors" onclick="confirmDeleteAPI(${api.id})" title="Delete API">
                        <i class="fa-solid fa-trash-can text-xs"></i>
                    </button>`;

            tr.innerHTML = `
                <td class="px-6 py-4 font-bold text-slate-900 dark:text-white select-all">
                    <div class="flex items-center gap-2.5">
                        ${typeBadge}
                        <span>${api.name}</span>
                    </div>
                </td>
                <td class="px-6 py-4">${displayEndpoint}</td>
                <td class="px-6 py-4 text-xs text-slate-400 dark:text-slate-500">${formatDate(api.created_at).split(" ")[0]}</td>
                <td class="px-6 py-4 text-right space-x-1">
                    ${actionButtons}
                </td>
            `;
            elements.apiTableBody.appendChild(tr);
        });
    }

    window.editComplexApiFromRegistry = (api) => {
        window.editComplexApi(api);
    };

    window.deleteComplexApiFromRegistry = async (id, name) => {
        if (!confirm(`Are you sure you want to delete the complex API '${name}'?`)) return;
        showOverlay("Deleting API...");
        try {
            await axios.delete(`${API_BASE}/api/complex-apis/${id}`);
            hideOverlay();
            showToast("Complex API deleted.");
            fetchComplexApis();
            fetchAPIs();
        } catch (err) {
            hideOverlay();
            showToast("Failed to delete complex API", "error");
        }
    };

    // Debounced real-time Search Filtering
    let searchDebounceTimer;
    elements.apiSearchBar.addEventListener("input", (e) => {
        clearTimeout(searchDebounceTimer);
        searchDebounceTimer = setTimeout(() => {
            const query = e.target.value.toLowerCase().trim();
            const filtered = state.apis.filter(api => 
                api.name.toLowerCase().includes(query) || 
                api.endpoint.toLowerCase().includes(query)
            );
            renderAPITable(filtered);
        }, 150);
    });

    // Add API FAB Modal Trigger
    elements.btnAddApiFab.addEventListener("click", async () => {
        if (!state.selectedRegistryEnvId) {
            showToast("Please select an environment first.", "warning");
            return;
        }
        await loadGlobalVariablesForAutocomplete();
        elements.apiForm.reset();
        elements.apiModalTitle.innerText = "Register New API";
        elements.apiIdField.value = "";
        elements.apiEnvIdField.value = state.selectedRegistryEnvId;
        openModal(elements.modalApi);
    });

    elements.btnRegistryAddComplexApi.addEventListener("click", async () => {
        if (!state.selectedRegistryEnvId) {
            showToast("Please select an environment first.", "warning");
            return;
        }
        await loadGlobalVariablesForAutocomplete();
        elements.inputCaId.value = "";
        elements.inputCaName.value = "";
        elements.inputCaCurl.value = "";
        elements.caExtractRulesContainer.innerHTML = "";
        elements.caAssertionsContainer.innerHTML = "";
        elements.modalComplexApiTitle.innerText = "Add Complex API";
        
        // Populate environments and preselect current active registry environment
        elements.inputCaEnv.innerHTML = state.environments.map(e => 
            `<option value="${e.id}" ${String(e.id) === String(state.selectedRegistryEnvId) ? 'selected' : ''}>${e.name}</option>`
        ).join("");
        
        openModal(elements.modalComplexApi);
    });

    window.openAPIModal = async (api) => {
        await loadGlobalVariablesForAutocomplete();
        elements.apiForm.reset();
        elements.apiModalTitle.innerText = "Edit API Configuration";
        elements.apiIdField.value = api.id;
        elements.apiEnvIdField.value = api.environment_id || state.selectedRegistryEnvId;
        elements.apiName.value = api.name;
        elements.apiEndpoint.value = api.endpoint;
        openModal(elements.modalApi);
    };

    elements.btnApiCancel.addEventListener("click", () => closeModal(elements.modalApi));

    elements.apiForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const id = elements.apiIdField.value;
        const envId = elements.apiEnvIdField.value;
        const payload = {
            environment_id: parseInt(envId),
            name: elements.apiName.value.trim(),
            endpoint: elements.apiEndpoint.value.trim()
        };

        // Form endpoint validation (must be absolute URL starting with http:// or https://)
        if (!payload.endpoint.startsWith("http://") && !payload.endpoint.startsWith("https://")) {
            showToast("Endpoint must start with http:// or https://", "error");
            return;
        }

        try {
            if (id) {
                // Update
                await axios.put(`${API_BASE}/api/apis/${id}`, payload);
                showToast("API configuration updated successfully.");
            } else {
                // Create
                await axios.post(`${API_BASE}/api/apis`, payload);
                showToast("New API registered successfully.");
            }
            closeModal(elements.modalApi);
            fetchAPIs();
        } catch (err) {
            const detail = err.response && err.response.data && err.response.data.detail
                ? err.response.data.detail
                : "Failed to save API details.";
            showToast(detail, "error");
        }
    });

    // API Deletion Confirmation
    let apiIdToDelete = null;
    window.confirmDeleteAPI = (id) => {
        apiIdToDelete = id;
        showConfirmModal({
            title: "Confirm Removal",
            message: "Are you sure you want to remove this API from the registry? This cannot be undone.",
            confirmText: "Remove",
            onConfirm: executeDeleteAPI
        });
    };

    async function executeDeleteAPI() {
        if (!apiIdToDelete) return;
        try {
            await axios.delete(`${API_BASE}/api/apis/${apiIdToDelete}`);
            showToast("API removed successfully from registry.");
            closeModal(elements.modalConfirm);
            fetchAPIs();
        } catch (err) {
            showToast("Failed to delete API", "error");
        } finally {
            apiIdToDelete = null;
        }
    }

    elements.btnConfirmCancel.addEventListener("click", () => {
        closeModal(elements.modalConfirm);
        apiIdToDelete = null;
        envIdToDelete = null;
    });

    // ==========================================
    // VIEW 3: SYSTEM SETTINGS PAGE
    // ==========================================
    async function fetchSettingsData() {
        // Load Environments settings view
        renderSettingsEnvironments();
        // Load settings inputs
        fetchSchedulerSettings();
        // Load communication settings
        fetchCommunicationSettings();
        // Populate filter backups dropdown
        populateFilterBackupsDropdown();
        // Load available backups
        fetchAvailableBackups();
    }

    function renderSettingsEnvironments() {
        elements.environmentsGrid.innerHTML = "";
        
        state.environments.forEach(env => {
            const card = document.createElement("div");
            card.className = "glass-panel p-5 rounded-2xl flex flex-col justify-between gap-4 border border-slate-200 dark:border-slate-800 shadow-sm";
            card.innerHTML = `
                <div class="flex items-start justify-between gap-4">
                    <div class="space-y-1">
                        <h4 class="font-bold text-slate-900 dark:text-white">${env.name}</h4>
                        <p class="font-mono text-xs text-primary-500 break-all select-all">${env.base_url}</p>
                    </div>
                    <div class="flex items-center gap-2">
                        <span class="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">Include in Schedule</span>
                        <label class="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" class="sr-only peer" ${env.schedule_enabled !== false ? 'checked' : ''} onchange="toggleEnvSchedule(${env.id}, this.checked)">
                            <div class="w-8 h-4 bg-slate-200 dark:bg-slate-700 rounded-full peer peer-checked:bg-primary-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-350 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:after:translate-x-4"></div>
                        </label>
                    </div>
                </div>
                <div class="flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800/80 pt-3">
                    <button class="h-8 px-3 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-500 hover:text-primary-600 dark:hover:text-primary-400 transition-colors flex items-center gap-1.5" onclick="openEnvModal(${JSON.stringify(env).replace(/"/g, '&quot;')})">
                        <i class="fa-solid fa-pen"></i>
                        <span>Edit</span>
                    </button>
                    <button class="h-8 px-3 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20 text-xs font-semibold text-slate-500 hover:text-red-600 transition-colors flex items-center gap-1.5" onclick="confirmDeleteEnv(${env.id})">
                        <i class="fa-solid fa-trash-can"></i>
                        <span>Delete</span>
                    </button>
                </div>
            `;
            elements.environmentsGrid.appendChild(card);
        });

        // If less than 4 environments, render the Add Card
        if (state.environments.length < 4) {
            const addCard = document.createElement("button");
            addCard.className = "btn-ripple min-h-36 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center text-slate-400 hover:text-primary-500 hover:border-primary-500 dark:hover:border-primary-400 dark:hover:text-primary-400 hover:bg-white dark:hover:bg-slate-900 transition-all gap-2 p-5";
            addCard.onclick = () => {
                elements.envModalTitle.innerText = "Configure Environment";
                elements.envIdField.value = "";
                elements.envForm.reset();
                openModal(elements.modalEnv);
            };
            addCard.innerHTML = `
                <div class="h-10 w-10 rounded-full border border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center">
                    <i class="fa-solid fa-plus text-base"></i>
                </div>
                <span class="text-xs font-bold uppercase tracking-wider">Configure Environment</span>
            `;
            elements.environmentsGrid.appendChild(addCard);
        }
    }

    window.toggleEnvSchedule = async (id, isChecked) => {
        const env = state.environments.find(e => String(e.id) === String(id));
        if (!env) return;

        // Helper to perform the actual toggle API call
        async function performToggle(envId, enabled, envName) {
            try {
                await axios.patch(`${API_BASE}/api/environments/${envId}/schedule`, {
                    schedule_enabled: enabled
                });
                showToast(`Scheduled runs ${enabled ? 'enabled' : 'disabled'} for ${envName}.`);
                await loadGlobalDropdowns();
                if (state.activeView === "dashboard") {
                    fetchDashboard();
                } else if (state.activeView === "settings") {
                    renderSettingsEnvironments();
                }
            } catch (err) {
                console.error("Failed to update environment schedule status", err);
                const detail = err.response && err.response.data && err.response.data.detail
                    ? err.response.data.detail
                    : "Failed to update schedule status.";
                showToast(detail, "error");

                // Re-render to revert toggle position
                if (state.activeView === "dashboard") {
                    fetchDashboard();
                } else if (state.activeView === "settings") {
                    renderSettingsEnvironments();
                }
            }
        }

        // Ask for confirmation only when disabling (switching to unchecked)
        if (!isChecked) {
            showConfirmModal({
                title: "Disable Schedule",
                message: `Are you sure you want to exclude "${env.name}" from scheduled validation runs?`,
                confirmText: "Disable",
                confirmClass: "bg-amber-600 hover:bg-amber-700",
                iconClass: "h-12 w-12 rounded-full bg-amber-50 dark:bg-amber-950/30 text-amber-500 flex items-center justify-center mx-auto text-lg border border-amber-200 dark:border-amber-800",
                iconHtml: '<i class="fa-solid fa-calendar-xmark"></i>',
                onConfirm: async () => {
                    closeModal(elements.modalConfirm);
                    await performToggle(id, false, env.name);
                }
            });

            // Set cancel to revert the toggle visually
            elements.btnConfirmCancel.onclick = () => {
                closeModal(elements.modalConfirm);
                if (state.activeView === "dashboard") {
                    fetchDashboard();
                } else if (state.activeView === "settings") {
                    renderSettingsEnvironments();
                }
            };
        } else {
            // Enable directly without confirmation
            await performToggle(id, true, env.name);
        }
    };

    window.openEnvModal = (env) => {
        elements.envModalTitle.innerText = "Edit Environment";
        elements.envIdField.value = env.id;
        elements.envName.value = env.name;
        elements.envUrl.value = env.base_url;
        openModal(elements.modalEnv);
    };

    elements.btnEnvCancel.addEventListener("click", () => closeModal(elements.modalEnv));

    elements.envForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const id = elements.envIdField.value;
        const payload = {
            name: elements.envName.value.trim(),
            base_url: elements.envUrl.value.trim()
        };

        try {
            if (id) {
                await axios.put(`${API_BASE}/api/environments/${id}`, payload);
                showToast("Environment settings modified.");
            } else {
                await axios.post(`${API_BASE}/api/environments`, payload);
                showToast("Environment added successfully.");
            }
            closeModal(elements.modalEnv);
            await loadGlobalDropdowns();
            renderSettingsEnvironments();
            
            // Reload active environment check
            if (state.activeView === "dashboard") {
                fetchDashboard();
            }
        } catch (err) {
            const detail = err.response && err.response.data && err.response.data.detail
                ? err.response.data.detail
                : "Failed to configure environment.";
            showToast(detail, "error");
        }
    });

    // Environment delete
    let envIdToDelete = null;
    window.confirmDeleteEnv = (id) => {
        envIdToDelete = id;
        showConfirmModal({
            title: "Confirm Removal",
            message: "Are you sure you want to remove this environment? All backup index logs and execution runs for this environment will be deleted.",
            confirmText: "Remove",
            onConfirm: executeDeleteEnv
        });
    };

    async function executeDeleteEnv() {
        if (!envIdToDelete) return;
        try {
            await axios.delete(`${API_BASE}/api/environments/${envIdToDelete}`);
            showToast("Environment removed successfully.");
            closeModal(elements.modalConfirm);
            
            if (String(state.selectedEnvId) === String(envIdToDelete)) {
                state.selectedEnvId = "";
                localStorage.removeItem("selectedEnvId");
            }
            
            await loadGlobalDropdowns();
            renderSettingsEnvironments();
        } catch (err) {
            showToast("Failed to delete environment.", "error");
        } finally {
            envIdToDelete = null;
        }
    }

    // ==========================================
    // BACKUP ENGINE RUNNER
    // ==========================================
    elements.btnBackupNow.addEventListener("click", async () => {
        const envId = elements.settingsBackupEnv.value;
        if (!envId) {
            showToast("Please choose an environment to backup.", "error");
            return;
        }

        const env = state.environments.find(e => String(e.id) === String(envId));
        const envName = env ? env.name : "Environment";

        // UI trigger transition disable clicks
        elements.btnBackupNow.disabled = true;
        elements.btnBackupNow.innerHTML = `<i class="fa-solid fa-spinner animate-spin mr-1"></i> Running...`;

        showToast(`Starting baseline generation for ${envName}...`, "info");

        try {
            await axios.post(`${API_BASE}/api/backup`, {
                environment_id: parseInt(envId)
            });
            
            showToast("Baseline backup completed successfully.", "success");
            showAlert("Baseline Backup Complete", `Baseline responses have been fetched and stored successfully as the active baseline version for ${envName}.`, true);
            
            // Reload global stats
            if (String(envId) === String(state.selectedEnvId)) {
                fetchDashboard();
            }
        } catch (err) {
            const detail = err.response && err.response.data && err.response.data.detail
                ? err.response.data.detail
                : "Baseline execution failed.";
                
            showAlert("Baseline Backup Error", detail, false);
            showToast("Baseline backup aborted", "error");
        } finally {
            elements.btnBackupNow.disabled = false;
            elements.btnBackupNow.innerHTML = `<i class="fa-solid fa-camera mr-1"></i> Backup Now`;
        }
    });

    // ==========================================
    // CSV BATCH IMPORT HANDLERS
    // ==========================================
    elements.importCsvFile.addEventListener("change", async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Reset target element value so same file can trigger change again
        elements.importCsvFile.value = "";

        // Verify CSV file extension
        if (!file.name.endsWith(".csv")) {
            showAlert("Invalid Format", "Only standard .csv files are supported. Please verify template.");
            return;
        }

        const csvImportEnvId = elements.importCsvEnvSelector.value;
        if (!csvImportEnvId) {
            showToast("Please select a target environment for CSV import.", "error");
            elements.importCsvFile.value = "";
            return;
        }

        const formData = new FormData();
        formData.append("file", file);
        formData.append("environment_id", csvImportEnvId);

        showOverlay("Parsing CSV records...");

        try {
            const res = await axios.post(`${API_BASE}/api/apis/import/preview`, formData, {
                headers: { "Content-Type": "multipart/form-data" }
            });
            state.csvPreviewData = res.data;
            
            hideOverlay();
            renderCsvPreview(state.csvPreviewData);
        } catch (err) {
            hideOverlay();
            const detail = err.response && err.response.data && err.response.data.detail
                ? err.response.data.detail
                : "An error occurred while uploading file.";
            showAlert("File Upload Rejected", detail, false);
        }
    });

    function renderCsvPreview(preview) {
        elements.csvPreviewBody.innerHTML = "";
        elements.csvPreviewSummary.innerText = `${preview.valid_rows} valid, ${preview.invalid_rows} invalid`;

        preview.rows.forEach(row => {
            const tr = document.createElement("tr");
            tr.className = row.is_valid 
                ? "hover:bg-slate-50/40 transition-colors" 
                : "bg-red-50/10 text-red-600";
                
            const statusBadge = row.is_valid
                ? `<span class="inline-flex text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider bg-emerald-50 border border-emerald-200 text-emerald-800">Valid</span>`
                : `<span class="inline-flex text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider bg-rose-50 border border-rose-200 text-rose-800" title="${row.error_message}">Invalid</span>`;

            tr.innerHTML = `
                <td class="px-4 py-3 text-center text-slate-400 font-mono">${row.serial_number}</td>
                <td class="px-4 py-3 font-bold truncate max-w-[150px]">${escapeHTML(row.name)}</td>
                <td class="px-4 py-3 font-mono text-[10px] truncate max-w-[260px]" title="${row.endpoint}">${escapeHTML(row.endpoint)}</td>
                <td class="px-4 py-3 flex items-center justify-between gap-2">
                    ${statusBadge}
                    ${!row.is_valid ? `<p class="text-[10px] font-semibold text-rose-500 italic truncate max-w-[120px]">${row.error_message}</p>` : ''}
                </td>
            `;
            elements.csvPreviewBody.appendChild(tr);
        });

        // Warning panel alert
        if (!preview.can_import) {
            elements.csvImportWarning.classList.remove("hidden");
            elements.btnCsvImport.disabled = true;
        } else {
            elements.csvImportWarning.classList.add("hidden");
            elements.btnCsvImport.disabled = false;
        }

        openModal(elements.modalCsvPreview);
    }

    elements.btnCsvCancel.addEventListener("click", () => {
        closeModal(elements.modalCsvPreview);
        state.csvPreviewData = null;
        showToast("CSV import aborted", "info");
    });

    elements.btnCsvImport.addEventListener("click", async () => {
        if (!state.csvPreviewData || !state.csvPreviewData.can_import) return;

        // Build simple list for endpoint payload
        const csvImportEnvId = elements.importCsvEnvSelector.value;
        const payload = state.csvPreviewData.rows.map(r => ({
            environment_id: parseInt(csvImportEnvId),
            name: r.name,
            endpoint: r.endpoint
        }));

        showOverlay("Importing APIs registry...");

        try {
            await axios.post(`${API_BASE}/api/apis/import/commit`, payload);
            hideOverlay();
            closeModal(elements.modalCsvPreview);
            showToast(`Imported ${payload.length} APIs successfully.`, "success");
            showAlert("Import Successful", `Successfully imported and registered ${payload.length} API configurations in the database registry.`, true);
            state.csvPreviewData = null;
            
            // If current registry page visible, refresh
            if (state.activeView === "registry") {
                fetchAPIs();
            }
        } catch (err) {
            hideOverlay();
            showToast("Failed to commit imported list.", "error");
        }
    });

    // ==========================================
    // CRON SCHEDULER SETTINGS HANDLERS
    // ==========================================
    async function fetchSchedulerSettings() {
        try {
            const res = await axios.get(`${API_BASE}/api/settings/scheduler`);
            state.schedulerCards = res.data;
            renderSchedulerCards();
        } catch (err) {
            loggerError("Error fetching scheduler cards", err);
        }
    }

    function renderSchedulerCards() {
        elements.schedulerGrid.innerHTML = "";
        
        state.schedulerCards.forEach(card => {
            const div = document.createElement("div");
            div.className = "glass-panel p-5 rounded-2xl flex flex-col justify-between gap-4 border border-slate-200 dark:border-slate-800 shadow-sm";
            div.innerHTML = `
                <div class="space-y-1">
                    <h4 class="font-bold text-slate-900 dark:text-white">${card.name}</h4>
                    <p class="font-semibold text-sm text-primary-500 flex items-center gap-1.5">
                        <i class="fa-regular fa-clock"></i>
                        <span>${card.time}</span>
                    </p>
                </div>
                <div class="flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800/80 pt-3">
                    <button class="h-8 px-3 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-500 hover:text-primary-600 dark:hover:text-primary-400 transition-colors flex items-center gap-1.5" onclick="openSchedulerModal(${JSON.stringify(card).replace(/"/g, '&quot;')})">
                        <i class="fa-solid fa-pen"></i>
                        <span>Edit</span>
                    </button>
                    <button class="h-8 px-3 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20 text-xs font-semibold text-slate-500 hover:text-red-600 transition-colors flex items-center gap-1.5" onclick="confirmDeleteScheduler(${card.id})">
                        <i class="fa-solid fa-trash-can"></i>
                        <span>Delete</span>
                    </button>
                </div>
            `;
            elements.schedulerGrid.appendChild(div);
        });

        // Add Card (Limit to 100 cards)
        if (state.schedulerCards.length < 100) {
            const addCard = document.createElement("button");
            addCard.className = "btn-ripple min-h-32 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center text-slate-400 hover:text-primary-500 hover:border-primary-500 dark:hover:border-primary-400 dark:hover:text-primary-400 hover:bg-white dark:hover:bg-slate-900 transition-all gap-2 p-5";
            addCard.onclick = () => {
                elements.schedulerModalTitle.innerText = "Configure Time Slot";
                elements.schedulerIdField.value = "";
                elements.schedulerForm.reset();
                openModal(elements.modalScheduler);
            };
            addCard.innerHTML = `
                <div class="h-10 w-10 rounded-full border border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center">
                    <i class="fa-solid fa-plus text-base"></i>
                </div>
                <span class="text-xs font-bold uppercase tracking-wider">Configure Time Slot</span>
            `;
            elements.schedulerGrid.appendChild(addCard);
        }
    }

    window.openSchedulerModal = (card) => {
        elements.schedulerModalTitle.innerText = "Edit Time Slot";
        elements.schedulerIdField.value = card.id;
        elements.schedulerName.value = card.name;
        elements.schedulerTime.value = card.time;
        openModal(elements.modalScheduler);
    };

    elements.btnSchedulerCancel.addEventListener("click", () => closeModal(elements.modalScheduler));

    elements.schedulerForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const id = elements.schedulerIdField.value;
        const payload = {
            name: elements.schedulerName.value.trim(),
            time: elements.schedulerTime.value.trim()
        };

        try {
            if (id) {
                await axios.put(`${API_BASE}/api/settings/scheduler/${id}`, payload);
                showToast("Scheduler time slot updated successfully.");
            } else {
                await axios.post(`${API_BASE}/api/settings/scheduler`, payload);
                showToast("Scheduler time slot configured successfully.");
            }
            closeModal(elements.modalScheduler);
            fetchSchedulerSettings();
        } catch (err) {
            const errorMsg = err.response?.data?.detail || "Failed to save scheduler slot. Please check format.";
            showToast(errorMsg, "error");
        }
    });

    let schedulerIdToDelete = null;
    window.confirmDeleteScheduler = (id) => {
        schedulerIdToDelete = id;
        showConfirmModal({
            title: "Confirm Removal",
            message: "Are you sure you want to remove this scheduler slot? Background validations will no longer run at this time.",
            confirmText: "Remove",
            onConfirm: executeDeleteScheduler
        });
    };

    async function executeDeleteScheduler() {
        if (!schedulerIdToDelete) return;
        try {
            await axios.delete(`${API_BASE}/api/settings/scheduler/${schedulerIdToDelete}`);
            showToast("Scheduler time slot removed.");
            closeModal(elements.modalConfirm);
            fetchSchedulerSettings();
        } catch (err) {
            showToast("Failed to delete scheduler time slot.", "error");
        } finally {
            schedulerIdToDelete = null;
        }
    }

    // ==========================================
    // COMMUNICATION SETTINGS HANDLERS
    // ==========================================
    elements.notificationChannel.addEventListener("change", () => {
        const val = elements.notificationChannel.value;
        toggleCommunicationConfigFields(val);
    });

    function toggleCommunicationConfigFields(channel) {
        if (channel === "slack" || channel === "teams") {
            elements.webhookConfigWrapper.classList.remove("hidden");
            elements.emailConfigWrapper.classList.add("hidden");
        } else if (channel === "email") {
            elements.emailConfigWrapper.classList.remove("hidden");
            elements.webhookConfigWrapper.classList.add("hidden");
        } else {
            elements.webhookConfigWrapper.classList.add("hidden");
            elements.emailConfigWrapper.classList.add("hidden");
        }
    }

    async function fetchCommunicationSettings() {
        try {
            const res = await axios.get(`${API_BASE}/api/settings/communication`);
            const data = res.data;
            
            elements.notificationChannel.value = data.channel;
            toggleCommunicationConfigFields(data.channel);
            
            elements.inputWebhookUrl.value = data.webhook_url || "";
            elements.inputSmtpServer.value = data.smtp_server || "";
            elements.inputSmtpPort.value = data.smtp_port || "";
            elements.inputSenderEmail.value = data.sender_email || "";
            elements.inputSenderPassword.value = data.sender_password || "";
            elements.inputRecipientEmail.value = data.recipient_email || "";
        } catch (err) {
            loggerError("Error loading communication settings", err);
        }
    }

    function getCommunicationPayload() {
        const channel = elements.notificationChannel.value;
        return {
            channel: channel,
            webhook_url: (channel === "slack" || channel === "teams") ? elements.inputWebhookUrl.value.trim() : null,
            smtp_server: channel === "email" ? elements.inputSmtpServer.value.trim() : null,
            smtp_port: channel === "email" ? parseInt(elements.inputSmtpPort.value) || null : null,
            sender_email: channel === "email" ? elements.inputSenderEmail.value.trim() : null,
            sender_password: channel === "email" ? elements.inputSenderPassword.value.trim() : null,
            recipient_email: channel === "email" ? elements.inputRecipientEmail.value.trim() : null
        };
    }

    elements.btnSaveCommunication.addEventListener("click", async () => {
        const payload = getCommunicationPayload();
        try {
            await axios.put(`${API_BASE}/api/settings/communication`, payload);
            showToast("Communication settings saved successfully.", "success");
            fetchCommunicationSettings();
        } catch (err) {
            const msg = err.response?.data?.detail || "Failed to save communication settings.";
            showToast(msg, "error");
        }
    });

    elements.btnTestNotification.addEventListener("click", async () => {
        const payload = getCommunicationPayload();
        if (payload.channel === "none") {
            showToast("Please select a notification channel before testing.", "warning");
            return;
        }
        
        showOverlay("Sending test notification...");
        try {
            await axios.post(`${API_BASE}/api/settings/communication/test`, payload);
            showToast("Test notification sent successfully. Please check your inbox / channel.", "success");
        } catch (err) {
            const msg = err.response?.data?.detail || "Failed to send test notification.";
            showToast(msg, "error");
        } finally {
            hideOverlay();
        }
    });

    // ==========================================
    // BACKUPS LIST & DANGER ZONE HANDLERS
    // ==========================================
    function populateFilterBackupsDropdown() {
        const currentSelected = elements.settingsFilterBackupEnv.value || "all";
        elements.settingsFilterBackupEnv.innerHTML = '<option value="all">All Environments</option>';
        state.environments.forEach(env => {
            const opt = document.createElement("option");
            opt.value = env.id;
            opt.innerText = env.name;
            if (String(env.id) === String(currentSelected)) {
                opt.selected = true;
            }
            elements.settingsFilterBackupEnv.appendChild(opt);
        });
    }

    async function fetchAvailableBackups() {
        try {
            const res = await axios.get(`${API_BASE}/api/backup`);
            const backups = res.data;
            state.backups = backups;
            renderBackupsTable(backups);
        } catch (err) {
            console.error("Error loading backups:", err);
            showToast("Failed to fetch available backups list.", "error");
        }
    }

    function renderBackupsTable(backupsList) {
        elements.backupsListTableBody.innerHTML = "";
        
        const filterVal = elements.settingsFilterBackupEnv.value || "all";
        const filtered = filterVal === "all" 
            ? backupsList 
            : backupsList.filter(b => String(b.environment_id) === String(filterVal));

        if (filtered.length === 0) {
            elements.backupsListTableBody.innerHTML = `
                <tr>
                    <td colspan="5" class="px-6 py-8 text-center text-slate-450 dark:text-slate-500">
                        <i class="fa-solid fa-cloud-arrow-down text-lg mb-1.5 block"></i>
                        No available baseline backups found for the selected filter.
                    </td>
                </tr>
            `;
            return;
        }

        // Find the latest backup ID for each environment to protect it from deletion
        const latestMap = {};
        backupsList.forEach(b => {
            const envId = b.environment_id;
            const time = new Date(b.backup_time).getTime();
            if (!latestMap[envId] || time > latestMap[envId].time) {
                latestMap[envId] = { id: b.id, time: time };
            }
        });
        const latestIds = new Set(Object.values(latestMap).map(item => item.id));

        filtered.forEach(backup => {
            const tr = document.createElement("tr");
            tr.className = "hover:bg-slate-50/40 dark:hover:bg-slate-900/30 transition-colors";
            
            const env = state.environments.find(e => e.id === backup.environment_id);
            const envName = env ? env.name : `Env ID: ${backup.environment_id}`;

            const isLatest = latestIds.has(backup.id);
            
            const actionButtons = `
                <div class="flex items-center justify-end gap-2.5">
                    <button class="h-8 px-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-primary-500 hover:text-primary-600 transition-colors flex items-center gap-1" onclick="downloadBackup(${backup.id})" title="Download Backup Archive">
                        <i class="fa-solid fa-file-arrow-down"></i>
                        <span>Download</span>
                    </button>
                    ${isLatest 
                        ? `<span class="text-[10px] bg-slate-100 text-slate-500 dark:bg-slate-900 dark:text-slate-400 font-bold px-2 py-1.5 rounded-md border border-slate-200/40 dark:border-slate-800 select-none" title="Active baseline template used for live checks">Active Baseline</span>`
                        : `<button class="h-8 px-2.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20 text-xs font-semibold text-slate-500 hover:text-red-600 transition-colors flex items-center gap-1" onclick="confirmDeleteBackup(${backup.id})" title="Delete Backup">
                            <i class="fa-solid fa-trash-can"></i>
                            <span>Delete</span>
                           </button>`
                    }
                </div>
            `;

            let relativePath = backup.backup_path;
            const projectRootIdx = relativePath.indexOf("backend/backups");
            if (projectRootIdx !== -1) {
                relativePath = relativePath.substring(projectRootIdx);
            } else {
                const backupsIdx = relativePath.indexOf("backups/");
                if (backupsIdx !== -1) {
                    relativePath = relativePath.substring(backupsIdx);
                }
            }

            tr.innerHTML = `
                <td class="px-6 py-3.5 font-bold font-mono text-slate-900 dark:text-white">${backup.backup_version}</td>
                <td class="px-6 py-3.5">${envName}</td>
                <td class="px-6 py-3.5 font-mono text-xs">${formatDate(backup.backup_time)}</td>
                <td class="px-6 py-3.5 font-mono text-[10px] text-slate-450 dark:text-slate-500 break-all select-all">${relativePath}</td>
                <td class="px-6 py-3.5 text-right">${actionButtons}</td>
            `;
            elements.backupsListTableBody.appendChild(tr);
        });
    }

    let backupIdToDelete = null;
    window.confirmDeleteBackup = (id) => {
        backupIdToDelete = id;
        showConfirmModal({
            title: "Confirm Deletion",
            message: "Are you sure you want to delete this historical baseline backup from the local filesystem? This action is irreversible.",
            confirmText: "Delete",
            onConfirm: executeDeleteBackup
        });
    };

    async function executeDeleteBackup() {
        if (!backupIdToDelete) return;
        try {
            await axios.delete(`${API_BASE}/api/backup/${backupIdToDelete}`);
            showToast("Baseline backup archive removed successfully.", "success");
            closeModal(elements.modalConfirm);
            fetchAvailableBackups();
            
            // Reload dashboard if active since card baseline info may change
            if (state.activeView === "dashboard") {
                fetchDashboard();
            }
        } catch (err) {
            const detail = err.response && err.response.data && err.response.data.detail
                ? err.response.data.detail
                : "Failed to delete backup.";
            showToast(detail, "error");
        } finally {
            backupIdToDelete = null;
        }
    }

    window.downloadBackup = (id) => {
        showToast("Downloading baseline backup zip archive...", "info");
        // Add cache-busting parameter to prevent browser caching old JSON response
        const downloadUrl = `${API_BASE}/api/backup/download/${id}?cb=${new Date().getTime()}`;
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute("href", downloadUrl);
        downloadAnchor.setAttribute("download", "");
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
    };

    // Filter backups dropdown change listener
    elements.settingsFilterBackupEnv.addEventListener("change", () => {
        if (state.backups) {
            renderBackupsTable(state.backups);
        }
    });

    // Wipe Database click listener
    elements.btnWipeDatabase.addEventListener("click", () => {
        showConfirmModal({
            title: "Wipe Database",
            message: "Are you sure you want to completely wipe out the database? This will delete all environments, APIs, baseline backups, and execution history. This action is irreversible!",
            confirmText: "Wipe Everything",
            onConfirm: executeWipeDatabase
        });
    });

    async function executeWipeDatabase() {
        showOverlay("Wiping all application data...");
        try {
            await axios.post(`${API_BASE}/api/settings/clear-data`);
            hideOverlay();
            closeModal(elements.modalConfirm);
            showToast("All application data has been wiped successfully.", "success");
            showAlert("Database Reset Complete", "All environments, APIs registry, validation execution histories, and baseline files have been cleared from SQLite database and local disk.", true);
            
            // Re-initialize application state
            await initializeApplication();
        } catch (err) {
            hideOverlay();
            closeModal(elements.modalConfirm);
            showToast("Wipe operation failed.", "error");
        }
    }

    // ==========================================
    // VIEW 4: EXECUTION AUDIT HISTORY PAGE
    // ==========================================
    async function fetchExecutionHistory() {
        try {
            const res = await axios.get(`${API_BASE}/api/validate/history`);
            const history = res.data;
            renderHistoryTable(history);
        } catch (err) {
            loggerError("Error loading audit history log", err);
            showToast("Failed to fetch execution logs", "error");
        }
    }

    function renderHistoryTable(history) {
        elements.historyTableBody.innerHTML = "";

        if (history.length === 0) {
            elements.historyTableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="px-6 py-12 text-center text-slate-400 dark:text-slate-500">
                        <i class="fa-solid fa-history text-xl mb-2 block"></i>
                        No validation check execution logs found. Run validation to create entry logs.
                    </td>
                </tr>
            `;
            return;
        }

        history.forEach(run => {
            const tr = document.createElement("tr");
            tr.className = "hover:bg-slate-50/40 dark:hover:bg-slate-900/30 transition-colors";
            
            const env = state.environments.find(e => e.id === run.environment_id);
            const envName = env ? env.name : `Env ID: ${run.environment_id}`;

            const statusClass = run.status === "PASSED" ? "status-pill-passed" : "status-pill-failed";

            tr.innerHTML = `
                <td class="px-6 py-4 font-mono font-semibold text-xs">${formatDate(run.execution_time)}</td>
                <td class="px-6 py-4 font-bold text-slate-900 dark:text-white">${envName}</td>
                <td class="px-6 py-4 font-mono text-xs">${run.total_apis}</td>
                <td class="px-6 py-4 text-emerald-600 dark:text-emerald-400 font-bold">${run.passed}</td>
                <td class="px-6 py-4 text-rose-600 dark:text-rose-400 font-bold">${run.failed}</td>
                <td class="px-6 py-4">
                    <span class="inline-flex text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border ${statusClass}">
                        ${run.status}
                    </span>
                </td>
            `;
            elements.historyTableBody.appendChild(tr);
        });
    }

    // Logger util
    function loggerError(msg, err) {
        console.error(`${msg}:`, err);
    }

    // ==========================================
    // GLOBAL VARIABLES LOGIC
    // ==========================================
    async function fetchGlobalVars() {
        elements.globalVarsTableBody.innerHTML = `<tr><td colspan="3" class="text-center py-8 text-slate-500"><i class="fa-solid fa-spinner fa-spin mr-2"></i>Loading variables...</td></tr>`;
        try {
            const res = await axios.get(`${API_BASE}/api/global-variables`);
            const vars = res.data;
            
            if (vars.length === 0) {
                elements.globalVarsTableBody.innerHTML = `<tr><td colspan="3" class="text-center py-8 text-slate-500 text-sm">No global variables found.</td></tr>`;
                return;
            }

            elements.globalVarsTableBody.innerHTML = vars.map(v => `
                <tr class="hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors">
                    <td class="px-6 py-3 font-semibold text-slate-700 dark:text-slate-300">{{${v.key}}}</td>
                    <td class="px-6 py-3 text-slate-500">${formatDate(v.updated_at)}</td>
                    <td class="px-6 py-3 text-right space-x-2">
                        <button onclick="editGlobalVar(${v.id}, '${v.key}')" class="text-slate-400 hover:text-primary-600 transition-colors" title="Edit">
                            <i class="fa-solid fa-pen"></i>
                        </button>
                        <button onclick="deleteGlobalVar(${v.id}, '${v.key}')" class="text-slate-400 hover:text-red-600 transition-colors" title="Delete">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `).join("");
        } catch (err) {
            elements.globalVarsTableBody.innerHTML = `<tr><td colspan="3" class="text-center py-8 text-red-500">Failed to load variables</td></tr>`;
        }
    }

    elements.btnAddGlobalVar.addEventListener("click", () => {
        elements.inputGvId.value = "";
        elements.inputGvKey.value = "";
        elements.inputGvValue.value = "";
        elements.modalGlobalVarTitle.innerText = "Add Global Variable";
        elements.inputGvKey.disabled = false;
        openModal(elements.modalGlobalVar);
    });

    window.editGlobalVar = (id, key) => {
        elements.inputGvId.value = id;
        elements.inputGvKey.value = key;
        elements.inputGvValue.value = ""; // Blank for security
        elements.modalGlobalVarTitle.innerText = "Edit Global Variable";
        elements.inputGvKey.disabled = true; // Key cannot be changed once created
        openModal(elements.modalGlobalVar);
    };

    window.deleteGlobalVar = (id, key) => {
        showConfirmModal({
            title: "Confirm Removal",
            message: `Are you sure you want to delete the variable '{{${key}}}'? APIs using this variable may stop working.`,
            confirmText: "Delete",
            onConfirm: async () => {
                closeModal(elements.modalConfirm);
                showOverlay("Deleting variable...");
                try {
                    await axios.delete(`${API_BASE}/api/global-variables/${id}`);
                    hideOverlay();
                    showToast("Variable deleted successfully.");
                    fetchGlobalVars();
                } catch (err) {
                    hideOverlay();
                    showToast("Failed to delete variable", "error");
                }
            }
        });
    };

    elements.btnGlobalVarSave.addEventListener("click", async () => {
        const id = elements.inputGvId.value;
        const key = elements.inputGvKey.value.trim();
        const value = elements.inputGvValue.value;

        if (!key || (!value && !id)) {
            showToast("Key and value are required.", "warning");
            return;
        }

        showOverlay("Saving variable...");
        try {
            if (id) {
                // Update
                await axios.put(`${API_BASE}/api/global-variables/${id}`, { value });
                showToast("Variable updated.");
            } else {
                // Create
                await axios.post(`${API_BASE}/api/global-variables`, { key, value });
                showToast("Variable created.");
            }
            hideOverlay();
            closeModal(elements.modalGlobalVar);
            fetchGlobalVars();
        } catch (err) {
            hideOverlay();
            const detail = err.response && err.response.data && err.response.data.detail ? err.response.data.detail : "Failed to save variable";
            showToast(detail, "error");
        }
    });

    elements.btnGlobalVarClose.addEventListener("click", () => closeModal(elements.modalGlobalVar));
    elements.btnGlobalVarCancel.addEventListener("click", () => closeModal(elements.modalGlobalVar));

    // ==========================================
    // COMPLEX APIs LOGIC
    // ==========================================
    async function fetchComplexApis() {
        elements.complexApisList.innerHTML = `<div class="text-center py-8 text-slate-500"><i class="fa-solid fa-spinner fa-spin mr-2"></i>Loading complex APIs...</div>`;
        try {
            const res = await axios.get(`${API_BASE}/api/complex-apis`);
            const apis = res.data;
            
            if (apis.length === 0) {
                elements.complexApisList.innerHTML = `<div class="text-center py-8 text-slate-500 text-sm">No complex APIs defined yet.</div>`;
                return;
            }

            elements.complexApisList.innerHTML = apis.map(api => {
                const envName = state.environments.find(e => e.id === api.environment_id)?.name || "Unknown Env";
                const ruleCount = api.extract_rules ? api.extract_rules.length : 0;
                const encodedApi = escapeHTML(JSON.stringify(api));
                
                return `
                <div class="border border-slate-200 dark:border-slate-800 rounded-xl p-5 hover:border-primary-300 dark:hover:border-primary-800 transition-colors">
                    <div class="flex items-start justify-between">
                        <div class="space-y-1">
                            <div class="flex items-center gap-2">
                                <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 uppercase tracking-wide">${envName}</span>
                                <h4 class="font-bold text-slate-900 dark:text-white">${escapeHTML(api.name)}</h4>
                            </div>
                            <div class="text-xs text-slate-500 font-mono truncate max-w-xl">${escapeHTML(api.curl_command.substring(0, 80))}${api.curl_command.length > 80 ? '...' : ''}</div>
                        </div>
                        <div class="flex items-center gap-2">
                            <span class="text-xs font-semibold text-slate-400 mr-2"><i class="fa-solid fa-filter mr-1"></i>${ruleCount} Extract Rule(s)</span>
                            <button onclick="executeComplexApi(${api.id})" class="h-8 px-3 bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-400 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5" title="Execute Now">
                                <i class="fa-solid fa-play"></i> Run
                            </button>
                            <button onclick='editComplexApi(${encodedApi})' class="h-8 w-8 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-400 hover:text-primary-600 flex items-center justify-center transition-colors">
                                <i class="fa-solid fa-pen"></i>
                            </button>
                            <button onclick="deleteComplexApi(${api.id}, '${escapeHTML(api.name.replace(/'/g, "\\'"))}')" class="h-8 w-8 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-400 hover:text-red-600 flex items-center justify-center transition-colors">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `}).join("");
        } catch (err) {
            elements.complexApisList.innerHTML = `<div class="text-center py-8 text-red-500">Failed to load complex APIs</div>`;
        }
    }

    elements.btnAddComplexApi.addEventListener("click", async () => {
        await loadGlobalVariablesForAutocomplete();
        elements.inputCaId.value = "";
        elements.inputCaName.value = "";
        elements.inputCaCurl.value = "";
        elements.caExtractRulesContainer.innerHTML = "";
        elements.caAssertionsContainer.innerHTML = "";
        elements.modalComplexApiTitle.innerText = "Add Complex API";
        
        // Populate environments
        elements.inputCaEnv.innerHTML = state.environments.map(e => `<option value="${e.id}">${e.name}</option>`).join("");
        
        openModal(elements.modalComplexApi);
    });

    window.editComplexApi = async (api) => {
        await loadGlobalVariablesForAutocomplete();
        elements.inputCaId.value = api.id;
        elements.inputCaName.value = api.name;
        elements.inputCaCurl.value = api.curl_command;
        elements.modalComplexApiTitle.innerText = "Edit Complex API";
        
        // Populate environments
        elements.inputCaEnv.innerHTML = state.environments.map(e => `<option value="${e.id}" ${e.id === api.environment_id ? 'selected' : ''}>${e.name}</option>`).join("");
        
        // Render extract rules
        elements.caExtractRulesContainer.innerHTML = "";
        if (api.extract_rules) {
            api.extract_rules.forEach(rule => addExtractRuleRow(rule.json_path, rule.variable_key));
        }
        
        // Render assertions
        elements.caAssertionsContainer.innerHTML = "";
        if (api.assertions) {
            api.assertions.forEach(assertion => addAssertionRuleRow(assertion.type, assertion.path, assertion.expected));
        }
        
        openModal(elements.modalComplexApi);
    };

    window.deleteComplexApi = async (id, name) => {
        if (!confirm(`Are you sure you want to delete the complex API '${name}'?`)) return;
        showOverlay("Deleting API...");
        try {
            await axios.delete(`${API_BASE}/api/complex-apis/${id}`);
            hideOverlay();
            showToast("Complex API deleted.");
            fetchComplexApis();
            if (state.activeView === "registry") {
                fetchAPIs();
            }
        } catch (err) {
            hideOverlay();
            showToast("Failed to delete complex API", "error");
        }
    };

    function formatRequestDetails(req) {
        if (!req) return '<span class="text-slate-400 italic">No request data.</span>';
        let headersStr = '';
        if (req.headers && Object.keys(req.headers).length > 0) {
            headersStr = Object.entries(req.headers).map(([k, v]) => `${k}: ${v}`).join('\n');
        } else {
            headersStr = 'None';
        }
        
        let dataStr = '';
        if (req.data) {
            try {
                const obj = typeof req.data === 'string' ? JSON.parse(req.data) : req.data;
                dataStr = JSON.stringify(obj, null, 2);
            } catch (e) {
                dataStr = String(req.data);
            }
        } else {
            dataStr = 'None';
        }
        
        return `METHOD: ${escapeHTML(req.method)}
URL: ${escapeHTML(req.url)}

HEADERS:
${escapeHTML(headersStr)}

BODY / PAYLOAD:
${escapeHTML(dataStr)}`;
    }    function formatResponseDetails(res) {
        if (!res) return '<span class="text-slate-400 italic">No response details (request failed before reaching server).</span>';
        let headersStr = '';
        if (res.headers && Object.keys(res.headers).length > 0) {
            headersStr = Object.entries(res.headers).map(([k, v]) => `${k}: ${v}`).join('\n');
        } else {
            headersStr = 'None';
        }
        
        let bodyStr = '';
        if (res.body) {
            try {
                const obj = typeof res.body === 'string' ? JSON.parse(res.body) : res.body;
                bodyStr = JSON.stringify(obj, null, 2);
            } catch (e) {
                bodyStr = String(res.body);
            }
        } else {
            bodyStr = 'None';
        }
        
        return `STATUS CODE: ${res.status_code}

HEADERS:
${escapeHTML(headersStr)}

BODY:
${escapeHTML(bodyStr)}`;
    }

    function renderRunResultAssertions(assertions, failures, containerEl) {
        containerEl.innerHTML = "";
        if (!assertions || assertions.length === 0) {
            containerEl.innerHTML = `<span class="text-xs text-slate-400 dark:text-slate-500 italic">No assertions configured.</span>`;
            return;
        }

        assertions.forEach(assertion => {
            const failure = failures ? failures.find(d => {
                if (assertion.type === "status_code" && d.field === "status_code") return true;
                if (assertion.type === "response_time_under_ms" && d.field === "response_time") return true;
                if (assertion.type === "body_contains" && d.field === "body") return true;
                if (assertion.type === "header_contains" && d.field === "headers." + assertion.path) return true;
                if (assertion.type === "json_path_exists" && d.field === assertion.path) return true;
                if (assertion.type === "json_path_equals" && d.field === assertion.path) return true;
                if (assertion.type === "json_path_contains" && d.field === assertion.path) return true;
                if (assertion.type === "json_path_type" && d.field === assertion.path + " (type)") return true;
                if (assertion.type === "json_schema" && d.field === "json_schema") return true;
                return false;
            }) : null;

            const isFailed = !!failure;
            const card = document.createElement("div");
            card.className = `p-3 rounded-xl border flex flex-col gap-2 transition-all text-left whitespace-normal font-sans text-xs ${
                isFailed 
                    ? 'bg-rose-50/10 dark:bg-rose-950/10 border-rose-200 dark:border-rose-900/50 shadow-sm shadow-rose-100/10' 
                    : 'bg-emerald-50/10 dark:bg-emerald-950/10 border-emerald-200 dark:border-emerald-900/20'
            }`;
            
            card.innerHTML = `
                <div class="flex items-center justify-between gap-3">
                    <span class="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                        <i class="${isFailed ? 'fa-solid fa-circle-xmark text-rose-500' : 'fa-solid fa-circle-check text-emerald-500'}"></i>
                        ${getAssertionDescription(assertion)}
                    </span>
                    <span class="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                        isFailed 
                            ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300' 
                            : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                    }">
                        ${isFailed ? 'Failed' : 'Passed'}
                    </span>
                </div>
                ${isFailed ? `
                    <div class="mt-1 grid grid-cols-2 gap-3 text-[11px] font-mono p-2 bg-slate-50/50 dark:bg-slate-950/50 rounded-lg border border-slate-100 dark:border-slate-800">
                        <div>
                            <span class="text-slate-400 dark:text-slate-500 block font-sans text-[10px] uppercase font-bold tracking-wide">Expected</span>
                            <span class="text-emerald-600 dark:text-emerald-400 break-all select-all whitespace-pre-wrap">${escapeHTML(String(failure.expected))}</span>
                        </div>
                        <div>
                            <span class="text-slate-400 dark:text-slate-500 block font-sans text-[10px] uppercase font-bold tracking-wide">Actual</span>
                            <span class="text-rose-600 dark:text-rose-500 break-all select-all whitespace-pre-wrap">${escapeHTML(String(failure.actual))}</span>
                        </div>
                    </div>
                ` : ''}
            `;
            containerEl.appendChild(card);
        });
    }

    window.executeComplexApi = async (id) => {
        showOverlay("Executing complex API request...");
        
        const runModal = document.getElementById("modal-complex-api-run-result");
        const runTitle = document.getElementById("run-result-title");
        const runSubtitle = document.getElementById("run-result-subtitle");
        const runReasonBox = document.getElementById("run-result-reason-box");
        const runRequestBox = document.getElementById("run-result-request-box");
        const runResponseBox = document.getElementById("run-result-response-box");
        const runAssertionsBox = document.getElementById("run-result-assertions-box");
        
        const closeBtn = document.getElementById("btn-run-result-close");
        const okBtn = document.getElementById("btn-run-result-ok");
        
        const closeRunModal = () => {
            runModal.classList.add("hidden");
            runModal.classList.remove("flex");
        };
        
        closeBtn.replaceWith(closeBtn.cloneNode(true));
        okBtn.replaceWith(okBtn.cloneNode(true));
        
        const newCloseBtn = document.getElementById("btn-run-result-close");
        const newOkBtn = document.getElementById("btn-run-result-ok");
        newCloseBtn.addEventListener("click", closeRunModal);
        newOkBtn.addEventListener("click", closeRunModal);

        try {
            const res = await axios.post(`${API_BASE}/api/complex-apis/${id}/execute`);
            hideOverlay();
            const data = res.data;
            
            runSubtitle.innerText = `${data.request && data.request.url ? data.request.url : "Complex API execution"}`;
            
            runRequestBox.innerHTML = formatRequestDetails(data.request);
            runResponseBox.innerHTML = formatResponseDetails(data.response);
            
            renderRunResultAssertions(data.assertions, data.failures, runAssertionsBox);
            
            if (data.success) {
                runReasonBox.className = "p-4 rounded-xl border text-sm font-semibold select-all bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/20 dark:border-emerald-900/50 dark:text-emerald-300";
                
                let extractionsMsg = "";
                if (data.extractions && data.extractions.length > 0) {
                    extractionsMsg = `<div class="mt-2 font-bold text-xs uppercase tracking-wide">Extracted Variables:</div>` + 
                        `<ul class="list-disc pl-5 mt-1 space-y-1 text-xs font-mono">` + 
                        data.extractions.map(e => `<li><code>{{${e.key}}}</code>: ${escapeHTML(e.extracted_value)}</li>`).join("") + `</ul>`;
                } else {
                    extractionsMsg = `<div class="mt-1 text-xs italic font-medium opacity-80">All assertions passed (if any) and no variables extracted.</div>`;
                }
                
                runReasonBox.innerHTML = `
                    <div class="flex items-center gap-2 text-base">
                        <i class="fa-solid fa-circle-check text-emerald-600 dark:text-emerald-400"></i>
                        <span>Execution Succeeded (Status Code: ${data.response ? data.response.status_code : 200})</span>
                    </div>
                    ${extractionsMsg}
                `;
            } else {
                runReasonBox.className = "p-4 rounded-xl border text-sm font-semibold select-all bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/20 dark:border-rose-900/50 dark:text-rose-300";
                
                let errorDetails = "";
                if (data.error) {
                    errorDetails = `<div class="mt-1 text-xs font-semibold opacity-90">${escapeHTML(data.error)}</div>`;
                }
                
                let failuresList = "";
                if (data.failures && data.failures.length > 0) {
                    failuresList = `<div class="mt-3 font-bold text-xs uppercase tracking-wide flex items-center gap-2"><i class="fa-solid fa-circle-exclamation text-rose-500"></i> Some assertions failed. View details below.</div>`;
                }
                
                runReasonBox.innerHTML = `
                    <div class="flex items-center gap-2 text-base">
                        <i class="fa-solid fa-circle-xmark text-rose-600 dark:text-rose-450"></i>
                        <span>Execution Failed</span>
                    </div>
                    ${errorDetails}
                    ${failuresList}
                `;
            }
            
            runModal.classList.remove("hidden");
            runModal.classList.add("flex");
            
        } catch (err) {
            hideOverlay();
            const detail = err.response && err.response.data && err.response.data.detail ? err.response.data.detail : "Execution failed completely.";
            
            runSubtitle.innerText = "Fatal connection/server error";
            runRequestBox.innerHTML = `<span class="text-slate-400 italic">Request data unavailable.</span>`;
            runResponseBox.innerHTML = `<span class="text-slate-400 italic">Response data unavailable.</span>`;
            runAssertionsBox.innerHTML = `<span class="text-slate-400 italic">No assertions run due to connection error.</span>`;
            
            runReasonBox.className = "p-4 rounded-xl border text-sm font-semibold select-all bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/20 dark:border-rose-900/50 dark:text-rose-300";
            runReasonBox.innerHTML = `
                <div class="flex items-center gap-2 text-base">
                    <i class="fa-solid fa-circle-xmark text-rose-600 dark:text-rose-450"></i>
                    <span>Execution Failed (Connection Error)</span>
                </div>
                <div class="mt-1 text-xs font-semibold opacity-90">${escapeHTML(detail)}</div>
            `;
            
            runModal.classList.remove("hidden");
            runModal.classList.add("flex");
        }
    };

    // Dynamic Rule Rows
    elements.btnAddExtractRule.addEventListener("click", () => {
        addExtractRuleRow("", "");
    });

    function addExtractRuleRow(jsonPath, varKey) {
        const div = document.createElement("div");
        div.className = "ca-rule-row flex items-center gap-3 animate-scale-in";
        div.innerHTML = `
            <input type="text" placeholder="JSON Path (e.g. data.user.id)" value="${escapeHTML(jsonPath)}" class="ca-rule-path flex-1 h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs focus:outline-none focus:border-primary-500 font-mono">
            <i class="fa-solid fa-arrow-right text-slate-400 text-xs"></i>
            <input type="text" placeholder="Global Var Key (e.g. auth_token)" value="${escapeHTML(varKey)}" class="ca-rule-key flex-1 h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs focus:outline-none focus:border-primary-500 font-mono">
            <button class="h-9 w-9 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors" onclick="this.parentElement.remove()">
                <i class="fa-solid fa-times"></i>
            </button>
        `;
        elements.caExtractRulesContainer.appendChild(div);
    }

    elements.btnAddAssertionRule.addEventListener("click", () => {
        addAssertionRuleRow("status_code", "", "");
    });

    function addAssertionRuleRow(type = "status_code", path = "", expected = "") {
        const div = document.createElement("div");
        div.className = "ca-assertion-row flex items-start gap-3 w-full border-b border-slate-100 dark:border-slate-800/50 pb-3 last:border-0 last:pb-0 animate-scale-in";
        div.innerHTML = `
            <select class="ca-assert-type w-44 h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs focus:outline-none focus:border-primary-500 font-semibold transition-all">
                <option value="status_code" ${type === 'status_code' ? 'selected' : ''}>status_code</option>
                <option value="response_time_under_ms" ${type === 'response_time_under_ms' ? 'selected' : ''}>response_time_under_ms</option>
                <option value="json_path_exists" ${type === 'json_path_exists' ? 'selected' : ''}>json_path_exists</option>
                <option value="json_path_equals" ${type === 'json_path_equals' ? 'selected' : ''}>json_path_equals</option>
                <option value="json_path_contains" ${type === 'json_path_contains' ? 'selected' : ''}>json_path_contains</option>
                <option value="json_path_type" ${type === 'json_path_type' ? 'selected' : ''}>json_path_type</option>
                <option value="json_schema" ${type === 'json_schema' ? 'selected' : ''}>json_schema</option>
                <option value="header_contains" ${type === 'header_contains' ? 'selected' : ''}>header_contains</option>
                <option value="body_contains" ${type === 'body_contains' ? 'selected' : ''}>body_contains</option>
            </select>
            <div class="ca-assert-fields-container flex items-center gap-2 flex-1 min-w-0"></div>
            <button class="h-9 w-9 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors flex-shrink-0" onclick="this.parentElement.remove()">
                <i class="fa-solid fa-times"></i>
            </button>
        `;

        const typeSelect = div.querySelector(".ca-assert-type");
        const fieldsContainer = div.querySelector(".ca-assert-fields-container");

        function updateFields(newType, currentPath, currentExpected) {
            fieldsContainer.innerHTML = "";
            let expectedStr = currentExpected;
            if (typeof expectedStr === 'object' && expectedStr !== null) {
                expectedStr = JSON.stringify(expectedStr, null, 2);
            } else if (expectedStr === null || expectedStr === undefined) {
                expectedStr = "";
            } else {
                expectedStr = String(expectedStr);
            }

            if (newType === "status_code" || newType === "response_time_under_ms" || newType === "body_contains") {
                fieldsContainer.innerHTML = `
                    <input type="text" placeholder="${newType === 'status_code' ? 'Expected status, e.g. 200' : newType === 'response_time_under_ms' ? 'Max milliseconds, e.g. 500' : 'Expected substring in response body'}" value="${escapeHTML(expectedStr)}" class="ca-assert-expected flex-1 h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs focus:outline-none focus:border-primary-500 font-mono">
                `;
            } else if (newType === "json_path_exists") {
                fieldsContainer.innerHTML = `
                    <input type="text" placeholder="JSON Path, e.g. data.user.id" value="${escapeHTML(currentPath)}" class="ca-assert-path flex-1 h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs focus:outline-none focus:border-primary-500 font-mono">
                `;
            } else if (newType === "json_path_equals" || newType === "json_path_contains") {
                fieldsContainer.innerHTML = `
                    <input type="text" placeholder="JSON Path, e.g. data.status" value="${escapeHTML(currentPath)}" class="ca-assert-path w-1/2 h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs focus:outline-none focus:border-primary-500 font-mono">
                    <input type="text" placeholder="Expected value" value="${escapeHTML(expectedStr)}" class="ca-assert-expected w-1/2 h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs focus:outline-none focus:border-primary-500 font-mono">
                `;
            } else if (newType === "header_contains") {
                fieldsContainer.innerHTML = `
                    <input type="text" placeholder="Header Name, e.g. Content-Type" value="${escapeHTML(currentPath)}" class="ca-assert-path w-1/2 h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs focus:outline-none focus:border-primary-500 font-mono">
                    <input type="text" placeholder="Expected value substring" value="${escapeHTML(expectedStr)}" class="ca-assert-expected w-1/2 h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs focus:outline-none focus:border-primary-500 font-mono">
                `;
            } else if (newType === "json_path_type") {
                fieldsContainer.innerHTML = `
                    <input type="text" placeholder="JSON Path, e.g. data.items" value="${escapeHTML(currentPath)}" class="ca-assert-path w-1/2 h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs focus:outline-none focus:border-primary-500 font-mono">
                    <select class="ca-assert-expected w-1/2 h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs focus:outline-none focus:border-primary-500 font-semibold transition-all">
                        <option value="string" ${expectedStr === 'string' ? 'selected' : ''}>string</option>
                        <option value="integer" ${expectedStr === 'integer' ? 'selected' : ''}>integer</option>
                        <option value="number" ${expectedStr === 'number' ? 'selected' : ''}>number</option>
                        <option value="boolean" ${expectedStr === 'boolean' ? 'selected' : ''}>boolean</option>
                        <option value="array" ${expectedStr === 'array' ? 'selected' : ''}>array</option>
                        <option value="object" ${expectedStr === 'object' ? 'selected' : ''}>object</option>
                        <option value="null" ${expectedStr === 'null' ? 'selected' : ''}>null</option>
                    </select>
                `;
            } else if (newType === "json_schema") {
                fieldsContainer.className = "ca-assert-fields-container flex flex-col gap-1.5 flex-1 min-w-0 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800";
                fieldsContainer.innerHTML = `
                    <div class="flex items-center justify-between gap-2 w-full">
                        <span class="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-semibold">JSON Schema</span>
                        <label class="text-[10px] text-primary-600 hover:text-primary-700 font-semibold cursor-pointer bg-primary-50 dark:bg-slate-900 px-2 py-0.5 rounded border border-primary-200 dark:border-slate-800 flex items-center gap-1 transition-all">
                            <span>📤</span> Upload Schema
                            <input type="file" accept=".json" class="hidden ca-assert-schema-upload">
                        </label>
                    </div>
                    <textarea placeholder='Paste JSON Schema here, e.g. { "type": "object", "properties": { "id": { "type": "integer" } } }' class="ca-assert-expected w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs focus:outline-none focus:border-primary-500 font-mono h-20 resize-y">${escapeHTML(expectedStr)}</textarea>
                `;

                // Handle file upload
                const fileInput = fieldsContainer.querySelector(".ca-assert-schema-upload");
                const textarea = fieldsContainer.querySelector(".ca-assert-expected");
                fileInput.addEventListener("change", (e) => {
                    const file = e.target.files[0];
                    if (file) {
                        const reader = new FileReader();
                        reader.onload = (evt) => {
                            try {
                                const text = evt.target.result;
                                JSON.parse(text); // validate JSON format
                                textarea.value = text;
                            } catch (err) {
                                showToast("Invalid JSON schema file. Must be valid JSON.", "error");
                            }
                        };
                        reader.readAsText(file);
                    }
                });
            } else {
                fieldsContainer.className = "ca-assert-fields-container flex items-center gap-2 flex-1 min-w-0";
            }
        }

        // Initialize fields
        updateFields(type, path, expected);

        // Listen for type change
        typeSelect.addEventListener("change", (e) => {
            updateFields(e.target.value, "", "");
        });

        elements.caAssertionsContainer.appendChild(div);
    }

    elements.btnComplexApiSave.addEventListener("click", async () => {
        const id = elements.inputCaId.value;
        const envId = elements.inputCaEnv.value;
        const name = elements.inputCaName.value.trim();
        const curl = elements.inputCaCurl.value.trim();
        
        if (!envId || !name || !curl) {
            showToast("Environment, Name, and Curl Command are required.", "warning");
            return;
        }

        // Collect rules
        const rules = [];
        const ruleRows = elements.caExtractRulesContainer.querySelectorAll(".ca-rule-row");
        ruleRows.forEach(row => {
            const path = row.querySelector(".ca-rule-path").value.trim();
            const key = row.querySelector(".ca-rule-key").value.trim();
            if (path && key) {
                rules.push({ json_path: path, variable_key: key });
            }
        });

        // Collect assertions
        const assertions = [];
        const assertionRows = elements.caAssertionsContainer.querySelectorAll(".ca-assertion-row");
        assertionRows.forEach(row => {
            const type = row.querySelector(".ca-assert-type").value;
            const pathInput = row.querySelector(".ca-assert-path");
            const expectedInput = row.querySelector(".ca-assert-expected");
            
            const path = pathInput ? pathInput.value.trim() : null;
            let expected = expectedInput ? expectedInput.value.trim() : null;
            
            // Try parsing numbers/bools/JSON objects for expected values
            if (expected !== null && expected !== "") {
                if (type === "status_code" || type === "response_time_under_ms") {
                    const parsedNum = Number(expected);
                    if (!isNaN(parsedNum)) {
                        expected = parsedNum;
                    }
                } else if (type === "json_schema") {
                    try {
                        expected = JSON.parse(expected);
                    } catch (err) {
                        // Keep as string if parsing fails, but try to parse if valid JSON
                    }
                } else if (expected === "true") {
                    expected = true;
                } else if (expected === "false") {
                    expected = false;
                }
            } else if (expected === "") {
                expected = null;
            }

            assertions.push({
                type: type,
                path: path || null,
                expected: expected
            });
        });

        const payload = {
            environment_id: parseInt(envId),
            name: name,
            curl_command: curl,
            extract_rules: rules.length > 0 ? rules : null,
            assertions: assertions.length > 0 ? assertions : null
        };

        showOverlay("Saving complex API...");
        try {
            if (id) {
                await axios.put(`${API_BASE}/api/complex-apis/${id}`, payload);
                showToast("Complex API updated.");
            } else {
                await axios.post(`${API_BASE}/api/complex-apis`, payload);
                showToast("Complex API created.");
            }
            hideOverlay();
            closeModal(elements.modalComplexApi);
            fetchComplexApis();
            if (state.activeView === "registry") {
                fetchAPIs();
            }
        } catch (err) {
            hideOverlay();
            const detail = err.response && err.response.data && err.response.data.detail ? err.response.data.detail : "Failed to save complex API";
            showToast(detail, "error");
        }
    });

    elements.btnComplexApiClose.addEventListener("click", () => closeModal(elements.modalComplexApi));
    elements.btnComplexApiCancel.addEventListener("click", () => closeModal(elements.modalComplexApi));

    // Tutorial Modal Event Listeners
    if (elements.btnComplexApiTutorial) {
        elements.btnComplexApiTutorial.addEventListener("click", () => openModal(elements.modalTutorial));
    }
    if (elements.registryBtnComplexApiTutorial) {
        elements.registryBtnComplexApiTutorial.addEventListener("click", () => openModal(elements.modalTutorial));
    }
    if (elements.btnTutorialClose) {
        elements.btnTutorialClose.addEventListener("click", () => closeModal(elements.modalTutorial));
    }
    if (elements.btnTutorialCloseBottom) {
        elements.btnTutorialCloseBottom.addEventListener("click", () => closeModal(elements.modalTutorial));
    }



    // ==========================================
    // GLOBAL VARIABLE AUTOCOMPLETE FOR COMPLEX APIS
    // ==========================================
    let _autocompleteVars = [];
    let _acActiveInput = null;
    let _acTriggerStart = -1; // index where `{{` starts
    let _acFiltered = [];
    let _acSelectedIndex = 0;

    async function loadGlobalVariablesForAutocomplete() {
        try {
            const res = await axios.get(`${API_BASE}/api/global-variables`);
            _autocompleteVars = res.data;
        } catch (err) {
            console.error("Failed to load global variables for autocomplete", err);
            _autocompleteVars = [];
        }
    }

    function initVarAutocomplete() {
        let acEl = document.getElementById("var-autocomplete");
        if (!acEl) {
            acEl = document.createElement("div");
            acEl.id = "var-autocomplete";
            acEl.innerHTML = `
                <div class="var-ac-header">Global Variables</div>
                <div id="var-ac-list" class="max-h-60 overflow-y-auto"></div>
            `;
            document.body.appendChild(acEl);
        }

        const modals = [elements.modalComplexApi, elements.modalApi];
        modals.forEach(modal => {
            if (!modal) return;

            modal.addEventListener("input", (e) => {
                const target = e.target;
                if ((target.tagName === "INPUT" && target.type === "text") || target.tagName === "TEXTAREA") {
                    handleAcInput(target);
                }
            });

            modal.addEventListener("keydown", (e) => {
                const target = e.target;
                if ((target.tagName === "INPUT" && target.type === "text") || target.tagName === "TEXTAREA") {
                    if (isAcVisible()) {
                        handleAcKeydown(e);
                    }
                }
            });
        });

        document.addEventListener("mousedown", (e) => {
            const acEl = document.getElementById("var-autocomplete");
            if (acEl && !acEl.contains(e.target) && e.target !== _acActiveInput) {
                hideAc();
            }
        });
    }

    function isAcVisible() {
        const acEl = document.getElementById("var-autocomplete");
        return acEl && acEl.style.display === "block";
    }

    function showAc() {
        const acEl = document.getElementById("var-autocomplete");
        if (acEl) acEl.style.display = "block";
    }

    function hideAc() {
        const acEl = document.getElementById("var-autocomplete");
        if (acEl) acEl.style.display = "none";
        _acActiveInput = null;
        _acTriggerStart = -1;
    }

    function handleAcInput(input) {
        const val = input.value;
        const caret = input.selectionStart;
        const textUpToCaret = val.substring(0, caret);

        const lastBrace = textUpToCaret.lastIndexOf("{{");
        if (lastBrace === -1) {
            hideAc();
            return;
        }

        const textAfterBrace = textUpToCaret.substring(lastBrace);
        if (textAfterBrace.includes("}}")) {
            hideAc();
            return;
        }

        const query = textUpToCaret.substring(lastBrace + 2);
        if (/\s/.test(query)) {
            hideAc();
            return;
        }

        _acActiveInput = input;
        _acTriggerStart = lastBrace;
        
        const queryLower = query.toLowerCase();
        _acFiltered = _autocompleteVars.filter(v => v.key.toLowerCase().includes(queryLower));
        _acSelectedIndex = 0;

        renderAcDropdown();
        positionAcDropdown(input);
    }

    function renderAcDropdown() {
        const listEl = document.getElementById("var-ac-list");
        if (!listEl) return;

        if (_acFiltered.length === 0) {
            listEl.innerHTML = `<div class="var-ac-empty">No matching variables</div>`;
            showAc();
            return;
        }

        listEl.innerHTML = _acFiltered.map((v, idx) => {
            const activeClass = idx === _acSelectedIndex ? "active" : "";
            const valStr = v.value || "";
            const valuePreview = valStr.length > 20 ? valStr.substring(0, 17) + "..." : valStr;
            return `
                <div class="var-ac-item ${activeClass}" data-index="${idx}">
                    <span class="var-ac-pill">{{${escapeHTML(v.key)}}}</span>
                    <span class="var-ac-name">${escapeHTML(v.key)}</span>
                    ${valuePreview ? `<span class="var-ac-hint">${escapeHTML(valuePreview)}</span>` : ""}
                </div>
            `;
        }).join("");

        const items = listEl.querySelectorAll(".var-ac-item");
        items.forEach(item => {
            item.addEventListener("mousedown", (e) => {
                e.preventDefault();
                const idx = parseInt(item.getAttribute("data-index"));
                insertAcVariable(_acFiltered[idx].key);
            });
        });

        showAc();
    }

    function positionAcDropdown(input) {
        const acEl = document.getElementById("var-autocomplete");
        if (!acEl) return;

        const rect = input.getBoundingClientRect();
        
        const width = Math.max(rect.width, 280);
        acEl.style.width = width + "px";
        acEl.style.left = rect.left + "px";

        let top = rect.bottom;
        
        acEl.style.display = "block";
        const dropdownHeight = acEl.offsetHeight;
        
        if (rect.bottom + dropdownHeight > window.innerHeight && rect.top - dropdownHeight > 0) {
            top = rect.top - dropdownHeight;
            acEl.style.borderRadius = "0.75rem 0.75rem 0 0";
        } else {
            acEl.style.borderRadius = "0 0 0.75rem 0.75rem";
        }

        acEl.style.top = top + "px";
    }

    function insertAcVariable(key) {
        if (!_acActiveInput || _acTriggerStart === -1) return;

        const val = _acActiveInput.value;
        const caret = _acActiveInput.selectionStart;
        
        const before = val.substring(0, _acTriggerStart);
        const after = val.substring(caret);
        const insertText = `{{${key}}}`;
        
        _acActiveInput.value = before + insertText + after;
        
        const newCaretPos = _acTriggerStart + insertText.length;
        _acActiveInput.focus();
        _acActiveInput.setSelectionRange(newCaretPos, newCaretPos);

        _acActiveInput.dispatchEvent(new Event("input", { bubbles: true }));

        hideAc();
    }

    function handleAcKeydown(e) {
        if (_acFiltered.length === 0) return;

        if (e.key === "ArrowDown") {
            e.preventDefault();
            _acSelectedIndex = (_acSelectedIndex + 1) % _acFiltered.length;
            renderAcDropdown();
            scrollAcActiveIntoView();
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            _acSelectedIndex = (_acSelectedIndex - 1 + _acFiltered.length) % _acFiltered.length;
            renderAcDropdown();
            scrollAcActiveIntoView();
        } else if (e.key === "Enter" || e.key === "Tab") {
            e.preventDefault();
            insertAcVariable(_acFiltered[_acSelectedIndex].key);
        } else if (e.key === "Escape") {
            e.preventDefault();
            hideAc();
        }
    }

    function scrollAcActiveIntoView() {
        const listEl = document.getElementById("var-ac-list");
        if (!listEl) return;
        const activeItem = listEl.querySelector(".var-ac-item.active");
        if (activeItem) {
            activeItem.scrollIntoView({ block: "nearest" });
        }
    }

    // ==========================================
    // INITIALIZATION KICK-OFF
    // ==========================================
    async function initializeApplication() {
        showOverlay("Powering up validation engine...");
        await loadGlobalDropdowns();
        initVarAutocomplete();
        hideOverlay();
        // Go to default dashboard
        switchView("dashboard");
    }

    initializeApplication();
});
