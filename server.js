const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const DATA_DIR = path.resolve(ROOT, process.env.DATA_DIR || "data");
const MEDIA_DIR = path.join(DATA_DIR, "media");
const STORE_FILE = path.join(DATA_DIR, "store.json");

loadEnv(path.join(ROOT, ".env"));
fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(MEDIA_DIR, { recursive: true });

const PORT = Number(process.env.PORT || 3030);
const MAX_JSON_BODY = Number(process.env.MAX_UPLOAD_MB || 40) * 1024 * 1024;
const DEFAULT_ACCOUNT_ID = "default";
const MAX_WHATSAPP_ACCOUNTS = Number(process.env.MAX_WHATSAPP_ACCOUNTS || 50);
const MAX_AI_KEYS = Number(process.env.MAX_AI_KEYS || 50);
const COOKIE_NAME = "sender_portal_session";
const sessions = new Map();

process.on("unhandledRejection", (error) => {
  console.error("Unhandled rejection:", error);
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught exception:", error);
});

const defaultStore = {
  whatsapp: {
    receiveChats: true,
    randomInterval: true,
    minInterval: 1,
    maxInterval: 5,
    phone: "",
    lastLinkedAt: ""
  },
  whatsappAccounts: [],
  aiKeys: [],
  actions: [],
  chats: {},
  messages: []
};

let store = loadStore();
normalizeStoreShape();
const waRuntimes = new Map();
const processedIncomingMessages = new Set();

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webm": "video/webm",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".ogg": "audio/ogg",
  ".opus": "audio/ogg",
  ".wav": "audio/wav",
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".txt": "text/plain; charset=utf-8",
  ".woff": "font/woff",
  ".woff2": "font/woff2"
};

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url);
      return;
    }

    if (url.pathname.startsWith("/media/")) {
      serveMedia(req, res, url);
      return;
    }

    serveStatic(req, res, url);
  } catch (error) {
    console.error(error);
    json(res, 500, { ok: false, error: "Server error" });
  }
});

server.listen(PORT, () => {
  console.log(`WhatsApp AI portal running on http://localhost:${PORT}`);
  autoStartLinkedWhatsAppAccounts();
});

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

function loadStore() {
  if (!fs.existsSync(STORE_FILE)) return structuredClone(defaultStore);
  try {
    return { ...structuredClone(defaultStore), ...JSON.parse(fs.readFileSync(STORE_FILE, "utf8")) };
  } catch {
    return structuredClone(defaultStore);
  }
}

function normalizeStoreShape() {
  let changed = false;

  if (!Array.isArray(store.whatsappAccounts)) {
    store.whatsappAccounts = [];
    changed = true;
  }

  if (!store.whatsappAccounts.length) {
    store.whatsappAccounts.push(defaultWhatsappAccount());
    changed = true;
  }

  store.whatsappAccounts = store.whatsappAccounts.slice(0, MAX_WHATSAPP_ACCOUNTS).map((account, index) => ({
    ...defaultWhatsappAccount(index === 0 ? DEFAULT_ACCOUNT_ID : `wa_${index + 1}`),
    ...account,
    id: safeAccountId(account.id || (index === 0 ? DEFAULT_ACCOUNT_ID : `wa_${index + 1}`)),
    name: String(account.name || account.phone || `WhatsApp ${index + 1}`).trim()
  }));

  for (const account of store.whatsappAccounts) {
    account.receiveChats = normalizeToggle(account.receiveChats, account.receiveChats, true);
    account.randomInterval = normalizeToggle(account.randomInterval, account.randomInterval, true);
    account.minInterval = clampNumber(account.minInterval, 0, 600, 1);
    account.maxInterval = Math.max(account.minInterval, clampNumber(account.maxInterval, 0, 600, 5));
  }

  if (!Array.isArray(store.actions)) store.actions = [];
  store.actions = store.actions.map((action) => ({ ...action, accountId: safeAccountId(action.accountId || DEFAULT_ACCOUNT_ID) }));
  store.actions = uniqueActionsByAccount(store.actions);

  if (!Array.isArray(store.messages)) store.messages = [];
  store.messages = store.messages.map((message) => {
    const accountId = safeAccountId(message.accountId || DEFAULT_ACCOUNT_ID);
    return { ...message, accountId, chatKey: message.chatKey || chatKey(accountId, message.jid) };
  });

  const oldChats = store.chats && typeof store.chats === "object" ? Object.values(store.chats) : [];
  store.chats = {};
  for (const chat of oldChats) {
    const accountId = safeAccountId(chat.accountId || DEFAULT_ACCOUNT_ID);
    const key = chat.chatKey || chatKey(accountId, chat.jid);
    store.chats[key] = { ...chat, accountId, chatKey: key };
  }

  if (changed) saveStore();
}

function defaultWhatsappAccount(id = DEFAULT_ACCOUNT_ID) {
  return {
    id,
    name: id === DEFAULT_ACCOUNT_ID ? "Default WhatsApp" : "WhatsApp",
    phone: store?.whatsapp?.phone || "",
    lastLinkedAt: store?.whatsapp?.lastLinkedAt || "",
    receiveChats: store?.whatsapp?.receiveChats ?? true,
    randomInterval: store?.whatsapp?.randomInterval ?? true,
    minInterval: store?.whatsapp?.minInterval ?? 1,
    maxInterval: store?.whatsapp?.maxInterval ?? 5
  };
}

function saveStore() {
  fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2));
}

function structuredClone(value) {
  return JSON.parse(JSON.stringify(value));
}

