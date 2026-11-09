import { useCallback, useEffect, useRef, useState } from "react";
import { Play, Pause, RotateCcw, ScanLine, Check, Film } from "lucide-react";
import { createEpisode } from "./workshop";
import type { Selection } from "./assessment";
interface Props {
  id: "V1" | "V2";
  review?: boolean;
  timed?: boolean;
  onSelect: (selection: Selection) => void;
  onSeen: () => void;
}
export default function Episode({
  id,
  review = false,
  timed = true,
  onSelect,
  onSeen,
}: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const ctl = useRef<ReturnType<typeof createEpisode> | null>(null);
  const clock = useRef({ time: 0, started: 0, playing: false });
  const callbacks = useRef({ onSelect, onSeen });
  callbacks.current = { onSelect, onSeen };
  const [time, setTime] = useState(0),
    [playing, setPlaying] = useState(false),
    [marking, setMarking] = useState(false),
    [ready, setReady] = useState(false),
    [error, setError] = useState(false),
    [seen, setSeen] = useState(false);
  const getTime = useCallback(
    () =>
      Math.min(
        12,
        clock.current.time +
          (clock.current.playing
            ? (performance.now() - clock.current.started) / 1000
            : 0),
      ),
    [],
  );
  useEffect(() => {
    let gone = false;
    try {
      ctl.current = createEpisode(
        canvas.current!,
        id,
        getTime,
        (s) => {
          setMarking(false);
          ctl.current?.setMarking(false);
          callbacks.current.onSelect(s);
        },
        () => {
          if (!gone) setReady(true);
        },
      );
    } catch (e) {
      console.error(e);
      setError(true);
    }
    return () => {
      gone = true;
      ctl.current?.dispose();
    };
  }, [id, getTime]);
  useEffect(() => {
    const i = window.setInterval(() => {
      const t = getTime();
      setTime(t);
      if (t >= 11.9 && !seen) {
        setSeen(true);
        callbacks.current.onSeen();
      }
      if (t >= 12 && clock.current.playing) {
        clock.current = { time: 12, started: 0, playing: false };
        setPlaying(false);
      }
    }, 100);
    return () => clearInterval(i);
  }, [getTime, seen]);
  function toggle() {
    const next = !clock.current.playing;
    clock.current = {
      time: getTime() >= 12 ? 0 : getTime(),
      started: performance.now(),
      playing: next,
    };
    setPlaying(next);
    setMarking(false);
    ctl.current?.setMarking(false);
  }
  function seek(t: number) {
    clock.current = {
      time: t,
      started: performance.now(),
      playing: clock.current.playing,
    };
    setTime(t);
    setMarking(false);
    ctl.current?.setMarking(false);
  }
  function mark() {
    clock.current = { time: getTime(), started: 0, playing: false };
    setPlaying(false);
    setMarking(!marking);
    ctl.current?.setMarking(!marking);
  }
  return (
    <div className="episode-player">
      <div className="episode-canvas-wrap">
        <canvas
          ref={canvas}
          className="episode-canvas"
          aria-label={
            id === "V1"
              ? "Анимация перемещения длинной детали на тележке"
              : "Анимация сближения пешехода и тележки у стеллажа"
          }
        />
        <span className="scene-label">
          <Film size={13} />{" "}
          {id === "V1" ? "Перемещение детали" : "Выезд из-за стеллажа"}
        </span>
        <span className="episode-time">{time.toFixed(1)} / 12.0 с</span>
        {!ready && !error && (
          <div className="scene-loading">Подготавливаем эпизод…</div>
        )}
        {error && (
          <div className="scene-loading">
            3D-эпизод недоступен в этом браузере. Попробуйте включить аппаратное
            ускорение.
          </div>
        )}
        {marking && (
          <div className="marking-banner">
            <ScanLine size={17} /> Выберите объект или место в остановленном
            кадре
          </div>
        )}
      </div>
      <div className="episode-controls">
        <button
          className="round-button"
          onClick={toggle}
          disabled={!ready}
          aria-label={playing ? "Пауза" : "Воспроизвести эпизод"}
        >
          {playing ? <Pause size={19} /> : <Play size={19} />}
        </button>
        <button
          className="icon-button"
          onClick={() => seek(0)}
          aria-label="Повторить эпизод"
        >
          <RotateCcw size={17} />
        </button>
        <input
          aria-label="Момент эпизода"
          type="range"
          min="0"
          max="12"
          step=".1"
          value={time}
          onChange={(e) => seek(Number(e.target.value))}
        />
        <span className="small muted">12 сек</span>
        {!review && (
          <button
            className={
              "button small-button " + (marking ? "primary" : "secondary")
            }
            onClick={mark}
            disabled={!ready}
          >
            <ScanLine size={16} />
            {marking ? "Отмена" : "Отметить"}
          </button>
        )}
      </div>
      <div className="episode-hint">
        {review ? (
          <>
            <Check size={16} /> Для разбора:{" "}
            {id === "V1"
              ? "смотрите 6–10 секунды — конец детали занимает пешеходный путь."
              : "смотрите 4–9 секунды — траектории пересекаются, контакта удаётся избежать."}
          </>
        ) : (
          <>
            Посмотрите эпизод. Остановите нужный момент и отметьте наблюдаемую
            опасность.{timed && " Таймер обхода продолжает идти."}
          </>
        )}
      </div>
    </div>
  );
}
