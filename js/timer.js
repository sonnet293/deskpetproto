// 타이머/스톱워치 공용 로직 (상태는 Store에 저장되어 펫/대쉬보드가 함께 본다)

const Timer = {
    remaining(t = Store.get("timer")) {
        return t.running ? Math.max(0, t.endAt - Date.now()) : t.remaining;
    },

    setDuration(ms) {
        Store.set("timer", { duration: ms, remaining: ms, endAt: null, running: false, finishedAt: null });
    },

    start() {
        Store.update("timer", t => {
            if (t.running) return;
            if (t.remaining <= 0) t.remaining = t.duration;
            if (t.remaining <= 0) return;
            t.endAt = Date.now() + t.remaining;
            t.running = true;
        });
    },

    pause() {
        Store.update("timer", t => {
            if (!t.running) return;
            t.remaining = Math.max(0, t.endAt - Date.now());
            t.endAt = null;
            t.running = false;
        });
    },

    reset() {
        Store.update("timer", t => {
            t.remaining = t.duration;
            t.endAt = null;
            t.running = false;
        });
    },

    // 시간이 다 됐으면 종료 처리 후 true (먼저 감지한 화면이 벨을 울린다)
    checkFinish() {
        const t = Store.get("timer");
        if (!t.running || t.endAt > Date.now()) return false;
        t.running = false;
        t.remaining = 0;
        t.endAt = null;
        t.finishedAt = Date.now();
        Store.set("timer", t);
        return true;
    },
};

const Stopwatch = {
    elapsed(s = Store.get("stopwatch")) {
        return s.running ? s.elapsed + (Date.now() - s.startAt) : s.elapsed;
    },

    start() {
        Store.update("stopwatch", s => {
            if (s.running) return;
            s.startAt = Date.now();
            s.running = true;
        });
    },

    pause() {
        Store.update("stopwatch", s => {
            if (!s.running) return;
            s.elapsed += Date.now() - s.startAt;
            s.startAt = null;
            s.running = false;
        });
    },

    reset() {
        Store.set("stopwatch", { startAt: null, elapsed: 0, running: false });
    },
};

function formatTime(ms, withCentis = false) {
    const total = Math.floor(ms / 1000);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const pad = n => String(n).padStart(2, "0");
    let str = h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
    if (withCentis) str += `.${pad(Math.floor((ms % 1000) / 10))}`;
    return str;
}

let bellAudio = null;

async function playBell() {
    stopBell();
    let src = "bgm/bell.mp3";
    try {
        const blob = await FileDB.get("bell");
        if (blob) src = URL.createObjectURL(blob);
    } catch (e) { /* 실패 시 기본 벨 */ }
    bellAudio = new Audio(src);
    bellAudio.play().catch(() => {});
}

function stopBell() {
    if (bellAudio) {
        bellAudio.pause();
        bellAudio = null;
    }
}

function randomTimerMessage() {
    const list = Store.get("timerMessages");
    return list.length ? list[Math.floor(Math.random() * list.length)] : "타이머 끝났어!";
}
