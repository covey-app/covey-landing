/*
 * Icon registry — the only icons the site renders.
 *
 * The app draws SF Symbols, which can't ship on the web. Lucide (ISC, via
 * lucide-static) is the closest open set in stroke and proportion. Each SVG is
 * imported as a raw string at build time and inlined by Icon.astro, so icons
 * cost zero client JavaScript and inherit `currentColor`.
 *
 * Add an icon by importing it here; unknown names fail the type check rather
 * than rendering nothing.
 */
import arrowDown from "lucide-static/icons/arrow-down.svg?raw";
import arrowRight from "lucide-static/icons/arrow-right.svg?raw";
import badgeCheck from "lucide-static/icons/badge-check.svg?raw";
import bus from "lucide-static/icons/bus.svg?raw";
import calendarPlus from "lucide-static/icons/calendar-plus.svg?raw";
import calendarSync from "lucide-static/icons/calendar-sync.svg?raw";
import camera from "lucide-static/icons/camera.svg?raw";
import check from "lucide-static/icons/check.svg?raw";
import clock from "lucide-static/icons/clock.svg?raw";
import coffee from "lucide-static/icons/coffee.svg?raw";
import croissant from "lucide-static/icons/croissant.svg?raw";
import dumbbell from "lucide-static/icons/dumbbell.svg?raw";
import film from "lucide-static/icons/film.svg?raw";
import flame from "lucide-static/icons/flame.svg?raw";
import footprints from "lucide-static/icons/footprints.svg?raw";
import gamepad from "lucide-static/icons/gamepad-2.svg?raw";
import hand from "lucide-static/icons/hand.svg?raw";
import iceCream from "lucide-static/icons/ice-cream-cone.svg?raw";
import landmark from "lucide-static/icons/landmark.svg?raw";
import list from "lucide-static/icons/list.svg?raw";
import lock from "lucide-static/icons/lock.svg?raw";
import map from "lucide-static/icons/map.svg?raw";
import mapPin from "lucide-static/icons/map-pin.svg?raw";
import messages from "lucide-static/icons/messages-square.svg?raw";
import moonStar from "lucide-static/icons/moon-star.svg?raw";
import mountain from "lucide-static/icons/mountain.svg?raw";
import navigation from "lucide-static/icons/navigation.svg?raw";
import palette from "lucide-static/icons/palette.svg?raw";
import repeat from "lucide-static/icons/repeat.svg?raw";
import shieldCheck from "lucide-static/icons/shield-check.svg?raw";
import shoppingBag from "lucide-static/icons/shopping-bag.svg?raw";
import soup from "lucide-static/icons/soup.svg?raw";
import sparkles from "lucide-static/icons/sparkles.svg?raw";
import sunset from "lucide-static/icons/sunset.svg?raw";
import trophy from "lucide-static/icons/trophy.svg?raw";
import users from "lucide-static/icons/users.svg?raw";
import utensils from "lucide-static/icons/utensils.svg?raw";
import volleyball from "lucide-static/icons/volleyball.svg?raw";
import briefcase from "lucide-static/icons/briefcase.svg?raw";

const RAW = {
  "arrow-down": arrowDown,
  "arrow-right": arrowRight,
  "badge-check": badgeCheck,
  briefcase,
  bus,
  "calendar-plus": calendarPlus,
  "calendar-sync": calendarSync,
  camera,
  check,
  clock,
  coffee,
  croissant,
  dumbbell,
  film,
  flame,
  footprints,
  gamepad,
  hand,
  "ice-cream": iceCream,
  landmark,
  list,
  lock,
  map,
  "map-pin": mapPin,
  messages,
  "moon-star": moonStar,
  mountain,
  navigation,
  palette,
  repeat,
  "shield-check": shieldCheck,
  "shopping-bag": shoppingBag,
  soup,
  sparkles,
  sunset,
  trophy,
  users,
  utensils,
  volleyball,
} as const;

export type IconName = keyof typeof RAW;

/** Inner SVG markup (paths only), with the license comment and wrapper removed. */
export function iconBody(name: IconName): string {
  const raw = RAW[name];
  const open = raw.indexOf(">", raw.indexOf("<svg"));
  const close = raw.lastIndexOf("</svg>");
  return raw.slice(open + 1, close).trim();
}
