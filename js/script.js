const wrapper = document.getElementById("character");
const petImg = wrapper.querySelector("img");
const bubble = document.getElementById("bubble");
const mini = document.getElementById("mini");
const menu = document.getElementById("context-menu");
const panel = document.getElementById("panel");
const toastEl = document.getElementById("toast");

let hideTimer;
let lastIndex = -1;

// ===== 말풍선 =====
function say(text, duration = 5000) {
    bubble.textContent = text;

    wrapper.classList.remove("pop-character");
    bubble.classList.remove("pop-bubble");
    void wrapper.offsetWidth;

    wrapper.classList.add("pop-character");
    bubble.classList.add("show", "pop-bubble");

    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
        bubble.classList.remove("show");
    }, duration);
}

function sayRandom() {
    const messages = Store.get("messages");
    if (messages.length === 0) return;

    let randomIndex = 0;
    if (messages.length > 1) {
        do {
            randomIndex = Math.floor(Math.random() * messages.length);
        } while (randomIndex === lastIndex);
    }

    lastIndex = randomIndex;
    say(messages[randomIndex]);
}

let toastTimer;
function toast(text) {
    toastEl.textContent = text;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("show"), 1800);
}

// ===== 설정 적용 =====
function applySettings(settings) {
    petImg.style.opacity = settings.opacity / 100;
    wrapper.classList.toggle("locked", settings.locked);
    document.getElementById("menu-lock").textContent = settings.locked ? "🔓 위치 잠금 해제" : "🔒 위치 잠금";
    document.getElementById("clip-shortcut-hint").textContent = settings.clipShortcut || "";
    applyFont(settings.activeFont);
    settings.pos ? placeCharacter(settings.pos.x, settings.pos.y) : centerCharacter();
}

function placeCharacter(x, y) {
    const maxX = window.innerWidth - wrapper.offsetWidth;
    const maxY = window.innerHeight - wrapper.offsetHeight;
    wrapper.style.left = Math.max(0, Math.min(x, maxX)) + "px";
    wrapper.style.top = Math.max(0, Math.min(y, maxY)) + "px";
}

function centerCharacter() {
    placeCharacter((window.innerWidth - wrapper.offsetWidth) / 2, (window.innerHeight - wrapper.offsetHeight) / 2);
}

// ===== 클릭 & 드래그 =====
let drag = null;
let justDragged = false;

wrapper.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || Store.get("settings").locked) return;
    drag = { startX: e.clientX, startY: e.clientY, offX: e.clientX - wrapper.offsetLeft, offY: e.clientY - wrapper.offsetTop, moved: false };
    wrapper.setPointerCapture(e.pointerId);
});

wrapper.addEventListener("pointermove", (e) => {
    if (!drag) return;
    if (!drag.moved && Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) < 5) return;
    drag.moved = true;
    wrapper.classList.add("dragging");
    placeCharacter(e.clientX - drag.offX, e.clientY - drag.offY);
});

wrapper.addEventListener("pointerup", () => {
    if (!drag) return;
    if (drag.moved) {
        justDragged = true;
        Store.update("settings", s => { s.pos = { x: wrapper.offsetLeft, y: wrapper.offsetTop }; });
    }
    wrapper.classList.remove("dragging");
    drag = null;
});

wrapper.addEventListener("click", (e) => {
    if (justDragged) {
        justDragged = false;
        return;
    }
    if (e.target.closest(".mini-widget")) return;
    if (bellAudio) {
        stopBell();
        return;
    }
    sayRandom();
});

window.addEventListener("resize", () => {
    const pos = Store.get("settings").pos;
    pos ? placeCharacter(pos.x, pos.y) : centerCharacter();
});

// ===== 우클릭 메뉴 =====
document.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    if (!wrapper.contains(e.target)) return;

    menu.classList.add("open");
    const x = Math.min(e.clientX, window.innerWidth - menu.offsetWidth - 8);
    const y = Math.min(e.clientY, window.innerHeight - menu.offsetHeight - 8);
    menu.style.left = x + "px";
    menu.style.top = y + "px";
});