async function handleApi(req, res, url) {
  const route = `${req.method} ${url.pathname}`;

  if (route === "POST /api/login") {
    const body = await bodyJson(req);
    const result = await authenticateUser(body.email, body.password);

    if (!result.ok) {
      json(res, 401, result);
      return;
    }

    const sessionId = randomId();
    sessions.set(sessionId, {
      email: result.user.email,
      name: result.user.name,
      expiresAt: result.user.expiresAt,
      createdAt: new Date().toISOString()
    });

    setCookie(res, sessionId);
    json(res, 200, { ok: true, user: sessions.get(sessionId) });
    return;
  }

  if (route === "POST /api/logout") {
    const sessionId = getCookie(req, COOKIE_NAME);
    if (sessionId) sessions.delete(sessionId);
    clearCookie(res);
    json(res, 200, { ok: true });
    return;
  }

  if (route === "GET /api/forgot-contact") {
    json(res, 200, {
      ok: true,
      number: process.env.FORGOT_WHATSAPP_NUMBER || "+923357631909",
      message: "Password bhool gaye hain? Kindly is WhatsApp number par rabta karein."
    });
    return;
  }

  const user = requireUser(req, res);
  if (!user) return;

  if (route === "GET /api/me") {
    json(res, 200, { ok: true, user });
    return;
  }

  if (route === "GET /api/status") {
    json(res, 200, {
      ok: true,
      googleLogin: Boolean(process.env.GOOGLE_SHEET_ID),
      whatsapp: whatsappPublicStatus(selectedAccountId(url)),
      counts: {
        aiKeys: store.aiKeys.length,
        actions: store.actions.length,
        whatsappAccounts: store.whatsappAccounts.length,
        chats: Object.keys(store.chats).length,
        messages: store.messages.length
      }
    });
    return;
  }

  if (route === "GET /api/whatsapp/status") {
    json(res, 200, { ok: true, whatsapp: whatsappPublicStatus(selectedAccountId(url)), accounts: whatsappAccountsPublic() });
    return;
  }

  if (route === "GET /api/whatsapp/accounts") {
    json(res, 200, { ok: true, accounts: whatsappAccountsPublic() });
    return;
  }

  if (route === "POST /api/whatsapp/accounts") {
    const body = await bodyJson(req);
    if (store.whatsappAccounts.length >= MAX_WHATSAPP_ACCOUNTS) {
      return json(res, 400, { ok: false, error: `Maximum ${MAX_WHATSAPP_ACCOUNTS} WhatsApp accounts allowed` });
    }
    const account = {
      ...defaultWhatsappAccount(`wa_${randomId().slice(0, 10)}`),
      name: String(body.name || `WhatsApp ${store.whatsappAccounts.length + 1}`).trim(),
      phone: "",
      lastLinkedAt: ""
    };
    store.whatsappAccounts.push(account);
    saveStore();
    json(res, 200, { ok: true, account: whatsappAccountPublic(account) });
    return;
  }

  if (route === "POST /api/whatsapp/link") {
    const body = await bodyJson(req);
    const accountId = safeAccountId(body.accountId || selectedAccountId(url));
    await startWhatsApp(accountId);
    json(res, 200, { ok: true, whatsapp: whatsappPublicStatus(accountId), accounts: whatsappAccountsPublic() });
    return;
  }

  if (route === "POST /api/whatsapp/logout") {
    const body = await bodyJson(req);
    const accountId = safeAccountId(body.accountId || selectedAccountId(url));
    await logoutWhatsApp(accountId);
    json(res, 200, { ok: true, whatsapp: whatsappPublicStatus(accountId), accounts: whatsappAccountsPublic() });
    return;
  }

  if (route === "POST /api/whatsapp/settings") {
    const body = await bodyJson(req);
    const account = getWhatsappAccount(body.accountId || selectedAccountId(url));
    if (!account) return json(res, 404, { ok: false, error: "WhatsApp account not found" });
    account.name = String(body.name || account.name || "WhatsApp").trim();
    account.receiveChats = normalizeToggle(body.receiveChats, account.receiveChats, true);
    account.randomInterval = normalizeToggle(body.randomInterval, account.randomInterval, true);
    account.minInterval = clampNumber(body.minInterval, 0, 600, 1);
    account.maxInterval = Math.max(account.minInterval, clampNumber(body.maxInterval, 0, 600, 5));
    saveStore();
    json(res, 200, { ok: true, whatsapp: whatsappPublicStatus(account.id), accounts: whatsappAccountsPublic() });
    return;
  }

  if (route === "GET /api/ai-keys") {
    json(res, 200, { ok: true, aiKeys: store.aiKeys.map(publicAiKey) });
    return;
  }

  if (route === "POST /api/ai-keys") {
    if (store.aiKeys.length >= MAX_AI_KEYS) {
      return json(res, 400, { ok: false, error: `Maximum ${MAX_AI_KEYS} API keys allowed` });
    }
    const body = await bodyJson(req);
    const key = normalizeAiKey(body);
    key.id = randomId();
    key.createdAt = new Date().toISOString();
    key.updatedAt = key.createdAt;
    store.aiKeys.push(key);
    saveStore();
    json(res, 200, { ok: true, aiKey: publicAiKey(key) });
    return;
  }

  const aiKeyMatch = url.pathname.match(/^\/api\/ai-keys\/([^/]+)$/);
  if (aiKeyMatch && req.method === "PUT") {
    const body = await bodyJson(req);
    const key = store.aiKeys.find((item) => item.id === aiKeyMatch[1]);
    if (!key) return json(res, 404, { ok: false, error: "AI key not found" });
    const updated = normalizeAiKey(body, key);
    Object.assign(key, updated, { id: key.id, createdAt: key.createdAt, updatedAt: new Date().toISOString() });
    saveStore();
    json(res, 200, { ok: true, aiKey: publicAiKey(key) });
    return;
  }

  if (aiKeyMatch && req.method === "DELETE") {
    store.aiKeys = store.aiKeys.filter((item) => item.id !== aiKeyMatch[1]);
    store.actions = store.actions.map((action) => action.aiKeyId === aiKeyMatch[1] ? { ...action, aiKeyId: "" } : action);
    saveStore();
    json(res, 200, { ok: true });
    return;
  }

  if (route === "GET /api/actions") {
    json(res, 200, { ok: true, actions: store.actions.map(publicAction) });
    return;
  }

  if (route === "POST /api/actions") {
    const body = await bodyJson(req);
    const action = normalizeAction(body);
    if (!getWhatsappAccount(action.accountId)) return json(res, 404, { ok: false, error: "WhatsApp account not found" });
    if (action.aiKeyId && !store.aiKeys.some((key) => key.id === action.aiKeyId)) return json(res, 404, { ok: false, error: "AI key not found" });
    const savedAction = saveUniqueAction(action);
    saveStore();
    json(res, 200, { ok: true, action: savedAction });
    return;
  }

  const actionMatch = url.pathname.match(/^\/api\/actions\/([^/]+)$/);
  if (actionMatch && req.method === "PUT") {
    const body = await bodyJson(req);
    const action = store.actions.find((item) => item.id === actionMatch[1]);
    if (!action) return json(res, 404, { ok: false, error: "Action not found" });
    const normalized = normalizeAction(body);
    if (!getWhatsappAccount(normalized.accountId)) return json(res, 404, { ok: false, error: "WhatsApp account not found" });
    if (normalized.aiKeyId && !store.aiKeys.some((key) => key.id === normalized.aiKeyId)) return json(res, 404, { ok: false, error: "AI key not found" });
    Object.assign(action, normalized, { id: action.id, createdAt: action.createdAt, updatedAt: new Date().toISOString() });
    store.actions = store.actions.filter((item) => item.id === action.id || item.accountId !== normalized.accountId);
    saveStore();
    json(res, 200, { ok: true, action });
    return;
  }

  if (actionMatch && req.method === "DELETE") {
    store.actions = store.actions.filter((item) => item.id !== actionMatch[1]);
    saveStore();
    json(res, 200, { ok: true });
    return;
  }

  if (route === "GET /api/chats") {
    await refreshStoredChatContactInfo();
    const accountId = selectedAccountId(url);
    const chats = Object.values(store.chats)
      .filter((chat) => !accountId || chat.accountId === accountId)
      .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
    json(res, 200, { ok: true, chats });
    return;
  }

  if (route === "GET /api/messages") {
    const key = url.searchParams.get("chatKey");
    const accountId = selectedAccountId(url);
    const jid = url.searchParams.get("jid");
    const messages = store.messages
      .filter((message) => {
        if (key) return message.chatKey === key;
        if (jid) return message.jid === jid && (!accountId || message.accountId === accountId);
        return !accountId || message.accountId === accountId;
      })
      .slice(-300);
    json(res, 200, { ok: true, messages });
    return;
  }

  if (route === "POST /api/messages/send") {
    const body = await bodyJson(req);
    const accountId = safeAccountId(body.accountId || DEFAULT_ACCOUNT_ID);
    if (!body.jid || !body.text) return json(res, 400, { ok: false, error: "Chat and message are required" });
    await sendWhatsAppText(accountId, body.jid, body.text);
    const contactInfo = await resolveJidContactInfo(accountId, body.jid);
    addMessageIfNotRecent({ accountId, jid: body.jid, direction: "out", text: body.text, source: "manual", contactInfo });
    json(res, 200, { ok: true });
    return;
  }

  if (route === "POST /api/messages/send-media") {
    const body = await bodyJson(req);
    const accountId = safeAccountId(body.accountId || DEFAULT_ACCOUNT_ID);
    if (!body.jid || !body.dataUrl) return json(res, 400, { ok: false, error: "Chat and file are required" });
    const parsed = parseMediaUpload(body);
    await sendWhatsAppMedia(accountId, body.jid, parsed, {
      caption: String(body.caption || "").trim(),
      asVoice: Boolean(body.asVoice)
    });
    const attachment = saveMediaFile(parsed, "out");
    const text = String(body.caption || "").trim() || attachmentLabel(attachment);
    const contactInfo = await resolveJidContactInfo(accountId, body.jid);
    addMessageIfNotRecent({
      accountId,
      jid: body.jid,
      direction: "out",
      text,
      source: body.asVoice ? "voice" : "manual",
      attachment,
      contactInfo
    });
    json(res, 200, { ok: true });
    return;
  }

  json(res, 404, { ok: false, error: "Not found" });
}

