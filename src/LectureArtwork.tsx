import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Focus, Hand, MousePointer2, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import { artView, lectureArt, panArt, type ArtHotspot, type ArtView } from "./lecture-art";

export default function LectureArtwork({ chapter }: { chapter: number }) {
  const lesson = lectureArt[chapter];
  const [selected, setSelected] = useState<ArtHotspot | null>(null);
  const [view, setView] = useState<ArtView>(artView(1, 0.5, 0.5));
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const canvas = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; x: number; y: number; view: ArtView; moved: boolean } | null>(null);
  const suppressClick = useRef(false);

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      const imageWidth = Math.min(width, height * 1672 / 941);
      setSize({ width: imageWidth, height: imageWidth * 941 / 1672 });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const reset = () => {
    setView(artView(1, 0.5, 0.5));
    setSelected(null);
  };
  const inspect = (hotspot: ArtHotspot) => {
    if (suppressClick.current) return;
    setSelected(hotspot);
    setView(artView(hotspot.zoom, ...hotspot.focus));
  };
  const zoom = (change: number) => {
    setView((v) => artView(v.scale + change, (0.5 - v.x) / v.scale, (0.5 - v.y) / v.scale));
  };

  return (
    <div className="art-workshop">
      <div className="art-toolbar">
        <span><MousePointer2 size={14} /> Нажмите на объект</span>
        <div role="group" aria-label="Масштаб иллюстрации">
          <button aria-label="Отдалить иллюстрацию" disabled={view.scale <= 1} onClick={() => zoom(-0.5)}><ZoomOut size={17} /></button>
          <span>{view.scale.toFixed(1)}×</span>
          <button aria-label="Приблизить иллюстрацию" disabled={view.scale >= 4} onClick={() => zoom(0.5)}><ZoomIn size={17} /></button>
          <button aria-label="Показать весь цех" onClick={reset}><Focus size={17} /></button>
        </div>
      </div>
      <div className="art-canvas" ref={canvas}>
        <div
          className={"art-frame" + (view.scale > 1 ? " art-zoomed" : "")}
          style={{ width: size.width, height: size.height }}
          onPointerDown={(e) => {
            suppressClick.current = false;
            if (view.scale <= 1 || e.button !== 0) return;
            drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, view, moved: false };
          }}
          onPointerMove={(e) => {
            const d = drag.current;
            if (!d || d.id !== e.pointerId || !size.width || !size.height) return;
            const dx = e.clientX - d.x, dy = e.clientY - d.y;
            if (Math.hypot(dx, dy) < 6 && !d.moved) return;
            if (!d.moved) e.currentTarget.setPointerCapture(e.pointerId);
            d.moved = true;
            suppressClick.current = true;
            setView(panArt(d.view, dx / size.width, dy / size.height));
          }}
          onPointerUp={() => { drag.current = null; }}
          onPointerCancel={() => { drag.current = null; suppressClick.current = false; }}
          onLostPointerCapture={() => { drag.current = null; }}
        >
          <div className="art-layer" style={{ transform: `translate(${view.x * 100}%, ${view.y * 100}%) scale(${view.scale})` }}>
            <img src={lesson.image} alt={lesson.alt} draggable={false} onLoad={() => setImageLoaded(true)} onError={() => setImageError(true)} />
            {imageLoaded && !imageError && size.width > 0 && lesson.hotspots.map((h, i) => (
              <button
                key={h.id}
                className={"art-hotspot" + (selected?.id === h.id ? " active" : "")}
                style={{ left: `${h.bounds[0] * 100}%`, top: `${h.bounds[1] * 100}%`, width: `${h.bounds[2] * 100}%`, height: `${h.bounds[3] * 100}%`, "--pin-scale": 1 / view.scale } as CSSProperties}
                aria-label={`Увеличить: ${h.label}`}
                aria-pressed={selected?.id === h.id}
                title={h.label}
                onClick={(e) => { if (e.detail === 0) suppressClick.current = false; inspect(h); }}
              ><span className="art-pin">{i + 1}<ZoomIn size={12} /></span></button>
            ))}
          </div>
          {imageError && <div className="art-image-error">Не удалось загрузить иллюстрацию. Выберите объект в списке ниже, чтобы прочитать пояснение.</div>}
        </div>
      </div>
      <div className="art-object-list" role="group" aria-label="Объекты этой сцены лекции">
        {lesson.hotspots.map((h, i) => <button key={h.id} className={selected?.id === h.id ? "active" : ""} aria-pressed={selected?.id === h.id} onClick={() => { suppressClick.current = false; inspect(h); }}><b>{i + 1}</b>{h.label}</button>)}
      </div>
      <div className="art-details" aria-live="polite" aria-atomic="true">
        {selected ? <>
          <div className="art-detail-title"><b>{selected.label}</b><button onClick={reset}><RotateCcw size={13} /> Весь цех</button></div>
          {selected.record ? <dl className="art-record">
            <div><dt>Где</dt><dd>{selected.record.where}</dd></div>
            <div><dt>Что наблюдаю</dt><dd>{selected.record.observation}</dd></div>
            <div><dt>Чем грозит</dt><dd>{selected.record.consequence}</dd></div>
          </dl> : <p>{selected.detail}</p>}
        </> : <div className="art-empty-detail"><Hand size={20} /><div><b>{lesson.caption}</b><p>Выберите отмеченный объект прямо на иллюстрации или в списке. Рассмотрите его крупнее и прочитайте пояснение.</p></div></div>}
        {selected && view.scale > 1 && <span className="art-pan-hint"><Hand size={12} /> Потяните увеличенный кадр для осмотра</span>}
      </div>
    </div>
  );
}
