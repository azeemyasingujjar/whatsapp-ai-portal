const state = {
  user: null,
  whatsapp: null,
  whatsappAccounts: [],
  selectedAccountId: "default",
  aiKeys: [],
  actions: [],
  chats: [],
  messages: [],
  selectedJid: "",
  selectedChatKey: "",
  pendingFile: null,
  mediaRecorder: null,
  voiceChunks: [],
  recording: false
};

const providerPresets = {
  OPENAI: { label: "OpenAI", style: "OPENAI_RESPONSES", models: ["gpt-5.5", "gpt-5.4", "gpt-5.4-mini", "gpt-5-mini", "gpt-4.1-mini"] },
  GEMINI: { label: "Google Gemini", style: "NATIVE", models: ["gemini-3.5-flash", "gemini-3.5-pro", "gemini-2.5-pro", "gemini-2.5-flash"] },
  ANTHROPIC_CLAUDE: { label: "Anthropic Claude", style: "NATIVE", models: ["claude-opus-4-5", "claude-sonnet-4-5", "claude-3-7-sonnet-latest", "claude-3-5-haiku-latest"] },
  XAI_GROK: { label: "xAI Grok", style: "OPENAI_COMPATIBLE", models: ["grok-4", "grok-3", "grok-3-mini"] },
  DEEPSEEK: { label: "DeepSeek", style: "OPENAI_COMPATIBLE", models: ["deepseek-chat", "deepseek-reasoner"] },
  MISTRAL_AI: { label: "Mistral AI", style: "OPENAI_COMPATIBLE", models: ["mistral-large-latest", "mistral-small-latest", "open-mistral-nemo"] },
  COHERE: { label: "Cohere", style: "OPENAI_COMPATIBLE", models: ["command-r-plus", "command-r", "command-a"] },
  META_LLAMA: { label: "Meta Llama", style: "OPENAI_COMPATIBLE", models: ["llama-3.3-70b-versatile", "llama-3.1-405b"] },
  AI21_LABS: { label: "AI21 Labs", style: "OPENAI_COMPATIBLE", models: ["jamba-large", "jamba-mini"] },
  TOGETHER_AI: { label: "Together AI", style: "OPENAI_COMPATIBLE", models: ["meta-llama/Llama-3.3-70B-Instruct-Turbo", "deepseek-ai/DeepSeek-V3"] },
  GROQ: { label: "Groq", style: "OPENAI_COMPATIBLE", models: ["llama-3.3-70b-versatile", "mixtral-8x7b-32768"] },
  FIREWORKS_AI: { label: "Fireworks AI", style: "OPENAI_COMPATIBLE", models: ["accounts/fireworks/models/llama-v3p1-405b-instruct", "accounts/fireworks/models/deepseek-v3"] },
  REPLICATE: { label: "Replicate", style: "OPENAI_COMPATIBLE", models: ["meta/meta-llama-3-70b-instruct", "custom-model"] },
  HUGGING_FACE: { label: "Hugging Face", style: "OPENAI_COMPATIBLE", models: ["meta-llama/Llama-3.1-70B-Instruct", "mistralai/Mixtral-8x7B-Instruct-v0.1"] },
  PERPLEXITY_API: { label: "Perplexity API", style: "OPENAI_COMPATIBLE", models: ["sonar-pro", "sonar", "sonar-reasoning-pro"] },
  ALIBABA_QWEN: { label: "Alibaba Qwen", style: "OPENAI_COMPATIBLE", models: ["qwen-plus", "qwen-max", "qwen-turbo"] },
  BAIDU_ERNIE: { label: "Baidu ERNIE", style: "OPENAI_COMPATIBLE", models: ["ernie-4.0-turbo", "ernie-3.5"] },
  SENSENOVA: { label: "SenseNova", style: "OPENAI_COMPATIBLE", models: ["SenseChat-5", "SenseChat-Turbo"] },
  MINIMAX_AI: { label: "MiniMax AI", style: "OPENAI_COMPATIBLE", models: ["abab6.5s-chat", "abab6.5-chat"] },
  MOONSHOT_KIMI: { label: "Moonshot AI Kimi", style: "OPENAI_COMPATIBLE", models: ["moonshot-v1-8k", "moonshot-v1-32k", "kimi-k2"] },
  CHARACTER_AI: { label: "Character.AI", style: "OPENAI_COMPATIBLE", models: ["character-chat"] },
  INFLECTION_AI: { label: "Inflection AI", style: "OPENAI_COMPATIBLE", models: ["inflection-3-productivity", "inflection-3-pi"] },
  STABILITY_AI: { label: "Stability AI", style: "OPENAI_COMPATIBLE", models: ["stable-image-ultra", "stable-diffusion-3.5-large"] },
  MIDJOURNEY: { label: "Midjourney", style: "OPENAI_COMPATIBLE", models: ["midjourney"] },
  RUNWAY: { label: "Runway", style: "OPENAI_COMPATIBLE", models: ["gen-4", "gen-3-alpha"] },
  PIKA_LABS: { label: "Pika Labs", style: "OPENAI_COMPATIBLE", models: ["pika"] },
  LEONARDO_AI: { label: "Leonardo AI", style: "OPENAI_COMPATIBLE", models: ["leonardo-phoenix", "leonardo-diffusion-xl"] },
  IDEOGRAM: { label: "Ideogram", style: "OPENAI_COMPATIBLE", models: ["ideogram-v3", "ideogram-v2"] },
  ASSEMBLYAI: { label: "AssemblyAI", style: "OPENAI_COMPATIBLE", models: ["universal-streaming", "best"] },
  ELEVENLABS: { label: "ElevenLabs", style: "OPENAI_COMPATIBLE", models: ["eleven_multilingual_v2", "eleven_turbo_v2_5"] },
  PLAYHT: { label: "PlayHT", style: "OPENAI_COMPATIBLE", models: ["PlayDialog", "Play3.0-mini"] },
  DEEPGRAM: { label: "Deepgram", style: "OPENAI_COMPATIBLE", models: ["nova-3", "nova-2"] },
  SPEECHMATICS: { label: "Speechmatics", style: "OPENAI_COMPATIBLE", models: ["standard", "enhanced"] },
  REV_AI: { label: "Rev AI", style: "OPENAI_COMPATIBLE", models: ["machine-transcription"] },
  WHISPER_API: { label: "Whisper API", style: "OPENAI_COMPATIBLE", models: ["whisper-1", "gpt-4o-mini-transcribe"] },
  AMAZON_BEDROCK: { label: "Amazon Bedrock", style: "OPENAI_COMPATIBLE", models: ["anthropic.claude-3-5-sonnet", "amazon.titan-text-premier"] },
  AMAZON_TITAN: { label: "Amazon Titan", style: "OPENAI_COMPATIBLE", models: ["amazon.titan-text-premier", "amazon.titan-text-lite"] },
  AZURE_AI: { label: "Azure AI", style: "OPENAI_COMPATIBLE", models: ["gpt-4.1", "gpt-4o-mini", "custom-deployment"] },
  IBM_WATSONX: { label: "IBM Watsonx", style: "OPENAI_COMPATIBLE", models: ["ibm/granite-3-8b-instruct", "meta-llama/llama-3-70b-instruct"] },
  ORACLE_AI: { label: "Oracle AI", style: "OPENAI_COMPATIBLE", models: ["cohere.command-r-plus", "meta.llama-3.1-70b-instruct"] },
  SAP_AI_CORE: { label: "SAP AI Core", style: "OPENAI_COMPATIBLE", models: ["gpt-4.1", "gemini-2.5-pro", "custom-deployment"] },
  NVIDIA_NIM: { label: "NVIDIA NIM", style: "OPENAI_COMPATIBLE", models: ["meta/llama-3.1-70b-instruct", "nvidia/llama-3.1-nemotron"] },
  DATABRICKS_MOSAIC: { label: "Databricks Mosaic AI", style: "OPENAI_COMPATIBLE", models: ["databricks-meta-llama-3-70b-instruct", "databricks-dbrx-instruct"] },
  SCALE_AI: { label: "Scale AI", style: "OPENAI_COMPATIBLE", models: ["scale-chat"] },
  WRITER_AI: { label: "Writer AI", style: "OPENAI_COMPATIBLE", models: ["palmyra-x-004", "palmyra-fin"] },
  JASPER_AI: { label: "Jasper AI", style: "OPENAI_COMPATIBLE", models: ["jasper-chat"] },
  COPY_AI: { label: "Copy.ai", style: "OPENAI_COMPATIBLE", models: ["copy-ai-chat"] },
  SYNTHESIA: { label: "Synthesia", style: "OPENAI_COMPATIBLE", models: ["synthesia"] },
  D_ID: { label: "D-ID", style: "OPENAI_COMPATIBLE", models: ["d-id"] },
  HEYGEN: { label: "HeyGen", style: "OPENAI_COMPATIBLE", models: ["heygen"] }
};