function serveStatic(req, res, url) {
  let filePath = url.pathname === "/" ? path.join(PUBLIC_DIR, "index.html") : path.join(PUBLIC_DIR, decodeURIComponent(url.pathname));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(PUBLIC_DIR, "index.html");
  }

  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, { "Content-Type": mimeTypes[ext] || "application/octet-stream" });
  fs.createReadStream(filePath).pipe(res);
}

function serveMedia(req, res, url) {
  const user = requireUser(req, res);
  if (!user) return;

  const relative = decodeURIComponent(url.pathname.replace(/^\/media\//, ""));
  const filePath = path.resolve(MEDIA_DIR, relative);
  if (!filePath.startsWith(`${MEDIA_DIR}${path.sep}`)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, {
    "Content-Type": mimeTypes[ext] || "application/octet-stream",
    "Cache-Control": "private, max-age=86400"
  });
  fs.createReadStream(filePath).pipe(res);
}

function bodyJson(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > MAX_JSON_BODY) {
        reject(new Error("Body too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        resolve({});
      }
    });
  });
}

function json(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function setCookie(res, value) {
  const signed = `${value}.${sign(value)}`;
  res.setHeader("Set-Cookie", `${COOKIE_NAME}=${signed}; HttpOnly; Path=/; SameSite=Lax; Max-Age=86400`);
}

function clearCookie(res) {
  res.setHeader("Set-Cookie", `${COOKIE_NAME}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`);
}

function getCookie(req, name) {
  const cookies = String(req.headers.cookie || "").split(";").map((item) => item.trim());
  const cookie = cookies.find((item) => item.startsWith(`${name}=`));
  if (!cookie) return "";
  const value = decodeURIComponent(cookie.slice(name.length + 1));
  const [sessionId, signature] = value.split(".");
  if (!sessionId || signature !== sign(sessionId)) return "";
  return sessionId;
}

function sign(value) {
  return crypto
    .createHmac("sha256", process.env.APP_SECRET || "dev-secret")
    .update(value)
    .digest("hex");
}

function requireUser(req, res) {
  const sessionId = getCookie(req, COOKIE_NAME);
  const user = sessionId ? sessions.get(sessionId) : null;
  if (!user) {
    json(res, 401, { ok: false, error: "Login required" });
    return null;
  }
  return user;
}

async function authenticateUser(email, password) {
  email = String(email || "").trim().toLowerCase();
  password = String(password || "");
  if (!email || !password) return { ok: false, error: "Email and password are required" };

  if (process.env.GOOGLE_SHEET_ID) {
    return authenticateWithGoogleSheet(email, password);
  }

  const expectedEmail = String(process.env.ADMIN_EMAIL || "admin@example.com").toLowerCase();
  const expectedPassword = String(process.env.ADMIN_PASSWORD || "12345");
  const expiresAt = process.env.ADMIN_EXPIRES_AT || "2099-12-31";

  if (email !== expectedEmail || password !== expectedPassword) {
    return { ok: false, error: "Invalid login" };
  }

  if (isExpired(expiresAt)) {
    return { ok: false, error: "Account expired" };
  }

  return {
    ok: true,
    user: {
      email,
      name: process.env.ADMIN_NAME || "Admin",
      expiresAt
    }
  };
}

async function authenticateWithGoogleSheet(email, password) {
  let google;
  try {
    ({ google } = await import("googleapis"));
  } catch {
    return { ok: false, error: "Google login package is not installed. Run npm install on the server." };
  }

  const authOptions = {
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"]
  };

  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    authOptions.credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  } else if (process.env.GOOGLE_SERVICE_ACCOUNT_FILE) {
    authOptions.keyFile = path.resolve(ROOT, process.env.GOOGLE_SERVICE_ACCOUNT_FILE);
  } else {
    return { ok: false, error: "Google service account is not configured" };
  }

  const auth = new google.auth.GoogleAuth(authOptions);
  const sheets = google.sheets({ version: "v4", auth });
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: process.env.GOOGLE_SHEET_RANGE || "Users!A:E"
  });

  const rows = response.data.values || [];
  if (rows.length < 2) return { ok: false, error: "No users found in sheet" };

  const headers = rows[0].map((item) => normalizeHeader(item));
  const getIndex = (...names) => headers.findIndex((header) => names.includes(header));
  const emailIndex = getIndex("email", "email_address", "user_email");
  const passwordIndex = getIndex("password", "pass");
  const expiryIndex = getIndex("expires_at", "expiry", "date", "expire_date");
  const statusIndex = getIndex("status", "active");
  const nameIndex = getIndex("name", "full_name");

  for (const row of rows.slice(1)) {
    const rowEmail = String(row[emailIndex] || "").trim().toLowerCase();
    if (rowEmail !== email) continue;

    const rowPassword = String(row[passwordIndex] || "");
    const expiresAt = String(row[expiryIndex] || "2099-12-31").trim();
    const status = String(row[statusIndex] || "active").trim().toLowerCase();

    if (rowPassword !== password) return { ok: false, error: "Invalid login" };
    if (["inactive", "blocked", "disabled", "0", "no"].includes(status)) return { ok: false, error: "Account disabled" };
    if (isExpired(expiresAt)) return { ok: false, error: "Account expired" };

    return {
      ok: true,
      user: {
        email,
        name: String(row[nameIndex] || email).trim(),
        expiresAt
      }
    };
  }

  return { ok: false, error: "Invalid login" };
}

