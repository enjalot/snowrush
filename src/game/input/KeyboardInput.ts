import type { InputState } from '../types';

export class KeyboardInput {
  private keys = new Set<string>();
  private justPressed = new Set<string>();

  constructor() {
    window.addEventListener('keydown', (e) => {
      if (!this.keys.has(e.code)) {
        this.justPressed.add(e.code);
      }
      this.keys.add(e.code);
      // Prevent spacebar from scrolling the page
      if (e.code === 'Space') e.preventDefault();
    });

    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });
  }

  poll(): InputState {
    let steer = 0;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) steer -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) steer += 1;

    let accelerate = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) accelerate += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) accelerate -= 1;

    const jump = this.justPressed.has('Space');
    const jumpHeld = this.keys.has('Space');
    const pause = this.justPressed.has('Escape');

    // Clear edge-triggered inputs
    this.justPressed.clear();

    return { steer, accelerate, jump, jumpHeld, pause };
  }
}
