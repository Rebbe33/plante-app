'use client';

import { describeChange, planChange } from '@/lib/diagnostic';
import type { Advice, Change, Kind } from '@/lib/diagnostic';
import type { Task } from '@/lib/types';

const LEVEL_ICON: Record<Advice['level'], string> = { alert: '⚠️', adjust: '🔧', info: 'ℹ️', ok: '✅' };

/** Carte de conseil avec, quand c'est possible, le détail du changement et un bouton « Appliquer ». */
export default function AdviceCard({
  advice,
  tasks,
  kind,
  done,
  busy,
  onApply,
}: {
  advice: Advice;
  tasks: Task[];
  kind: Kind | null;
  done: boolean;
  busy: boolean;
  onApply: (a: Advice) => void;
}) {
  const changes = advice.actions
    .map((act) => planChange(act, tasks.find((t) => t.care_type === act.care), new Date(), kind))
    .filter((c): c is Change => c !== null);

  return (
    <div className={`advice ${advice.level}`}>
      <div className="advice-title">
        {LEVEL_ICON[advice.level]} {advice.title}
      </div>
      <div className="small">{advice.why}</div>
      {!done && changes.length > 0 && (
        <>
          <ul className="changes">
            {changes.map((c, i) => (
              <li key={i}>{describeChange(c)}</li>
            ))}
          </ul>
          <button className="btn primary sm" disabled={busy} onClick={() => onApply(advice)}>
            Appliquer au programme
          </button>
        </>
      )}
      {done && <div className="done-line">✓ Appliqué au programme</div>}
    </div>
  );
}