document.addEventListener("click", (e) => {
    if (!menu.contains(e.target)) menu.classList.remove("open");
});

menu.addEventListener("click", (e) => {
    const item = e.target.closest("[data-action]");
    if (!item) return;
    menu.classList.remove("open");

    const action = item.dataset.action;
    if (action === "dashboard") {
        window.open("dashboard.html", "deskpet-dashboard");
    } else if (action === "lock") {
        Store.update("settings", s => { s.locked = !s.locked; });
        toast(Store.get("settings").locked ? "위치를 잠갔어요" : "위치 잠금을 풀었어요");
    } else {
        openPanel(action);
    }
});

// ===== 패널 =====
const PANEL_TITLES = { clipboard: "클립보드", timer: "타이머 / 스톱워치", todo: "오늘의 할 일", memo: "메모장" };
let currentPanel = null;

function openPanel(name) {
    currentPanel = name;
    document.getElementById("panel-title").textContent = PANEL_TITLES[name];
    panel.querySelectorAll(".panel-body").forEach(el => el.classList.toggle("active", el.dataset.panel === name));
    panel.classList.add("open");

    if (name === "clipboard") renderClipboard();
    if (name === "todo") renderTodos();
    if (name === "memo") showMemoList();
    positionPanel();
}

function closePanel() {
    panel.classList.remove("open");
    currentPanel = null;
}

function togglePanel(name) {
    currentPanel === name ? closePanel() : openPanel(name);
}

// 캐릭터 옆(공간이 있는 쪽)에 패널 띄우기
function positionPanel() {
    const rect = wrapper.getBoundingClientRect();
    const w = panel.offsetWidth;
    const h = panel.offsetHeight;
    const gap = 70; // 미니 위젯 자리

    let x = rect.right + gap;
    if (x + w > window.innerWidth - 10) x = rect.left - w - 16;
    if (x < 10) x = Math.max(10, window.innerWidth - w - 10);

    const y = Math.max(10, Math.min(rect.top, window.innerHeight - h - 10));
    panel.style.left = x + "px";
    panel.style.top = y + "px";
}

document.getElementById("panel-close").addEventListener("click", closePanel);

document.addEventListener("keydown", (e) => {
    const shortcut = Store.get("settings").clipShortcut;
    if (shortcut && shortcutFromEvent(e) === shortcut) {
        e.preventDefault();
        togglePanel("clipboard");
    } else if (e.key === "Escape") {
        menu.classList.remove("open");
        closePanel();
    }
});

// ===== 클립보드 =====
const clipList = document.getElementById("clip-list");
const clipInput = document.getElementById("clip-input");

function renderClipboard() {
    const items = Store.get("clipboard");
    if (items.length === 0) {
        clipList.innerHTML = `<li class="empty">저장된 클립보드가 없어요</li>`;
        return;
    }
    clipList.innerHTML = items.map(item => `
        <li class="clickable" data-id="${item.id}" title="${escapeHTML(item.text)}">
            <span class="text">${escapeHTML(item.text)}</span>
            <button class="icon-btn" data-del="${item.id}" title="삭제">✕</button>
        </li>`).join("");
}

clipList.addEventListener("click", async (e) => {
    const del = e.target.closest("[data-del]");
    if (del) {
        Store.update("clipboard", list => list.filter(i => i.id !== del.dataset.del));
        return;
    }
    const li = e.target.closest("li[data-id]");
    if (!li) return;
    const item = Store.get("clipboard").find(i => i.id === li.dataset.id);
    if (!item) return;
    try {
        await navigator.clipboard.writeText(item.text);
        toast("클립보드에 복사했어요");
    } catch (err) {
        toast("복사에 실패했어요");
    }
});