function normalizeHeader(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function isExpired(value) {
  if (!value) return false;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return false;
  parsed.setHours(23, 59, 59, 999);
  return parsed < new Date();
}

function whatsappPublicStatus(accountId = DEFAULT_ACCOUNT_ID) {
  const account = getWhatsappAccount(accountId) || store.whatsappAccounts[0] || defaultWhatsappAccount();
  const runtime = getRuntime(account.id);
  return {
    ...whatsappAccountPublic(account),
    qr: runtime.qr,
    lastError: runtime.lastError,
    settings: {
      receiveChats: account.receiveChats,
      randomInterval: account.randomInterval,
      minInterval: account.minInterval,
      maxInterval: account.maxInterval
    }
  };
}

function whatsappAccountsPublic() {
  return store.whatsappAccounts.map(whatsappAccountPublic);
}

function whatsappAccountPublic(account) {
  const runtime = getRuntime(account.id);
  const action = store.actions.find((item) => item.accountId === account.id && item.enabled !== false);
  const aiKey = action?.aiKeyId ? store.aiKeys.find((item) => item.id === action.aiKeyId) : null;
  return {
    id: account.id,
    name: account.name,
    phone: account.phone,
    lastLinkedAt: account.lastLinkedAt,
    status: runtime.status,
    connected: runtime.status === "connected",
    aiKeyId: action?.aiKeyId || "",
    aiKeyName: aiKey?.name || "",
    settings: {
      receiveChats: account.receiveChats,
      randomInterval: account.randomInterval,
      minInterval: account.minInterval,
      maxInterval: account.maxInterval
    }
  };
}

function getRuntime(accountId = DEFAULT_ACCOUNT_ID) {
  const id = safeAccountId(accountId);
  if (!waRuntimes.has(id)) {
    waRuntimes.set(id, {
      accountId: id,
      client: null,
      qr: "",
      status: "offline",
      lastError: "",
      starting: false
    });
  }
  return waRuntimes.get(id);
}

async function startWhatsApp(accountId = DEFAULT_ACCOUNT_ID) {
  const account = getWhatsappAccount(accountId);
  if (!account) throw new Error("WhatsApp account not found");
  const runtime = getRuntime(account.id);
  if (runtime.starting || ["starting", "qr", "connected"].includes(runtime.status)) return;
  runtime.starting = true;
  runtime.lastError = "";

  try {
    const { Client, LocalAuth } = require("whatsapp-web.js");
    const qrcode = require("qrcode");
    const chromePath = process.env.CHROME_PATH || defaultChromePath();

    runtime.client = new Client({
      authStrategy: new LocalAuth({ clientId: account.id, dataPath: path.join(DATA_DIR, "wa-session") }),
      puppeteer: {
        headless: true,
        executablePath: chromePath || undefined,
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
      }
    });

    runtime.client.on("qr", async (qr) => {
      runtime.status = "qr";
      runtime.qr = await qrcode.toDataURL(qr);
    });

    runtime.client.on("ready", () => {
      runtime.status = "connected";
      runtime.qr = "";
      account.phone = runtime.client?.info?.wid?.user || account.phone;
      account.lastLinkedAt = new Date().toISOString();
      saveStore();
    });

    runtime.client.on("auth_failure", (message) => {
      runtime.status = "offline";
      runtime.qr = "";
      runtime.lastError = message || "WhatsApp authentication failed";
    });

    runtime.client.on("disconnected", () => {
      runtime.status = "offline";
      runtime.qr = "";
      if (account.phone) setTimeout(() => startWhatsApp(account.id).catch(console.error), 5000);
    });

    runtime.client.on("message", (message) => handleIncomingWhatsAppMessage(account.id, message));
    runtime.client.on("message_create", (message) => handleAnyCreatedWhatsAppMessage(account.id, message));

    runtime.status = "starting";
    runtime.client.initialize().catch((error) => {
      runtime.status = "driver-missing";
      runtime.qr = "";
      runtime.lastError = error.message || "WhatsApp failed to start";
      console.error(error);
    });
  } catch (error) {
    runtime.status = "driver-missing";
    runtime.lastError = "WhatsApp package or Chrome is not ready. Run npm install, set CHROME_PATH if needed, then restart.";
    console.error(error);
  } finally {
    runtime.starting = false;
  }
}

async function logoutWhatsApp(accountId = DEFAULT_ACCOUNT_ID) {
  const account = getWhatsappAccount(accountId);
  if (!account) throw new Error("WhatsApp account not found");
  const runtime = getRuntime(account.id);
  try {
    if (runtime.client?.logout) await runtime.client.logout();
    if (runtime.client?.destroy) await runtime.client.destroy();
  } catch {}
  runtime.client = null;
  runtime.qr = "";
  runtime.status = "offline";
  account.phone = "";
  account.lastLinkedAt = "";
  saveStore();
}

function autoStartLinkedWhatsAppAccounts() {
  for (const account of store.whatsappAccounts) {
    if (!account.phone) continue;
    startWhatsApp(account.id).catch(console.error);
  }
}

async function handleIncomingWhatsAppMessage(accountId, message) {
  const account = getWhatsappAccount(accountId);
  if (!account?.receiveChats) return;
  if (message.fromMe || message.from === "status@broadcast") return;
  if (wasIncomingProcessed(accountId, message)) return;

  const jid = message.from;
  if (!jid) return;

  const autoReplyContext = findAutoReplyContext(accountId, jid);
  const contactInfo = await resolveMessageContactInfo(accountId, message, jid);
  const mediaResult = await captureMessageMedia(message, "in");
  const incoming = await resolveIncomingText(message, autoReplyContext?.aiKey, mediaResult?.media);
  const text = incoming.text || attachmentLabel(mediaResult?.attachment);
  if (!text && !mediaResult?.attachment) return;

  addMessage({ accountId, jid, direction: "in", text, source: incoming.source, attachment: mediaResult?.attachment, contactInfo });
  if (incoming.source === "system") return;
  const autoReplyText = incoming.text || mediaAiPrompt(mediaResult?.attachment);
  if (!autoReplyText) return;

  maybeAutoReply(accountId, jid, autoReplyText, mediaResult).catch((error) => {
    console.error(error);
    addMessage({ accountId, jid, direction: "system", text: `Auto reply failed: ${error.message}`, source: "system", contactInfo });
  });
}

async function handleAnyCreatedWhatsAppMessage(accountId, message) {
  if (message.fromMe) {
    await handleCreatedWhatsAppMessage(accountId, message);
    return;
  }

  await handleIncomingWhatsAppMessage(accountId, message);
}

async function handleCreatedWhatsAppMessage(accountId, message) {
  if (!message.fromMe || message.from === "status@broadcast") return;
  const jid = message.to || message.from;
  if (!jid) return;
  const mediaResult = await captureMessageMedia(message, "out");
  const text = extractText(message) || attachmentLabel(mediaResult?.attachment);
  if (!text && !mediaResult?.attachment) return;
  const contactInfo = await resolveJidContactInfo(accountId, jid);
  addMessageIfNotRecent({ accountId, jid, direction: "out", text, source: "whatsapp", attachment: mediaResult?.attachment, contactInfo });
}

function wasIncomingProcessed(accountId, message) {
  const key = messageKey(message);
  if (!key) return false;
  const accountKey = `${accountId}:${key}`;
  if (processedIncomingMessages.has(accountKey)) return true;
  processedIncomingMessages.add(accountKey);
  if (processedIncomingMessages.size > 2000) {
    const [first] = processedIncomingMessages;
    processedIncomingMessages.delete(first);
  }
  return false;
}

function messageKey(message) {
  return message?.id?._serialized || message?.id?.id || "";
}

function extractText(message) {
  if (!message) return "";
  if (typeof message.body === "string") return message.body.trim();
  return "";
}

async function resolveIncomingText(message, aiKey, downloadedMedia) {
  const text = extractText(message);
  if (text) return { text, source: "whatsapp" };

  const shouldTryMedia = Boolean(downloadedMedia?.data) || Boolean(message.hasMedia) || isLikelyAudioMessage(message);
  if (!shouldTryMedia) return { text: "", source: "whatsapp" };

  let media = downloadedMedia;
  if (!media) {
    try {
      media = await message.downloadMedia();
    } catch (error) {
      return {
        text: `Voice/media received, but download failed: ${error.message}`,
        source: "system"
      };
    }
  }

  if (!media?.data) {
    return {
      text: "Voice/media received, but the file was not available for download yet.",
      source: "system"
    };
  }

  if (!isAudioMessage(message, media)) return { text: "", source: "whatsapp" };

  if (!aiKey) {
    return {
      text: "Voice note received, but no active API action is attached.",
      source: "system"
    };
  }

  if (aiKey.transcription === false) {
    return {
      text: "Voice note received, but transcription is disabled for this API key.",
      source: "system"
    };
  }

  if (!supportsOpenAiTranscription(aiKey)) {
    return {
      text: "Customer sent a voice note. Use the attached audio if this provider supports audio, otherwise ask for the detail in text.",
      source: "voice"
    };
  }

  const transcript = await transcribeWhatsAppAudio(aiKey, media);
  if (!transcript) return { text: "", source: "voice" };
  return {
    text: `[Voice note transcript]\n${transcript}`,
    source: "voice"
  };
}

function isAudioMessage(message, media) {
  return isLikelyAudioMessage(message) || cleanMimeType(media?.mimetype || "").startsWith("audio/");
}

function isLikelyAudioMessage(message) {
  const type = String(message.type || "").toLowerCase();
  const rawType = String(message.rawData?.type || message._data?.type || "").toLowerCase();
  return ["audio", "ptt", "voice"].includes(type) || ["audio", "ptt", "voice"].includes(rawType);
}

function supportsOpenAiTranscription(aiKey) {
  const provider = String(aiKey?.provider || "OPENAI").toUpperCase();
  const style = String(aiKey?.apiStyle || "").toUpperCase();
  return provider === "OPENAI" || provider === "WHISPER_API" || style === "OPENAI_RESPONSES";
}

async function captureMessageMedia(message, direction) {
  const shouldTryMedia = Boolean(message?.hasMedia) || isLikelyAudioMessage(message);
  if (!shouldTryMedia || typeof message.downloadMedia !== "function") return null;

  try {
    const media = await message.downloadMedia();
    if (!media?.data) return null;
    const attachment = saveMediaFile({
      base64: media.data,
      mimeType: cleanMimeType(media.mimetype || media.mimeType || ""),
      filename: media.filename || message._data?.filename || message.rawData?.filename || defaultMediaName(message, media)
    }, direction);
    return { media, attachment };
  } catch (error) {
    console.error(error);
    return null;
  }
}

async function refreshStoredChatContactInfo() {
  let changed = false;

  for (const chat of Object.values(store.chats)) {
    if (!chat?.jid) continue;
    if (!needsContactRefresh(chat)) continue;
    const runtime = getRuntime(chat.accountId || DEFAULT_ACCOUNT_ID);
    if (!runtime.client || runtime.status !== "connected") continue;

    const contactInfo = await resolveJidContactInfo(chat.accountId || DEFAULT_ACCOUNT_ID, chat.jid);
    if (contactInfo.phone && contactInfo.phone !== chat.phone) {
      chat.phone = contactInfo.phone;
      changed = true;
    }
    if (contactInfo.title && contactInfo.title !== chat.title) {
      chat.title = contactInfo.title;
      changed = true;
    }
  }

  if (changed) saveStore();
}

function needsContactRefresh(chat) {
  const fallback = contactNumber(chat.jid);
  return isLidJid(chat.jid) || !chat.phone || !chat.title || chat.phone === fallback || chat.title === fallback || chat.title === chat.jid;
}

async function resolveMessageContactInfo(accountId, message, jid) {
  const info = baseContactInfo(jid);

  try {
    if (typeof message.getChat === "function" && isGroupJid(jid)) {
      const chat = await message.getChat();
      mergeNamedContactInfo(info, chat?.name || chat?.formattedTitle || "");
    }
  } catch {}

  try {
    if (typeof message.getContact === "function" && !isGroupJid(jid)) {
      mergeContactInfo(info, await message.getContact());
    }
  } catch {}

  await enrichPhoneFromLid(accountId, info, [jid, message?.author, message?.id?.participant, info.serializedId]);
  return finalizeContactInfo(info);
}

async function resolveJidContactInfo(accountId, jid) {
  const info = baseContactInfo(jid);
  const runtime = getRuntime(accountId);

  try {
    if (runtime.client?.getContactById && jid) {
      mergeContactInfo(info, await runtime.client.getContactById(jid));
    }
  } catch {}

  await enrichPhoneFromLid(accountId, info, [jid, info.serializedId]);
  return finalizeContactInfo(info);
}

function baseContactInfo(jid) {
  const fallback = contactNumber(jid);
  return {
    jid,
    phone: cleanPhone(fallback) || fallback,
    title: displayPhone(cleanPhone(fallback)) || fallback,
    name: "",
    serializedId: jid
  };
}

function mergeContactInfo(info, contact) {
  if (!contact) return;
  const serialized = contact.id?._serialized || "";
  const server = contact.id?.server || "";
  const phone = cleanPhone(contact.number || (server !== "lid" ? contact.id?.user : ""));
  const name = [contact.name, contact.pushname, contact.shortName, contact.verifiedName]
    .map((value) => String(value || "").trim())
    .find(Boolean);

  if (serialized) info.serializedId = serialized;
  if (phone) info.phone = phone;
  mergeNamedContactInfo(info, name);
}

function mergeNamedContactInfo(info, name) {
  const cleanName = String(name || "").trim();
  if (cleanName) info.name = cleanName;
}

async function enrichPhoneFromLid(accountId, info, candidates) {
  const runtime = getRuntime(accountId);
  if (!runtime.client?.getContactLidAndPhone) return;
  const ids = uniqueValues(candidates).filter(Boolean);

  for (const id of ids) {
    try {
      const [match] = await runtime.client.getContactLidAndPhone([id]);
      const phone = cleanPhone(contactNumber(match?.pn || ""));
      if (phone) {
        info.phone = phone;
        return;
      }
    } catch {}
  }
}

function finalizeContactInfo(info) {
  const fallback = contactNumber(info.jid);
  const rawPhone = cleanPhone(info.phone) || cleanPhone(fallback) || fallback;
  const phone = isLidJid(info.jid) && rawPhone === cleanPhone(fallback) ? "" : rawPhone;
  const phoneTitle = displayPhone(phone);
  const name = String(info.name || "").trim();
  const title = name && phoneTitle ? `${name} (${phoneTitle})` : name || phoneTitle || fallback;
  return { phone, title };
}

function cleanPhone(value) {
  return String(value || "").replace(/\D/g, "");
}

function displayPhone(phone) {
  const clean = cleanPhone(phone);
  return clean ? `+${clean}` : "";
}

function uniqueValues(values) {
  return Array.from(new Set(values.map((value) => String(value || "").trim()).filter(Boolean)));
}

function isGroupJid(jid) {
  return String(jid || "").endsWith("@g.us");
}

function isLidJid(jid) {
  return String(jid || "").includes("@lid");
}

function addMessage({ accountId = DEFAULT_ACCOUNT_ID, jid, direction, text, source, attachment, contactInfo }) {
  const now = new Date().toISOString();
  const key = chatKey(accountId, jid);
  const existingChat = store.chats[key] || {};
  const phone = bestContactPhone(jid, contactInfo?.phone, existingChat.phone);
  const title = bestContactTitle(jid, contactInfo?.title, existingChat.title, phone);
  const message = {
    id: randomId(),
    accountId,
    chatKey: key,
    jid,
    phone,
    direction,
    text,
    source,
    attachment: attachment || null,
    createdAt: now
  };
  store.messages.push(message);
  if (store.messages.length > 5000) store.messages = store.messages.slice(-5000);

  store.chats[key] = {
    chatKey: key,
    accountId,
    jid,
    phone,
    title,
    lastMessage: text,
    unread: direction === "in" ? (store.chats[key]?.unread || 0) + 1 : store.chats[key]?.unread || 0,
    updatedAt: now
  };
  saveStore();
  return message;
}

function addMessageIfNotRecent(message) {
  const exists = store.messages.some((item) => {
    if ((item.accountId || DEFAULT_ACCOUNT_ID) !== (message.accountId || DEFAULT_ACCOUNT_ID)) return false;
    if (item.jid !== message.jid || item.direction !== message.direction) return false;
    if (item.text !== message.text) return false;
    if (attachmentTypeKey(item.attachment) !== attachmentTypeKey(message.attachment)) return false;
    return Date.now() - new Date(item.createdAt).getTime() < 5000;
  });
  if (exists) return null;
  return addMessage(message);
}

function attachmentTypeKey(attachment) {
  if (!attachment) return "";
  return `${attachment.type || ""}:${attachment.filename || ""}`;
}

function bestContactPhone(jid, newPhone, oldPhone) {
  const fallback = contactNumber(jid);
  const cleanNew = cleanPhone(newPhone);
  const cleanOld = cleanPhone(oldPhone);
  if (cleanNew) return cleanNew;
  if (cleanOld && (!isLidJid(jid) || cleanOld !== cleanPhone(fallback))) return cleanOld;
  return cleanOld || cleanPhone(fallback) || fallback;
}

function bestContactTitle(jid, newTitle, oldTitle, phone) {
  const fallback = contactNumber(jid);
  const fallbackDisplay = displayPhone(fallback);
  const cleanNew = String(newTitle || "").trim();
  const cleanOld = String(oldTitle || "").trim();
  const newIsOnlyFallback = cleanNew === fallback || cleanNew === fallbackDisplay || cleanNew === jid;
  const oldIsBetter = cleanOld && cleanOld !== fallback && cleanOld !== fallbackDisplay && cleanOld !== jid;

  if (cleanNew && (!isLidJid(jid) || !newIsOnlyFallback || !oldIsBetter)) return cleanNew;
  if (oldIsBetter) return cleanOld;
  return displayPhone(phone) || cleanOld || fallback;
}

async function maybeAutoReply(accountId, jid, latestText, latestMedia = null) {
  const context = findAutoReplyContext(accountId, jid);
  if (!context) return;

  const { aiKey } = context;
  const delay = getReplyDelayMs(accountId);
  await wait(delay);

  const reply = await generateAiReply(aiKey, accountId, jid, latestText, latestMedia);
  if (!reply) return;
  await sendWhatsAppText(accountId, jid, reply);
  const contactInfo = await resolveJidContactInfo(accountId, jid);
  addMessage({ accountId, jid, direction: "out", text: reply, source: "ai", contactInfo });
}

function findAutoReplyContext(accountId, jid) {
  const action = store.actions.find((item) => {
    if (item.enabled === false) return false;
    if (item.accountId !== accountId) return false;
    if (item.source !== "WHATSAPP") return false;
    if (item.matchType !== "ARTIFICIAL INTELLIGENCE") return false;
    if (jid.endsWith("@g.us") && !item.groupTrigger) return false;
    return Boolean(item.aiKeyId);
  });
  if (!action) return null;

  const aiKey = store.aiKeys.find((item) => item.id === action.aiKeyId);
  if (!aiKey) return null;

  return { action, aiKey };
}

function getReplyDelayMs(accountId = DEFAULT_ACCOUNT_ID) {
  const account = getWhatsappAccount(accountId) || defaultWhatsappAccount();
  const min = Number(account.minInterval || 0);
  const max = Number(account.maxInterval || min);
  const seconds = account.randomInterval ? min + Math.random() * Math.max(0, max - min) : min;
  return Math.round(seconds * 1000);
}

async function sendWhatsAppText(accountId, jid, text) {
  const runtime = getRuntime(accountId);
  if (!runtime.client || runtime.status !== "connected") {
    throw new Error("WhatsApp is not connected");
  }
  await runtime.client.sendMessage(jid, text);
}

async function sendWhatsAppMedia(accountId, jid, media, options = {}) {
  const runtime = getRuntime(accountId);
  if (!runtime.client || runtime.status !== "connected") {
    throw new Error("WhatsApp is not connected");
  }
  const { MessageMedia } = require("whatsapp-web.js");
  const messageMedia = new MessageMedia(media.mimeType, media.base64, media.filename);
  await runtime.client.sendMessage(jid, messageMedia, {
    caption: options.caption || undefined,
    sendAudioAsVoice: Boolean(options.asVoice && media.mimeType.startsWith("audio/"))
  });
}

function parseMediaUpload(body) {
  const match = String(body.dataUrl || "").match(/^data:([^;,]+)?(?:;[^,]*)?;base64,(.+)$/);
  if (!match) throw new Error("Invalid media file");
  const mimeType = cleanMimeType(body.mimeType || match[1] || "application/octet-stream");
  const base64 = String(match[2] || "").replace(/\s/g, "");
  const buffer = Buffer.from(base64, "base64");
  if (!buffer.length) throw new Error("Media file is empty");
  if (buffer.length > 25 * 1024 * 1024) throw new Error("Media file is larger than 25 MB");
  const filename = safeFilename(body.filename || `upload.${extensionForMime(mimeType)}`);
  return { base64, buffer, mimeType, filename, size: buffer.length };
}

function saveMediaFile(media, direction) {
  const mimeType = cleanMimeType(media.mimeType || "application/octet-stream");
  const ext = path.extname(media.filename || "") || `.${extensionForMime(mimeType)}`;
  const fileName = `${Date.now()}-${direction}-${randomId().slice(0, 10)}${ext.toLowerCase()}`;
  const filePath = path.join(MEDIA_DIR, fileName);
  const buffer = media.buffer || Buffer.from(media.base64 || "", "base64");
  fs.writeFileSync(filePath, buffer);
  return {
    url: `/media/${fileName}`,
    filename: safeFilename(media.filename || fileName),
    mimeType,
    type: mediaKind(mimeType),
    size: buffer.length
  };
}

function mediaKind(mimeType) {
  const clean = cleanMimeType(mimeType);
  if (clean.startsWith("image/")) return "image";
  if (clean.startsWith("video/")) return "video";
  if (clean.startsWith("audio/")) return "audio";
  return "document";
}

function attachmentLabel(attachment) {
  if (!attachment) return "";
  const labels = {
    image: "[Photo received]",
    video: "[Video received]",
    audio: "[Voice note received]",
    document: "[Document received]"
  };
  return labels[attachment.type] || "[File received]";
}

function mediaAiPrompt(attachment) {
  if (!attachment) return "";
  if (attachment.type === "image") return "Customer sent a photo. Inspect the attached image and reply helpfully.";
  if (attachment.type === "video") return `Customer sent a video file named ${attachment.filename}. Reply helpfully and ask for any missing details if needed.`;
  if (attachment.type === "audio") return "Customer sent a voice note.";
  return `Customer sent a document/file named ${attachment.filename}. Reply helpfully and ask for any missing details if needed.`;
}

function defaultMediaName(message, media) {
  const kind = mediaKind(media?.mimetype || "");
  const messageType = String(message?.type || message?.rawData?.type || message?._data?.type || "").toLowerCase();
  if (kind !== "document") return `${kind}.${extensionForMime(media?.mimetype || "")}`;
  if (["audio", "ptt", "voice"].includes(messageType)) return "voice-note.ogg";
  if (["image", "sticker"].includes(messageType)) return "photo.jpg";
  if (messageType === "video") return "video.mp4";
  return `file.${extensionForMime(media?.mimetype || "")}`;
}

function extensionForMime(mimeType) {
  const map = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
    "video/mp4": "mp4",
    "video/webm": "webm",
    "video/quicktime": "mov",
    "audio/ogg": "ogg",
    "audio/opus": "ogg",
    "audio/webm": "webm",
    "audio/mpeg": "mp3",
    "audio/mp4": "m4a",
    "audio/m4a": "m4a",
    "audio/wav": "wav",
    "application/pdf": "pdf",
    "application/msword": "doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/vnd.ms-excel": "xls",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
    "text/plain": "txt"
  };
  return map[cleanMimeType(mimeType)] || "bin";
}

