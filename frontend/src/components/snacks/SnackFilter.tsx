import { Search, X } from "lucide-react";

import { SnackCategory, SnackStatus } from "../../types";

interface SnackFilterProps {
  search: string;
  onSearchChange: (value: string) => void;
  category: SnackCategory | "";
  onCategoryChange: (value: SnackCategory | "") => void;
  status: SnackStatus | "";
  onStatusChange: (value: SnackStatus | "") => void;
  sortBy: "name" | "quantity" | "votes";
  sortOrder: "asc" | "desc";
  onSortChange: (sortBy: "name" | "quantity" | "votes", sortOrder: "asc" | "desc") => void;
}

const CATEGORIES: Array<{ value: SnackCategory | ""; label: string }> = [
  { value: "", label: "All Categories" },
  { value: "sweet", label: "Sweet" },
  { value: "savoury", label: "Savoury" },
  { value: "drink", label: "Drink" },
  { value: "healthy-ish", label: "Healthy-ish" },
];

const STATUSES: Array<{ value: SnackStatus | ""; label: string }> = [
  { value: "", label: "Any Status" },
  { value: "stocked", label: "Stocked" },
  { value: "running_low", label: "Running Low" },
  { value: "gone", label: "Gone" },
];

export function SnackFilter({
  search,
  onSearchChange,
  category,
  onCategoryChange,
  status,
  onStatusChange,
  sortBy,
  sortOrder,
  onSortChange,
}: SnackFilterProps) {
  const sortValue = `${sortBy}:${sortOrder}`;

  return (
    <div className="card filter-bar">
      <div className="filter-top-row">
        <div className="search-input-wrap">
          <Search size={17} className="search-icon" />
          <input
            type="search"
            className="input search-input"
            placeholder="Search snacks by name..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            aria-label="Search snacks"
          />
          {search && (
            <button
              type="button"
              className="btn btn-ghost btn-icon"
              onClick={() => onSearchChange("")}
              aria-label="Clear search"
              style={{
                position: "absolute",
                right: 6,
                top: "50%",
                transform: "translateY(-50%)",
              }}
            >
              <X size={15} />
            </button>
          )}
        </div>

        <div style={{ minWidth: 200 }}>
          <select
            className="select"
            aria-label="Sort snacks"
            value={sortValue}
            onChange={(e) => {
              const [field, order] = e.target.value.split(":") as [
                "name" | "quantity" | "votes",
                "asc" | "desc",
              ];
              onSortChange(field, order);
            }}
          >
            <option value="name:asc">Sort: Name (A → Z)</option>
            <option value="name:desc">Sort: Name (Z → A)</option>
            <option value="votes:desc">Sort: Most Voted</option>
            <option value="quantity:desc">Sort: Highest Stock</option>
            <option value="quantity:asc">Sort: Lowest Stock</option>
          </select>
        </div>
      </div>

      <div className="filter-pills-row">
        <div className="pill-group" role="group" aria-label="Filter by category">
          {CATEGORIES.map((item) => (
            <button
              key={item.label}
              type="button"
              className={`filter-pill${category === item.value ? " active" : ""}`}
              onClick={() => onCategoryChange(item.value)}
              aria-pressed={category === item.value}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="pill-group" role="group" aria-label="Filter by stock status">
          {STATUSES.map((item) => (
            <button
              key={item.label}
              type="button"
              className={`filter-pill${status === item.value ? " active-green" : ""}`}
              onClick={() => onStatusChange(item.value)}
              aria-pressed={status === item.value}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

