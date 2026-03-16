import * as THREE from 'three';

const WIDTH = 256;
const HEIGHT = 96;

export class RacerBillboard {
  readonly sprite: THREE.Sprite;

  private canvas: HTMLCanvasElement;
  private context: CanvasRenderingContext2D;
  private texture: THREE.CanvasTexture;
  private material: THREE.SpriteMaterial;
  private lastText = '';
  private readonly name: string;
  private readonly color: string;

  constructor(name: string, color: string) {
    this.name = name;
    this.color = color;
    this.canvas = document.createElement('canvas');
    this.canvas.width = WIDTH;
    this.canvas.height = HEIGHT;

    const context = this.canvas.getContext('2d');
    if (!context) {
      throw new Error('Unable to create 2D context for racer billboard.');
    }

    this.context = context;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.material = new THREE.SpriteMaterial({
      map: this.texture,
      transparent: true,
      depthWrite: false,
    });
    this.sprite = new THREE.Sprite(this.material);
    this.sprite.scale.set(3.1, 1.15, 1);
    this.draw('0');
  }

  update(score: number, position: THREE.Vector3, active: boolean) {
    const text = `${this.name} ${score}${active ? '' : ' KO'}`;
    if (text !== this.lastText) {
      this.draw(text);
    }

    this.sprite.position.copy(position);
    this.sprite.visible = true;
  }

  dispose() {
    this.material.dispose();
    this.texture.dispose();
  }

  private draw(text: string) {
    this.lastText = text;

    const ctx = this.context;
    ctx.clearRect(0, 0, WIDTH, HEIGHT);

    ctx.fillStyle = 'rgba(8, 13, 26, 0.72)';
    this.roundRect(8, 14, WIDTH - 16, HEIGHT - 28, 24);
    ctx.fill();

    ctx.strokeStyle = this.color;
    ctx.lineWidth = 4;
    this.roundRect(8, 14, WIDTH - 16, HEIGHT - 28, 24);
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = '700 30px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, WIDTH / 2, HEIGHT / 2 + 1);

    this.texture.needsUpdate = true;
  }

  private roundRect(x: number, y: number, width: number, height: number, radius: number) {
    const ctx = this.context;
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + width, y, x + width, y + height, radius);
    ctx.arcTo(x + width, y + height, x, y + height, radius);
    ctx.arcTo(x, y + height, x, y, radius);
    ctx.arcTo(x, y, x + width, y, radius);
    ctx.closePath();
  }
}
