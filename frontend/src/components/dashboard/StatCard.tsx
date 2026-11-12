import React from "react";

interface StatCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  onClick?: () => void;
}

export function StatCard({
  label,
  value,
  icon,
  iconBg,
  iconColor,
  onClick,
}: StatCardProps) {
  return (
    <div
      className="card stat-card"
      onClick={onClick}
      style={onClick ? { cursor: "pointer" } : undefined}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      <div>
        <div className="stat-label">{label}</div>
        <div className="stat-value tabular-nums">{value}</div>
      </div>
      <div
        className="stat-icon"
        style={{ backgroundColor: iconBg, color: iconColor }}
        aria-hidden="true"
      >
        {icon}
      </div>
    </div>
  );
}

