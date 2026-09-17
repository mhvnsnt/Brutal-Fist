/**
 * Tekken-style directional commands.
 * Camera at +Z: toward cam = +Z (down), away = −Z (up).
 *
 *  tap up           jump (after the double-tap window, so tap-tap can sidestep)
 *  up+forward/back  jump immediately; forward/back still read while airborne
 *  double-tap up    sidestep away from camera (−Z)
 *  double-tap down  sidestep toward camera (+Z)
 *  hold down        crouch
 *  f,f              dash     f,f hold = run
 *  b,b              Korean backdash    b,b hold = run back
 */
const DOUBLE_MS = 220;
const HOLD_RUN_MS = 160;

export interface TekkenCommand {
  forward: number;
  strafe: number;
  crouch: boolean;
  jump: boolean;
  dashing: boolean;
  backdashing: boolean;
  running: boolean;
}

interface DirTap {
  last: number;
  heldSince: number;
  down: boolean;
}

function tap(): DirTap {
  return { last: 0, heldSince: 0, down: false };
}

export function createTekkenStick() {
  const f = tap();
  const b = tap();
  const u = tap();
  const d = tap();
  let pendingJump = false;
  let jumpPressAt = 0;
  let jumpUntil = 0;
  let sidestepUpUntil = 0;
  let sidestepDownUntil = 0;
  let dashUntil = 0;
  let backdashUntil = 0;

  const rise = (slot: DirTap, pressed: boolean, now: number): { rose: boolean; dbl: boolean; fell: boolean } => {
    const rose = pressed && !slot.down;
    const fell = !pressed && slot.down;
    const dbl = rose && now - slot.last < DOUBLE_MS;
    if (rose) {
      slot.down = true;
      slot.heldSince = now;
      slot.last = now;
    } else if (fell) {
      slot.down = false;
    }
    return { rose, dbl, fell };
  };

  return {
    resolve(held: { left: boolean; right: boolean; up: boolean; down: boolean }, now: number): TekkenCommand {
      const F = rise(f, held.right, now);
      const B = rise(b, held.left, now);
      const U = rise(u, held.up, now);
      const D = rise(d, held.down, now);

      if (U.dbl) {
        // Double-tap up wins over a pending single-tap jump.
        sidestepUpUntil = now + 280;
        pendingJump = false;
        jumpUntil = 0;
      } else if (U.rose && (f.down || b.down)) {
        jumpUntil = now + 480;
        pendingJump = false;
      } else if (U.rose) {
        pendingJump = true;
        jumpPressAt = now;
      } else if (pendingJump && (f.down || b.down)) {
        // Jump then press forward/back — air control, do not wait for simultaneous press.
        jumpUntil = now + 480;
        pendingJump = false;
      } else if (pendingJump && now - jumpPressAt >= DOUBLE_MS) {
        jumpUntil = now + 480;
        pendingJump = false;
      }

      if (D.dbl) sidestepDownUntil = now + 280;
      if (F.dbl) dashUntil = now + 320;
      if (B.dbl) backdashUntil = now + 280;

      const sidestepUp = now < sidestepUpUntil;
      const sidestepDown = now < sidestepDownUntil;
      const jumping = now < jumpUntil;
      const dashing = now < dashUntil && f.down;
      const backdashing = now < backdashUntil && !f.down;
      const running = dashing && f.down && now - f.heldSince > HOLD_RUN_MS;
      const runBack = backdashing && b.down && now - b.heldSince > HOLD_RUN_MS && !f.down;

      let forward = 0;
      if (running || dashing) forward = 1;
      else if (runBack || backdashing) forward = -1;
      else if (f.down && !b.down) forward = 1;
      else if (b.down && !f.down) forward = -1;

      let strafe = 0;
      if (sidestepUp) strafe = -1;
      else if (sidestepDown) strafe = 1;

      return {
        forward,
        strafe,
        crouch: d.down && !sidestepDown && !jumping,
        jump: jumping,
        dashing: dashing && !running,
        backdashing: backdashing && !runBack,
        running: running || runBack,
      };
    },
  };
}
