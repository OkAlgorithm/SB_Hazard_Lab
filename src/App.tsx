import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Compass,
  Eye,
  Film,
  Flag,
  Focus,
  HelpCircle,
  Keyboard,
  Layers3,
  ListChecks,
  Maximize2,
  MousePointer2,
  Move,
  Pause,
  Play,
  RotateCcw,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Timer,
  Volume2,
  VolumeX,
  X,
  TriangleAlert,
  Zap,
  PackageOpen,
  Footprints,
  ClipboardList,
  UserRound,
  LogOut,
  MapPin,
} from "lucide-react";
import content from "./content.json";
import Workshop from "./Workshop";
import LectureArtwork from "./LectureArtwork";
import Episode from "./Episode";
import { learningChecks } from "./learning-checks";
import {
  createAttempt,
  confirmMark,
  calculateResult,
  finishAttempt,
  remainingMilliseconds,
  SCENARIO_VERSION,
  objectLabels,
  evaluateSelection,
  practiceFeedbackFor,
  type PracticeFeedback,
  type Attempt,
  type Category,
  type Selection,
  type Zone,
} from "./assessment";
import type { WorkshopController } from "./workshop";

type Phase = "lecture" | "brief" | "assessment" | "results";
interface Saved {
  phase: Phase;
  chapter: number;
  lectureDone: boolean;
  signedIn: boolean;
  attempt: Attempt | null;
  checks?: Record<string, number>;
}
const STORAGE = "samruk-hazard-lab:1";
const durations = [22, 26, 26, 26, 25, 25, 30];
const shortTitles = [
  "Что искать",
  "Осмотр места",
  "Шаги работы",
  "Наблюдение",
  "Опасное событие",
  "Ложные признаки",
  "Фиксация",
];
const zones: Record<Zone, { name: string; caption: string }> = {
  A: { name: "Проход", caption: "Вход и маршрут движения" },
  B: { name: "Оборудование", caption: "Станки и рабочая зона" },
  C: { name: "Хранение", caption: "Стеллаж и перемещение грузов" },
};
const zoneOf = (id: string): Zone =>
  ["H2", "H4", "D1"].includes(id)
    ? "B"
    : ["H3", "H5", "D2"].includes(id)
      ? "C"
      : "A";
