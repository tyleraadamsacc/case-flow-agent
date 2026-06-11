import { useState } from "react";
import type { ReactNode } from "react";

export interface SideNavItem {
  id: string;
  label: string;
  icon?: ReactNode;
}

export interface SideNavProps {
  items?: SideNavItem[];
  activeId?: string;
  onSelect?: (id: string) => void;
  defaultCollapsed?: boolean;
}

function NavIcon({ path }: { path: string }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={path} />
    </svg>
  );
}

/** Primary navigation stays focused — five destinations, no more
 * (plan §13). Adding a sixth requires removing one. */
export const DEFAULT_NAV_ITEMS: SideNavItem[] = [
  {
    id: "governance",
    label: "Governance & Insights",
    icon: <NavIcon path="M4 20V10 M10 20V4 M16 20v-7 M22 20H2" />,
  },
  {
    id: "attention",
    label: "Work Needing Attention",
    icon: <NavIcon path="M12 3 2 20h20L12 3z M12 10v4 M12 17v.5" />,
  },
  {
    id: "queue",
    label: "Request Queue",
    icon: <NavIcon path="M4 6h16 M4 12h16 M4 18h10" />,
  },
  {
    id: "audit",
    label: "Audit",
    icon: <NavIcon path="M12 22s8-3 8-10V5l-8-3-8 3v7c0 7 8 10 8 10z M9 12l2 2 4-4" />,
  },
  {
    id: "settings",
    label: "Settings",
    icon: <NavIcon path="M4 8h10 M18 8h2 M14 8a2 2 0 1 0 4 0 2 2 0 0 0-4 0z M4 16h2 M10 16h10 M6 16a2 2 0 1 0 4 0 2 2 0 0 0-4 0z" />,
  },
];

export default function SideNav({
  items = DEFAULT_NAV_ITEMS,
  activeId,
  onSelect,
  defaultCollapsed = true,
}: SideNavProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  function toggleCollapsed() {
    setCollapsed((value) => !value);
  }

  return (
    <nav
      className={["cf-sidenav", collapsed ? "cf-sidenav--collapsed" : null]
        .filter(Boolean)
        .join(" ")}
      aria-label="Primary"
    >
      <ul className="cf-sidenav__list">
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              className="cf-sidenav__item"
              aria-current={item.id === activeId ? "page" : undefined}
              title={collapsed ? item.label : undefined}
              aria-label={collapsed ? item.label : undefined}
              onClick={() => onSelect?.(item.id)}
            >
              <span className="cf-sidenav__icon">{item.icon}</span>
              <span className="cf-sidenav__label">{item.label}</span>
            </button>
          </li>
        ))}
      </ul>
      <div className="cf-sidenav__footer">
        <button
          type="button"
          className="cf-sidenav__item"
          aria-expanded={!collapsed}
          title={collapsed ? "Expand navigation" : "Collapse navigation"}
          aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
          onClick={toggleCollapsed}
        >
          <span className="cf-sidenav__icon">
            <NavIcon path={collapsed ? "m9 18 6-6-6-6" : "m15 18-6-6 6-6"} />
          </span>
          <span className="cf-sidenav__label">
            {collapsed ? "Expand" : "Collapse"}
          </span>
        </button>
      </div>
    </nav>
  );
}