document.getElementById("clip-add").addEventListener("click", () => {
    addClipboard(clipInput.value);
    clipInput.value = "";
});

clipInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.isComposing) document.getElementById("clip-add").click();
});

document.getElementById("clip-read").addEventListener("click", async () => {
    try {
        const text = await navigator.clipboard.readText();
        if (text) {
            addClipboard(text);
            toast("가져왔어요");
        } else {
            toast("클립보드가 비어 있어요");
        }
    } catch (err) {
        toast("클립보드 접근 권한이 필요해요");
    }
});

// 이 창 안에서 복사한 내용 자동 저장
document.addEventListener("copy", () => {
    const el = document.activeElement;
    let text = "";
    if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) {
        text = el.value.substring(el.selectionStart, el.selectionEnd);
    } else {
        text = document.getSelection().toString();
    }
    addClipboard(text);
});

// 창으로 돌아올 때 시스템 클립보드 확인 (권한이 있을 때만 동작)
window.addEventListener("focus", async () => {
    try {
        const text = await navigator.clipboard.readText();
        if (text) addClipboard(text);
    } catch (err) { /* 권한 없으면 무시 */ }
});

Store.on("clipboard", () => {
    if (currentPanel === "clipboard") renderClipboard();
});

// ===== 타이머 / 스톱워치 =====
const timerDisplay = document.getElementById("timer-display");
const timerToggle = document.getElementById("timer-toggle");
const swDisplay = document.getElementById("sw-display");
const swToggle = document.getElementById("sw-toggle");

panel.querySelectorAll(".tab").forEach(tab => {
    tab.addEventListener("click", () => {
        panel.querySelectorAll(".tab").forEach(t => t.classList.toggle("active", t === tab));
        panel.querySelectorAll(".tab-body").forEach(b => b.classList.toggle("hidden", b.id !== tab.dataset.tab));
    });
});

document.getElementById("timer-set").addEventListener("click", () => {
    const h = +document.getElementById("timer-h").value || 0;
    const m = +document.getElementById("timer-m").value || 0;
    const s = +document.getElementById("timer-s").value || 0;
    const ms = ((h * 60 + m) * 60 + s) * 1000;
    if (ms <= 0) return toast("시간을 입력해 주세요");
    Timer.setDuration(ms);
});

panel.querySelectorAll(".presets button").forEach(btn => {
    btn.addEventListener("click", () => Timer.setDuration(+btn.dataset.min * 60 * 1000));
});

timerToggle.addEventListener("click", () => {
    Store.get("timer").running ? Timer.pause() : Timer.start();
});
document.getElementById("timer-reset").addEventListener("click", () => {
    stopBell();
    Timer.reset();
});

swToggle.addEventListener("click", () => {
    Store.get("stopwatch").running ? Stopwatch.pause() : Stopwatch.start();
});
document.getElementById("sw-reset").addEventListener("click", () => Stopwatch.reset());

mini.addEventListener("click", (e) => {
    if (e.target.closest(".done")) {
        stopBell();
        Timer.reset();
    } else {
        openPanel("timer");
    }
});

let lastFinishedAt = Store.get("timer").finishedAt;

function onTimerFinished() {
    say(randomTimerMessage(), 8000);
}

// 다른 화면(대쉬보드)이 먼저 종료를 감지해도 대사는 펫이 말한다
Store.on("timer", (t) => {
    if (t.finishedAt && t.finishedAt !== lastFinishedAt) {
        lastFinishedAt = t.finishedAt;
        onTimerFinished();
    }
});