const providerBaseUrls = {
  XAI_GROK: "https://api.x.ai/v1",
  DEEPSEEK: "https://api.deepseek.com/v1",
  MISTRAL_AI: "https://api.mistral.ai/v1",
  TOGETHER_AI: "https://api.together.xyz/v1",
  GROQ: "https://api.groq.com/openai/v1",
  FIREWORKS_AI: "https://api.fireworks.ai/inference/v1",
  HUGGING_FACE: "https://router.huggingface.co/v1",
  PERPLEXITY_API: "https://api.perplexity.ai",
  MOONSHOT_KIMI: "https://api.moonshot.ai/v1",
  NVIDIA_NIM: "https://integrate.api.nvidia.com/v1"
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

document.addEventListener("DOMContentLoaded", () => {
  bindEvents();
  checkSession();
});

function bindEvents() {
  $("#loginForm").addEventListener("submit", login);
  $("#forgotBtn").addEventListener("click", showForgot);
  $("#logoutBtn").addEventListener("click", logout);
  $("#refreshBtn").addEventListener("click", refreshAll);
  $("#refreshMessages").addEventListener("click", loadMessages);
  $("#openLinkModal").addEventListener("click", () => openModal("linkModal"));
  $("#startLinkBtn").addEventListener("click", startWhatsAppLink);
  $("#addWaAccount").addEventListener("click", addWhatsappAccount);
  $("#waAccountSelect").addEventListener("change", changeWhatsappAccount);
  $("#messageAccountSelect").addEventListener("change", changeMessengerAccount);
  $("#editWaSettings").addEventListener("click", openSettings);
  $("#settingsForm").addEventListener("submit", saveSettings);
  $("#openAiModal").addEventListener("click", () => openAiModal());
  $("#aiForm").addEventListener("submit", saveAiKey);
  $("#aiProviderSelect").addEventListener("change", () => fillModelSelect());
  $("#openActionModal").addEventListener("click", () => openActionModal());
  $("#actionForm").addEventListener("submit", saveAction);
  $("#sendForm").addEventListener("submit", sendMessage);
  $("#attachBtn").addEventListener("click", () => $("#mediaInput").click());
  $("#mediaInput").addEventListener("change", selectAttachment);
  $("#voiceBtn").addEventListener("click", toggleVoiceRecording);

  $$(".nav-list button").forEach((button) => {
    button.addEventListener("click", () => setView(button.dataset.view));
  });

  $$(".close-modal").forEach((button) => button.addEventListener("click", closeModal));
  $("#modalBackdrop").addEventListener("click", (event) => {
    if (event.target.id === "modalBackdrop") closeModal();
  });
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  const data = await response.json().catch(() => ({}));
  if (response.status === 401 && path !== "/api/login") {
    showLogin();
  }
  if (!response.ok || data.ok === false) {
    throw new Error(data.error || "Request failed");
  }
  return data;
}

async function checkSession() {
  try {
    const data = await api("/api/me");
    state.user = data.user;
    showDashboard();
    await refreshAll();
  } catch {
    showLogin();
  }
}

async function login(event) {
  event.preventDefault();
  $("#loginError").textContent = "";
  try {
    const data = await api("/api/login", {
      method: "POST",
      body: JSON.stringify({
        email: $("#loginEmail").value,
        password: $("#loginPassword").value
      })
    });
    state.user = data.user;
    showDashboard();
    await refreshAll();
  } catch (error) {
    $("#loginError").textContent = error.message;
  }
}

async function showForgot() {
  const box = $("#forgotBox");
  try {
    const data = await api("/api/forgot-contact");
    box.textContent = `${data.message} ${data.number}`;
    box.classList.remove("hidden");
  } catch {
    box.textContent = "Password bhool gaye hain? Kindly admin se rabta karein.";
    box.classList.remove("hidden");
  }
}

async function logout() {
  await api("/api/logout", { method: "POST" }).catch(() => {});
  showLogin();
}

function showLogin() {
  $("#loginScreen").classList.remove("hidden");
  $("#dashboard").classList.add("hidden");
}

function showDashboard() {
  $("#loginScreen").classList.add("hidden");
  $("#dashboard").classList.remove("hidden");
  $("#userName").textContent = state.user?.name || state.user?.email || "User";
}

async function refreshAll() {
  await Promise.all([loadWhatsapp(), loadAiKeys(), loadActions(), loadMessages()]);
}

function setView(view) {
  $$(".nav-list button").forEach((button) => button.classList.toggle("active", button.dataset.view === view));
  $$(".view").forEach((panel) => panel.classList.toggle("active", panel.id === `view-${view}`));
}

async function loadWhatsapp() {
  const data = await api(`/api/whatsapp/status?accountId=${encodeURIComponent(state.selectedAccountId)}`);
  state.whatsapp = data.whatsapp;
  state.whatsappAccounts = data.accounts || [];
  if (!state.whatsappAccounts.some((account) => account.id === state.selectedAccountId)) {
    state.selectedAccountId = state.whatsappAccounts[0]?.id || "default";
  }
  renderWhatsapp();
  fillAccountSelects();
  renderMessengerAccountTabs();
}

function renderWhatsapp() {
  const wa = state.whatsapp || {};
  const connected = Boolean(wa.connected);
  const connectedTotal = state.whatsappAccounts.filter((account) => account.connected).length;
  $("#waStatusPill").textContent = `${connectedTotal}/${state.whatsappAccounts.length || 1} Connected`;
  $("#connectedCount").textContent = connectedTotal;
  $("#failedCount").textContent = Math.max(0, (state.whatsappAccounts.length || 1) - connectedTotal);
  $("#waPhone").textContent = wa.phone || "Not linked";
  $("#waStatusText").textContent = connected ? "Connected" : labelStatus(wa.status);
  $("#receiveChatsText").textContent = wa.settings?.receiveChats ? "Enable" : "Disable";
  $("#intervalText").textContent = `${wa.settings?.minInterval ?? 1} - ${wa.settings?.maxInterval ?? 5} sec`;
  $("#whatsappRows").innerHTML = state.whatsappAccounts.length
    ? state.whatsappAccounts.map((account) => rowHtml([
      escapeHtml(account.name),
      account.phone || "Not linked",
      account.connected ? "Connected" : labelStatus(account.status),
      escapeHtml(account.aiKeyName || "No API attached"),
      `<div class="row-actions"><button class="dark mini" onclick="selectWhatsappAccount('${escapeAttr(account.id)}')">Open</button><button class="dark mini" onclick="openSettings('${escapeAttr(account.id)}')">Edit</button><button class="dark mini" onclick="openLinkForAccount('${escapeAttr(account.id)}')">Link</button><button class="red mini" onclick="disconnectWhatsapp('${escapeAttr(account.id)}')">Logout</button></div>`
    ])).join("")
    : rowHtml(["-", "-", "-", "-", "-"]);

  if (wa.qr) {
    $("#qrBox").innerHTML = `<img src="${wa.qr}" alt="WhatsApp QR">`;
  } else if (wa.lastError) {
    $("#qrBox").textContent = wa.lastError;
  } else {
    $("#qrBox").textContent = connected ? "Connected" : "QR not ready";
  }
  $("#linkAccountName").textContent = wa.name || "WhatsApp";
}

function labelStatus(status) {
  const map = {
    offline: "Offline",
    starting: "Starting",
    qr: "Scan QR",
    connected: "Connected",
    "driver-missing": "Setup Required"
  };
  return map[status] || "Offline";
}

async function startWhatsAppLink() {
  $("#qrBox").textContent = "Creating QRCode";
  await api("/api/whatsapp/link", {
    method: "POST",
    body: JSON.stringify({ accountId: state.selectedAccountId })
  });
  await loadWhatsapp();
  setTimeout(loadWhatsapp, 2500);
}

async function addWhatsappAccount() {
  const data = await api("/api/whatsapp/accounts", {
    method: "POST",
    body: JSON.stringify({ name: `WhatsApp ${state.whatsappAccounts.length + 1}` })
  });
  state.selectedAccountId = data.account.id;
  state.selectedChatKey = "";
  state.selectedJid = "";
  await Promise.all([loadWhatsapp(), loadActions(), loadMessages()]);
  openModal("linkModal");
}

async function changeWhatsappAccount(event) {
  state.selectedAccountId = event.target.value || "default";
  state.selectedChatKey = "";
  state.selectedJid = "";
  await Promise.all([loadWhatsapp(), loadMessages()]);
}

async function changeMessengerAccount(event) {
  state.selectedAccountId = event.target.value || "default";
  state.selectedChatKey = "";
  state.selectedJid = "";
  await Promise.all([loadWhatsapp(), loadMessages()]);
}

async function selectMessengerAccount(accountId) {
  state.selectedAccountId = accountId || "default";
  state.selectedChatKey = "";
  state.selectedJid = "";
  fillAccountSelects();
  renderMessengerAccountTabs();
  await Promise.all([loadWhatsapp(), loadMessages()]);
}

async function selectWhatsappAccount(accountId) {
  state.selectedAccountId = accountId;
  state.selectedChatKey = "";
  state.selectedJid = "";
  await Promise.all([loadWhatsapp(), loadMessages()]);
}

async function openLinkForAccount(accountId) {
  await selectWhatsappAccount(accountId);
  openModal("linkModal");
}

async function disconnectWhatsapp(accountId = state.selectedAccountId) {
  await api("/api/whatsapp/logout", {
    method: "POST",
    body: JSON.stringify({ accountId })
  });
  await loadWhatsapp();
}

function openSettings(accountId = state.selectedAccountId) {
  const form = $("#settingsForm");
  const account = state.whatsappAccounts.find((item) => item.id === accountId) || state.whatsapp || {};
  const settings = account.settings || {};
  form.accountId.value = account.id || accountId;
  form.name.value = account.name || "";
  form.receiveChats.value = String(settings.receiveChats ?? true);
  form.randomInterval.value = String(settings.randomInterval ?? true);
  form.minInterval.value = settings.minInterval ?? 1;
  form.maxInterval.value = settings.maxInterval ?? 5;
  openModal("settingsModal");
}

async function saveSettings(event) {
  event.preventDefault();
  const form = event.currentTarget;
  await api("/api/whatsapp/settings", {
    method: "POST",
    body: JSON.stringify({
      accountId: form.accountId.value,
      name: form.name.value,
      receiveChats: form.receiveChats.value === "true",
      randomInterval: form.randomInterval.value === "true",
      minInterval: form.minInterval.value,
      maxInterval: form.maxInterval.value
    })
  });
  closeModal();
  await loadWhatsapp();
}

function fillAccountSelects() {
  const options = state.whatsappAccounts.length
    ? state.whatsappAccounts.map((account) => `<option value="${escapeAttr(account.id)}">${escapeHtml(account.name)}${account.phone ? ` - +${escapeHtml(account.phone)}` : ""}</option>`).join("")
    : `<option value="default">Default WhatsApp</option>`;
  ["#waAccountSelect", "#messageAccountSelect", "#actionAccountSelect"].forEach((selector) => {
    const select = $(selector);
    if (!select) return;
    select.innerHTML = options;
    select.value = state.selectedAccountId;
  });
}

function renderMessengerAccountTabs() {
  const box = $("#messengerAccountTabs");
  if (!box) return;
  const accounts = state.whatsappAccounts.length ? state.whatsappAccounts : [{
    id: "default",
    name: "WhatsApp",
    status: "disconnected",
    connected: false
  }];
  box.innerHTML = accounts.map((account, index) => {
    const number = String(index + 1).padStart(2, "0");
    const statusText = account.phone ? `+${account.phone}` : labelStatus(account.status);
    const activeClass = account.id === state.selectedAccountId ? "active" : "";
    const statusClass = account.connected ? "online" : "offline";
    return `
      <button class="account-tab ${activeClass}" onclick="selectMessengerAccount('${escapeAttr(account.id)}')">
        <strong>Account ${number}</strong>
        <span>${escapeHtml(account.name || `WhatsApp ${number}`)}</span>
        <em class="${statusClass}">${escapeHtml(statusText)}</em>
      </button>
    `;
  }).join("");
}

async function loadAiKeys() {
  const data = await api("/api/ai-keys");
  state.aiKeys = data.aiKeys;
  renderAiKeys();
  fillAiKeySelect();
}

function renderAiKeys() {
  $("#aiRows").innerHTML = state.aiKeys.length
    ? state.aiKeys.map((key) => rowHtml([
      formatDate(key.createdAt),
      escapeHtml(key.name),
      `${escapeHtml(providerLabel(key.provider))}<br>${escapeHtml(key.model)}`,
      escapeHtml(key.apiKey || "Not set"),
      `<div class="row-actions"><button class="dark mini" onclick="openAiModal('${key.id}')">Edit</button><button class="red mini" onclick="deleteAiKey('${key.id}')">Delete</button></div>`
    ])).join("")
    : rowHtml(["-", "No AI key", "-", "-", `<button class="dark mini" onclick="openAiModal()">Add</button>`]);
}

function openAiModal(id = "") {
  const key = state.aiKeys.find((item) => item.id === id);
  const form = $("#aiForm");
  form.reset();
  fillProviderSelect();
  form.id.value = key?.id || "";
  form.name.value = key?.name || "Haji";
  form.provider.value = key?.provider || "OPENAI";
  form.apiBaseUrl.value = key?.apiBaseUrl || "";
  fillModelSelect(key?.model);
  form.apiStyle.value = key?.apiStyle || providerPresets[form.provider.value]?.style || "OPENAI_COMPATIBLE";
  form.initialPrompt.value = key?.initialPrompt || "You are a helpful WhatsApp shopkeeper. Reply naturally, read the complete chat history, and answer in the customer's language.";
  form.postPrompt.value = key?.postPrompt || "Keep replies short, polite, and useful. Ask one clear question if details are missing.";
  form.vision.value = String(key?.vision ?? true);
  form.transcription.value = String(key?.transcription ?? true);
  form.maxTokens.value = key?.maxTokens || 512;
  form.historyThreshold.value = key?.historyThreshold || 5000;
  form.apiKey.value = "";
  $("#aiModalTitle").textContent = key ? "Edit AI API Key" : "Add AI API Key";
  openModal("aiModal");
}

function fillProviderSelect() {
  const select = $("#aiProviderSelect");
  select.innerHTML = Object.entries(providerPresets)
    .map(([id, provider]) => `<option value="${escapeAttr(id)}">${escapeHtml(provider.label)}</option>`)
    .join("");
}

function fillModelSelect(selected = "") {
  const providerId = $("#aiProviderSelect").value || "OPENAI";
  const provider = providerPresets[providerId] || providerPresets.OPENAI;
  $("#aiStyleSelect").value = provider.style || "OPENAI_COMPATIBLE";
  const baseInput = document.querySelector("[name='apiBaseUrl']");
  if (baseInput && (!baseInput.value || Object.values(providerBaseUrls).includes(baseInput.value))) {
    baseInput.value = providerBaseUrls[providerId] || "";
  }
  const models = provider.models?.length ? provider.models : ["custom-model"];
  $("#aiModelSelect").innerHTML = models.map((model) => `<option value="${escapeAttr(model)}">${escapeHtml(model)}</option>`).join("");
  $("#aiModelSelect").value = selected && models.includes(selected) ? selected : models[0];
}

function providerLabel(providerId) {
  return providerPresets[providerId]?.label || providerId || "OpenAI";
}

async function saveAiKey(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const payload = formToObject(form);
  payload.vision = payload.vision === "true";
  payload.transcription = payload.transcription === "true";
  const id = payload.id;
  delete payload.id;

  await api(id ? `/api/ai-keys/${id}` : "/api/ai-keys", {
    method: id ? "PUT" : "POST",
    body: JSON.stringify(payload)
  });

  closeModal();
  await loadAiKeys();
}

async function deleteAiKey(id) {
  await api(`/api/ai-keys/${id}`, { method: "DELETE" });
  await Promise.all([loadAiKeys(), loadActions()]);
}

async function loadActions() {
  const data = await api("/api/actions");
  state.actions = data.actions;
  renderActions();
}

function renderActions() {
  $("#actionRows").innerHTML = state.actions.length
    ? state.actions.map((action) => rowHtml([
      formatDate(action.createdAt),
      escapeHtml(action.name),
      `Type: Autoreply<br>Account: ${escapeHtml(action.accountName || action.accountId || "default")}<br>API: ${escapeHtml(action.aiKeyName || "Not attached")}`,
      action.enabled ? "Yes" : "No",
      `<div class="row-actions"><button class="dark mini" onclick="openActionModal('${action.id}')">Edit</button><button class="red mini" onclick="deleteAction('${action.id}')">Delete</button></div>`
    ])).join("")
    : rowHtml(["-", "No action", "-", "-", `<button class="dark mini" onclick="openActionModal()">Add</button>`]);
}

function fillAiKeySelect() {
  const select = $("#actionAiKeySelect");
  select.innerHTML = state.aiKeys.length
    ? state.aiKeys.map((key) => `<option value="${key.id}">${escapeHtml(key.name)} - ${escapeHtml(key.provider || "OPENAI")}</option>`).join("")
    : `<option value="">NOTHING SELECTED</option>`;
}

function openActionModal(id = "") {
  const action = state.actions.find((item) => item.id === id);
  const form = $("#actionForm");
  form.reset();
  fillAiKeySelect();
  fillAccountSelects();
  form.id.value = action?.id || "";
  form.name.value = action?.name || "Hjiiii";
  form.accountId.value = action?.accountId || state.selectedAccountId || "default";
  form.aiKeyId.value = action?.aiKeyId || state.aiKeys[0]?.id || "";
  form.priority.value = String(action?.priority ?? true);
  form.groupTrigger.value = String(action?.groupTrigger ?? false);
  form.enabled.value = String(action?.enabled ?? true);
  $("#actionModalTitle").textContent = action ? "Edit Reply Action" : "Add Reply Action";
  openModal("actionModal");
}

async function saveAction(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const payload = formToObject(form);
  payload.priority = payload.priority === "true";
  payload.groupTrigger = payload.groupTrigger === "true";
  payload.enabled = payload.enabled === "true";
  const id = payload.id;
  delete payload.id;

  await api(id ? `/api/actions/${id}` : "/api/actions", {
    method: id ? "PUT" : "POST",
    body: JSON.stringify(payload)
  });
  closeModal();
  await loadActions();
}

async function deleteAction(id) {
  await api(`/api/actions/${id}`, { method: "DELETE" });
  await loadActions();
}

async function loadMessages() {
  const [chatsData, messagesData] = await Promise.all([
    api(`/api/chats?accountId=${encodeURIComponent(state.selectedAccountId)}`),
    api(state.selectedChatKey ? `/api/messages?chatKey=${encodeURIComponent(state.selectedChatKey)}` : `/api/messages?accountId=${encodeURIComponent(state.selectedAccountId)}`)
  ]);
  state.chats = chatsData.chats;
  state.messages = messagesData.messages;
  if (state.selectedChatKey && !state.chats.some((chat) => chat.chatKey === state.selectedChatKey)) {
    state.selectedChatKey = "";
    state.selectedJid = "";
  }
  renderChats();
  renderMessages();
}

function renderChats() {
  $("#chatList").innerHTML = state.chats.length
    ? state.chats.map((chat) => `
      <button class="chat-item ${state.selectedChatKey === chat.chatKey ? "active" : ""}" onclick="selectChat('${escapeAttr(chat.chatKey)}')">
        <strong>${escapeHtml(chat.title || chat.phone)}</strong>
        <em>${escapeHtml(accountLabel(chat.accountId))}</em>
        <span>${escapeHtml(chat.lastMessage || "")}</span>
      </button>
    `).join("")
    : `<button class="chat-item"><strong>No chats</strong><span>Messages will appear here</span></button>`;
}

async function selectChat(chatKey) {
  const chat = state.chats.find((item) => item.chatKey === chatKey);
  state.selectedChatKey = chatKey;
  state.selectedJid = chat?.jid || "";
  await loadMessages();
}

function renderMessages() {
  const messages = state.selectedChatKey
    ? state.messages.filter((message) => message.chatKey === state.selectedChatKey)
    : state.messages.slice(-50);
  const chat = state.chats.find((item) => item.chatKey === state.selectedChatKey);
  $("#chatTitle").textContent = chat ? `${chat.title || chat.phone} - ${accountLabel(chat.accountId)}` : "Select a chat";
  $("#messageList").innerHTML = messages.length
    ? messages.map((message) => `
      <div class="bubble ${message.direction}">
        ${renderAttachment(message.attachment)}
        ${formatMessageText(message.text)}
        <small>${formatDate(message.createdAt)} - ${escapeHtml(message.source || "")}</small>
      </div>
    `).join("")
    : `<div class="bubble system">No messages</div>`;
  $("#messageList").scrollTop = $("#messageList").scrollHeight;
}

async function sendMessage(event) {
  event.preventDefault();
  if (!state.selectedJid || !state.selectedAccountId) return;
  const text = $("#sendText").value.trim();
  if (!text && !state.pendingFile) return;
  if (state.pendingFile) {
    const dataUrl = await fileToDataUrl(state.pendingFile);
    await api("/api/messages/send-media", {
      method: "POST",
      body: JSON.stringify({
        jid: state.selectedJid,
        accountId: state.selectedAccountId,
        dataUrl,
        filename: state.pendingFile.name,
        mimeType: state.pendingFile.type,
        caption: text
      })
    });
    clearAttachment();
  } else {
    await api("/api/messages/send", {
      method: "POST",
      body: JSON.stringify({ jid: state.selectedJid, accountId: state.selectedAccountId, text })
    });
  }
  $("#sendText").value = "";
  await loadMessages();
}

function selectAttachment(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  state.pendingFile = file;
  renderAttachmentPreview(file);
}

function renderAttachmentPreview(file) {
  const box = $("#attachmentPreview");
  box.innerHTML = `
    <span>${escapeHtml(file.name)} (${formatBytes(file.size)})</span>
    <button class="link-button" type="button" onclick="clearAttachment()">Remove</button>
  `;
  box.classList.remove("hidden");
}

function clearAttachment() {
  state.pendingFile = null;
  $("#mediaInput").value = "";
  $("#attachmentPreview").classList.add("hidden");
  $("#attachmentPreview").innerHTML = "";
}

async function toggleVoiceRecording() {
  if (state.recording) {
    state.mediaRecorder?.stop();
    return;
  }

  if (!state.selectedJid || !state.selectedAccountId) return;
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    alert("Mic permission allow karein, phir voice note send hoga.");
    return;
  }
  state.voiceChunks = [];
  state.mediaRecorder = new MediaRecorder(stream);
  state.mediaRecorder.addEventListener("dataavailable", (event) => {
    if (event.data?.size) state.voiceChunks.push(event.data);
  });
  state.mediaRecorder.addEventListener("stop", async () => {
    stream.getTracks().forEach((track) => track.stop());
    state.recording = false;
    $("#voiceBtn").textContent = "Mic";
    const blob = new Blob(state.voiceChunks, { type: state.mediaRecorder.mimeType || "audio/webm" });
    if (!blob.size) return;
    const dataUrl = await blobToDataUrl(blob);
    await api("/api/messages/send-media", {
      method: "POST",
      body: JSON.stringify({
        jid: state.selectedJid,
        accountId: state.selectedAccountId,
        dataUrl,
        filename: "voice-note.webm",
        mimeType: blob.type || "audio/webm",
        caption: "",
        asVoice: true
      })
    });
    await loadMessages();
  });
  state.recording = true;
  $("#voiceBtn").textContent = "Stop";
  state.mediaRecorder.start();
}

