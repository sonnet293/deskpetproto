const $ = (id) => document.getElementById(id);

let toastTimer;
function toast(text) {
    $("toast").textContent = text;
    $("toast").classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $("toast").classList.remove("show"), 1800);
}

// 다시 그릴 때 열려 있던 토글을 유지
function openKeys(container) {
    return new Set([...container.querySelectorAll("details[open]")].map(d => d.dataset.key));
}

// ===== 상단 네비게이션 =====
function showPage(name) {
    document.querySelectorAll(".nav-link").forEach(b => b.classList.toggle("active", b.dataset.page === name));
    document.querySelectorAll(".page").forEach(p => p.classList.toggle("active", p.id === "page-" + name));
    history.replaceState(null, "", "#" + name);
}

document.querySelectorAll(".nav-link").forEach(btn => {
    btn.addEventListener("click", () => showPage(btn.dataset.page));
});

// ===== 메인: 대사 목록 =====
const messageList = $("message-list");

function renderMessages() {
    const opened = openKeys(messageList);
    const messages = Store.get("messages");

    if (messages.length === 0) {
        messageList.innerHTML = `<div class="desc">대사가 없어요. 아래에서 추가해 보세요.</div>`;
        return;
    }
    messageList.innerHTML = messages.map((msg, i) => `
        <details data-key="${i}" ${opened.has(String(i)) ? "open" : ""}>
            <summary><span class="text">${escapeHTML(msg)}</span><span class="sub">#${i + 1}</span></summary>
            <div class="toggle-body">
                <textarea rows="3">${escapeHTML(msg)}</textarea>
                <div class="btn-row">
                    <button class="danger" data-act="delete">삭제</button>
                    <button class="primary" data-act="save">변경 저장</button>
                </div>
            </div>
        </details>`).join("");
}

messageList.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-act]");
    if (!btn) return;
    const details = btn.closest("details");
    const index = +details.dataset.key;

    if (btn.dataset.act === "save") {
        const text = details.querySelector("textarea").value.trim();
        if (!text) return toast("내용을 입력해 주세요");
        Store.update("messages", list => { list[index] = text; });
        toast("저장했어요");
    } else if (btn.dataset.act === "delete") {
        if (!confirm("이 대사를 삭제할까요?")) return;
        details.open = false;
        Store.update("messages", list => { list.splice(index, 1); });
    }
});

$("message-add").addEventListener("click", () => {
    const text = $("message-new").value.trim();
    if (!text) return;
    Store.update("messages", list => { list.push(text); });
    $("message-new").value = "";
    toast("대사를 추가했어요");
});

// ===== 메인: 캐릭터 설정 =====
function renderSettings() {
    const s = Store.get("settings");
    $("set-locked").checked = s.locked;
    $("set-autostart").checked = s.autoStart;
    $("set-opacity").value = s.opacity;
    $("opacity-value").textContent = s.opacity + "%";
    $("bell-name").textContent = s.bellName || "기본 (bell.mp3)";
    applyFont(s.activeFont);
    renderFonts();
    renderShortcut();
}

$("set-locked").addEventListener("change", (e) => {
    Store.update("settings", s => { s.locked = e.target.checked; });
});

$("set-autostart").addEventListener("change", (e) => {
    Store.update("settings", s => { s.autoStart = e.target.checked; });
});

$("set-opacity").addEventListener("input", (e) => {
    Store.update("settings", s => { s.opacity = +e.target.value; });
});

$("pos-reset").addEventListener("click", () => {
    Store.update("settings", s => { s.pos = null; });
    toast("캐릭터를 가운데로 옮겼어요");
});

// ===== 메인: 글꼴 =====
const fontList = $("font-list");

function renderFonts() {
    const fonts = Store.get("fonts");
    const active = Store.get("settings").activeFont;

    fontList.innerHTML = fonts.map((f, i) => `
        <li>
            <label>
                <input type="radio" name="font" value="${escapeHTML(f.name)}" ${f.name === active ? "checked" : ""}>
                <span class="preview" style="font-family: '${escapeHTML(f.name.replace(/'/g, ""))}', sans-serif">안녕! 오늘도 화이팅 Hello 123</span>
                <span class="font-name">${escapeHTML(f.name)}</span>
            </label>
            <button class="icon-btn" data-del="${i}" title="삭제">✕</button>
        </li>`).join("") + `
        <li>
            <label>
                <input type="radio" name="font" value="sans-serif" ${active === "sans-serif" ? "checked" : ""}>
                <span class="preview" style="font-family: sans-serif">안녕! 오늘도 화이팅 Hello 123</span>
                <span class="font-name">기본 시스템 글꼴</span>
            </label>
        </li>`;
}

fontList.addEventListener("change", (e) => {
    if (e.target.name !== "font") return;
    Store.update("settings", s => { s.activeFont = e.target.value; });
});

fontList.addEventListener("click", (e) => {
    const del = e.target.closest("[data-del]");
    if (!del) return;
    const fonts = Store.get("fonts");
    const removed = fonts.splice(+del.dataset.del, 1)[0];
    Store.set("fonts", fonts);
    if (removed && Store.get("settings").activeFont === removed.name) {
        Store.update("settings", s => { s.activeFont = "sans-serif"; });
    }
});