function tick() {
    if (Timer.checkFinish()) playBell();

    const t = Store.get("timer");
    const sw = Store.get("stopwatch");
    const remain = Timer.remaining(t);
    const elapsed = Stopwatch.elapsed(sw);

    timerDisplay.textContent = formatTime(remain);
    timerToggle.textContent = t.running ? "일시정지" : "시작";
    swDisplay.textContent = formatTime(elapsed, true);
    swToggle.textContent = sw.running ? "일시정지" : "시작";

    // 캐릭터 옆 미니 표시
    let html = "";
    if (t.running || (t.remaining > 0 && t.remaining < t.duration)) {
        html += `<div class="${t.running ? "" : "paused"}">⏱️ ${formatTime(remain)}</div>`;
    } else if (t.finishedAt && t.remaining === 0) {
        html += `<div class="done" title="눌러서 끄기">⏰ 끝!</div>`;
    }
    if (sw.running || sw.elapsed > 0) {
        html += `<div class="${sw.running ? "" : "paused"}">⏲️ ${formatTime(elapsed)}</div>`;
    }
    if (mini.innerHTML !== html) mini.innerHTML = html;
}

setInterval(tick, 100);

// ===== 일정관리 =====
const todoList = document.getElementById("todo-list");
const todoInput = document.getElementById("todo-input");
const todoInterval = document.getElementById("todo-interval");

function visibleTodos() {
    const today = todayKey();
    return Store.get("todos")
        .filter(t => t.date === today || !t.done)
        .sort((a, b) => a.done - b.done || a.createdAt - b.createdAt);
}

function renderTodos() {
    const todos = visibleTodos();
    todoInterval.value = Store.get("settings").todoInterval;
    if (todos.length === 0) {
        todoList.innerHTML = `<li class="empty">오늘 할 일을 추가해 보세요</li>`;
        return;
    }
    const today = todayKey();
    todoList.innerHTML = todos.map(t => `
        <li class="${t.done ? "done" : ""}" data-id="${t.id}">
            <input type="checkbox" ${t.done ? "checked" : ""}>
            <span class="text">${escapeHTML(t.text)}</span>
            ${t.date !== today ? `<span class="sub">${t.date.slice(5)}</span>` : ""}
            <button class="icon-btn" data-del="${t.id}" title="삭제">✕</button>
        </li>`).join("");
}

function addTodo() {
    const text = todoInput.value.trim();
    if (!text) return;
    Store.update("todos", list => {
        list.push({ id: uid(), text, done: false, date: todayKey(), createdAt: Date.now() });
    });
    todoInput.value = "";
}

document.getElementById("todo-add").addEventListener("click", addTodo);
todoInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.isComposing) addTodo();
});

todoList.addEventListener("click", (e) => {
    const li = e.target.closest("li[data-id]");
    if (!li) return;
    const id = li.dataset.id;
    if (e.target.closest("[data-del]")) {
        Store.update("todos", list => list.filter(t => t.id !== id));
    } else if (e.target.type === "checkbox") {
        Store.update("todos", list => {
            const todo = list.find(t => t.id === id);
            if (todo) todo.done = e.target.checked;
        });
    }
});

todoInterval.addEventListener("change", () => {
    const value = +todoInterval.value;
    Store.update("settings", s => { s.todoInterval = value; });
    if (value > 0 && "Notification" in window && Notification.permission === "default") {
        Notification.requestPermission();
    }
});

Store.on("todos", () => {
    if (currentPanel === "todo") renderTodos();
});

// 일정 시간마다 남은 할 일 알려주기
let lastRemind = Date.now();
let lastInterval = Store.get("settings").todoInterval;

setInterval(() => {
    const interval = Store.get("settings").todoInterval;
    if (interval !== lastInterval) {
        lastInterval = interval;
        lastRemind = Date.now();
    }
    if (!interval || Date.now() - lastRemind < interval * 60 * 1000) return;
    lastRemind = Date.now();

    const pending = Store.get("todos").filter(t => !t.done);
    if (pending.length === 0) return;

    const preview = pending.slice(0, 3).map(t => `· ${t.text}`).join("\n");
    const more = pending.length > 3 ? `\n외 ${pending.length - 3}개` : "";
    say(`아직 남은 일이 ${pending.length}개 있어!\n${preview}${more}`, 10000);

    if ("Notification" in window && Notification.permission === "granted" && document.hidden) {
        new Notification("데스크펫 일정 알림", { body: pending.map(t => t.text).join("\n") });
    }
}, 15 * 1000);

