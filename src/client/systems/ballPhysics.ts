import { BALL, PITCH } from '../../shared/tuning';
import type { Ball } from '../entities/Ball';

const W = PITCH.width;
const H = PITCH.height;
const G_TOP = (H - PITCH.goalMouth) / 2;
const G_BOT = (H + PITCH.goalMouth) / 2;
const NET_TOP = PITCH.goalHeight * 0.7; // the net's roof slopes down to this at the back

export type BallContact = {
  goal: -1 | 0 | 1; // a goal was just scored in the left (-1) or right (1) net
  out: -1 | 0 | 1; // the ball just went out over the bar / end wall behind that goal
  hitWall: boolean;
  hitPost: boolean; // posts or crossbar
};

// Free flight for one fixed step: gravity and bounces, rolling or air drag,
// and spin that bends a fast ball's path a few degrees.
export function stepFreeBall(ball: Ball, dt: number) {
  ball.vz -= BALL.gravity * (1 + ball.dip) * dt;
  ball.z += ball.vz * dt;
  if (ball.z <= 0) {
    ball.z = 0;
    ball.dip = 0; // topspin only shapes the first flight
    ball.vz = ball.vz < -BALL.minBounceVz ? -ball.vz * BALL.bounce : 0;
  }
  const onGround = ball.z === 0 && ball.vz === 0;
  const keep = Math.pow(onGround ? BALL.groundDrag : BALL.airDrag, dt);
  ball.vx *= keep;
  ball.vy *= keep;
  if (onGround) {
    const speed = ball.speed;
    const slowed = Math.max(0, speed - BALL.rollFriction * dt);
    if (speed > 0) {
      ball.vx *= slowed / speed;
      ball.vy *= slowed / speed;
    }
  }

  if (ball.spin !== 0 && ball.speed > BALL.spinMinSpeed) {
    const a = ball.spin * dt;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const vx = ball.vx * c - ball.vy * s;
    ball.vy = ball.vx * s + ball.vy * c;
    ball.vx = vx;
  }
  ball.spin *= Math.pow(BALL.spinDecay, dt);

  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;
  if (onGround && ball.speed < BALL.stopSpeed) {
    ball.vx = 0;
    ball.vy = 0;
  }
}

// Walls, fence, posts, crossbar, nets and goal detection, for free and
// dribbled balls alike. The far wall and near fence return the ball, and so
// do the end walls either side of each goal (up to their height). At a goal
// line:
// - in the mouth, under the bar: into the net; fully over the line = goal;
// - at bar height: it hits the crossbar and comes back;
// - over the bar, or over an end wall: the ball is out behind that goal
//   (the match restarts with the defending keeper).
export function collideBall(ball: Ball): BallContact {
  const r = BALL.radius;
  const wb = BALL.wallBounce;
  const contact: BallContact = {
    goal: 0,
    out: 0,
    hitWall: false,
    hitPost: false,
  };
  if (ball.out !== 0) return contact; // flying off behind the goal; nothing to hit

  if (ball.y < r) {
    ball.y = r;
    ball.vy = Math.abs(ball.vy) * wb;
    contact.hitWall = true;
  } else if (ball.y > H - r) {
    ball.y = H - r;
    ball.vy = -Math.abs(ball.vy) * wb;
    contact.hitWall = true;
  }

  if (ball.inNet === 0) {
    for (const side of [-1, 1] as const) {
      const touchingLine = side < 0 ? ball.x < r : ball.x > W - r;
      if (!touchingLine) continue;
      const inMouthY = ball.y > G_TOP && ball.y < G_BOT;
      if (inMouthY && ball.z < PITCH.goalHeight - r) {
        const overLine = side < 0 ? ball.x < -r : ball.x > W + r;
        if (overLine) {
          ball.inNet = side;
          contact.goal = side;
        }
      } else if (inMouthY && ball.z < PITCH.goalHeight + r) {
        // Crossbar: back into play; under the bar it is knocked down, over it up.
        ball.x = side < 0 ? r : W - r;
        ball.vx = side < 0 ? Math.abs(ball.vx) * wb : -Math.abs(ball.vx) * wb;
        ball.vz = (ball.z < PITCH.goalHeight ? -1 : 1) * Math.abs(ball.vz) * wb;
        contact.hitPost = true;
      } else if (inMouthY || ball.z > PITCH.endWallHeight) {
        ball.out = side;
        contact.out = side;
        return contact;
      } else {
        ball.x = side < 0 ? r : W - r;
        ball.vx = side < 0 ? Math.abs(ball.vx) * wb : -Math.abs(ball.vx) * wb;
        contact.hitWall = true;
      }
    }
  }

  if (ball.inNet !== 0) holdInNet(ball, ball.inNet);

  for (const lineX of [0, W]) {
    for (const postY of [G_TOP, G_BOT]) {
      if (ball.z < PITCH.goalHeight && bounceOffPost(ball, lineX, postY))
        contact.hitPost = true;
    }
  }
  return contact;
}

// Keeps a scored ball inside the net box; the net soaks up most of its speed.
function holdInNet(ball: Ball, side: -1 | 1) {
  const r = BALL.radius;
  const nb = BALL.netBounce;
  const lineX = side < 0 ? 0 : W;
  const backX = lineX + side * PITCH.goalDepth;
  const minX = Math.min(backX, lineX) + r;
  const maxX = Math.max(backX, lineX) - r;
  if (ball.x < minX) {
    ball.x = minX;
    ball.vx = Math.abs(ball.vx) * nb;
  } else if (ball.x > maxX) {
    ball.x = maxX;
    ball.vx = -Math.abs(ball.vx) * nb;
  }
  if (ball.y < G_TOP + r) {
    ball.y = G_TOP + r;
    ball.vy = Math.abs(ball.vy) * nb;
  } else if (ball.y > G_BOT - r) {
    ball.y = G_BOT - r;
    ball.vy = -Math.abs(ball.vy) * nb;
  }
  if (ball.z > NET_TOP - r) {
    ball.z = NET_TOP - r;
    ball.vz = -Math.abs(ball.vz) * nb;
  }
}

// Posts are circles on the ground plane; returns true on contact.
function bounceOffPost(ball: Ball, px: number, py: number) {
  const dx = ball.x - px;
  const dy = ball.y - py;
  const d = Math.hypot(dx, dy);
  const min = BALL.radius + BALL.postRadius;
  if (d >= min || d === 0) return false;
  const nx = dx / d;
  const ny = dy / d;
  ball.x = px + nx * min;
  ball.y = py + ny * min;
  const vn = ball.vx * nx + ball.vy * ny;
  if (vn < 0) {
    ball.vx -= (1 + BALL.wallBounce) * vn * nx;
    ball.vy -= (1 + BALL.wallBounce) * vn * ny;
  }
  return true;
}
