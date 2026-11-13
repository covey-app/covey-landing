/*
 * Home-page photographs: candid groups doing ordinary things together.
 * Supplied by the owner (2026-11-13) as AI-generated images, so they're
 * mood, never proof: no caption, quote or name ever presents one as a
 * Covey member, plan or event (covey-marketing claims-and-voice §1).
 *
 * Files live in public/brand/photos/ as WebP at 640 wide and at the
 * original's own width (1280 for landscape, 1086 for portrait; never
 * upscaled). `focus` is the object-position that keeps the faces in a crop.
 */

export type PhotoId =
  | "sunset-hike"
  | "pickup-frisbee"
  | "taco-truck"
  | "record-store"
  | "puzzle-night"
  | "pizza-night"
  | "rooftop"
  | "card-night"
  | "beach-bonfire"
  | "living-room"
  | "movie-night"
  | "cafe"
  | "couch"
  | "patio";

export interface Photo {
  alt: string;
  /** Portrait (3:4) originals are 1086 × 1448; landscape (4:3) are 1448 × 1086. */
  portrait?: boolean;
  focus?: string;
}

export const PHOTOS: Record<PhotoId, Photo> = {
  "sunset-hike": { alt: "Friends on a dry grass trail at sunset, one stopping to take a photo.", portrait: true, focus: "50% 60%" },
  "pickup-frisbee": { alt: "Friends throwing a frisbee across a big lawn on a sunny afternoon.", focus: "45% 60%" },
  "taco-truck": { alt: "Friends in line at a taco truck at night, one holding up a plate of tacos.", portrait: true, focus: "40% 55%" },
  "record-store": { alt: "Friends flipping through crates in a record store.", focus: "40% 50%" },
  "puzzle-night": { alt: "Friends around a dining table working on a jigsaw puzzle.", focus: "55% 50%" },
  "pizza-night": { alt: "Friends topping homemade pizzas on a kitchen counter.", focus: "50% 45%" },
  rooftop: { alt: "Friends laughing on a rooftop at golden hour, string lights overhead.", focus: "50% 55%" },
  "card-night": { alt: "Friends playing cards around a coffee table in a living room.", focus: "50% 50%" },
  "beach-bonfire": { alt: "Friends around a beach bonfire at dusk.", portrait: true, focus: "50% 70%" },
  "living-room": { alt: "Friends squeezed onto a couch for a selfie.", focus: "50% 45%" },
  "movie-night": { alt: "Friends sharing pizza on a couch in front of the TV.", focus: "45% 50%" },
  cafe: { alt: "Friends laughing around a cafe table.", focus: "50% 50%" },
  couch: { alt: "Friends piled on a couch, smiling at the camera.", focus: "50% 40%" },
  patio: { alt: "Friends huddled together for a flash photo on a patio at night.", focus: "50% 45%" },
};

/** src, srcset and intrinsic size for a photo. */
export function photoSrc(id: PhotoId) {
  const p = PHOTOS[id];
  const big = p.portrait ? 1086 : 1280;
  return {
    src: `/brand/photos/${id}-640.webp`,
    srcset: `/brand/photos/${id}-640.webp 640w, /brand/photos/${id}-${big}.webp ${big}w`,
    width: p.portrait ? 1086 : 1448,
    height: p.portrait ? 1448 : 1086,
  };
}