function safeFilename(filename) {
  const clean = String(filename || "file")
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  return clean.slice(0, 140) || "file";
}

function buildAiUserContent(text, latestMedia, aiKey) {
  const attachment = latestMedia?.attachment;
  const media = latestMedia?.media;
  const canAttachImage = aiKey.vision !== false && attachment?.type === "image" && media?.data && cleanMimeType(media.mimetype || attachment.mimeType).startsWith("image/");
  if (!canAttachImage) return text;

  return [
    { type: "input_text", text },
    {
      type: "input_image",
      image_url: `data:${cleanMimeType(media.mimetype || attachment.mimeType)};base64,${media.data}`,
      detail: "auto"
    }
  ];
}

async function generateAiReply(aiKey, accountId, jid, latestText, latestMedia = null) {
  const apiKey = decryptSecret(aiKey.apiKey || "");
  if (!apiKey) throw new Error("AI API key is missing");

  const history = store.messages
    .filter((message) => (message.accountId || DEFAULT_ACCOUNT_ID) === accountId && message.jid === jid && ["in", "out"].includes(message.direction))
    .slice(-30)
    .map((message) => `${message.direction === "in" ? "Customer" : "Shop"}: ${message.text}${message.attachment ? ` (${message.attachment.type}: ${message.attachment.filename})` : ""}`)
    .join("\n")
    .slice(-Number(aiKey.historyThreshold || 5000));

  const instructions = [aiKey.initialPrompt, aiKey.postPrompt].filter(Boolean).join("\n\n");
  const userText = `Chat history:\n${history}\n\nLatest customer message:\n${latestText}`;
  const provider = String(aiKey.provider || "OPENAI").toUpperCase();
  const style = String(aiKey.apiStyle || "").toUpperCase();

  if (provider === "GEMINI") {
    return generateGeminiReply(apiKey, aiKey, instructions, userText, latestMedia);
  }

  if (provider === "ANTHROPIC_CLAUDE") {
    return generateAnthropicReply(apiKey, aiKey, instructions, userText, latestMedia);
  }

  if (style === "OPENAI_COMPATIBLE" || aiKey.apiBaseUrl) {
    return generateOpenAiCompatibleReply(apiKey, aiKey, instructions, userText, latestMedia);
  }

  const input = [
    {
      role: "developer",
      content: instructions || "Reply to customers clearly and helpfully on WhatsApp."
    },
    {
      role: "user",
      content: buildAiUserContent(userText, latestMedia, aiKey)
    }
  ];

  const response = await fetch(process.env.OPENAI_RESPONSES_URL || "https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: aiKey.model || process.env.DEFAULT_OPENAI_MODEL || "gpt-5.5",
      input,
      max_output_tokens: Number(aiKey.maxTokens || 512)
    })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error?.message || "OpenAI request failed");
  }

  return extractOpenAiText(payload).trim();
}

