// Retro pixel art style. One art pixel is PX logical pixels, and every shape
// snaps to that grid so the whole game reads as chunky pixel art.
export const PX = 4;

// Base PICO-8 palette plus a small character ramp for the supplied footballer
// reference. Keep shared scenery/HUD colors stable; use named colors here.
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
  ink: 0x292a30,
  hairDark: 0x382116,
  hairMid: 0x60391f,
  hairLight: 0x85502c,
  skinDark: 0x986344,
  skinMid: 0xc28b60,
  skinLight: 0xe5b386,
  skinHighlight: 0xf3c99c,
  kitPink: 0xef94aa,
  kitPinkShade: 0xad5d78,
  kitPinkLight: 0xffb3c3,
  kitBlue: 0x609bc7,
  kitBlueShade: 0x365574,
  kitBlueLight: 0x9ec8e3,
  kitGreen: 0x6aa875,
  kitGreenShade: 0x3d7050,
  kitGreenLight: 0xa1cf91,
  kitGold: 0xe3bb66,
  kitGoldShade: 0xa87b43,
  kitGoldLight: 0xf6d891,
} as const;
