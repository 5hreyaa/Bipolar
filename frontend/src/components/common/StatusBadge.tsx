import { SnackStatus } from "../../types";

const STATUS_LABELS: Record<SnackStatus, string> = {
  stocked: "Stocked",
  running_low: "Running Low",
  gone: "Gone",
};

export function StatusBadge({ status }: { status: SnackStatus }) {
  return (
    <span className={`status-badge ${status}`} aria-label={`Status: ${STATUS_LABELS[status]}`}>
      <span className="status-dot" />
      {STATUS_LABELS[status]}
    </span>
  );
}