async function generateGeminiReply(apiKey, aiKey, instructions, userText, latestMedia) {
  const model = aiKey.model || "gemini-3.5-flash";
  const baseUrl = aiKey.apiBaseUrl || `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const parts = [{ text: userText }];
  const mediaPart = geminiMediaPart(latestMedia);
  if (mediaPart) parts.push(mediaPart);

  const response = await fetch(baseUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey
    },
    body: JSON.stringify({
      system_instruction: instructions ? { parts: [{ text: instructions }] } : undefined,
      contents: [{ parts }],
      generationConfig: { maxOutputTokens: Number(aiKey.maxTokens || 512) }
    })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error?.message || "Gemini request failed");
  return String(payload.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("\n") || "").trim();
}

async function generateAnthropicReply(apiKey, aiKey, instructions, userText, latestMedia) {
  const content = [{ type: "text", text: userText }];
  const image = anthropicImagePart(latestMedia);
  if (image) content.push(image);

  const response = await fetch(aiKey.apiBaseUrl || "https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: aiKey.model || "claude-sonnet-4-5",
      max_tokens: Number(aiKey.maxTokens || 512),
      system: instructions || undefined,
      messages: [{ role: "user", content }]
    })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error?.message || "Claude request failed");
  return String((payload.content || []).map((part) => part.text || "").join("\n")).trim();
}

async function generateOpenAiCompatibleReply(apiKey, aiKey, instructions, userText, latestMedia) {
  const base = String(aiKey.apiBaseUrl || providerDefaultBaseUrl(aiKey.provider) || "https://api.openai.com/v1").replace(/\/$/, "");
  const url = base.endsWith("/chat/completions") ? base : `${base}/chat/completions`;
  const userContent = openAiCompatibleUserContent(userText, latestMedia, aiKey);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: aiKey.model || "gpt-5.5",
      messages: [
        { role: "system", content: instructions || "Reply to customers clearly and helpfully on WhatsApp." },
        { role: "user", content: userContent }
      ],
      max_tokens: Number(aiKey.maxTokens || 512)
    })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error?.message || "OpenAI-compatible request failed");
  return String(payload.choices?.[0]?.message?.content || "").trim();
}

function providerDefaultBaseUrl(provider) {
  const map = {
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
  return map[String(provider || "").toUpperCase()] || "";
}

function geminiMediaPart(latestMedia) {
  const media = latestMedia?.media;
  const attachment = latestMedia?.attachment;
  if (!media?.data || !attachment) return null;
  const mimeType = cleanMimeType(media.mimetype || attachment.mimeType);
  if (!mimeType.startsWith("image/") && !mimeType.startsWith("audio/") && !mimeType.startsWith("video/")) return null;
  return { inline_data: { mime_type: mimeType, data: media.data } };
}

function anthropicImagePart(latestMedia) {
  const media = latestMedia?.media;
  const attachment = latestMedia?.attachment;
  if (!media?.data || attachment?.type !== "image") return null;
  const mimeType = cleanMimeType(media.mimetype || attachment.mimeType);
  return {
    type: "image",
    source: { type: "base64", media_type: mimeType, data: media.data }
  };
}

function openAiCompatibleUserContent(userText, latestMedia, aiKey) {
  const attachment = latestMedia?.attachment;
  const media = latestMedia?.media;
  const canAttachImage = aiKey.vision !== false && attachment?.type === "image" && media?.data;
  if (!canAttachImage) return userText;
  const mimeType = cleanMimeType(media.mimetype || attachment.mimeType);
  return [
    { type: "text", text: userText },
    { type: "image_url", image_url: { url: `data:${mimeType};base64,${media.data}` } }
  ];
}

async function transcribeWhatsAppAudio(aiKey, media) {
  const apiKey = decryptSecret(aiKey.apiKey || "");
  if (!apiKey) throw new Error("OpenAI API key is missing");

  const buffer = Buffer.from(media.data || "", "base64");
  if (!buffer.length) throw new Error("Voice note is empty");
  if (buffer.length > 25 * 1024 * 1024) throw new Error("Voice note is larger than 25 MB");

  const mimetype = cleanMimeType(media.mimetype || "audio/ogg");
  const fileName = media.filename || `voice-note.${audioExtension(mimetype)}`;
  const form = new FormData();
  form.append("file", new Blob([buffer], { type: mimetype }), fileName);
  form.append("model", process.env.OPENAI_TRANSCRIPTION_MODEL || "gpt-4o-mini-transcribe");
  form.append("response_format", "json");

  if (process.env.OPENAI_TRANSCRIPTION_LANGUAGE) {
    form.append("language", process.env.OPENAI_TRANSCRIPTION_LANGUAGE);
  }

  if (process.env.OPENAI_TRANSCRIPTION_PROMPT) {
    form.append("prompt", process.env.OPENAI_TRANSCRIPTION_PROMPT);
  }

  const response = await fetch(process.env.OPENAI_TRANSCRIPTIONS_URL || "https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`
    },
    body: form
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error?.message || "OpenAI transcription failed");
  }

  return String(payload.text || "").trim();
}

