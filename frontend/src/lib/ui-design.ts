/**
 * Semantic corner-radius roles for the authenticated application.
 *
 * Choose by hierarchy instead of appearance so new routes stay aligned with
 * the Portfolio surface language.
 */
export const APP_RADIUS = {
  surface: "rounded-2xl",
  nested: "rounded-xl",
  control: "rounded-lg",
  overlay: "rounded-3xl",
  pill: "rounded-full",
} as const;

export type AppRadiusRole = keyof typeof APP_RADIUS;
