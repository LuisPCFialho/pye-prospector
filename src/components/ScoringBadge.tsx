import { scoreColor, scoreLabel } from "../lib/scoring";

interface Props {
  score: number;
  explanations?: string[];
  size?: "sm" | "md" | "lg";
  showExplanations?: boolean;
}

export default function ScoringBadge({
  score, explanations, size = "md", showExplanations = false,
}: Props) {
  const color = scoreColor(score);
  const label = scoreLabel(score);
  const sizeClasses = {
    sm: "text-xs px-2 py-0.5",
    md: "text-sm px-2.5 py-1",
    lg: "text-base px-3 py-1.5",
  }[size];

  return (
    <div className="flex flex-col gap-2">
      <div
        className={`inline-flex items-center gap-2 rounded-full font-bold ${sizeClasses}`}
        style={{ background: `${color}25`, color, border: `1px solid ${color}50` }}
      >
        <span className="text-lg leading-none" aria-hidden>★</span>
        <span>{score}</span>
        <span className="opacity-70 text-xs uppercase tracking-wide">{label}</span>
      </div>
      {showExplanations && explanations && explanations.length > 0 && (
        <ul className="text-xs space-y-1 text-slate-300">
          {explanations.map((e, i) => (
            <li key={i} className="flex items-start gap-1.5">
              <span className="text-slate-500 mt-0.5">·</span>
              <span>{e}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
