import { useEffect, useRef } from "react";
import { createWorkshop, type WorkshopController } from "./workshop";
import type { Mark, Selection, Zone } from "./assessment";

interface Props {
  variant: "lecture" | "assessment";
  chapter: number;
  lecturePlaying?: boolean;
  zone: Zone | "all";
  cameraMode: "orbit" | "walk";
  marking: boolean;
  marks: Mark[];
  paused: boolean;
  onSelect: (s: Selection) => void;
  onReady: (ready: boolean) => void;
  onError: () => void;
  onController: (c: WorkshopController | null) => void;
}
export default function Workshop(props: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const controller = useRef<WorkshopController | null>(null);
  const live = useRef(props);
  live.current = props;
  useEffect(() => {
    let disposed = false;
    live.current.onReady(false);
    try {
      const c = createWorkshop(
        canvas.current!,
        props.variant,
        (s) => live.current.onSelect(s),
        () => {
          if (!disposed) live.current.onReady(true);
        },
      );
      controller.current = c;
      live.current.onController(c);
      c.setMode(live.current.cameraMode);
      c.setChapter(live.current.chapter);
      c.setZone(live.current.zone);
      c.setMarks(live.current.marks);
      c.setMarking(live.current.marking);
      c.setPaused(live.current.paused);
      c.setLecturePlaying(!!live.current.lecturePlaying);
    } catch (error) {
      console.error("Workshop initialization failed", error);
      live.current.onError();
    }
    return () => {
      disposed = true;
      controller.current?.dispose();
      controller.current = null;
      live.current.onController(null);
    };
  }, [props.variant]);
  useEffect(
    () => controller.current?.setChapter(props.chapter),
    [props.chapter],
  );
  useEffect(
    () => controller.current?.setLecturePlaying(!!props.lecturePlaying),
    [props.lecturePlaying],
  );
  useEffect(() => controller.current?.setZone(props.zone), [props.zone]);
  useEffect(
    () => controller.current?.setMode(props.cameraMode),
    [props.cameraMode],
  );
  useEffect(
    () => controller.current?.setMarking(props.marking),
    [props.marking],
  );
  useEffect(() => controller.current?.setMarks(props.marks), [props.marks]);
  useEffect(() => controller.current?.setPaused(props.paused), [props.paused]);
  return (
    <canvas
      ref={canvas}
      className="workshop-canvas"
      tabIndex={0}
      aria-label="Трёхмерный учебный цех. Потяните сцену для осмотра. Выберите зону или используйте WASD. Для ответа сначала включите режим отметки."
    />
  );
}
