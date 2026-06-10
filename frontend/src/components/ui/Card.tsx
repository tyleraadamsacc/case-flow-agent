import type { HTMLAttributes, ReactNode } from "react";

export type CardVariant = "default" | "soft" | "tint" | "insight";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  /** Hover lift — only for cards that navigate somewhere. */
  interactive?: boolean;
  title?: string;
  subtitle?: ReactNode;
}

export default function Card({
  variant = "default",
  interactive = false,
  title,
  subtitle,
  className,
  children,
  ...rest
}: CardProps) {
  const classes = [
    "cf-card",
    variant !== "default" ? `cf-card--${variant}` : null,
    interactive ? "cf-card--interactive" : null,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes} {...rest}>
      {title ? <h3 className="cf-card__title">{title}</h3> : null}
      {subtitle ? <p className="cf-card__subtitle">{subtitle}</p> : null}
      {children}
    </div>
  );
}