$("font-add").addEventListener("click", () => {
    const name = $("font-name").value.trim();
    const url = $("font-url").value.trim();
    if (!name || !url) return toast("글꼴 이름과 URL을 모두 입력해 주세요");
    if (!/^https?:\/\//i.test(url)) return toast("http(s):// 로 시작하는 URL을 입력해 주세요");

    Store.update("fonts", list => {
        const existing = list.find(f => f.name === name);
        existing ? (existing.url = url) : list.push({ name, url });
    });
    $("font-name").value = "";
    $("font-url").value = "";
    toast("글꼴을 추가했어요");
});

// ===== 클립보드 =====
const clipList = $("clip-list");

function renderClipboard() {
    const items = Store.get("clipboard");
    $("clip-count").textContent = `${items.length}/10`;

    if (items.length === 0) {
        clipList.innerHTML = `<li class="empty">저장된 클립보드가 없어요</li>`;
        return;
    }
    clipList.innerHTML = items.map(item => `
        <li data-id="${item.id}">
            <span class="text">${escapeHTML(item.text)}</span>
            <span class="sub">${formatDate(item.at)}</span>
            <button data-act="copy">복사</button>
            <button class="icon-btn" data-act="delete" title="삭제">✕</button>
        </li>`).join("");
}

clipList.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-act]");
    if (!btn) return;
    const id = btn.closest("li").dataset.id;

    if (btn.dataset.act === "delete") {
        Store.update("clipboard", list => list.filter(i => i.id !== id));
    } else {
        const item = Store.get("clipboard").find(i => i.id === id);
        try {
            await navigator.clipboard.writeText(item.text);
            toast("클립보드에 복사했어요");
        } catch (err) {
            toast("복사에 실패했어요");
        }
    }
});

// 클립보드 단축키 변경
const DEFAULT_CLIP_SHORTCUT = "Alt+C";
let recordingShortcut = false;

function renderShortcut() {
    const btn = $("clip-shortcut");
    btn.classList.toggle("recording", recordingShortcut);
    btn.textContent = recordingShortcut ? "키를 누르세요..." : (Store.get("settings").clipShortcut || "없음");
}

$("clip-shortcut").addEventListener("click", () => {
    recordingShortcut = !recordingShortcut;
    renderShortcut();
});

$("clip-shortcut").addEventListener("blur", () => {
    recordingShortcut = false;
    renderShortcut();
});

document.addEventListener("keydown", (e) => {
    if (!recordingShortcut) return;
    e.preventDefault();

    if (e.key === "Escape") {
        recordingShortcut = false;
        return renderShortcut();
    }

    const shortcut = shortcutFromEvent(e);
    if (!shortcut) return; // 수정키만 누른 상태

    // 글자 입력을 방해하지 않도록 수정키(Ctrl/Alt/Meta) 또는 F키가 필요
    if (!(e.ctrlKey || e.altKey || e.metaKey) && !/^F\d{1,2}$/.test(e.code)) {
        return toast("Ctrl, Alt 중 하나와 함께 눌러 주세요 (F1~F12는 단독 가능)");
    }

    recordingShortcut = false;
    Store.update("settings", s => { s.clipShortcut = shortcut; });
    toast(`단축키를 ${shortcut}(으)로 바꿨어요`);
});

$("clip-shortcut-default").addEventListener("click", () => {
    recordingShortcut = false;
    Store.update("settings", s => { s.clipShortcut = DEFAULT_CLIP_SHORTCUT; });
});

$("clip-clear").addEventListener("click", () => {
    if (confirm("클립보드 내역을 모두 삭제할까요?")) Store.set("clipboard", []);
});

// ===== 메모장 =====
const memoList = $("memo-list");

function renderMemos() {
    const opened = openKeys(memoList);
    const all = Store.get("memos");
    const q = $("memo-search").value.trim().toLowerCase();
    const memos = all
        .filter(m => !q || m.title.toLowerCase().includes(q) || m.content.toLowerCase().includes(q))
        .sort((a, b) => b.updatedAt - a.updatedAt);

    $("memo-count").textContent = `${all.length}개`;

    if (memos.length === 0) {
        memoList.innerHTML = `<div class="desc">${q ? "검색 결과가 없어요" : "저장된 메모가 없어요"}</div>`;
        return;
    }
    memoList.innerHTML = memos.map(m => `
        <details data-key="${m.id}" ${opened.has(m.id) ? "open" : ""}>
            <summary>
                <span class="text">${escapeHTML(m.title || m.content.split("\n")[0] || "(제목 없음)")}</span>
                <span class="sub">${formatDate(m.updatedAt)}</span>
            </summary>
            <div class="toggle-body">
                <input type="text" class="memo-title" value="${escapeHTML(m.title)}" placeholder="제목">
                <textarea class="memo-content" rows="8" placeholder="내용">${escapeHTML(m.content)}</textarea>
                <div class="btn-row">
                    <button class="danger" data-act="delete">삭제</button>
                    <button class="primary" data-act="save">저장</button>
                </div>
            </div>
        </details>`).join("");
}

