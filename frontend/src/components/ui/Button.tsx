import type { ButtonHTMLAttributes } from "react";

export type ButtonVariant = "filled" | "tonal" | "text" | "outlined";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: "sm" | "md";
  /** Gemini soft-gradient glow — reserved for the single primary action
   * on a screen. Never apply to more than one button at a time. */
  glow?: boolean;
}

export default function Button({
  variant = "tonal",
  size = "md",
  glow = false,
  className,
  type = "button",
  children,
  ...rest
}: ButtonProps) {
  const classes = [
    "cf-button",
    `cf-button--${variant}`,
    size === "sm" ? "cf-button--sm" : null,
    glow ? "cf-button--glow" : null,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button type={type} className={classes} {...rest}>
      {children}
    </button>
  );
}
