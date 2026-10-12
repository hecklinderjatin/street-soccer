// Retro pixel art style. One art pixel is PX logical pixels, and every shape
// snaps to that grid so the whole game reads as chunky pixel art.
export const PX = 4;

// Limited 16-colour palette (PICO-8 style). Use these, not ad-hoc colours.
export const PAL = {
  black: 0x000000,
  navy: 0x1d2b53,
  plum: 0x7e2553,
  darkGreen: 0x008751,
  brown: 0xab5236,
  darkGray: 0x5f574f,
  lightGray: 0xc2c3c7,
  white: 0xfff1e8,
  red: 0xff004d,
  orange: 0xffa300,
  yellow: 0xffec27,
  green: 0x00e436,
  blue: 0x29adff,
  lavender: 0x83769c,
  pink: 0xff77a8,
  peach: 0xffccaa,
} as const;