function cleanMimeType(mimetype, fallback = "application/octet-stream") {
  return String(mimetype || fallback).split(";")[0].trim().toLowerCase();
}

function audioExtension(mimetype) {
  const map = {
    "audio/ogg": "ogg",
    "audio/opus": "ogg",
    "audio/webm": "webm",
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/mp4": "mp4",
    "audio/m4a": "m4a",
    "audio/wav": "wav",
    "audio/x-wav": "wav"
  };
  return map[cleanMimeType(mimetype)] || "ogg";
}

function extractOpenAiText(payload) {
  if (payload.output_text) return payload.output_text;
  const parts = [];
  for (const output of payload.output || []) {
    for (const content of output.content || []) {
      if (content.text) parts.push(content.text);
      if (content.type === "output_text" && content.text) parts.push(content.text);
    }
  }
  return parts.join("\n");
}

function normalizeAiKey(body, existing = {}) {
  const apiKey = String(body.apiKey || "").trim();
  return {
    name: String(body.name || existing.name || "AI Key").trim(),
    provider: String(body.provider || existing.provider || "OPENAI").trim().toUpperCase(),
    apiStyle: String(body.apiStyle || existing.apiStyle || "OPENAI_RESPONSES").trim().toUpperCase(),
    apiBaseUrl: String(body.apiBaseUrl || existing.apiBaseUrl || "").trim(),
    model: String(body.model || existing.model || process.env.DEFAULT_OPENAI_MODEL || "gpt-5.5").trim(),
    initialPrompt: String(body.initialPrompt || existing.initialPrompt || "").trim(),
    postPrompt: String(body.postPrompt || existing.postPrompt || "").trim(),
    vision: normalizeToggle(body.vision, existing.vision, true),
    transcription: normalizeToggle(body.transcription, existing.transcription, true),
    maxTokens: clampNumber(body.maxTokens ?? existing.maxTokens, 16, 8192, 512),
    historyThreshold: clampNumber(body.historyThreshold ?? existing.historyThreshold, 200, 100000, 5000),
    apiKey: apiKey ? encryptSecret(apiKey) : existing.apiKey || ""
  };
}

