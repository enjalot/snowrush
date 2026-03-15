import type { InputState } from '../types';
import { clamp } from '../utils/math';

export class TouchInput {
  isActive = false;
  private startX = 0;
  private startY = 0;
  private currentX = 0;
  private currentY = 0;
  private touching = false;
  private justReleased = false;
  private viewportWidth = 1;
  private viewportHeight = 1;

  constructor(canvas: HTMLCanvasElement) {
    const updateViewportSize = () => {
      const rect = canvas.getBoundingClientRect();
      this.viewportWidth = rect.width || window.innerWidth || 1;
      this.viewportHeight = rect.height || window.innerHeight || 1;
    };

    updateViewportSize();
    window.addEventListener('resize', updateViewportSize);

    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.isActive = true;
      updateViewportSize();
      const touch = e.touches[0];
      this.startX = touch.clientX;
      this.startY = touch.clientY;
      this.currentX = touch.clientX;
      this.currentY = touch.clientY;
      this.touching = true;
    }, { passive: false });

    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      this.currentX = touch.clientX;
      this.currentY = touch.clientY;
    }, { passive: false });

    const handleTouchEnd = (e: TouchEvent) => {
      e.preventDefault();
      const touch = e.changedTouches[0];
      if (touch) {
        this.currentX = touch.clientX;
        this.currentY = touch.clientY;
      }
      this.justReleased = this.touching;
      this.touching = false;
    };

    canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
    canvas.addEventListener('touchcancel', handleTouchEnd, { passive: false });
  }

  poll(): InputState {
    if (!this.touching && !this.justReleased) {
      return { steer: 0, accelerate: 0, jump: false, jumpHeld: false, pause: false };
    }

    const jump = this.justReleased;
    this.justReleased = false;

    if (!this.touching) {
      return { steer: 0, accelerate: 0, jump, jumpHeld: false, pause: false };
    }

    const dx = this.currentX - this.startX;
    const dy = this.currentY - this.startY;
    const horizontalRange = Math.max(64, this.viewportWidth * 0.18);
    const verticalRange = Math.max(64, this.viewportHeight * 0.14);
    const deadZone = 10;

    // Drag left/right to steer. Pull up to accelerate/frontflip, down to brake/backflip.
    const steer = Math.abs(dx) < deadZone ? 0 : clamp(dx / horizontalRange, -1, 1);
    const accelerate = Math.abs(dy) < deadZone ? 0 : clamp(-dy / verticalRange, -1, 1);

    return { steer, accelerate, jump, jumpHeld: true, pause: false };
  }
}
