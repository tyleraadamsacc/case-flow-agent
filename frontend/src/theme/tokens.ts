/** Typed mirror of tokens.css for code that needs token values
 * (charts, inline accents, thresholds). Components should prefer the
 * CSS custom properties; this module is for logic, not styling. */

export const color = {
  backgroundApp: "#F7F9FC",
  surfaceCard: "#FFFFFF",
  surfaceSoft: "#F1F4F9",
  surfaceTintBlue: "#EEF4FF",
  borderSubtle: "#E0E5EF",
  textPrimary: "#202124",
  textSecondary: "#5F6368",
  textMuted: "#80868B",
  blue: "#1A73E8",
  blueSoft: "#E8F0FE",
  violet: "#7C4DFF",
  violetSoft: "#F0EAFE",
  cyan: "#00ACC1",
  cyanSoft: "#E6F7FA",
  green: "#188038",
  greenSoft: "#E6F4EA",
  yellow: "#F9AB00",
  yellowSoft: "#FEF7E0",
  red: "#D93025",
  redSoft: "#FCE8E6",
} as const;

export const gradient = {
  gemini: "linear-gradient(135deg, #1A73E8 0%, #7C4DFF 48%, #00ACC1 100%)",
  geminiSoft:
    "linear-gradient(135deg, rgba(26,115,232,.14), rgba(124,77,255,.12), rgba(0,172,193,.10))",
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  card: 20,
  pill: 999,
} as const;

export const fontSize = {
  display: 32,
  title: 24,
  section: 18,
  body: 14,
  small: 12,
  micro: 11,
} as const;

export const fontFamily = '"Google Sans", "Inter", "Roboto", Arial, sans-serif';

/** Confidence thresholds (0–1 scale). The green/amber boundary matches the
 * backend's low-confidence review threshold (0.75): anything the policy
 * would flag for human review must not read as green in the UI. */
export const confidenceThresholds = {
  green: 0.75,
  amber: 0.5,
} as const;