// ===== 메모장 =====
const memoListView = document.getElementById("memo-list-view");
const memoEditView = document.getElementById("memo-edit-view");
const memoList = document.getElementById("memo-list");
const memoSearch = document.getElementById("memo-search");
const memoTitle = document.getElementById("memo-title");
const memoContent = document.getElementById("memo-content");
let editingMemoId = null;

function renderMemos() {
    const q = memoSearch.value.trim().toLowerCase();
    const memos = Store.get("memos")
        .filter(m => !q || m.title.toLowerCase().includes(q) || m.content.toLowerCase().includes(q))
        .sort((a, b) => b.updatedAt - a.updatedAt);

    if (memos.length === 0) {
        memoList.innerHTML = `<li class="empty">${q ? "검색 결과가 없어요" : "저장된 메모가 없어요"}</li>`;
        return;
    }
    memoList.innerHTML = memos.map(m => `
        <li class="clickable" data-id="${m.id}">
            <span class="text">${escapeHTML(m.title || m.content.split("\n")[0] || "(제목 없음)")}</span>
            <span class="sub">${formatDate(m.updatedAt)}</span>
        </li>`).join("");
}

function showMemoList() {
    editingMemoId = null;
    memoEditView.classList.add("hidden");
    memoListView.classList.remove("hidden");
    renderMemos();
    memoSearch.focus();
}

function showMemoEditor(memo) {
    editingMemoId = memo ? memo.id : null;
    memoTitle.value = memo ? memo.title : "";
    memoContent.value = memo ? memo.content : "";
    document.getElementById("memo-delete").classList.toggle("hidden", !memo);
    memoListView.classList.add("hidden");
    memoEditView.classList.remove("hidden");
    memoContent.focus();
}

memoSearch.addEventListener("input", renderMemos);
document.getElementById("memo-new").addEventListener("click", () => showMemoEditor(null));
document.getElementById("memo-back").addEventListener("click", showMemoList);

memoList.addEventListener("click", (e) => {
    const li = e.target.closest("li[data-id]");
    if (!li) return;
    showMemoEditor(Store.get("memos").find(m => m.id === li.dataset.id));
});

function saveMemo() {
    const title = memoTitle.value.trim();
    const content = memoContent.value;
    if (!title && !content.trim()) return toast("내용을 입력해 주세요");

    Store.update("memos", list => {
        const memo = list.find(m => m.id === editingMemoId);
        if (memo) {
            Object.assign(memo, { title, content, updatedAt: Date.now() });
        } else {
            editingMemoId = uid();
            list.push({ id: editingMemoId, title, content, createdAt: Date.now(), updatedAt: Date.now() });
        }
    });
    document.getElementById("memo-delete").classList.remove("hidden");
    toast("저장했어요");
}

document.getElementById("memo-save").addEventListener("click", saveMemo);

memoEditView.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.key === "s") {
        e.preventDefault();
        saveMemo();
    }
});

document.getElementById("memo-delete").addEventListener("click", () => {
    if (!editingMemoId || !confirm("이 메모를 삭제할까요?")) return;
    Store.update("memos", list => list.filter(m => m.id !== editingMemoId));
    showMemoList();
});

Store.on("memos", () => {
    if (currentPanel === "memo" && !memoListView.classList.contains("hidden")) renderMemos();
});

// ===== 시작 =====
Store.on("settings", applySettings);
Store.on("fonts", loadFonts);

loadFonts(Store.get("fonts"));

const init = () => applySettings(Store.get("settings"));
petImg.complete ? init() : petImg.addEventListener("load", init);