function readSaved(): Saved {
  try {
    const v = JSON.parse(localStorage.getItem(STORAGE) || "null");
    if (
      v &&
      ["lecture", "brief", "assessment", "results"].includes(v.phase) &&
      Number.isInteger(v.chapter) &&
      v.chapter >= 0 &&
      v.chapter < 7 &&
      (!v.attempt ||
        (v.attempt.version === SCENARIO_VERSION &&
          Array.isArray(v.attempt.marks) &&
          Array.isArray(v.attempt.videosSeen) &&
          Number.isFinite(v.attempt.startedAt)))
    )
      return v;
  } catch {
    /* Local progress is optional. */
  }
  return {
    phase: "lecture",
    chapter: 0,
    lectureDone: false,
    signedIn: false,
    attempt: null,
  };
}
function timeLabel(ms: number) {
  const secs = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(secs / 60)
    .toString()
    .padStart(2, "0")}:${(secs % 60).toString().padStart(2, "0")}`;
}
function CategoryIcon({ id, size = 20 }: { id: string; size?: number }) {
  return id === "C1" ? (
    <Footprints size={size} />
  ) : id === "C2" ? (
    <Move size={size} />
  ) : id === "C3" ? (
    <PackageOpen size={size} />
  ) : (
    <Zap size={size} />
  );
}

function Modal({
  title,
  subtitle,
  children,
  onClose,
  wide = false,
  className = "",
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current
      ?.querySelector<HTMLElement>('button,input,select,[tabindex="0"]')
      ?.focus();
    const key = (e: KeyboardEvent) => {
      const dialogs = document.querySelectorAll('[role="dialog"]');
      if (dialogs[dialogs.length - 1] !== ref.current) return;
      if (e.key === "Escape") {
        e.preventDefault();
        close.current();
      }
      if (e.key === "Tab") {
        const els = ref.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),input:not(:disabled),select,[tabindex="0"]',
        );
        if (!els?.length) return;
        const first = els[0],
          last = els[els.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      document.body.style.overflow = previousOverflow;
      previous?.focus?.();
    };
  }, []);
  return (
    <div
      className={"modal-backdrop " + className}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        className={"modal " + (wide ? "wide-modal" : "")}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="modal-heading">
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label="Закрыть"
          >
            <X size={21} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function MiniMap({
  zone,
  onZone,
}: {
  zone: Zone | "all";
  onZone: (zone: Zone | "all") => void;
}) {
  return (
    <div className="mini-map">
      <div className="mini-map-label">
        <Compass size={12} /> ПЛАН ЦЕХА
      </div>
      <svg viewBox="0 0 160 103" aria-label="План цеха с тремя зонами">
        <path
          d="M12 17H148V91H12Z"
          fill="#e1e6d9"
          stroke="#9aa997"
          strokeWidth="2"
        />
        <path
          d="M66 87V26M66 55H137"
          fill="none"
          stroke="#c2d38d"
          strokeWidth="11"
        />
        <rect x="23" y="29" width="29" height="18" rx="2" fill="#9eb4a0" />
        <rect x="23" y="59" width="29" height="18" rx="2" fill="#9eb4a0" />
        <rect x="94" y="26" width="40" height="16" rx="2" fill="#a6b49b" />
        <rect x="102" y="69" width="30" height="13" rx="2" fill="#b5ad8e" />
        {(
          [
            ["A", 67, 76],
            ["B", 38, 52],
            ["C", 115, 53],
          ] as const
        ).map(([id, x, y]) => (
          <g
            key={id}
            className="map-zone"
            onClick={() => onZone(id)}
            role="button"
            tabIndex={0}
            aria-label={`Перейти в зону ${id}: ${zones[id].name}`}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") onZone(id);
            }}
          >
            <circle
              cx={x}
              cy={y}
              r={zone === id ? 12 : 9}
              fill={zone === id ? "#d3ad5b" : "#f4f4e8"}
              stroke={zone === id ? "#577054" : "#a0ad95"}
            />
            <text
              x={x}
              y={y + 3.5}
              textAnchor="middle"
              fontSize="10"
              fontWeight="800"
              fill="#29483b"
            >
              {id === "B" ? "Б" : id === "C" ? "В" : "А"}
            </text>
          </g>
        ))}
      </svg>
      <button onClick={() => onZone("all")}>
        Весь цех <ArrowUpRight size={11} />
      </button>
    </div>
  );
}

function Pad({ controller }: { controller: WorkshopController | null }) {
  const hold = (x: number, z: number) => ({
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      controller?.move(x, z);
    },
    onPointerUp: () => controller?.move(0, 0),
    onPointerCancel: () => controller?.move(0, 0),
    onLostPointerCapture: () => controller?.move(0, 0),
  });
  return (
    <div className="touch-pad" aria-label="Кнопки перемещения">
      <button className="pad-up" aria-label="Вперёд" {...hold(0, 1)}>
        <ChevronDown style={{ transform: "rotate(180deg)" }} size={22} />
      </button>
      <button aria-label="Влево" {...hold(-1, 0)}>
        <ChevronLeft size={22} />
      </button>
      <button aria-label="Назад" {...hold(0, -1)}>
        <ChevronDown size={22} />
      </button>
      <button aria-label="Вправо" {...hold(1, 0)}>
        <ChevronRight size={22} />
      </button>
    </div>
  );
}

export default function App() {
  const [saved] = useState(readSaved);
  const [phase, setPhase] = useState<Phase>(saved.phase),
    [chapter, setChapter] = useState(saved.chapter),
    [lectureDone, setLectureDone] = useState(saved.lectureDone),
    [signedIn, setSignedIn] = useState(saved.signedIn),
    [attempt, setAttempt] = useState<Attempt | null>(saved.attempt);
  const [checkAnswers, setCheckAnswers] = useState<Record<string, number>>(
    saved.checks || {},
  );
  const [checkDialog, setCheckDialog] = useState<string | null>(null);
  const [expandedScene, setExpandedScene] = useState(false);
  const [lectureView, setLectureView] = useState<"2d" | "3d">("2d");
  useEffect(() => setExpandedScene(false), [phase]);
  useEffect(() => {
    if (!expandedScene) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExpandedScene(false);
    };
    window.addEventListener("keydown", close);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", close);
    };
  }, [expandedScene]);
  const [feedback, setFeedback] = useState<PracticeFeedback | null>(null);
  const [playing, setPlaying] = useState(false),
    [lectureElapsed, setLectureElapsed] = useState(0),
    [voice, setVoice] = useState(false),
    [zone, setZone] = useState<Zone | "all">("all"),
    [cameraMode, setCameraMode] = useState<"orbit" | "walk">("walk"),
    [marking, setMarking] = useState(false),
    [ready, setReady] = useState(false),
    [webglError, setWebglError] = useState(false),
    [controller, setController] = useState<WorkshopController | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null),
    [category, setCategory] = useState<Category | null>(null),
    [journal, setJournal] = useState(false),
    [help, setHelp] = useState(false),
    [transcript, setTranscript] = useState(false),
    [finishDialog, setFinishDialog] = useState(false),
    [episode, setEpisode] = useState<"V1" | "V2" | null>(null),
    [reviewId, setReviewId] = useState<string | null>(null),
    [objects, setObjects] = useState(false),
    [toast, setToast] = useState(""),
    [timed, setTimed] = useState(true),
    [now, setNow] = useState(Date.now());
  const sceneBox = useRef<HTMLDivElement>(null);
  const appTop = useRef<HTMLElement>(null);
  const lectureAudio = useRef<HTMLAudioElement>(null);
  const narrationChapter = useRef(chapter);
  const result = attempt ? calculateResult(attempt) : null;
  const remaining = attempt ? remainingMilliseconds(attempt, now) : null;
  const totalElapsed =
    durations.slice(0, chapter).reduce((a, b) => a + b, 0) +
    lectureElapsed / 1000;
  const hasActiveAttempt =
    phase === "assessment" && !!attempt && !attempt.finishedAt;
  const modalOpen =
    !!selection ||
    journal ||
    help ||
    transcript ||
    finishDialog ||
    !!episode ||
    !!feedback ||
    !!checkDialog ||
    objects;

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE,
        JSON.stringify({
          phase,
          chapter,
          lectureDone,
          signedIn,
          attempt,
          checks: checkAnswers,
        }),
      );
    } catch {
      /* Keep the course usable when storage is disabled. */
    }
  }, [phase, chapter, lectureDone, signedIn, attempt, checkAnswers]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 3800);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    setLectureElapsed(0);
  }, [chapter]);
  useEffect(() => {
    if (!playing || phase !== "lecture") return;
    let prev = performance.now();
    const id = setInterval(() => {
      const n = performance.now();
      if (voice) {
        const audio = lectureAudio.current;
        if (audio && audio.readyState >= 2) {
          setLectureElapsed(
            audio.ended
              ? durations[chapter] * 1000
              : Math.min(durations[chapter] * 1000, audio.currentTime * 1000),
          );
        }
      } else {
        setLectureElapsed((t) =>
          Math.min(durations[chapter] * 1000, t + n - prev),
        );
      }
      prev = n;
    }, 100);
    return () => clearInterval(id);
  }, [playing, phase, chapter, voice]);
  useEffect(() => {
    if (!playing || lectureElapsed < durations[chapter] * 1000) return;
    if (chapter < 6) setChapter((c) => c + 1);
    else {
      setPlaying(false);
      setLectureDone(true);
    }
  }, [lectureElapsed, chapter, playing]);
  useEffect(() => {
    const changedChapter = narrationChapter.current !== chapter;
    narrationChapter.current = chapter;
    if (voice && phase === "lecture" && lectureAudio.current) {
      const source = `/audio/lecture/ru-${String(chapter + 1).padStart(2, "0")}.mp3`;
      if (lectureAudio.current.getAttribute("src") !== source)
        lectureAudio.current.src = source;
    }
    if (playing && voice && phase === "lecture") {
      playLectureAudio(chapter, changedChapter ? 0 : lectureElapsed);
    } else lectureAudio.current?.pause();
  }, [playing, voice, chapter, phase]);

  function playLectureAudio(targetChapter = chapter, elapsed = lectureElapsed) {
    const audio = lectureAudio.current;
    if (!audio) return;
    const source = `/audio/lecture/ru-${String(targetChapter + 1).padStart(2, "0")}.mp3`;
    if (audio.getAttribute("src") !== source) audio.src = source;
    const position = Math.min(
      Math.max(0, elapsed / 1000),
      durations[targetChapter] - 0.02,
    );
    if (Math.abs(audio.currentTime - position) > 0.15)
      audio.currentTime = position;
    void audio.play().catch((error: DOMException) => {
      if (error.name === "AbortError") return;
      setVoice(false);
      setToast("Не удалось включить озвучку. Нажмите кнопку звука ещё раз.");
    });
  }
  useEffect(() => {
    if (!hasActiveAttempt || !attempt) return;
    const tick = () => {
      const n = Date.now();
      setNow(n);
      if (attempt.deadline !== null && n >= attempt.deadline) {
        setAttempt((a) => (a ? finishAttempt(a, "timeout", n) : a));
        setPhase("results");
        setEpisode(null);
        setSelection(null);
        setJournal(false);
        setFinishDialog(false);
        setMarking(false);
        setToast(content.assessment.timeout);
      }
    };
    tick();
    const i = setInterval(tick, 250);
    return () => clearInterval(i);
  }, [hasActiveAttempt, attempt?.deadline]);
  useEffect(() => {
    if (phase !== "lecture") setPlaying(false);
    else {
      setCameraMode("walk");
      const lectureViews: (Zone | "all")[] = [
        "all",
        "A",
        "C",
        "C",
        "A",
        "B",
        "all",
      ];
      setZone(lectureViews[chapter]);
    }
    if (phase === "results") window.scrollTo({ top: 0, behavior: "smooth" });
  }, [phase, chapter]);

  function pick(s: Selection) {
    if (phase === "lecture" || phase === "results") return;
    setSelection(s);
    setCategory(
      attempt?.marks.find(
        (m) => m.objectId === s.objectId && m.source === s.source,
      )?.category || null,
    );
    setMarking(false);
  }
  function confirm() {
    if (!selection || !category) return;
    if (phase === "brief") {
      setToast(
        "Отметка подтверждена. В контрольном обходе она появится в журнале.",
      );
    } else if (attempt) {
      const next = confirmMark(attempt, selection, category);
      setFeedback(practiceFeedbackFor(next, evaluateSelection(selection).key));
      setAttempt(
        selection.source === "world" ||
          next.videosSeen.includes(selection.source)
          ? next
          : { ...next, videosSeen: [...next.videosSeen, selection.source] },
      );
      setToast(
        next.marks.length > attempt.marks.length
          ? `Отметка ${next.marks.length.toString().padStart(2, "0")} сохранена в журнале`
          : "Категория отметки обновлена",
      );
    }
    if (selection.source !== "world") setEpisode(null);
    setSelection(null);
    setCategory(null);
  }
  function start() {
    if (!ready && !webglError) return;
    setAttempt(createAttempt(timed));
    setFeedback(null);
    setNow(Date.now());
    setPhase("assessment");
    setMarking(false);
    setZone("A");
    setCameraMode("walk");
  }
  function finish() {
    if (attempt) setAttempt(finishAttempt(attempt));
    setPhase("results");
    setFinishDialog(false);
    setEpisode(null);
    setMarking(false);
    setJournal(false);
    setSelection(null);
    setFeedback(null);
  }
  function goBrief() {
    setPlaying(false);
    setPhase("brief");
    setZone("all");
    setMarking(false);
    setCameraMode("walk");
    setFeedback(null);
  }
  function seenVideo(id: "V1" | "V2") {
    if (hasActiveAttempt)
      setAttempt((a) =>
        a && !a.videosSeen.includes(id)
          ? { ...a, videosSeen: [...a.videosSeen, id] }
          : a,
      );
  }
  function openEpisode(id: "V1" | "V2") {
    setMarking(false);
    setEpisode(id);
  }
  function selectChapter(i: number) {
    setChapter(i);
    setLectureElapsed(0);
    if (voice && playing) playLectureAudio(i, 0);
  }
  function fullScreen() {
    setExpandedScene((value) => !value);
  }
  function navigateStage(i: number) {
    if (hasActiveAttempt && i !== 2) {
      setToast("Завершите текущий обход, чтобы перейти к другому этапу.");
      return;
    }
    setCheckDialog(null);
    if (i === 0) setPhase("lecture");
    if (i === 1) goBrief();
    if (i === 2) {
      if (attempt && !attempt.finishedAt) setPhase("assessment");
      else goBrief();
    }
    if (i === 3) {
      if (attempt?.finishedAt) setPhase("results");
      else setToast("Разбор появится после первого контрольного обхода.");
    }
  }
  function openCheck(id: string) {
    setPlaying(false);
    setCheckDialog(id);
  }
  const chapterCheck = learningChecks.find((c) => c.chapter === chapter);
  const activeCheck = learningChecks.find((c) => c.id === checkDialog);
  const checksComplete = learningChecks.filter(
    (c) => checkAnswers[c.id] === c.correct,
  ).length;

  const activeNav =
    phase === "lecture"
      ? 0
      : phase === "brief"
        ? 1
        : phase === "assessment"
          ? 2
          : 3;
  const selectedRecord = selection
    ? attempt?.marks.find(
        (m) =>
          m.objectId === selection.objectId && m.source === selection.source,
      )
    : undefined;
  const phaseTitles = {
    lecture: "Учимся замечать опасности",
    brief: "Сначала — освоиться",
    assessment:
      attempt?.deadline === null
        ? "Спокойная практика"
        : "Ваш контрольный обход",
    results: "Каждая находка имеет значение",
  };
  return (
    <div className="application">
      <audio ref={lectureAudio} preload="auto" hidden aria-hidden="true" />
      <header className="topbar">
        <a
          href="#"
          className="brand"
          onClick={(e) => {
            e.preventDefault();
            if (!hasActiveAttempt) setPhase("lecture");
          }}
          aria-label="Samruk Academy, к обучению"
        >
          <span className="brand-mark">
            <ShieldCheck size={25} strokeWidth={1.8} />
          </span>
          <span>
            samruk<span className="brand-sub">ACADEMY</span>
          </span>
        </a>
        <div className="header-divider" />
        <span className="header-course">Производственная безопасность</span>
        <div className="topbar-right">
          <span className="module-pill">
            <span className="status-dot" /> Курс 02 · один модуль
          </span>
          <button
            className="icon-button help-header"
            onClick={() => setHelp(true)}
            aria-label="Помощь"
          >
            <HelpCircle size={20} />
          </button>
          {signedIn ? (
            <button
              className="user-button"
              onClick={() => {
                setSignedIn(false);
                setToast(
                  "Демосессия завершена. Прогресс сохранён на этом устройстве.",
                );
              }}
              aria-label="Выйти из демосессии"
            >
              <span className="avatar">У</span>
              <span>Участник</span>
              <LogOut size={14} />
            </button>
          ) : (
            <button
              className="sign-in"
              onClick={() => {
                setSignedIn(true);
                setToast(
                  "Вы вошли в деморежим. Прогресс сохраняется на этом устройстве.",
                );
              }}
            >
              <UserRound size={15} />
              Sign In
            </button>
          )}
        </div>
      </header>
      <div className="app-layout">
        <aside className="course-rail">
          <div className="rail-top">
            <span className="rail-eyebrow">ВАШ МАРШРУТ</span>
            <h2>
              Внимание
              <br />к деталям
            </h2>
            <div className="rail-progress">
              <i style={{ width: `${(activeNav + 1) * 25}%` }} />
            </div>
            <p>Один навык. Один цех.</p>
          </div>
          <nav aria-label="Этапы модуля">
            {[
              {
                name: "Короткая лекция",
                sub: "7 сцен · около 3 минут",
                icon: BookOpen,
              },
              {
                name: "Знакомство с цехом",
                sub: "Управление и маршрут",
                icon: Compass,
              },
              {
                name: "Контрольный обход",
                sub: "6 опасностей · 4 минуты",
                icon: ScanLine,
              },
              {
                name: "Разбор находок",
                sub: "Ваш результат",
                icon: ListChecks,
              },
            ].map((n, i) => (
              <button
                key={n.name}
                className={`rail-step ${activeNav === i ? "active" : ""} ${activeNav > i ? "done" : ""}`}
                onClick={() => navigateStage(i)}
                aria-current={activeNav === i ? "step" : undefined}
              >
                <span className="step-icon">
                  {activeNav > i ? <Check size={17} /> : <n.icon size={18} />}
                </span>
                <span>
                  <b>{n.name}</b>
                  <small>{n.sub}</small>
                </span>
                {activeNav === i && <span className="nav-dot" />}
              </button>
            ))}
          </nav>
          <div className="rail-bottom">
            <div className="rail-badge">
              <Eye size={25} />
            </div>
            <b>«Глаз-алмаз»</b>
            <p>
              Заметьте все опасности
              <br />и точно определите их тип.
            </p>
            <button onClick={() => setHelp(true)}>
              Как получить значок <ArrowUpRight size={13} />
            </button>
          </div>
          <span className="rail-edition">ПРАКТИКА БЕЗОПАСНОСТИ · 2026</span>
        </aside>
        <main ref={appTop} className="main-content">
          <nav className="mobile-stage-nav" aria-label="Маршрут обучения">
            {[
              { label: "Лекция", icon: BookOpen },
              { label: "Знакомство", icon: Compass },
              { label: "Обход", icon: ScanLine },
              { label: "Итоги", icon: ListChecks },
            ].map((item, i) => (
              <button
                key={item.label}
                className={activeNav === i ? "active" : ""}
                onClick={() => navigateStage(i)}
                aria-current={activeNav === i ? "step" : undefined}
              >
                <item.icon size={17} />
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
          <div className="breadcrumb">
            <span>Мои курсы</span>
            <ChevronRight size={12} />
            <span>Выявление опасностей</span>
            <ChevronRight size={12} />
            <b>{["Лекция", "Знакомство", "Обход", "Результат"][activeNav]}</b>
          </div>
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                <span className="eyebrow-line" />
                {
                  [
                    "01 / ОБУЧЕНИЕ",
                    "02 / ПОДГОТОВКА",
                    "03 / ПРАКТИКА",
                    "04 / ОБРАТНАЯ СВЯЗЬ",
                  ][activeNav]
                }
              </div>
              <h1>{phaseTitles[phase]}</h1>
              <p>
                {phase === "lecture"
                  ? "Осмотрите рабочее место. Поймите, что может причинить вред. Научитесь видеть больше."
                  : phase === "brief"
                    ? "Исследуйте цех без таймера. Затем начните самостоятельный обход."
                    : phase === "assessment"
                      ? "Осмотрите три зоны, посмотрите два эпизода и зафиксируйте конкретные признаки."
                      : "Посмотрите, что удалось заметить и на что обратить внимание при следующем обходе."}
              </p>
            </div>
            {phase === "lecture" ? (
              <div className="heading-duration">
                <Clock3 size={18} />
                <span>
                  <b>3 минуты</b>
                  <small>теории в действии</small>
                </span>
              </div>
            ) : phase === "assessment" ? (
              <div
                className={
                  "assessment-timer " +
                  (remaining !== null && remaining < 60_000 ? "urgent" : "")
                }
              >
                <Timer size={22} />
                <span>
                  <small>
                    {remaining === null ? "БЕЗ ЛИМИТА" : "ОСТАЛОСЬ"}
                  </small>
                  <b>{remaining === null ? "∞" : timeLabel(remaining)}</b>
                </span>
              </div>
            ) : phase === "results" ? (
              <span className="completion-pill">
                <CheckCheck size={17} /> Обход завершён
              </span>
            ) : (
              <span className="completion-pill">
                <MousePointer2 size={17} /> Без оценивания
              </span>
            )}
          </div>

          {phase !== "results" && (
            <>
              {phase === "brief" && (
                <section className="preparation-intro" aria-labelledby="preparation-title">
                  <div>
                    <span className="card-eyebrow">ПЕРЕД НАЧАЛОМ</span>
                    <h2 id="preparation-title">Осмотритесь. Выберите свой темп.</h2>
                    <p>
                      Обход охватывает три зоны одного цеха. Найдите 4 опасности
                      в сцене и ещё 2 в коротких эпизодах.
                    </p>
                  </div>
                  <div className="brief-checks">
                    <span><Check size={16} /> Перемещение не оценивается</span>
                    <span><Check size={16} /> Отметка требует подтверждения</span>
                    <span><Check size={16} />{timed ? "Разбор — после завершения" : "Объяснения — после каждой отметки"}</span>
                  </div>
                </section>
              )}
              <div
                className={
                  "learning-grid " +
                  (phase === "assessment" ? "assessment-grid" : phase === "brief" ? "preparation-grid" : "")
                }
              >
                <section
                  className={
                    "scene-card" + (phase === "lecture" && lectureView === "2d" ? " scene-2d" : "") + (expandedScene ? " scene-expanded" : "")
                  }
                  aria-label="Учебный цех"
                >
                  <div className="scene-topbar">
                    <span>
                      <span className="live-dot" /> Учебный цех{" "}
                      <span className="scene-topbar-dim">/ участок № 03</span>
                    </span>
                    <div>
                      {phase === "lecture" ? (
                        <div className="lecture-view-switch" role="group" aria-label="Вид лекции">
                          <button aria-pressed={lectureView === "2d"} onClick={() => setLectureView("2d")}>2D</button>
                          <button aria-pressed={lectureView === "3d"} onClick={() => setLectureView("3d")}>3D</button>
                        </div>
                      ) : <span className="scene-3d">3D</span>}
                      <button
                        className="icon-button"
                        aria-label={
                          expandedScene ? "Уменьшить сцену" : "Увеличить сцену"
                        }
                        aria-pressed={expandedScene}
                        onClick={fullScreen}
                      >
                        <Maximize2 size={16} />
                      </button>
                    </div>
                  </div>
                  <div className="scene-viewport" ref={sceneBox}>
                    {phase === "lecture" && lectureView === "2d" ? (
                      <LectureArtwork key={chapter} chapter={chapter} />
                    ) : <>
                    <Workshop
                      variant={phase === "lecture" ? "lecture" : "assessment"}
                      chapter={chapter}
                      lecturePlaying={playing}
                      zone={zone}
                      cameraMode={cameraMode}
                      marking={marking}
                      marks={phase === "assessment" ? attempt?.marks || [] : []}
                      paused={modalOpen}
                      onSelect={pick}
                      onReady={setReady}
                      onError={() => {
                        setWebglError(true);
                        setReady(false);
                      }}
                      onController={setController}
                    />
                    {!ready && !webglError && (
                      <div className="scene-loading">
                        <span className="loading-orbit" /> Подготавливаем цех…
                      </div>
                    )}
                    {webglError && (
                      <div className="scene-loading">
                        <Layers3 size={35} />
                        <b>3D пока недоступно</b>
                        <span>
                          Для осмотра используйте список объектов или откройте
                          курс в браузере с аппаратным ускорением.
                        </span>
                        <button
                          className="button primary"
                          onClick={() => setObjects(true)}
                        >
                          Открыть объекты
                        </button>
                      </div>
                    )}
                    <div className="scene-overlay-heading">
                      <span className="scene-location">
                        <MapPin size={13} />
                        {zone === "all"
                          ? cameraMode === "walk"
                            ? "Вход в цех"
                            : "Общий план"
                          : `Зона ${zone === "A" ? "А" : zone === "B" ? "Б" : "В"} · ${zones[zone].name}`}
                      </span>
                      {phase === "lecture" && (
                        <span className="lesson-view-label">
                          Сцена {chapter + 1} из 7
                        </span>
                      )}
                    </div>
                    <MiniMap zone={zone} onZone={setZone} />
                    {marking && (
                      <div className="marking-banner">
                        <ScanLine size={17} />
                        {phase === "brief"
                          ? "Попробуйте выбрать объект — это тренировка"
                          : "Выберите объект или место, которое хотите отметить"}
                        <button
                          onClick={() => setMarking(false)}
                          aria-label="Отменить режим отметки"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    )}
                    <div className="scene-bottom-hint">
                      <span className="drag-icon">
                        <MousePointer2 size={14} />
                      </span>
                      <span>
                        {cameraMode === "walk"
                          ? "WASD — движение · потяните, чтобы осмотреться"
                          : "Потяните, чтобы осмотреться · колесо — масштаб"}
                      </span>
                    </div>
                    {phase !== "lecture" && <Pad controller={controller} />}
                    <span className="scene-caption">
                      ИНТЕРАКТИВНАЯ УЧЕБНАЯ СРЕДА
                    </span>
                    </>}
                  </div>
                  {phase === "lecture" ? (
                    <div className="lecture-player">
                      <button
                        className="round-button"
                        onClick={() => {
                          const replay =
                            chapter === 6 && lectureElapsed >= 30_000;
                          if (replay) {
                            setChapter(0);
                            setLectureElapsed(0);
                          }
                          if (!playing && voice)
                            playLectureAudio(
                              replay ? 0 : chapter,
                              replay ? 0 : lectureElapsed,
                            );
                          else lectureAudio.current?.pause();
                          setPlaying(!playing);
                        }}
                        disabled={!playing && lectureView === "3d" && !ready && !webglError}
                        aria-label={
                          playing ? "Пауза лекции" : "Воспроизвести лекцию"
                        }
                      >
                        {playing ? <Pause size={18} /> : <Play size={18} />}
                      </button>
                      <div className="lecture-progress">
                        <div className="progress-track">
                          <span
                            style={{ width: `${(totalElapsed / 180) * 100}%` }}
                          />
                        </div>
                        <div>
                          <span>
                            {timeLabel(totalElapsed * 1000)}{" "}
                            <span className="muted">/ 03:00</span>
                          </span>
                          <span>
                            {playing ? "Лекция идёт" : "В своём темпе"}
                          </span>
                        </div>
                      </div>
                      <button
                        className={"icon-button " + (voice ? "selected" : "")}
                        onClick={() => {
                          if (!voice && playing) playLectureAudio();
                          else lectureAudio.current?.pause();
                          setVoice(!voice);
                          setToast(
                            !voice
                              ? "Включена русская озвучка лектора."
                              : "Озвучка выключена.",
                          );
                        }}
                        aria-label={
                          voice ? "Выключить озвучку" : "Включить озвучку"
                        }
                      >
                        {voice ? <Volume2 size={19} /> : <VolumeX size={19} />}
                      </button>
                      <button
                        className="transcript-button"
                        onClick={() => setTranscript(true)}
                      >
                        <ClipboardList size={16} />
                        <span>Текст</span>
                      </button>
                    </div>
                  ) : (
                    <div className="scene-tools">
                      <button
                        className={
                          "button " + (marking ? "mark-active" : "primary")
                        }
                        onClick={() => setMarking(!marking)}
                        disabled={!ready && !webglError}
                      >
                        <ScanLine size={17} />
                        {marking
                          ? "Отменить отметку"
                          : phase === "brief"
                            ? "Попробовать отметку"
                            : "Отметить опасность"}
                      </button>
                      <div className="scene-tools-right">
                        <button
                          className={
                            "icon-button " +
                            (cameraMode === "walk" ? "selected" : "")
                          }
                          onClick={() =>
                            setCameraMode(
                              cameraMode === "walk" ? "orbit" : "walk",
                            )
                          }
                          aria-label={
                            cameraMode === "walk"
                              ? "Переключить на общий вид"
                              : "Включить вид от первого лица"
                          }
                          title={
                            cameraMode === "walk"
                              ? "Общий вид"
                              : "От первого лица"
                          }
                        >
                          <Eye size={18} />
                        </button>
                        <button
                          className="icon-button"
                          onClick={() => {
                            setZone("all");
                            controller?.setZone("all");
                          }}
                          aria-label="Вернуть общий план"
                        >
                          <Focus size={18} />
                        </button>
                        <button
                          className="icon-button"
                          onClick={() => setHelp(true)}
                          aria-label="Управление"
                        >
                          <Keyboard size={18} />
                        </button>
                        <button
                          className="icon-button"
                          onClick={() => setObjects(true)}
                          aria-label="Текстовый обзор объектов"
                        >
                          <Layers3 size={18} />
                        </button>
                      </div>
                    </div>
                  )}
                </section>

                {phase === "lecture" ? (
                  <aside className="lecturer-card">
                    <div className="lecturer-portrait">
                      <div className="portrait-circle" />
                      <div className="portrait-ring" />
                      <img
                        src="/assets/instructor.png"
                        alt="Цифровой лектор по производственной безопасности"
                      />
                      <span className="portrait-tag">
                        <Sparkles size={12} /> Ваш цифровой лектор
                      </span>
                      <div className="portrait-number">
                        0{chapter + 1}
                        <span>/ 07</span>
                      </div>
                    </div>
                    <div className="lecturer-message">
                      <div className="message-label">
                        <span className="status-dot" /> {shortTitles[chapter]}
                      </div>
                      <h2>{content.lecture[chapter].title}</h2>
                      <p key={chapter} className="lecture-voice">
                        {content.lecture[chapter].voice}
                      </p>
                      <div className="key-thought">
                        <span>ЗАПОМНИТЕ</span>
                        <p>{content.lecture[chapter].bubble}</p>
                      </div>
                      {(chapterCheck || chapter === 6) && (
                        <button
                          className="knowledge-check-launch"
                          onClick={() =>
                            openCheck(
                              chapterCheck?.id ||
                                learningChecks.find(
                                  (c) => checkAnswers[c.id] !== c.correct,
                                )?.id ||
                                learningChecks[0].id,
                            )
                          }
                        >
                          <Sparkles size={16} />
                          <span>
                            {chapterCheck
                              ? "Проверить наблюдение"
                              : "Повторить мини-проверки"}
                            <small>
                              {checksComplete} из 3 пройдено · без оценивания
                            </small>
                          </span>
                          <ArrowUpRight size={15} />
                        </button>
                      )}
                    </div>
                    <div className="lecturer-nav">
                      <button
                        className="icon-button"
                        disabled={chapter === 0}
                        aria-label="Предыдущая сцена"
                        onClick={() => selectChapter(chapter - 1)}
                      >
                        <ArrowLeft size={19} />
                      </button>
                      <span>Сцена {chapter + 1} из 7</span>
                      <button
                        className="button primary small-button"
                        onClick={() => {
                          if (chapter < 6) selectChapter(chapter + 1);
                          else {
                            setLectureDone(true);
                            goBrief();
                          }
                        }}
                      >
                        {chapter < 6 ? "Далее" : "К практике"}
                        <ArrowRight size={16} />
                      </button>
                    </div>
                  </aside>
                ) : phase === "brief" ? null : (
                  <aside className="inspection-sidebar">
                    <div className="findings-summary">
                      <div className="summary-heading">
                        <span className="card-eyebrow">ВАШИ НАХОДКИ</span>
                        <span className="summary-icon">
                          <ScanLine size={18} />
                        </span>
                      </div>
                      <div className="findings-number">
                        <b>{result?.found || 0}</b>
                        <span>из 6 опасностей</span>
                      </div>
                      <div className="six-progress">
                        {Array.from({ length: 6 }, (_, i) => (
                          <i
                            className={i < (result?.found || 0) ? "filled" : ""}
                            key={i}
                          />
                        ))}
                      </div>
                      <span className="tiny muted">
                        {remaining === null
                          ? "После каждой отметки — объяснение и подходящий тип."
                          : "Типы опасностей проверим в разборе."}
                      </span>
                    </div>
                    <div className="zones-block">
                      <span className="card-eyebrow">МАРШРУТ ОСМОТРА</span>
                      <div className="zone-list">
                        {(["A", "B", "C"] as Zone[]).map((id) => (
                          <button
                            key={id}
                            className={
                              "zone-button " + (zone === id ? "active" : "")
                            }
                            onClick={() => setZone(id)}
                          >
                            <span>
                              {id === "A" ? "А" : id === "B" ? "Б" : "В"}
                            </span>
                            <div>
                              <b>{zones[id].name}</b>
                              <small>{zones[id].caption}</small>
                            </div>
                            <ChevronRight size={15} />
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="episodes-block">
                      <div className="block-heading">
                        <span className="card-eyebrow">
                          НАБЛЮДЕНИЕ ЗА РАБОТОЙ
                        </span>
                        <span className="tiny muted">
                          {attempt?.videosSeen.length || 0} / 2
                        </span>
                      </div>
                      {(["V1", "V2"] as const).map((id, i) => (
                        <button
                          className="episode-tile"
                          onClick={() => openEpisode(id)}
                          key={id}
                        >
                          <span className={"episode-thumbnail thumbnail-" + i}>
                            <span className="mini-trolley" />
                            <Play size={15} />
                          </span>
                          <span>
                            <b>
                              {i === 0
                                ? "Перемещение детали"
                                : "Выезд из-за стеллажа"}
                            </b>
                            <small>Эпизод 0{i + 1} · 12 секунд</small>
                          </span>
                          {attempt?.videosSeen.includes(id) ? (
                            <Check size={16} />
                          ) : (
                            <ChevronRight size={15} />
                          )}
                        </button>
                      ))}
                    </div>
                    <div className="journal-block">
                      <button
                        className="journal-button"
                        onClick={() => setJournal(true)}
                      >
                        <ClipboardList size={19} />
                        <span>Журнал обхода</span>
                        <b>{attempt?.marks.length || 0}</b>
                        <ArrowUpRight size={15} />
                      </button>
                      <button
                        className="button finish-button"
                        onClick={() => setFinishDialog(true)}
                      >
                        <Flag size={15} />
                        Завершить обход
                        <ArrowRight size={15} />
                      </button>
                    </div>
                  </aside>
                )}
              </div>

              {phase === "brief" && (
                <section className="brief-start-panel" aria-label="Режим обхода">
                    <div className="mode-options">
                      <button
                        className={timed ? "mode-option active" : "mode-option"}
                        onClick={() => setTimed(true)}
                      >
                        <span className="radio-dot" />
                        <span>
                          <b>Контрольный обход</b>
                          <small>4 минуты · значок «Глаз-алмаз»</small>
                        </span>
                        <Timer size={17} />
                      </button>
                      <button
                        className={
                          !timed ? "mode-option active" : "mode-option"
                        }
                        onClick={() => setTimed(false)}
                      >
                        <span className="radio-dot" />
                        <span>
                          <b>Спокойная практика</b>
                          <small>Без лимита · с объяснениями</small>
                        </span>
                        <Compass size={17} />
                      </button>
                    </div>
                    <button
                      className="button primary start-button"
                      disabled={!ready && !webglError}
                      onClick={start}
                    >
                      {timed ? "Начать контрольный обход" : "Начать практику"}
                      <ArrowRight size={18} />
                    </button>
                    <span className="tiny muted">
                      {timed
                        ? "Таймер начнётся после нажатия кнопки."
                        : "Исследуйте цех столько, сколько нужно."}
                    </span>
                </section>
              )}

              {phase === "lecture" ? (
                <>
                  <div className="chapter-strip">
                    {shortTitles.map((name, i) => (
                      <button
                        key={name}
                        className={
                          chapter === i
                            ? "active"
                            : chapter > i || lectureDone
                              ? "visited"
                              : ""
                        }
                        onClick={() => selectChapter(i)}
                      >
                        <span>
                          {chapter > i || lectureDone ? (
                            <Check size={12} />
                          ) : (
                            String(i + 1).padStart(2, "0")
                          )}
                        </span>
                        <b>{name}</b>
                      </button>
                    ))}
                  </div>
                  <div className="learning-footer">
                    <div>
                      <span className="footer-icon">
                        <Eye size={21} />
                      </span>
                      <p>
                        <b>Опасность начинается раньше происшествия.</b>
                        <span>Сначала наблюдайте. Затем делайте вывод.</span>
                      </p>
                    </div>
                    <button className="text-button" onClick={goBrief}>
                      Перейти к знакомству с цехом <ArrowRight size={16} />
                    </button>
                  </div>
                </>
              ) : phase === "brief" ? (
                <div className="control-cards">
                  <div>
                    <span className="control-key">
                      <MousePointer2 size={22} />
                    </span>
                    <b>Осматривайтесь</b>
                    <p>
                      Потяните сцену мышью или пальцем. В общем виде колесо
                      меняет масштаб.
                    </p>
                  </div>
                  <div>
                    <span className="control-key">
                      <Keyboard size={24} />
                    </span>
                    <b>Перемещайтесь</b>
                    <p>
                      Выберите зону на плане. WASD и экранные стрелки — для
                      свободного движения.
                    </p>
                  </div>
                  <div>
                    <span className="control-key">
                      <ScanLine size={23} />
                    </span>
                    <b>Фиксируйте</b>
                    <p>
                      Нажмите «Отметить», выберите место и категорию, затем
                      подтвердите.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="inspection-bottom">
                  <span>
                    <ShieldCheck size={17} /> Наблюдайте с безопасной дистанции.
                    Для проверки не нужно касаться оборудования.
                  </span>
                  <span>
                    <span className="status-dot" /> Прогресс сохраняется на
                    устройстве
                  </span>
                </div>
              )}
            </>
          )}

          {phase === "results" && attempt && result && (
            <div className="results-layout">
              <div className="results-main">
                <div className="result-intro">
                  <div
                    className={
                      "result-emblem " + (result.badge ? "earned" : "")
                    }
                  >
                    <Eye size={40} />
                  </div>
                  <div>
                    <span className="card-eyebrow">
                      {result.badge
                        ? "ЗНАЧОК ПОЛУЧЕН"
                        : attempt.deadline === null
                          ? "СПОКОЙНАЯ ПРАКТИКА"
                          : "КОНТРОЛЬНЫЙ ОБХОД"}
                    </span>
                    <h2>
                      {result.badge
                        ? "«Глаз-алмаз» — ваш"
                        : result.found === 6
                          ? "Все опасности замечены"
                          : "Хороший обход начинается с внимания"}
                    </h2>
                    <p>
                      {result.badge
                        ? "Все шесть опасностей найдены и классифицированы верно. Ложных отметок нет."
                        : attempt.reason === "timeout"
                          ? "Время вышло. Подтверждённые отметки сохранены; теперь можно спокойно разобрать результат."
                          : "Ниже — все предусмотренные опасности, ваши решения и объяснения."}
                    </p>
                  </div>
                </div>
                <div className="result-list-title">
                  <h3>Разбор шести опасностей</h3>
                  <span>{result.found} / 6 обнаружено</span>
                </div>
                <div className="review-list">
                  {content.hazards.map((h, i) => {
                    const mark = attempt.marks.find((m) => m.hazardId === h.id);
                    const correct = mark?.category === h.category;
                    return (
                      <article
                        className={
                          "review-card " + (mark ? "was-found" : "was-missed")
                        }
                        key={h.id}
                      >
                        <div className="review-order">
                          {String(i + 1).padStart(2, "0")}
                        </div>
                        <div className="review-card-content">
                          <div className="review-card-top">
                            <span className="tiny muted">{h.zone}</span>
                            <span
                              className={
                                "review-status " + (mark ? "found" : "missed")
                              }
                            >
                              {mark ? (
                                <>
                                  <Check size={12} />
                                  Найдено
                                </>
                              ) : (
                                <>
                                  <Focus size={12} />
                                  Пропущено
                                </>
                              )}
                            </span>
                          </div>
                          <h3>{h.title}</h3>
                          <p>{h.feedback}</p>
                          <div className="review-category">
                            <CategoryIcon id={h.category} size={15} />
                            <b>
                              {
                                content.categories.find(
                                  (c) => c.id === h.category,
                                )?.title
                              }
                            </b>
                            {mark && (
                              <span>
                                {correct
                                  ? "Категория верна"
                                  : `Вы выбрали: ${content.categories.find((c) => c.id === mark.category)?.title}`}
                              </span>
                            )}
                          </div>
                          <button
                            className="text-button small"
                            onClick={() => {
                              if (i > 3) openEpisode(i === 4 ? "V1" : "V2");
                              else setReviewId(h.id);
                            }}
                          >
                            {i > 3
                              ? "Пересмотреть эпизод"
                              : "Рассмотреть в цехе"}
                            <ArrowUpRight size={13} />
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
                {result.falseCount > 0 && (
                  <div className="false-review">
                    <h3>
                      <TriangleAlert size={19} /> Ложные отметки:{" "}
                      {result.falseCount}
                    </h3>
                    {result.marks
                      .filter((m) => !m.hazardId)
                      .map((m) => (
                        <div key={m.key}>
                          <b>
                            {m.label}
                            {m.time !== undefined
                              ? ` · ${m.time.toFixed(1)} с`
                              : ""}
                          </b>
                          <p>
                            {content.distractors.find(
                              (d) => d.id === m.objectId,
                            )?.feedback ||
                              (m.source !== "world"
                                ? "В выбранном месте и моменте не зафиксирован предусмотренный признак опасности. Посмотрите разбор эпизода."
                                : "Для этой отметки в учебной сцене нет предусмотренного наблюдаемого признака опасности.")}
                          </p>
                        </div>
                      ))}
                  </div>
                )}
              </div>
              <aside className="result-score-card">
                <span className="card-eyebrow">РЕЗУЛЬТАТ ОБХОДА</span>
                <div className="big-score">
                  {result.score}
                  <span>/ 90</span>
                </div>
                <div className="score-meter">
                  <span style={{ width: `${(result.score / 90) * 100}%` }} />
                </div>
                <div className="score-breakdown">
                  <div>
                    <span>Опасности найдены</span>
                    <b>{result.found} / 6</b>
                  </div>
                  <div>
                    <span>Категории верны</span>
                    <b>{result.correct} / 6</b>
                  </div>
                  <div>
                    <span>Ложные отметки</span>
                    <b>{result.falseCount}</b>
                  </div>
                  <div>
                    <span>Время обхода</span>
                    <b>
                      {timeLabel(
                        (attempt.finishedAt || now) - attempt.startedAt,
                      )}
                    </b>
                  </div>
                </div>
                <div className="score-formula">
                  <span>Как считаем</span>
                  <p>
                    +10 за находку · +5 за верный тип
                    <br />
                    −5 за ложную отметку
                  </p>
                </div>
                <div className="badge-note">
                  <Eye size={21} />
                  <p>
                    {result.badge
                      ? "Значок «Глаз-алмаз» получен."
                      : attempt.deadline === null
                        ? "Для значка пройдите контрольный обход с таймером."
                        : "Для значка: 6 находок, 6 верных категорий и ни одной ложной отметки за 4 минуты."}
                  </p>
                </div>
                <button
                  className="button primary start-button"
                  onClick={goBrief}
                >
                  <RotateCcw size={16} />
                  Повторить обход
                </button>
                <button
                  className="button secondary start-button"
                  onClick={() => {
                    setPhase("lecture");
                    setChapter(0);
                    setZone("all");
                  }}
                >
                  Вернуться к лекции
                  <BookOpen size={16} />
                </button>
                <p className="tiny muted">
                  Результат учебного упражнения.
                  <br />
                  Сохранён на этом устройстве.
                </p>
              </aside>
            </div>
          )}
          <footer className="page-footer">
            <span>
              samruk academy <span>·</span> Практика безопасной работы
            </span>
            <span>
              Учебный прототип <span>·</span> Курс 02
            </span>
          </footer>
        </main>
      </div>

      {phase === "assessment" && (
        <div className="mobile-attempt-bar" hidden={modalOpen}>
          <div>
            <small>{remaining === null ? "БЕЗ ЛИМИТА" : "ОСТАЛОСЬ"}</small>
            <b>{remaining === null ? "∞" : timeLabel(remaining)}</b>
          </div>
          <span className="mobile-findings">
            <Eye size={15} />
            {result?.found || 0}/6
          </span>
          <button
            className={"button " + (marking ? "mark-active" : "primary")}
            onClick={() => {
              setMarking(!marking);
              sceneBox.current?.scrollIntoView({
                behavior: "smooth",
                block: "center",
              });
            }}
          >
            <ScanLine size={17} />
            {marking ? "Отмена" : "Отметить"}
          </button>
          <button
            className="icon-button"
            aria-label="Открыть журнал"
            onClick={() => setJournal(true)}
          >
            <ClipboardList size={21} />
          </button>
          <button
            className="icon-button"
            aria-label="Завершить текущий обход"
            onClick={() => setFinishDialog(true)}
          >
            <Flag size={19} />
          </button>
        </div>
      )}
      {activeCheck && (
        <Modal
          title="Проверим наблюдение"
          subtitle={`Мини-проверка ${learningChecks.indexOf(activeCheck) + 1} из 3 · можно пробовать снова`}
          onClose={() => setCheckDialog(null)}
        >
          <div className="knowledge-question">
            <span className="card-eyebrow">ПОДУМАЙТЕ КАК НАБЛЮДАТЕЛЬ</span>
            <h3>{activeCheck.question}</h3>
          </div>
          <div className="knowledge-options">
            {activeCheck.choices.map((answer, i) => (
              <button
                key={answer}
                className={
                  (checkAnswers[activeCheck.id] === i ? "selected " : "") +
                  (checkAnswers[activeCheck.id] === i &&
                  i === activeCheck.correct
                    ? "correct"
                    : "")
                }
                onClick={() =>
                  setCheckAnswers((a) => ({ ...a, [activeCheck.id]: i }))
                }
              >
                <span>{["А", "Б", "В"][i]}</span>
                <b>{answer}</b>
                {checkAnswers[activeCheck.id] === i &&
                  i === activeCheck.correct && <Check size={18} />}
              </button>
            ))}
          </div>
          {checkAnswers[activeCheck.id] !== undefined && (
            <div
              className={
                "knowledge-explanation " +
                (checkAnswers[activeCheck.id] === activeCheck.correct
                  ? "correct"
                  : "retry")
              }
              role="status"
            >
              <b>
                {checkAnswers[activeCheck.id] === activeCheck.correct
                  ? "Верно. Основание — наблюдаемый факт."
                  : "Посмотрите на основание вывода ещё раз."}
              </b>
              <p>{activeCheck.explanation}</p>
            </div>
          )}
          <button
            className="button primary modal-full-button"
            onClick={() => setCheckDialog(null)}
          >
            Продолжить лекцию
            <ArrowRight size={17} />
          </button>
        </Modal>
      )}
      {feedback && (
        <Modal
          title={feedback.title}
          subtitle="Спокойная практика · объяснение вашей отметки"
          className="practice-feedback-modal"
          onClose={() => setFeedback(null)}
        >
          <div className={"practice-feedback-icon " + feedback.kind}>
            {feedback.kind === "correct" ? (
              <CheckCheck size={30} />
            ) : feedback.kind === "category" ? (
              <Layers3 size={30} />
            ) : (
              <Focus size={30} />
            )}
          </div>
          <h3 className="practice-object-name">{feedback.mark.label}</h3>
          <p className="practice-explanation">{feedback.body}</p>
          {feedback.category && (
            <div className="practice-correct-category">
              <CategoryIcon id={feedback.category} size={20} />
              <span>
                <small>ПОДХОДЯЩИЙ ТИП</small>
                <b>
                  {
                    content.categories.find((c) => c.id === feedback.category)
                      ?.title
                  }
                </b>
              </span>
            </div>
          )}
          <div className="practice-feedback-footer">
            <span>
              Ваш счёт: <b>{result?.score || 0} / 90</b>
            </span>
            <span>В практике объясняем сразу.</span>
          </div>
          <div className="modal-actions">
            {feedback.kind === "category" && (
              <button
                className="button secondary"
                onClick={() => {
                  setSelection(feedback.mark);
                  setCategory(feedback.mark.category);
                  setFeedback(null);
                }}
              >
                Уточнить тип
              </button>
            )}
            <button
              className="button primary"
              onClick={() => setFeedback(null)}
            >
              Продолжить осмотр
              <ArrowRight size={17} />
            </button>
          </div>
        </Modal>
      )}
      {help && (
        <Modal
          title="Как устроен обход"
          subtitle="Наблюдайте, отмечайте и проверяйте себя."
          onClose={() => setHelp(false)}
        >
          <div className="help-content">
            <div className="help-row">
              <MousePointer2 />
              <div>
                <b>Осмотр и перемещение</b>
                <p>
                  Потяните сцену для поворота камеры. Используйте колесо для
                  масштаба, WASD или экранные стрелки для движения. Кнопки зон и
                  план цеха переносят к нужному участку. Значок глаза включает
                  вид от первого лица.
                </p>
              </div>
            </div>
            <div className="help-row">
              <ScanLine />
              <div>
                <b>Отметки</b>
                <p>
                  Включите «Отметить», выберите объект или место, укажите тип и
                  подтвердите. До подтверждения можно отменить. Повторная
                  отметка того же объекта обновляет категорию и не добавляет
                  баллов.
                </p>
              </div>
            </div>
            <div className="help-row">
              <Film />
              <div>
                <b>Эпизоды</b>
                <p>
                  Два события разворачиваются в движении. Остановите нужный
                  момент и выберите область, где наблюдаете опасность. Основной
                  таймер в контрольном обходе продолжает идти.
                </p>
              </div>
            </div>
            <div className="help-row">
              <Eye />
              <div>
                <b>«Глаз-алмаз»</b>
                <p>
                  Найдите все шесть опасностей, верно выберите их типы и не
                  сделайте ложных отметок за четырёхминутный обход. Для
                  спокойной тренировки есть режим без лимита.
                </p>
              </div>
            </div>
            <div className="help-note">
              Кнопка Sign In открывает демосессию. Учебный прогресс сохраняется
              только в этом браузере. Полная расшифровка лекции доступна по
              кнопке «Текст».
            </div>
          </div>
          <button
            className="button primary modal-full-button"
            onClick={() => setHelp(false)}
          >
            Понятно
            <Check size={17} />
          </button>
        </Modal>
      )}
      {transcript && (
        <Modal
          title="Текст короткой лекции"
          subtitle="Выявление опасностей на рабочем месте · 7 сцен"
          wide
          onClose={() => setTranscript(false)}
        >
          <div className="transcript-content">
            {content.lecture.map((l, i) => (
              <article key={l.id}>
                <span>{l.time}</span>
                <h3>
                  {i + 1}. {l.title}
                </h3>
                <p>{l.voice}</p>
              </article>
            ))}
          </div>
        </Modal>
      )}
      {journal && (
        <Modal
          title="Журнал обхода"
          subtitle={`${attempt?.marks.length || 0} подтверждённых отметок. Проверка и объяснения появятся после завершения.`}
          onClose={() => setJournal(false)}
        >
          <div className="journal-entries">
            {!attempt?.marks.length ? (
              <div className="empty-journal">
                <ClipboardList size={35} />
                <h3>Здесь будут ваши наблюдения</h3>
                <p>
                  Включите «Отметить» в цехе или остановите эпизод, выберите
                  место и подтвердите категорию.
                </p>
              </div>
            ) : (
              attempt.marks.map((m, i) => (
                <div className="journal-entry" key={m.key}>
                  <span className="journal-entry-number">{i + 1}</span>
                  <div>
                    <b>{m.label}</b>
                    <small>
                      {m.source === "world"
                        ? `Зона ${zoneOf(m.objectId) === "A" ? "А" : zoneOf(m.objectId) === "B" ? "Б" : "В"}`
                        : `Эпизод ${m.source === "V1" ? "01" : "02"} · ${m.time?.toFixed(1)} с`}
                    </small>
                    <span className="journal-category">
                      {
                        content.categories.find((c) => c.id === m.category)
                          ?.title
                      }
                    </span>
                  </div>
                  <button
                    className="text-button small"
                    onClick={() => {
                      setJournal(false);
                      setSelection(m);
                      setCategory(m.category);
                    }}
                  >
                    Изменить
                  </button>
                </div>
              ))
            )}
          </div>
          <button
            className="button secondary modal-full-button"
            onClick={() => setJournal(false)}
          >
            <ArrowLeft size={16} />
            Продолжить обход
          </button>
        </Modal>
      )}
      {episode && (
        <Modal
          title={
            episode === "V1"
              ? "Эпизод 01 · Перемещение детали"
              : "Эпизод 02 · Выезд из-за стеллажа"
          }
          subtitle={
            phase === "results"
              ? "Разбор наблюдаемого события"
              : "Посмотрите на работу в движении. Найдите конкретный признак."
          }
          wide
          className="episode-modal"
          onClose={() => setEpisode(null)}
        >
          {hasActiveAttempt && (
            <span className="modal-timer">
              <Timer size={14} />
              {remaining === null ? "Без лимита" : timeLabel(remaining || 0)}
            </span>
          )}
          <Episode
            key={episode}
            id={episode}
            review={phase === "results"}
            timed={remaining !== null}
            onSelect={pick}
            onSeen={() => seenVideo(episode)}
          />
        </Modal>
      )}
      {reviewId && (
        <Modal
          title={
            content.hazards.find((h) => h.id === reviewId)?.title || "Осмотр"
          }
          subtitle="Рассмотрите объект с разных сторон."
          wide
          onClose={() => setReviewId(null)}
        >
          <div className="review-scene">
            <Workshop
              variant="assessment"
              chapter={0}
              zone={zoneOf(reviewId)}
              cameraMode="orbit"
              marking={false}
              marks={attempt?.marks || []}
              paused={false}
              onSelect={() => {}}
              onReady={() => {}}
              onError={() => {}}
              onController={() => {}}
            />
          </div>
          <p className="review-explanation">
            {content.hazards.find((h) => h.id === reviewId)?.evidence}
          </p>
        </Modal>
      )}
      {objects && (
        <Modal
          title="Текстовый обзор объектов"
          subtitle="Те же наблюдаемые признаки — в текстовом формате. Ответы подтверждаются отдельно."
          wide
          onClose={() => setObjects(false)}
        >
          <div className="object-list">
            {[
              ...content.hazards.slice(0, 4).map((h) => ({
                id: h.id,
                label: objectLabels[h.id],
                text: h.evidence,
              })),
              ...content.distractors.map((d) => ({
                id: d.id,
                label: objectLabels[d.id],
                text: d.visible,
              })),
            ].map((o) => (
              <article key={o.id}>
                <h3>{o.label}</h3>
                <p>{o.text}</p>
                {phase !== "lecture" && (
                  <button
                    className="text-button"
                    onClick={() => {
                      setObjects(false);
                      pick({ objectId: o.id, label: o.label, source: "world" });
                    }}
                  >
                    Отметить наблюдение
                    <ArrowRight size={14} />
                  </button>
                )}
              </article>
            ))}
          </div>
        </Modal>
      )}
      {finishDialog && (
        <Modal
          title="Завершить обход?"
          subtitle={`Вы обнаружили ${result?.found || 0} из 6 опасностей.`}
          onClose={() => setFinishDialog(false)}
        >
          <p className="modal-body-text">
            После завершения откроется разбор всех находок и пропусков. Изменить
            ответы этой попытки будет нельзя.
          </p>
          <div className="modal-actions">
            <button
              className="button secondary"
              onClick={() => setFinishDialog(false)}
            >
              Продолжить осмотр
            </button>
            <button className="button primary" onClick={finish}>
              Завершить
              <Flag size={16} />
            </button>
          </div>
        </Modal>
      )}
      {selection && (
        <Modal
          title={
            selectedRecord ? "Изменить категорию" : "Зафиксировать наблюдение"
          }
          subtitle={
            phase === "brief"
              ? "Учебная отметка · без оценивания"
              : `Отметка ${selectedRecord ? attempt!.marks.indexOf(selectedRecord) + 1 : (attempt?.marks.length || 0) + 1}`
          }
          className="selection-modal"
          onClose={() => setSelection(null)}
        >
          <div className="selected-object">
            <span>
              <Focus size={22} />
            </span>
            <div>
              <small>
                {selection.source === "world"
                  ? "В учебном цехе"
                  : `В эпизоде · ${selection.time?.toFixed(1)} с`}
              </small>
              <b>{selection.label}</b>
            </div>
          </div>
          <h3 className="category-question">
            Какой тип опасности вы отмечаете?
          </h3>
          <div className="category-options">
            {content.categories.map((c) => (
              <button
                key={c.id}
                className={
                  "category-option " + (category === c.id ? "active" : "")
                }
                onClick={() => setCategory(c.id as Category)}
              >
                <span className="category-icon">
                  <CategoryIcon id={c.id} />
                </span>
                <span>
                  <b>{c.title}</b>
                  <small>{c.description}</small>
                </span>
                <span className="radio-dot" />
              </button>
            ))}
          </div>
          <p className="tiny muted selection-note">
            Отметка сохранится после подтверждения. Тип можно изменить в журнале
            до завершения обхода.
          </p>
          <div className="modal-actions">
            <button
              className="button secondary"
              onClick={() => setSelection(null)}
            >
              Отмена
            </button>
            <button
              className="button primary"
              disabled={!category}
              onClick={confirm}
            >
              Подтвердить
              <Check size={17} />
            </button>
          </div>
        </Modal>
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={18} />
          <span>{toast}</span>
          <button onClick={() => setToast("")} aria-label="Закрыть уведомление">
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