function publicAiKey(key) {
  return {
    ...key,
    apiKey: maskSecret(decryptSecret(key.apiKey || ""))
  };
}

function selectedAccountId(url) {
  return safeAccountId(url?.searchParams?.get("accountId") || DEFAULT_ACCOUNT_ID);
}

function getWhatsappAccount(accountId = DEFAULT_ACCOUNT_ID) {
  const id = safeAccountId(accountId);
  return store.whatsappAccounts.find((account) => account.id === id) || null;
}

function safeAccountId(value) {
  const clean = String(value || DEFAULT_ACCOUNT_ID).replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 48);
  return clean || DEFAULT_ACCOUNT_ID;
}

function chatKey(accountId, jid) {
  return `${safeAccountId(accountId)}::${String(jid || "")}`;
}

function publicAction(action) {
  const account = getWhatsappAccount(action.accountId);
  const aiKey = store.aiKeys.find((item) => item.id === action.aiKeyId);
  return {
    ...action,
    accountName: account?.name || action.accountId,
    aiKeyName: aiKey?.name || ""
  };
}

function saveUniqueAction(action) {
  const existing = store.actions.find((item) => item.accountId === action.accountId);
  if (existing) {
    Object.assign(existing, action, { id: existing.id, createdAt: existing.createdAt, updatedAt: new Date().toISOString() });
    store.actions = uniqueActionsByAccount(store.actions);
    return existing;
  }

  action.id = randomId();
  action.createdAt = new Date().toISOString();
  action.updatedAt = action.createdAt;
  store.actions.push(action);
  store.actions = uniqueActionsByAccount(store.actions);
  return action;
}

function uniqueActionsByAccount(actions) {
  const seen = new Set();
  const unique = [];
  for (const action of actions.slice().reverse()) {
    const accountId = safeAccountId(action.accountId || DEFAULT_ACCOUNT_ID);
    if (seen.has(accountId)) continue;
    seen.add(accountId);
    unique.push({ ...action, accountId });
  }
  return unique.reverse();
}

function normalizeAction(body) {
  return {
    name: String(body.name || "Auto Reply").trim(),
    source: "WHATSAPP",
    matchType: "ARTIFICIAL INTELLIGENCE",
    accountId: safeAccountId(body.accountId || DEFAULT_ACCOUNT_ID),
    aiKeyId: String(body.aiKeyId || "").trim(),
    priority: normalizeToggle(body.priority, true, true),
    groupTrigger: normalizeToggle(body.groupTrigger, false, false),
    enabled: normalizeToggle(body.enabled, true, true)
  };
}

function normalizeToggle(value, existing, fallback) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return ["enable", "enabled", "yes", "true", "1"].includes(value.toLowerCase());
  if (typeof existing === "boolean") return existing;
  return fallback;
}

function encryptSecret(value) {
  if (!value) return "";
  const key = crypto.createHash("sha256").update(process.env.DATA_SECRET || "dev-data-secret").digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
}

function decryptSecret(value) {
  if (!value) return "";
  if (!value.startsWith("enc:")) return value;
  try {
    const [, ivRaw, tagRaw, encryptedRaw] = value.split(":");
    const key = crypto.createHash("sha256").update(process.env.DATA_SECRET || "dev-data-secret").digest();
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivRaw, "base64"));
    decipher.setAuthTag(Buffer.from(tagRaw, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(encryptedRaw, "base64")), decipher.final()]).toString("utf8");
  } catch {
    return "";
  }
}

function maskSecret(value) {
  if (!value) return "";
  if (value.length <= 8) return "********";
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function contactNumber(jid) {
  return String(jid || "").split("@")[0].split(":")[0];
}

function defaultChromePath() {
  const candidates = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium"
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) || "";
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomId() {
  return crypto.randomBytes(16).toString("hex");
}
