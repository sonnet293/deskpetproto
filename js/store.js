// 펫 화면과 대쉬보드가 공유하는 저장소 (localStorage + IndexedDB)
// Electron 이식 시 이 파일만 IPC/파일 저장으로 교체하면 된다.

const DEFAULTS = {
    messages: [
        "녹턴, 골든 레코드에 뭐가 들어있지?",
        "캐논이 삐걱거리는 건 정상이지. 나보다 나이가 많잖아.",
        "캐논, 너까지 잃으면 진짜 곤란해.",
        "소나타, 그것은 식품이 아닙니다.",
    ],
    timerMessages: ["타이머 끝났어!"],
    settings: {
        locked: false,
        autoStart: false,
        opacity: 100,
        activeFont: "Diary",
        pos: null,
        todoInterval: 30, // 분, 0 = 끄기
        bellName: null,   // null = 기본 bell.mp3
        clipShortcut: "Alt+C", // Electron accelerator 형식과 동일
    },
    fonts: [
        { name: "Diary", url: "https://gcore.jsdelivr.net/gh/projectnoonnu/noonfonts_220508@1.0/EarlyFontDiary.woff2" },
    ],
    clipboard: [],
    memos: [],
    todos: [],
    timer: { duration: 5 * 60 * 1000, remaining: 5 * 60 * 1000, endAt: null, running: false, finishedAt: null },
    stopwatch: { startAt: null, elapsed: 0, running: false },
};

const PREFIX = "deskpet:";
const listeners = {};

const Store = {
    get(key) {
        try {
            const raw = localStorage.getItem(PREFIX + key);
            if (raw !== null) {
                const value = JSON.parse(raw);
                // 객체 설정은 기본값과 합쳐서, 나중에 추가된 항목도 기본값을 갖게 한다
                const def = DEFAULTS[key];
                if (def && typeof def === "object" && !Array.isArray(def)) return { ...structuredClone(def), ...value };
                return value;
            }
        } catch (e) { /* 손상된 값은 기본값으로 */ }
        return structuredClone(DEFAULTS[key]);
    },

    set(key, value) {
        localStorage.setItem(PREFIX + key, JSON.stringify(value));
        emit(key, value);
    },

    update(key, fn) {
        const value = this.get(key);
        const next = fn(value);
        this.set(key, next === undefined ? value : next);
    },

    // 같은 탭의 set과 다른 탭(storage 이벤트)의 변경 모두 알려준다
    on(key, cb) {
        (listeners[key] ||= []).push(cb);
    },
};

function emit(key, value) {
    (listeners[key] || []).forEach(cb => cb(value));
}

window.addEventListener("storage", (e) => {
    if (!e.key || !e.key.startsWith(PREFIX)) return;
    const key = e.key.slice(PREFIX.length);
    emit(key, Store.get(key));
});

// ===== 업로드한 음원 등 큰 파일은 IndexedDB =====
const FileDB = {
    _db: null,

    open() {
        if (this._db) return Promise.resolve(this._db);
        return new Promise((resolve, reject) => {
            const req = indexedDB.open("deskpet", 1);
            req.onupgradeneeded = () => req.result.createObjectStore("files");
            req.onsuccess = () => resolve(this._db = req.result);
            req.onerror = () => reject(req.error);
        });
    },

    async put(key, blob) {
        const db = await this.open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction("files", "readwrite");
            tx.objectStore("files").put(blob, key);
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
        });
    },

    async get(key) {
        const db = await this.open();
        return new Promise((resolve, reject) => {
            const req = db.transaction("files").objectStore("files").get(key);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => reject(req.error);
        });
    },

    async remove(key) {
        const db = await this.open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction("files", "readwrite");
            tx.objectStore("files").delete(key);
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
        });
    },
};

// ===== 공용 유틸 =====
function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function escapeHTML(str) {
    return String(str).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDate(ts) {
    const d = new Date(ts);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// 클립보드 기록 추가 (중복은 맨 위로, 최대 10개)
function addClipboard(text) {
    if (!text || !text.trim()) return;
    Store.update("clipboard", list => {
        const next = list.filter(item => item.text !== text);
        next.unshift({ id: uid(), text, at: Date.now() });
        return next.slice(0, 10);
    });
}

// ===== 단축키 =====
// 키 입력을 "Ctrl+Shift+V" 같은 문자열로. 수정키만 눌렸으면 null
function shortcutFromEvent(e) {
    if (["Control", "Alt", "Shift", "Meta"].includes(e.key)) return null;

    let key = e.code;
    if (/^Key[A-Z]$/.test(key)) key = key.slice(3);
    else if (/^Digit\d$/.test(key)) key = key.slice(5);
    else if (key === "Space") key = "Space";
    else if (!/^F\d{1,2}$/.test(key)) key = e.key.length === 1 ? e.key.toUpperCase() : e.key;

    const parts = [];
    if (e.ctrlKey) parts.push("Ctrl");
    if (e.altKey) parts.push("Alt");
    if (e.shiftKey) parts.push("Shift");
    if (e.metaKey) parts.push("Meta");
    parts.push(key);
    return parts.join("+");
}

// ===== 글꼴 로딩 =====
// URL이 CSS(구글 폰트 등)면 <link>, 폰트 파일이면 @font-face로 등록
function loadFonts(fonts) {
    document.querySelectorAll("[data-deskpet-font]").forEach(el => el.remove());

    fonts.forEach(font => {
        const isCSS = /\.css(\?|$)/i.test(font.url) || /fonts\.googleapis\.com/i.test(font.url);
        let el;
        if (isCSS) {
            el = document.createElement("link");
            el.rel = "stylesheet";
            el.href = font.url;
        } else {
            el = document.createElement("style");
            el.textContent = `@font-face { font-family: "${font.name.replace(/"/g, "")}"; src: url("${font.url.replace(/"/g, "%22")}"); font-display: swap; }`;
        }
        el.dataset.deskpetFont = font.name;
        document.head.appendChild(el);
    });
}

function applyFont(name) {
    document.documentElement.style.setProperty("--pet-font", `"${name.replace(/"/g, "")}", sans-serif`);
}
