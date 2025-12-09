'use client';

import {
  Button,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui';
import { STATUS_OPTIONS } from './tree-types';

export interface PriorityPopupState {
  personId: string;
  personName: string;
  x: number;
  y: number;
  priority: number;
  status: string;
}

interface PriorityPopupProps {
  popup: PriorityPopupState;
  onClose: () => void;
  onPriorityChange: (personId: string, priority: number) => void;
  onStatusChange: (personId: string, status: string) => void;
  onPopupUpdate: (updates: Partial<PriorityPopupState>) => void;
}

export function PriorityPopup({
  popup,
  onClose,
  onPriorityChange,
  onStatusChange,
  onPopupUpdate,
}: PriorityPopupProps) {
  const getPriorityLabel = (priority: number) => {
    if (priority === 0) return 'Not prioritized';
    if (priority <= 3) return 'Low priority';
    if (priority <= 6) return 'Medium priority';
    if (priority <= 9) return 'High priority';
    return 'Urgent';
  };

  return (
    <div
      role="dialog"
      aria-label="Priority and status settings"
      className="absolute bg-[var(--card)] text-[var(--card-foreground)] rounded-lg shadow-xl border border-[var(--border)] p-3 z-50"
      style={{ left: popup.x, top: popup.y }}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <div className="font-semibold text-sm mb-2 truncate max-w-48">
        {popup.personName}
      </div>

      <div className="mb-3">
        <label
          htmlFor="priority-slider"
          className="text-xs font-medium text-[var(--muted-foreground)] flex items-center gap-1"
        >
          Priority
          <span
            className="text-[var(--muted-foreground)] cursor-help"
            title="0 = No urgency, 10 = Research immediately. Higher priority people appear first in research queue."
          >
            ⓘ
          </span>
        </label>
        <div className="flex items-center gap-2 mt-1">
          <input
            id="priority-slider"
            type="range"
            min="0"
            max="10"
            value={popup.priority}
            onChange={(e) => {
              const newPriority = parseInt(e.target.value, 10);
              onPopupUpdate({ priority: newPriority });
            }}
            onMouseUp={() => onPriorityChange(popup.personId, popup.priority)}
            className="w-20"
          />
          <span className="text-sm font-bold w-6">{popup.priority}</span>
        </div>
        <div className="text-[10px] text-[var(--muted-foreground)] mt-0.5">
          {getPriorityLabel(popup.priority)}
        </div>
      </div>

      <div>
        <Label className="text-xs font-medium text-[var(--muted-foreground)] flex items-center gap-1">
          Status
          <span
            className="text-[var(--muted-foreground)] cursor-help"
            title="Tracks research progress: Not Started → In Progress → Partial/Verified. Use Brick Wall when stuck."
          >
            ⓘ
          </span>
        </Label>
        <Select
          value={popup.status}
          onValueChange={(v) => {
            onPopupUpdate({ status: v });
            onStatusChange(popup.personId, v);
          }}
        >
          <SelectTrigger className="w-full mt-1 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s.value} value={s.value} title={s.desc}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="text-[10px] text-[var(--muted-foreground)] mt-0.5">
          {STATUS_OPTIONS.find((s) => s.value === popup.status)?.desc}
        </div>
      </div>

      <div className="mt-2 text-right">
        <Button
          variant="link"
          size="sm"
          onClick={onClose}
          className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
        >
          Close
        </Button>
      </div>
    </div>
  );
}
