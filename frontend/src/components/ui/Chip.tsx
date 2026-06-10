import type { ReactNode } from "react";

export type ChipTone =
  | "neutral"
  | "blue"
  | "green"
  | "amber"
  | "red"
  | "violet"
  | "cyan";

export interface ChipProps {
  tone?: ChipTone;
  /** Leading dot reinforces tone without relying on color alone —
   * the text label always carries the meaning. */
  dot?: boolean;
  onClick?: () => void;
  title?: string;
  className?: string;
  children: ReactNode;
}

export default function Chip({
  tone = "neutral",
  dot = false,
  onClick,
  title,
  className,
  children,
}: ChipProps) {
  const classes = ["cf-chip", `cf-chip--${tone}`, className]
    .filter(Boolean)
    .join(" ");
  const content = (
    <>
      {dot ? <span className="cf-chip__dot" aria-hidden="true" /> : null}
      {children}
    </>
  );

  if (onClick) {
    return (
      <button type="button" className={classes} title={title} onClick={onClick}>
        {content}
      </button>
    );
  }
  return (
    <span className={classes} title={title}>
      {content}
    </span>
  );
}
