export type ExportIconType =
  | 'clock'
  | 'pin'
  | 'checkCircle'
  | 'checkbox'
  | 'checkedCheckbox'
  | 'calendar'
  | 'list'
  | 'chart'
  | 'task'
  | 'user'
  | 'alertTriangle'
  | 'book'
  | 'target'
  | 'star';

export interface DrawIconOptions {
  color?: string;
  lineWidth?: number;
  filled?: boolean;
}

/**
 * Draws a crisp vector icon on a 2D Canvas context inside a bounding square [x, y, size, size].
 * All coordinates are normalized to [0, 1] and scaled to `size`.
 */
export function drawExportIcon(
  ctx: CanvasRenderingContext2D,
  type: ExportIconType,
  x: number,
  y: number,
  size: number,
  options: DrawIconOptions = {}
): void {
  ctx.save();
  const color = options.color || '#243B35';
  const lineWidth = options.lineWidth || Math.max(1.5, size * 0.08);

  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const cx = x + size / 2;
  const cy = y + size / 2;
  const r = (size / 2) * 0.85;

  switch (type) {
    case 'clock': {
      // Circle outline
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();

      // Hands (10:10 / standard clock time)
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx, cy - r * 0.55); // hour hand (up)
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + r * 0.45, cy); // minute hand (right)
      ctx.stroke();

      // Center dot
      ctx.beginPath();
      ctx.arc(cx, cy, lineWidth * 0.9, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'pin': {
      // Map location pin: head circle + bottom point + inner dot
      const pinR = r * 0.65;
      const headCy = cy - r * 0.25;

      ctx.beginPath();
      // Outer bulb & tip
      ctx.arc(cx, headCy, pinR, Math.PI * 0.8, Math.PI * 2.2, false);
      ctx.lineTo(cx, cy + r * 0.9);
      ctx.closePath();
      ctx.stroke();

      // Inner dot
      ctx.beginPath();
      ctx.arc(cx, headCy, pinR * 0.38, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'checkCircle': {
      if (options.filled) {
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();

        // White check inside
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = Math.max(2, size * 0.1);
        ctx.beginPath();
        ctx.moveTo(cx - r * 0.45, cy);
        ctx.lineTo(cx - r * 0.1, cy + r * 0.35);
        ctx.lineTo(cx + r * 0.45, cy - r * 0.35);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(cx - r * 0.45, cy);
        ctx.lineTo(cx - r * 0.1, cy + r * 0.35);
        ctx.lineTo(cx + r * 0.45, cy - r * 0.35);
        ctx.stroke();
      }
      break;
    }

    case 'checkbox': {
      const boxSize = size * 0.76;
      const bx = cx - boxSize / 2;
      const by = cy - boxSize / 2;
      const rad = boxSize * 0.22;

      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(bx, by, boxSize, boxSize, rad);
      } else {
        ctx.rect(bx, by, boxSize, boxSize);
      }
      ctx.stroke();
      break;
    }

    case 'checkedCheckbox': {
      const boxSize = size * 0.76;
      const bx = cx - boxSize / 2;
      const by = cy - boxSize / 2;
      const rad = boxSize * 0.22;

      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(bx, by, boxSize, boxSize, rad);
      } else {
        ctx.rect(bx, by, boxSize, boxSize);
      }
      ctx.fill();

      // White check inside
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = Math.max(2, size * 0.1);
      ctx.beginPath();
      ctx.moveTo(bx + boxSize * 0.25, by + boxSize * 0.52);
      ctx.lineTo(bx + boxSize * 0.45, by + boxSize * 0.72);
      ctx.lineTo(bx + boxSize * 0.78, by + boxSize * 0.3);
      ctx.stroke();
      break;
    }

    case 'calendar': {
      const w = size * 0.76;
      const h = size * 0.76;
      const bx = cx - w / 2;
      const by = cy - h / 2 + size * 0.05;
      const rad = w * 0.18;

      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(bx, by, w, h, rad);
      } else {
        ctx.rect(bx, by, w, h);
      }
      ctx.stroke();

      // Top divider bar
      const barY = by + h * 0.32;
      ctx.beginPath();
      ctx.moveTo(bx, barY);
      ctx.lineTo(bx + w, barY);
      ctx.stroke();

      // Rings / Pins at top
      const pinH = size * 0.14;
      ctx.beginPath();
      ctx.moveTo(bx + w * 0.3, by - pinH * 0.4);
      ctx.lineTo(bx + w * 0.3, by + pinH * 0.6);
      ctx.moveTo(bx + w * 0.7, by - pinH * 0.4);
      ctx.lineTo(bx + w * 0.7, by + pinH * 0.6);
      ctx.stroke();

      // Day grid dots inside
      const dotR = lineWidth * 0.65;
      const gridY = by + h * 0.65;
      ctx.beginPath();
      ctx.arc(bx + w * 0.32, gridY, dotR, 0, Math.PI * 2);
      ctx.arc(bx + w * 0.5, gridY, dotR, 0, Math.PI * 2);
      ctx.arc(bx + w * 0.68, gridY, dotR, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'list':
    case 'task': {
      const w = size * 0.74;
      const h = size * 0.74;
      const bx = cx - w / 2;
      const by = cy - h / 2;

      const lineSpacing = h / 3.2;
      for (let i = 0; i < 3; i++) {
        const lineY = by + (i + 0.6) * lineSpacing;

        // Bullet dot on right (RTL)
        ctx.beginPath();
        ctx.arc(bx + w - size * 0.08, lineY, lineWidth * 0.8, 0, Math.PI * 2);
        ctx.fill();

        // Line extending to left
        ctx.beginPath();
        ctx.moveTo(bx, lineY);
        ctx.lineTo(bx + w - size * 0.22, lineY);
        ctx.stroke();
      }
      break;
    }

    case 'chart': {
      const barW = size * 0.16;
      const spacing = size * 0.08;
      const baseX = cx - (3 * barW + 2 * spacing) / 2;
      const bottomY = cy + r * 0.75;

      const heights = [size * 0.35, size * 0.55, size * 0.75];
      for (let i = 0; i < 3; i++) {
        const curX = baseX + i * (barW + spacing);
        const curH = heights[i];
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
          ctx.roundRect(curX, bottomY - curH, barW, curH, barW * 0.3);
        } else {
          ctx.rect(curX, bottomY - curH, barW, curH);
        }
        ctx.fill();
      }
      break;
    }

    case 'user': {
      // Person icon: head circle + torso arc
      const headR = r * 0.42;
      const headCy = cy - r * 0.38;

      ctx.beginPath();
      ctx.arc(cx, headCy, headR, 0, Math.PI * 2);
      ctx.stroke();

      const torsoY = cy + r * 0.85;
      const torsoW = r * 0.95;
      ctx.beginPath();
      ctx.arc(cx, torsoY, torsoW, Math.PI * 1.15, Math.PI * 1.85, false);
      ctx.stroke();
      break;
    }

    case 'alertTriangle': {
      // Triangle with rounded corners and exclamation inside
      const topY = cy - r * 0.9;
      const botY = cy + r * 0.85;
      const halfW = r * 0.95;

      ctx.beginPath();
      ctx.moveTo(cx, topY);
      ctx.lineTo(cx + halfW, botY);
      ctx.lineTo(cx - halfW, botY);
      ctx.closePath();
      ctx.stroke();

      // Exclamation point
      ctx.beginPath();
      ctx.moveTo(cx, cy - r * 0.25);
      ctx.lineTo(cx, cy + r * 0.25);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(cx, cy + r * 0.55, lineWidth * 0.85, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'book': {
      const w = size * 0.76;
      const h = size * 0.65;
      const bx = cx - w / 2;
      const by = cy - h / 2;

      ctx.beginPath();
      // Center spine
      ctx.moveTo(cx, by);
      ctx.lineTo(cx, by + h);
      // Left page curve
      ctx.quadraticCurveTo(cx - w * 0.25, by + h - 2, bx, by + h);
      ctx.lineTo(bx, by);
      ctx.quadraticCurveTo(cx - w * 0.25, by - 2, cx, by);
      // Right page curve
      ctx.quadraticCurveTo(cx + w * 0.25, by - 2, bx + w, by);
      ctx.lineTo(bx + w, by + h);
      ctx.quadraticCurveTo(cx + w * 0.25, by + h - 2, cx, by + h);
      ctx.stroke();
      break;
    }

    case 'target': {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.55, 0, Math.PI * 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.2, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'star': {
      const spikes = 5;
      const outerR = r;
      const innerR = r * 0.45;
      let rot = (Math.PI / 2) * 3;
      const step = Math.PI / spikes;

      ctx.beginPath();
      ctx.moveTo(cx, cy - outerR);
      for (let i = 0; i < spikes; i++) {
        let sx = cx + Math.cos(rot) * outerR;
        let sy = cy + Math.sin(rot) * outerR;
        ctx.lineTo(sx, sy);
        rot += step;

        sx = cx + Math.cos(rot) * innerR;
        sy = cy + Math.sin(rot) * innerR;
        ctx.lineTo(sx, sy);
        rot += step;
      }
      ctx.lineTo(cx, cy - outerR);
      ctx.closePath();
      if (options.filled) {
        ctx.fill();
      } else {
        ctx.stroke();
      }
      break;
    }
  }

  ctx.restore();
}
