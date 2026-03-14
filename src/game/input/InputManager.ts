import type { InputState } from '../types';
import { KeyboardInput } from './KeyboardInput';
import { TouchInput } from './TouchInput';

export class InputManager {
  private keyboard: KeyboardInput;
  private touch: TouchInput;
  state: InputState = { steer: 0, accelerate: 0, jump: false, jumpHeld: false, pause: false };

  constructor(canvas: HTMLCanvasElement) {
    this.keyboard = new KeyboardInput();
    this.touch = new TouchInput(canvas);
  }

  update() {
    if (this.touch.isActive) {
      this.state = this.touch.poll();
    } else {
      this.state = this.keyboard.poll();
    }
  }
}
