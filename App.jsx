import { useState, useEffect, useRef } from "react";

const STORE_KEY = "tempo_sessions_v1";

const pad = (n) => String(n).padStart(2, "0");
const fmtHMS = (ms) => {
  const s = Math.floor(ms / 1000);
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
};
const fmtDur = (ms) => {
  const m = Math.floor(ms / 60000);
  if (m < 1) return "< 1m";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60), r = m % 60;
  return r > 0 ? `${h}h ${r}m` : `${h}h`;
};
const toDate = (d) => d.toISOString().split("T")[0];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const MSHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DSHORT = ["S","M","T","W","T","F","S"];

export default function App() {
  const [sessions, setSessions] = useState([]);
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [task, setTask] = useState("");
  const [sessionStart, setSessionStart] = useState(null);
  const [calMonth, setCalMonth] = useState(new Date());
  const [viewDate, setViewDate] = useState(new Date());
  const [loaded, setLoaded] = useState(false);

  const timerRef = useRef(null);
  const startRef = useRef(null);
  const baseRef = useRef(0);

  useEffect(() => {
    try {
      const r = localStorage.getItem(STORE_KEY);
      if (r) setSessions(JSON.parse(r));
    } catch (e) {
      console.error("Failed to load sessions", e);
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (running && !paused) {
      timerRef.current = setInterval(() => {
        setElapsed(baseRef.current + Date.now() - startRef.current);
      }, 100);
    } else clearInterval(timerRef.current);
    return () => clearInterval(timerRef.current);
  }, [running, paused]);

  const save = (updated) => {
    setSessions(updated);
    try { localStorage.setItem(STORE_KEY, JSON.stringify(updated)); } catch (e) {
        console.error("Failed to save sessions", e);
    }
  };

  const startTimer = () => {
    startRef.current = Date.now();
    baseRef.current = 0;
    setElapsed(0);
    setRunning(true);
    setPaused(false);
    setSessionStart(new Date());
  };

  const togglePause = () => {
    if (paused) { startRef.current = Date.now(); setPaused(false); }
    else { baseRef.current = elapsed; setPaused(true); }
  };

  const stopTimer = () => {
    clearInterval(timerRef.current);
    if (elapsed >= 3000) {
      const s = {
        id: String(Date.now()),
        task: task.trim() || "Work Session",
        start: sessionStart.toISOString(),
        end: new Date().toISOString(),
        duration: elapsed,
        date: toDate(new Date()),
      };
      save([s, ...sessions]);
    }
    setRunning(false); setPaused(false); setElapsed(0); setTask("");
    baseRef.current = 0;
  };

  const delSession = (id) => save(sessions.filter((s) => s.id !== id));

  const todayStr = toDate(new Date());
  const todaySessions = sessions.filter((s) => s.date === todayStr);
  const todayMs = todaySessions.reduce((a, s) => a + s.duration, 0) + (running ? elapsed : 0);

  const yr = calMonth.getFullYear(), mo = calMonth.getMonth();
  const daysInMonth = new Date(yr, mo + 1, 0).getDate();
  const firstDay = new Date(yr, mo, 1).getDay();
  const monthPfx = `${yr}-${pad(mo + 1)}`;
  const monthSessions = sessions.filter((s) => s.date.startsWith(monthPfx));
  const monthMs = monthSessions.reduce((a, s) => a + s.duration, 0);
  const daysWorked = new Set(monthSessions.map((s) => s.date)).size;

  const weekMs = (() => {
    const d = new Date(); d.setDate(d.getDate() - d.getDay());
    const ws = toDate(d);
    return sessions.filter((s) => s.date >= ws).reduce((a, s) => a + s.duration, 0);
  })();

  const dayMap = {};
  sessions.forEach((s) => { dayMap[s.date] = (dayMap[s.date] || 0) + s.duration; });

  const heatColor = (dateStr) => {
    const h = (dayMap[dateStr] || 0) / 3600000;
    if (h === 0) return "var(--cell0)";
    if (h < 2) return "var(--cell1)";
    if (h < 4) return "var(--cell2)";
    if (h < 6) return "var(--cell3)";
    return "var(--cell4)";
  };

  const viewStr = toDate(viewDate);
  const viewSessions = sessions.filter((s) => s.date === viewStr);
  const viewMs = viewSessions.reduce((a, s) => a + s.duration, 0);

  const topDays = Object.entries(dayMap).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const now = new Date();
  const dateLabel = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  const monthBars = Object.entries(dayMap)
    .filter(([d]) => d.startsWith(monthPfx))
    .sort((a, b) => a[0].localeCompare(b[0]));
  const maxBar = Math.max(...monthBars.map(([, v]) => v), 1);

  // Task Selection from existing ones
  const existingTasks = Array.from(new Set(sessions.map(s => s.task))).filter(Boolean).sort();

  // Task detail stats (current month)
  const taskStats = monthSessions.reduce((acc, s) => {
    acc[s.task] = (acc[s.task] || 0) + s.duration;
    return acc;
  }, {});
  const sortedTaskStats = Object.entries(taskStats).sort((a, b) => b[1] - a[1]);
  const maxTaskBar = Math.max(...Object.values(taskStats), 1);

  // Monthly stats (current year)
  const yearStr = String(yr);
  const yearSessions = sessions.filter(s => s.date.startsWith(yearStr));
  const monthlyTotals = Array(12).fill(0);
  yearSessions.forEach(s => {
    const m = parseInt(s.date.split("-")[1]) - 1;
    monthlyTotals[m] += s.duration;
  });
  const maxMonthBar = Math.max(...monthlyTotals, 1);

  if (!loaded) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", fontFamily: "'DM Sans', sans-serif", color: "#AEA598", fontSize: 14 }}>
      Loading Tempo…
    </div>
  );

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        :root {
          --bg: #F3EDE2;
          --surface: #FDFAF5;
          --s2: #EDE7DC;
          --border: #DDD6C8;
          --text: #1C1814;
          --t2: #7A7268;
          --t3: #B0A898;
          --accent: #C7572B;
          --asoft: #F5DDD2;
          --green: #3A6B50;
          --gsoft: #D5E8DD;
          --cell0: #EDE7DC;
          --cell1: #F2D5C4;
          --cell2: #E8A07A;
          --cell3: #D46E3F;
          --cell4: #C7572B;
          --sh: 0 2px 8px rgba(28,24,20,0.07), 0 0 1px rgba(28,24,20,0.06);
          --sha: 0 6px 24px rgba(28,24,20,0.1), 0 0 1px rgba(28,24,20,0.06);
          --r: 14px; --rs: 9px;
        }
        html, body { background: var(--bg); min-height: 100vh; font-family: 'DM Sans', sans-serif; color: var(--text); -webkit-font-smoothing: antialiased; }
        .app { min-height: 100vh; }

        .hdr {
          display: flex; align-items: center; justify-content: space-between;
          padding: 16px 28px; background: var(--surface);
          border-bottom: 1px solid var(--border);
          position: sticky; top: 0; z-index: 50;
        }
        .logo { display: flex; align-items: center; gap: 10px; }
        .logo-icon {
          width: 36px; height: 36px; background: var(--accent);
          border-radius: 10px; display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .logo-name { font-family: 'Fraunces', serif; font-size: 21px; font-weight: 600; letter-spacing: -0.5px; line-height: 1.1; }
        .logo-sub { font-size: 10.5px; color: var(--t3); letter-spacing: 0.5px; line-height: 1; }
        .hdr-date { font-size: 13.5px; color: var(--t2); font-weight: 400; }
        .hdr-status { display: flex; align-items: center; gap: 7px; font-size: 13px; font-weight: 500; color: var(--t2); }
        .dot { width: 7px; height: 7px; border-radius: 50%; background: var(--t3); flex-shrink: 0; transition: all .3s; }
        .dot.on { background: #4DB87A; box-shadow: 0 0 0 3px rgba(77,184,122,.22); animation: glow 2s infinite; }
        .dot.idle { background: var(--accent); opacity: .5; }
        @keyframes glow { 0%,100%{box-shadow:0 0 0 3px rgba(77,184,122,.22)} 50%{box-shadow:0 0 0 6px rgba(77,184,122,.1)} }

        .main {
          padding: 24px 28px 40px;
          display: grid;
          grid-template-columns: 320px 1fr 300px;
          grid-template-rows: auto auto auto;
          gap: 18px;
          align-items: start;
          max-width: 1400px;
          margin: 0 auto;
        }
        .stats-row { grid-column: 1/-1; display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
        .col-l { grid-column: 1; display: flex; flex-direction: column; gap: 16px; }
        .col-m { grid-column: 2; display: flex; flex-direction: column; gap: 16px; }
        .col-r { grid-column: 3; display: flex; flex-direction: column; gap: 16px; }

        .scard {
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--r); box-shadow: var(--sh);
          padding: 18px 20px;
        }
        .scard.hi { background: var(--accent); border-color: var(--accent); }
        .scard-lbl { font-size: 10.5px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; color: var(--t3); margin-bottom: 7px; }
        .scard.hi .scard-lbl { color: rgba(255,255,255,.65); }
        .scard-val { font-family: 'Fraunces', serif; font-size: 30px; font-weight: 400; letter-spacing: -1.5px; line-height: 1; margin-bottom: 4px; color: var(--text); }
        .scard.hi .scard-val { color: #fff; }
        .scard-sub { font-size: 11.5px; color: var(--t3); }
        .scard.hi .scard-sub { color: rgba(255,255,255,.55); }

        .card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--r); box-shadow: var(--sh); overflow: hidden; }
        .card-hd { padding: 17px 20px 0; display: flex; align-items: center; justify-content: space-between; }
        .card-ttl { font-size: 10.5px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; color: var(--t3); }
        .card-meta { font-family: 'Fraunces', serif; font-size: 14px; color: var(--t2); font-weight: 400; }
        .card-bd { padding: 14px 20px 20px; }

        .timer-card {
          background: var(--surface); border: 1px solid var(--border); border-radius: var(--r);
          box-shadow: var(--sha); padding: 26px 22px 22px; text-align: center;
        }
        .t-badge {
          display: inline-flex; align-items: center; gap: 5px;
          font-size: 10.5px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase;
          color: var(--t3); margin-bottom: 14px; padding: 4px 10px;
          border: 1px solid var(--border); border-radius: 20px;
        }
        .t-badge.on { color: var(--green); background: var(--gsoft); border-color: #B8D9C8; }
        .t-badge.pause { color: var(--accent); background: var(--asoft); border-color: #E8C0AC; }
        .t-bdot { width: 5px; height: 5px; border-radius: 50%; background: currentColor; animation: blink 1.4s infinite; }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:.3} }

        .timer-num {
          font-family: 'Fraunces', serif; font-size: 62px; font-weight: 300;
          letter-spacing: -4px; line-height: 1; color: var(--text);
          margin-bottom: 22px; font-variant-numeric: tabular-nums;
          transition: color .3s;
        }
        .timer-num.on { color: var(--accent); }
        .timer-num.pause { color: var(--t2); }

        .t-input {
          width: 100%; border: 1px solid var(--border); border-radius: var(--rs);
          padding: 10px 13px; font-family: 'DM Sans', sans-serif; font-size: 13px;
          color: var(--text); background: var(--bg); outline: none;
          transition: border-color .2s, box-shadow .2s; margin-bottom: 14px;
        }
        .t-input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--asoft); }
        .t-input::placeholder { color: var(--t3); }
        .t-input:disabled { opacity: .5; cursor: not-allowed; }

        .btns { display: flex; gap: 8px; }
        .btn {
          flex: 1; padding: 10px 12px; border: none; border-radius: var(--rs);
          font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 600;
          cursor: pointer; display: flex; align-items: center; justify-content: center;
          gap: 6px; transition: all .15s;
        }
        .btn-p { background: var(--accent); color: #fff; }
        .btn-p:hover { background: #B34D23; transform: translateY(-1px); box-shadow: 0 4px 14px rgba(199,87,43,.28); }
        .btn-s { background: var(--s2); color: var(--text); border: 1px solid var(--border); }
        .btn-s:hover { background: var(--border); }
        .btn-d { background: #FDF0EE; color: var(--accent); border: 1px solid #EFC4B0; }
        .btn-d:hover { background: var(--asoft); }
        .btn:disabled { opacity: .35; cursor: not-allowed; transform: none !important; box-shadow: none !important; }
        .btn:active { transform: scale(.98); }

        .cal-nav { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
        .cal-mname { font-family: 'Fraunces', serif; font-size: 19px; font-weight: 500; letter-spacing: -.5px; }
        .cal-yr { font-size: 13px; color: var(--t2); margin-left: 6px; }
        .nav-btn {
          width: 28px; height: 28px; border: 1px solid var(--border); border-radius: 7px;
          background: transparent; cursor: pointer; display: flex; align-items: center;
          justify-content: center; color: var(--t2); font-size: 13px; transition: all .15s;
        }
        .nav-btn:hover { background: var(--s2); color: var(--text); }

        .cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 3px; }
        .cal-dn { text-align: center; font-size: 10px; font-weight: 600; letter-spacing: .5px; color: var(--t3); padding: 3px 0 8px; }
        .cal-cell {
          aspect-ratio: 1; border-radius: 7px; display: flex; align-items: center;
          justify-content: center; font-size: 12px; font-weight: 500; cursor: pointer;
          transition: transform .12s; position: relative; color: var(--text);
          background: var(--cell0);
        }
        .cal-cell:not(.empty):hover { transform: scale(1.12); z-index: 2; }
        .cal-cell.empty { cursor: default; background: transparent; }
        .cal-cell.future { color: var(--t3); background: var(--cell0); opacity: .5; cursor: default; }
        .cal-cell.has-w { color: #fff; }
        .cal-cell.is-today { box-shadow: 0 0 0 2px var(--accent), 0 0 0 4px var(--bg); }
        .cal-cell.selected:not(.is-today) { box-shadow: 0 0 0 2px var(--text), 0 0 0 4px var(--bg); }
        .cdot { position: absolute; bottom: 2px; width: 3px; height: 3px; border-radius: 50%; background: rgba(255,255,255,.7); }

        .heat-leg { display: flex; align-items: center; gap: 5px; margin-top: 14px; font-size: 10.5px; color: var(--t3); }
        .heat-sq { width: 11px; height: 11px; border-radius: 3px; border: 1px solid rgba(0,0,0,.06); }

        .sess-item {
          padding: 11px 0; border-bottom: 1px solid var(--border);
          display: flex; align-items: flex-start; justify-content: space-between; gap: 10px;
        }
        .sess-item:last-child { border-bottom: none; }
        .sess-name { font-size: 13px; font-weight: 500; color: var(--text); margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 170px; }
        .sess-time { font-size: 11px; color: var(--t3); }
        .sess-dur { font-family: 'Fraunces', serif; font-size: 15px; color: var(--text); font-weight: 400; white-space: nowrap; }
        .sess-del { background: none; border: none; cursor: pointer; color: var(--t3); font-size: 15px; padding: 1px 3px; border-radius: 4px; opacity: 0; transition: all .15s; flex-shrink: 0; }
        .sess-item:hover .sess-del { opacity: 1; }
        .sess-del:hover { color: var(--accent); background: var(--asoft); }

        .empty-st { text-align: center; padding: 28px 16px; }
        .empty-ico { font-size: 22px; margin-bottom: 7px; opacity: .5; }
        .empty-txt { font-size: 12.5px; color: var(--t3); }

        .bar-row { display: flex; align-items: center; gap: 8px; margin-bottom: 7px; }
        .bar-lbl { width: 30px; text-align: right; font-size: 11.5px; color: var(--t2); flex-shrink: 0; }
        .bar-lbl-task { width: 100px; text-align: right; font-size: 11.5px; color: var(--t2); flex-shrink: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .bar-trk { flex: 1; height: 5px; background: var(--s2); border-radius: 3px; overflow: hidden; }
        .bar-fill { height: 100%; background: var(--accent); border-radius: 3px; transition: width .5s ease; }
        .bar-dur { width: 50px; font-size: 11px; color: var(--t3); flex-shrink: 0; }

        .scroll { max-height: 260px; overflow-y: auto; scrollbar-width: thin; scrollbar-color: var(--border) transparent; }

        .live-badge { display: inline-flex; align-items: center; gap: 4px; font-size: 10px; font-weight: 600; letter-spacing: .5px; text-transform: uppercase; color: var(--accent); background: var(--asoft); border-radius: 10px; padding: 2px 7px; margin-left: 5px; vertical-align: middle; }

        .chart-grid { display: grid; grid-template-columns: repeat(12, 1fr); gap: 4px; height: 100px; align-items: end; margin-top: 10px; }
        .chart-bar { background: var(--s2); border-radius: 3px 3px 0 0; position: relative; transition: height 0.5s ease, background 0.3s; cursor: pointer; }
        .chart-bar:hover { background: var(--accent); }
        .chart-bar.active { background: var(--accent); }
        .chart-m-lbl { font-size: 9px; color: var(--t3); text-align: center; margin-top: 5px; }

        @media (max-width: 1100px) {
          .main { grid-template-columns: 290px 1fr; }
          .col-r { grid-column: 1/-1; display: grid; grid-template-columns: 1fr 1fr; }
        }
        @media (max-width: 720px) {
          .main { grid-template-columns: 1fr; padding: 16px; }
          .stats-row { grid-template-columns: repeat(2,1fr); }
          .col-l,.col-m,.col-r { grid-column: 1; }
          .col-r { display: flex; }
          .timer-num { font-size: 52px; }
          .hdr-date { display: none; }
        }
      `}</style>

      <div className="app">
        <header className="hdr">
          <div className="logo">
            <div className="logo-icon">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <circle cx="10" cy="10" r="7.5" stroke="white" strokeWidth="1.4"/>
                <line x1="10" y1="3" x2="10" y2="10" stroke="white" strokeWidth="1.4" strokeLinecap="round"/>
                <line x1="10" y1="10" x2="14.5" y2="12.5" stroke="white" strokeWidth="1.4" strokeLinecap="round"/>
                <circle cx="10" cy="10" r="1.2" fill="white"/>
              </svg>
            </div>
            <div>
              <div className="logo-name">Tempo</div>
              <div className="logo-sub">Time Tracker</div>
            </div>
          </div>
          <div className="hdr-date">{dateLabel}</div>
          <div className="hdr-status">
            <div className={`dot ${running && !paused ? "on" : running ? "idle" : ""}`} />
            <span style={{ color: running && !paused ? "var(--green)" : running ? "var(--accent)" : "var(--t2)" }}>
              {running && !paused ? "Tracking" : running ? "Paused" : "Idle"}
            </span>
          </div>
        </header>

        <main className="main">
          <div className="stats-row">
            {[
              { lbl: "Today", val: fmtDur(todayMs), sub: `${todaySessions.length} session${todaySessions.length !== 1 ? "s" : ""}`, hi: true },
              { lbl: "This Week", val: fmtDur(weekMs) === "< 1m" ? "—" : fmtDur(weekMs), sub: "Mon – Sun", hi: false },
              { lbl: MONTHS[calMonth.getMonth()], val: fmtDur(monthMs) === "< 1m" ? "—" : fmtDur(monthMs), sub: `${daysWorked} day${daysWorked !== 1 ? "s" : ""} worked`, hi: false },
              { lbl: "All Sessions", val: String(sessions.length), sub: "logged all time", hi: false },
            ].map((s, i) => (
              <div key={i} className={`scard ${s.hi ? "hi" : ""}`}>
                <div className="scard-lbl">{s.lbl}</div>
                <div className="scard-val">{s.val || "—"}</div>
                <div className="scard-sub">{s.sub}</div>
              </div>
            ))}
          </div>

          <div className="col-l">
            <div className="timer-card">
              <div className={`t-badge ${running && !paused ? "on" : paused ? "pause" : ""}`}>
                {(running) && <div className="t-bdot" />}
                {!running ? "Ready to track" : paused ? "Paused" : "Recording time"}
              </div>
              <div className={`timer-num ${running && !paused ? "on" : paused ? "pause" : ""}`}>
                {fmtHMS(elapsed)}
              </div>
              <input
                list="tasks"
                className="t-input"
                placeholder="What are you working on?"
                value={task}
                onChange={(e) => setTask(e.target.value)}
                disabled={running}
                onKeyDown={(e) => { if (e.key === "Enter" && !running) startTimer(); }}
              />
              <datalist id="tasks">
                {existingTasks.map(t => <option key={t} value={t} />)}
              </datalist>
              <div className="btns">
                {!running ? (
                  <button className="btn btn-p" onClick={startTimer}>
                    <svg width="10" height="11" viewBox="0 0 10 11" fill="currentColor"><path d="M1.5 1.5l7 4-7 4V1.5z"/></svg>
                    Start Timer
                  </button>
                ) : (
                  <>
                    <button className="btn btn-s" onClick={togglePause}>
                      {paused ? (
                        <><svg width="10" height="11" viewBox="0 0 10 11" fill="currentColor"><path d="M1.5 1.5l7 4-7 4V1.5z"/></svg>Resume</>
                      ) : (
                        <><svg width="9" height="11" viewBox="0 0 9 11" fill="currentColor"><rect x="0" y="0" width="3" height="11" rx="1"/><rect x="6" y="0" width="3" height="11" rx="1"/></svg>Pause</>
                      )}
                    </button>
                    <button className="btn btn-d" onClick={stopTimer}>
                      <svg width="9" height="9" viewBox="0 0 9 9" fill="currentColor"><rect width="9" height="9" rx="2"/></svg>
                      Stop
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="card">
              <div className="card-hd">
                <span className="card-ttl">Today's Log</span>
                {todaySessions.length > 0 && <span className="card-meta">{fmtDur(todaySessions.reduce((a, s) => a + s.duration, 0))}</span>}
              </div>
              <div className="card-bd">
                {todaySessions.length === 0 && !running ? (
                  <div className="empty-st">
                    <div className="empty-ico">☕</div>
                    <div className="empty-txt">No sessions yet today.<br />Start the timer above!</div>
                  </div>
                ) : (
                  <div className="scroll">
                    {running && (
                      <div className="sess-item">
                        <div style={{flex:1,minWidth:0}}>
                          <div className="sess-name" style={{color:"var(--accent)"}}>
                            {task || "Work Session"}
                            <span className="live-badge">live</span>
                          </div>
                          <div className="sess-time">{sessionStart?.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})} → now</div>
                        </div>
                        <div className="sess-dur" style={{color:"var(--accent)"}}>{fmtDur(elapsed)}</div>
                      </div>
                    )}
                    {todaySessions.map((s) => (
                      <div key={s.id} className="sess-item">
                        <div style={{flex:1,minWidth:0}}>
                          <div className="sess-name">{s.task}</div>
                          <div className="sess-time">
                            {new Date(s.start).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})} → {new Date(s.end).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}
                          </div>
                        </div>
                        <div style={{display:"flex",alignItems:"center",gap:5}}>
                          <div className="sess-dur">{fmtDur(s.duration)}</div>
                          <button className="sess-del" onClick={() => delSession(s.id)} title="Delete">×</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="col-m">
            <div className="card">
              <div className="card-bd" style={{paddingTop:20}}>
                <div className="cal-nav">
                  <button className="nav-btn" onClick={() => setCalMonth(new Date(yr, mo - 1, 1))}>‹</button>
                  <div>
                    <span className="cal-mname">{MONTHS[mo]}</span>
                    <span className="cal-yr">{yr}</span>
                  </div>
                  <button className="nav-btn" onClick={() => setCalMonth(new Date(yr, mo + 1, 1))}>›</button>
                </div>
                <div className="cal-grid">
                  {DSHORT.map((d, i) => <div key={i} className="cal-dn">{d}</div>)}
                  {Array.from({length: firstDay}, (_, i) => <div key={`e${i}`} className="cal-cell empty" />)}
                  {Array.from({length: daysInMonth}, (_, i) => {
                    const day = i + 1;
                    const ds = `${yr}-${pad(mo + 1)}-${pad(day)}`;
                    const isFuture = ds > todayStr;
                    const isToday = ds === todayStr;
                    const isSel = ds === viewStr;
                    const hasWork = (dayMap[ds] || 0) > 0;
                    return (
                      <div
                        key={day}
                        className={`cal-cell ${isFuture ? "future" : ""} ${hasWork && !isFuture ? "has-w" : ""} ${isToday ? "is-today" : ""} ${isSel && !isToday ? "selected" : ""}`}
                        style={!isFuture ? {background: heatColor(ds)} : {}}
                        onClick={() => !isFuture && setViewDate(new Date(ds + "T12:00:00"))}
                        title={hasWork ? fmtDur(dayMap[ds]) : undefined}
                      >
                        {day}
                        {hasWork && !isFuture && <div className="cdot" />}
                      </div>
                    );
                  })}
                </div>
                <div className="heat-leg">
                  <span>Less</span>
                  {["var(--cell0)","var(--cell1)","var(--cell2)","var(--cell3)","var(--cell4)"].map((c, i) => (
                    <div key={i} className="heat-sq" style={{background: c}} />
                  ))}
                  <span>More</span>
                  <span style={{marginLeft:"auto",fontSize:11,color:"var(--t3)"}}>Click day to inspect</span>
                </div>
              </div>
            </div>

            {/* Monthly Trends - YEAR VIEW */}
            <div className="card">
              <div className="card-hd">
                <span className="card-ttl">Monthly Trends — {yr}</span>
              </div>
              <div className="card-bd">
                <div className="chart-grid">
                  {monthlyTotals.map((dur, i) => (
                    <div key={i} style={{ display: "flex", flexDirection: "column", height: "100%", justifyContent: "flex-end" }}>
                      <div 
                        className={`chart-bar ${i === mo ? "active" : ""}`} 
                        style={{ height: `${(dur / maxMonthBar) * 100}%` }}
                        title={`${MONTHS[i]}: ${fmtDur(dur)}`}
                      />
                      <div className="chart-m-lbl">{MSHORT[i]}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Task Detail breakdown - CURRENT MONTH */}
            <div className="card">
              <div className="card-hd">
                <span className="card-ttl">Tasks — {MSHORT[mo]}</span>
              </div>
              <div className="card-bd">
                {sortedTaskStats.length === 0 ? (
                  <div className="empty-st" style={{padding:"20px 0"}}>
                    <div className="empty-txt">No tasks logged in {MONTHS[mo]} yet</div>
                  </div>
                ) : (
                  sortedTaskStats.map(([t, dur]) => (
                    <div key={t} className="bar-row">
                      <div className="bar-lbl-task" title={t}>{t}</div>
                      <div className="bar-trk">
                        <div className="bar-fill" style={{width: `${(dur / maxTaskBar) * 100}%`}} />
                      </div>
                      <div className="bar-dur">{fmtDur(dur)}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="col-r">
            <div className="card">
              <div className="card-hd">
                <span className="card-ttl">
                  {viewStr === todayStr
                    ? "Today's Sessions"
                    : new Date(viewStr + "T12:00:00").toLocaleDateString("en-US", {month: "short", day: "numeric", year: "numeric"})}
                </span>
                {viewMs > 0 && <span className="card-meta">{fmtDur(viewMs)}</span>}
              </div>
              <div className="card-bd">
                {viewSessions.length === 0 ? (
                  <div className="empty-st">
                    <div className="empty-ico">📋</div>
                    <div className="empty-txt">No sessions on this day.<br/>Select a date on the calendar.</div>
                  </div>
                ) : (
                  <div className="scroll">
                    {viewSessions.map((s) => (
                      <div key={s.id} className="sess-item">
                        <div style={{flex:1,minWidth:0}}>
                          <div className="sess-name">{s.task}</div>
                          <div className="sess-time">
                            {new Date(s.start).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})} → {new Date(s.end).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}
                          </div>
                        </div>
                        <div style={{display:"flex",alignItems:"center",gap:5}}>
                          <div className="sess-dur">{fmtDur(s.duration)}</div>
                          <button className="sess-del" onClick={() => delSession(s.id)} title="Delete">×</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Daily Bars - LAST 10 DAYS of current month */}
            <div className="card">
              <div className="card-hd">
                <span className="card-ttl">Daily Detail — {MSHORT[mo]}</span>
              </div>
              <div className="card-bd">
                {monthBars.length === 0 ? (
                   <div className="empty-st" style={{padding:"20px 0"}}>
                    <div className="empty-txt">No work logged in {MONTHS[mo]} yet</div>
                  </div>
                ) : (
                  monthBars.slice(-10).map(([date, dur]) => (
                    <div key={date} className="bar-row" style={{cursor:"pointer"}} onClick={() => setViewDate(new Date(date + "T12:00:00"))}>
                      <div className="bar-lbl">{parseInt(date.split("-")[2])}</div>
                      <div className="bar-trk">
                        <div className="bar-fill" style={{width: `${(dur / maxBar) * 100}%`}} />
                      </div>
                      <div className="bar-dur">{fmtDur(dur)}</div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="card">
              <div className="card-hd"><span className="card-ttl">Best Days</span></div>
              <div className="card-bd">
                {topDays.length === 0 ? (
                  <div className="empty-st" style={{padding:"18px 0"}}>
                    <div className="empty-txt">Track work to see your best days</div>
                  </div>
                ) : (
                  topDays.map(([date, dur], i) => {
                    const pct = (dur / topDays[0][1]) * 100;
                    return (
                      <div
                        key={date}
                        style={{padding:"9px 0",borderBottom:"1px solid var(--border)",cursor:"pointer"}}
                        onClick={() => setViewDate(new Date(date + "T12:00:00"))}
                      >
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
                          <div style={{display:"flex",alignItems:"center",gap:8}}>
                            <div style={{
                              width:20,height:20,borderRadius:6,background: i===0?"var(--accent)":"var(--s2)",
                              display:"flex",alignItems:"center",justifyContent:"center",
                              fontSize:10,fontWeight:600,color:i===0?"#fff":"var(--t2)",flexShrink:0
                            }}>{i+1}</div>
                            <div>
                              <div style={{fontSize:13,fontWeight:500}}>
                                {new Date(date+"T12:00:00").toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"})}
                              </div>
                              <div style={{fontSize:11,color:"var(--t3)"}}>
                                {sessions.filter(s=>s.date===date).length} sessions
                              </div>
                            </div>
                          </div>
                          <div style={{fontFamily:"'Fraunces',serif",fontSize:16,letterSpacing:-.5}}>{fmtDur(dur)}</div>
                        </div>
                        <div style={{height:3,background:"var(--s2)",borderRadius:2,overflow:"hidden"}}>
                          <div style={{height:"100%",width:`${pct}%`,background:i===0?"var(--accent)":"var(--t3)",borderRadius:2,transition:"width .5s ease"}}/>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
