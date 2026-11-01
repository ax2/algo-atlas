import { ArrowDown, Compass, CheckCircle2 } from "lucide-react";
import type { Topic } from "../content/types";
import { lessonOverviews } from "../content/lesson-overviews";

export function LessonOrientation({ topic }: { topic: Topic }) {
  const guide = lessonOverviews[topic.id];
  return (
    <section
      className="lesson-orientation"
      aria-labelledby="orientation-heading"
    >
      <div className="orientation-heading">
        <div>
          <span className="orientation-eyebrow">
            <Compass size={15} /> 本例导览
          </span>
          <h2 id="orientation-heading">{guide.goal}</h2>
        </div>
        <button
          className="button compact"
          onClick={() => {
            document
              .getElementById("section-experiment")
              ?.scrollIntoView({ block: "start" });
            document
              .querySelector<HTMLButtonElement>(".playback .play-button")
              ?.focus({ preventScroll: true });
          }}
        >
          <ArrowDown size={16} /> 进入实验
        </button>
      </div>
      <ol className="orientation-route" aria-label="整体步骤">
        {guide.steps.map((step, i) => (
          <li key={step}>
            <span className="orientation-number" aria-hidden="true">
              {String(i + 1).padStart(2, "0")}
            </span>
            <p>{step}</p>
          </li>
        ))}
      </ol>
      <div className="orientation-check">
        <CheckCircle2 size={16} />
        <p>
          <strong>完成时核对</strong>
          {guide.check}
        </p>
      </div>
      <p className="orientation-hint">
        先读目标与路线，再点播放或单步；实验内可随时切回「总览」，不丢失当前进度。
      </p>
    </section>
  );
}
