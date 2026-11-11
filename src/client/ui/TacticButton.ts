import type Phaser from 'phaser';
import type { MatchTactic } from '../systems/ai';
import { PAL } from './palette';
import { TextButton } from './TextButton';

// One appearance for live tactics and their examples on the info screen.
export function paintTacticButton(
  button: TextButton,
  mode: MatchTactic,
  selected: MatchTactic
) {
  button.setFill(mode === selected ? PAL.darkGreen : PAL.navy);
  button.setLabel(`${mode === selected ? '> ' : ''}${mode.toUpperCase()}`);
}
export function tacticButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  mode: MatchTactic,
  selected: MatchTactic,
  onClick: () => void
) {
  const button = new TextButton(scene, x, y, '', onClick, {
    width: 144,
    height: 44,
    textSize: 2,
  });
  paintTacticButton(button, mode, selected);
  return button;
}
