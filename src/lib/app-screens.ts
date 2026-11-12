/*
 * The iOS app screens the site shows (public/brand/app/), each captured in
 * light and dark from the Meadow theme in demo mode: fictional people and
 * plans, nothing from a real account. Files are
 * `/brand/app/<screen>-<light|dark>-<420|840>.webp`.
 */
export const APP_SCREENS = ["explore", "plan", "chat", "myplans"] as const;
export type AppScreen = (typeof APP_SCREENS)[number];
