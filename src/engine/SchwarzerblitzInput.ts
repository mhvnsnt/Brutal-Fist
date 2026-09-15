import type { InputBitmask } from '../types';

export type InputSample = InputBitmask & { frame: number };

export type MotionCommand =
  | 'forward'
  | 'back' |'forward-forward' |'back-back' |'quarter-forward' |'quarter-back';

const MAX_SAMPLES = 24;

export class SchwarzerblitzInputBuffer {
  private samples: InputSample[] = [];

  push(frame: number, input: InputBitmask) {
    this.samples.push({ frame, ...input });
    if (this.samples.length > MAX_SAMPLES) this.samples.shift();
  }

  clear() {
    this.samples.length = 0;
  }

  has(command: MotionCommand): boolean {
    const recent = this.samples.slice(-MAX_SAMPLES);
    if (recent.length < 2) return false;

    if (command === 'forward-forward') return this.hasDouble('forward');
    if (command === 'back-back') return this.hasDouble('back');
    if (command === 'quarter-forward') return this.hasQuarter(true);
    if (command === 'quarter-back') return this.hasQuarter(false);

    return recent.some((s) => command === 'forward'
      ? s.right && !s.left
      : command === 'back'
        ? s.left && !s.right
        : false);
  }

  private hasDouble(direction: 'forward' | 'back') {
    let presses = 0;
    let wasDown = false;
    for (const sample of this.samples.slice(-16)) {
      const down = direction === 'forward'
        ? sample.right && !sample.left
        : sample.left && !sample.right;
      if (down && !wasDown) presses++;
      wasDown = down;
    }
    return presses >= 2;
  }

  private hasQuarter(forward: boolean) {
    let sawVertical = false;
    let sawDiagonal = false;
    for (const sample of this.samples.slice(-12)) {
      const horizontal = forward ? sample.right : sample.left;
      if (sample.down) sawVertical = true;
      if (horizontal && sample.down) sawDiagonal = true;
    }
    return sawVertical && sawDiagonal;
  }
}
