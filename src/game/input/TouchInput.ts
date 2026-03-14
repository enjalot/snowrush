import type { InputState } from '../types';
import { clamp } from '../utils/math';

export class TouchInput {
  isActive = false;
  private startX = 0;
  private startY = 0;
  private currentX = 0;
  private currentY = 0;
  private touching = false;
  private justJumped = false;
  private touchStartTime = 0;

  constructor(canvas: HTMLCanvasElement) {
    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.isActive = true;
      const touch = e.touches[0];
      this.startX = touch.clientX;
      this.startY = touch.clientY;
      this.currentX = touch.clientX;
      this.currentY = touch.clientY;
      this.touching = true;
      this.touchStartTime = performance.now();
    }, { passive: false });

    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      this.currentX = touch.clientX;
      this.currentY = touch.clientY;
    }, { passive: false });

    canvas.addEventListener('touchend', (e) => {
      e.preventDefault();
      // Quick upward swipe = jump
      const dt = performance.now() - this.touchStartTime;
      const dy = this.startY - this.currentY;
      if (dt < 300 && dy > 30) {
        this.justJumped = true;
      }
      this.touching = false;
    }, { passive: false });
  }

  poll(): InputState {
    if (!this.touching && !this.justJumped) {
      return { steer: 0, accelerate: 0, jump: false, jumpHeld: false, pause: false };
    }

    const dx = this.currentX - this.startX;
    const dy = this.currentY - this.startY;

    // Steer: horizontal drag normalized to screen width portion
    const maxDrag = 80;
    const steer = clamp(dx / maxDrag, -1, 1);

    // Accelerate: vertical drag (down = accelerate, up = brake)
    const accelerate = clamp(dy / maxDrag, -1, 1);

    const jump = this.justJumped;
    this.justJumped = false;

    return { steer, accelerate, jump, jumpHeld: false, pause: false };
  }
}