$("memo-search").addEventListener("input", renderMemos);

memoList.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-act]");
    if (!btn) return;
    const details = btn.closest("details");
    const id = details.dataset.key;

    if (btn.dataset.act === "save") {
        const title = details.querySelector(".memo-title").value.trim();
        const content = details.querySelector(".memo-content").value;
        Store.update("memos", list => {
            const memo = list.find(m => m.id === id);
            if (memo) Object.assign(memo, { title, content, updatedAt: Date.now() });
        });
        toast("저장했어요");
    } else if (btn.dataset.act === "delete") {
        if (!confirm("이 메모를 삭제할까요?")) return;
        Store.update("memos", list => list.filter(m => m.id !== id));
    }
});

$("memo-new").addEventListener("click", () => {
    const id = uid();
    Store.update("memos", list => {
        list.push({ id, title: "", content: "", createdAt: Date.now(), updatedAt: Date.now() });
    });
    $("memo-search").value = "";
    renderMemos();
    const details = memoList.querySelector(`details[data-key="${id}"]`);
    details.open = true;
    details.querySelector(".memo-title").focus();
});

// ===== 타이머 / 스톱워치 =====
$("timer-set").addEventListener("click", () => {
    const h = +$("timer-h").value || 0;
    const m = +$("timer-m").value || 0;
    const s = +$("timer-s").value || 0;
    const ms = ((h * 60 + m) * 60 + s) * 1000;
    if (ms <= 0) return toast("시간을 입력해 주세요");
    Timer.setDuration(ms);
});

$("timer-toggle").addEventListener("click", () => {
    Store.get("timer").running ? Timer.pause() : Timer.start();
});
$("timer-reset").addEventListener("click", () => {
    stopBell();
    Timer.reset();
});

$("sw-toggle").addEventListener("click", () => {
    Store.get("stopwatch").running ? Stopwatch.pause() : Stopwatch.start();
});
$("sw-reset").addEventListener("click", () => Stopwatch.reset());

function tick() {
    if (Timer.checkFinish()) {
        playBell();
        toast("⏰ " + randomTimerMessage());
    }

    const t = Store.get("timer");
    const sw = Store.get("stopwatch");
    $("timer-display").textContent = formatTime(Timer.remaining(t));
    $("timer-display").classList.toggle("finished", !t.running && t.remaining === 0);
    $("timer-toggle").textContent = t.running ? "일시정지" : "시작";
    $("sw-display").textContent = formatTime(Stopwatch.elapsed(sw), true);
    $("sw-toggle").textContent = sw.running ? "일시정지" : "시작";
}

setInterval(tick, 100);

// 벨소리
$("bell-preview").addEventListener("click", () => {
    bellAudio ? stopBell() : playBell();
});

$("bell-file").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("audio/")) return toast("음원 파일만 올릴 수 있어요");

    await FileDB.put("bell", file);
    Store.update("settings", s => { s.bellName = file.name; });
    toast("벨소리를 변경했어요");
});

$("bell-default").addEventListener("click", async () => {
    await FileDB.remove("bell");
    Store.update("settings", s => { s.bellName = null; });
    toast("기본 벨소리로 돌아갔어요");
});

// 타이머 종료 대사
const timerMsgList = $("timer-msg-list");

function renderTimerMessages() {
    const list = Store.get("timerMessages");
    if (list.length === 0) {
        timerMsgList.innerHTML = `<li class="empty">종료 대사가 없으면 "타이머 끝났어!"를 말해요</li>`;
        return;
    }
    timerMsgList.innerHTML = list.map((msg, i) => `
        <li>
            <span class="text">${escapeHTML(msg)}</span>
            <button class="icon-btn" data-del="${i}" title="삭제">✕</button>
        </li>`).join("");
}

timerMsgList.addEventListener("click", (e) => {
    const del = e.target.closest("[data-del]");
    if (!del) return;
    Store.update("timerMessages", list => { list.splice(+del.dataset.del, 1); });
});

function addTimerMessage() {
    const text = $("timer-msg-new").value.trim();
    if (!text) return;
    Store.update("timerMessages", list => { list.push(text); });
    $("timer-msg-new").value = "";
}

$("timer-msg-add").addEventListener("click", addTimerMessage);
$("timer-msg-new").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.isComposing) addTimerMessage();
});

// ===== 시작 =====
Store.on("messages", renderMessages);
Store.on("settings", renderSettings);
Store.on("fonts", (fonts) => {
    loadFonts(fonts);
    renderFonts();
});
Store.on("clipboard", renderClipboard);
Store.on("memos", renderMemos);
Store.on("timerMessages", renderTimerMessages);

loadFonts(Store.get("fonts"));
renderMessages();
renderSettings();
renderClipboard();
renderMemos();
renderTimerMessages();

const initialPage = location.hash.slice(1);
if (document.getElementById("page-" + initialPage)) showPage(initialPage);