function renderAttachment(attachment) {
  if (!attachment?.url) return "";
  const url = escapeAttr(attachment.url);
  const name = escapeHtml(attachment.filename || "file");
  if (attachment.type === "image") return `<img class="message-media image" src="${url}" alt="${name}">`;
  if (attachment.type === "video") return `<video class="message-media" src="${url}" controls></video>`;
  if (attachment.type === "audio") return `<audio class="message-audio" src="${url}" controls></audio>`;
  return `<a class="message-file" href="${url}" target="_blank" download>${name}</a>`;
}

function formatMessageText(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  return `<div class="message-text">${escapeHtml(text).replace(/\n/g, "<br>")}</div>`;
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("File read failed"));
    reader.readAsDataURL(file);
  });
}

function blobToDataUrl(blob) {
  return fileToDataUrl(blob);
}

function formatBytes(bytes) {
  const value = Number(bytes || 0);
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function accountLabel(accountId) {
  const account = state.whatsappAccounts.find((item) => item.id === accountId);
  if (!account) return accountId || "WhatsApp";
  return `${account.name}${account.phone ? ` (+${account.phone})` : ""}`;
}

function openModal(id) {
  $("#modalBackdrop").classList.remove("hidden");
  $$(".modal").forEach((modal) => modal.classList.toggle("active", modal.id === id));
}

function closeModal() {
  $("#modalBackdrop").classList.add("hidden");
  $$(".modal").forEach((modal) => modal.classList.remove("active"));
}

function formToObject(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function rowHtml(cells) {
  return `<tr>${cells.map((cell) => `<td>${cell}</td>`).join("")}</tr>`;
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, "&#096;");
}

window.openModal = openModal;
window.openSettings = openSettings;
window.selectWhatsappAccount = selectWhatsappAccount;
window.selectMessengerAccount = selectMessengerAccount;
window.openLinkForAccount = openLinkForAccount;
window.disconnectWhatsapp = disconnectWhatsapp;
window.openAiModal = openAiModal;
window.deleteAiKey = deleteAiKey;
window.openActionModal = openActionModal;
window.deleteAction = deleteAction;
window.selectChat = selectChat;
window.clearAttachment = clearAttachment;
