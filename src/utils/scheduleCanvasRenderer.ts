import {
  WeekScheduleLayout,
  MonthScheduleLayout,
  TimetableScheduleLayout,
  StoryScheduleLayout,
  StoryPageLayout,
  CoursesScheduleLayout,
  UpcomingScheduleLayout,
  SummaryScheduleLayout,
  AnyScheduleLayout,
  HeaderLayout,
  FooterLayout,
  THEME,
  CATEGORY_COLORS,
} from './scheduleLayout';
import { drawExportIcon, ExportIconType } from './exportIcons';

/**
 * Calculates a safe rendering pixel ratio scale (2.0 -> 1.5 -> 1.0)
 * so total physical canvas dimension (width * scale and height * scale) never exceeds 14,000px,
 * preventing memory crashes on Android WebViews.
 */
export function calculateSafeScale(logicalHeight: number, logicalWidth: number = 1080): number {
  const maxDim = Math.max(logicalHeight, logicalWidth);
  if (maxDim * 2 <= 14000) {
    return 2.0;
  }
  if (maxDim * 1.5 <= 14000) {
    return 1.5;
  }
  return 1.0;
}

/**
 * Ensures Tajawal font faces are fully loaded in browser context before measurement or rendering.
 */
export async function ensureFontsLoaded(): Promise<void> {
  if (typeof document !== 'undefined' && document.fonts && document.fonts.load) {
    try {
      await Promise.all([
        document.fonts.load('400 20px Tajawal'),
        document.fonts.load('500 20px Tajawal'),
        document.fonts.load('600 20px Tajawal'),
        document.fonts.load('700 24px Tajawal'),
        document.fonts.ready,
      ]);
    } catch (e) {
      console.warn('Font loading check notice:', e);
    }
  }
}

/**
 * Loads image asset asynchronously with graceful fallback.
 */
function loadLogoImage(src: string): Promise<HTMLImageElement | null> {
  if (typeof window === 'undefined' || typeof Image === 'undefined') {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
    setTimeout(() => resolve(null), 1500);
  });
}

/**
 * Helper to draw a rounded card with solid background and stroke border.
 */
function drawCard(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number = 24,
  fillColor: string = THEME.cardBg,
  strokeColor: string = THEME.cardBorder,
  lineWidth: number = 1.5
): void {
  ctx.save();
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, width, height, radius);
  } else {
    ctx.rect(x, y, width, height);
  }
  ctx.fillStyle = fillColor;
  ctx.fill();

  if (strokeColor) {
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Unified text drawing helper ensuring RTL direction and consistent baseline.
 */
function drawRTLText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  font: string,
  color: string,
  align: CanvasTextAlign = 'right',
  baseline: CanvasTextBaseline = 'middle'
): void {
  ctx.save();
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.direction = 'rtl';
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  ctx.fillText(text, x, y);
  ctx.restore();
}

/**
 * Helper to draw an icon followed by text aligned in RTL.
 */
function drawIconWithText(
  ctx: CanvasRenderingContext2D,
  iconType: ExportIconType,
  text: string,
  rightX: number,
  centerY: number,
  iconSize: number = 20,
  font: string = '500 20px Tajawal',
  textColor: string = THEME.text,
  iconColor?: string,
  gap: number = 8
): void {
  const finalIconColor = iconColor || textColor;
  drawExportIcon(ctx, iconType, rightX - iconSize, centerY - iconSize / 2, iconSize, {
    color: finalIconColor,
  });

  const textRightX = rightX - iconSize - gap;
  drawRTLText(ctx, text, textRightX, centerY, font, textColor, 'right', 'middle');
}

/**
 * Renders unified header.
 */
async function renderHeader(
  ctx: CanvasRenderingContext2D,
  header: HeaderLayout,
  logoImg: HTMLImageElement | null
): Promise<void> {
  const { bounds, logoBounds, title, titleFont, subtitle, subtitleFont, periodBadge } = header;

  // 1. Draw Logo
  if (logoImg) {
    ctx.save();
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(logoBounds.x, logoBounds.y, logoBounds.width, logoBounds.height, 16);
    } else {
      ctx.rect(logoBounds.x, logoBounds.y, logoBounds.width, logoBounds.height);
    }
    ctx.clip();
    ctx.drawImage(logoImg, logoBounds.x, logoBounds.y, logoBounds.width, logoBounds.height);
    ctx.restore();
  } else {
    drawCard(
      ctx,
      logoBounds.x,
      logoBounds.y,
      logoBounds.width,
      logoBounds.height,
      16,
      THEME.primary,
      ''
    );
    drawExportIcon(
      ctx,
      'calendar',
      logoBounds.x + 12,
      logoBounds.y + 12,
      logoBounds.width - 24,
      { color: '#F6F3EE' }
    );
  }

  // 2. Titles next to logo (RTL: to the left of logo)
  const titleX = logoBounds.x - 18;
  drawRTLText(ctx, title, titleX, logoBounds.y + 18, titleFont, THEME.primary, 'right', 'middle');
  drawRTLText(
    ctx,
    subtitle,
    titleX,
    logoBounds.y + 46,
    subtitleFont,
    THEME.textSecondary,
    'right',
    'middle'
  );

  // 3. Period Badge on the far left
  drawCard(
    ctx,
    periodBadge.bounds.x,
    periodBadge.bounds.y,
    periodBadge.bounds.width,
    periodBadge.bounds.height,
    22,
    THEME.badgeBg,
    '#DCD4C4',
    1.2
  );

  const badgeCenterX = periodBadge.bounds.x + periodBadge.bounds.width / 2;
  const badgeCenterY = periodBadge.bounds.y + periodBadge.bounds.height / 2;
  drawRTLText(
    ctx,
    periodBadge.text,
    badgeCenterX,
    badgeCenterY,
    periodBadge.font,
    THEME.primary,
    'center',
    'middle'
  );
}

/**
 * Renders unified footer.
 */
function renderFooter(ctx: CanvasRenderingContext2D, footer: FooterLayout): void {
  const { bounds, text, font } = footer;
  const centerX = bounds.x + bounds.width / 2;
  const centerY = bounds.y + bounds.height / 2;
  drawRTLText(ctx, text, centerX, centerY, font, THEME.textSecondary, 'center', 'middle');
}

// ---------------------------------------------------------------------------
// 1. Render Week
// ---------------------------------------------------------------------------

export async function renderWeekToCanvas(
  layout: WeekScheduleLayout,
  canvas?: HTMLCanvasElement
): Promise<HTMLCanvasElement> {
  await ensureFontsLoaded();
  const targetCanvas = canvas || document.createElement('canvas');
  const scale = calculateSafeScale(layout.height, layout.width);

  targetCanvas.width = Math.round(layout.width * scale);
  targetCanvas.height = Math.round(layout.height * scale);

  const ctx = targetCanvas.getContext('2d');
  if (!ctx) throw new Error('تعذر الوصول إلى سياق الرسم 2D');

  ctx.scale(scale, scale);

  // Background
  ctx.fillStyle = THEME.bg;
  ctx.fillRect(0, 0, layout.width, layout.height);

  const logo = await loadLogoImage('/icons/icon-192.png');
  await renderHeader(ctx, layout.header, logo);

  // Summary Cards
  for (const card of layout.summary.cards) {
    drawCard(ctx, card.bounds.x, card.bounds.y, card.bounds.width, card.bounds.height, 20);
    const cardRightX = card.bounds.x + card.bounds.width - 20;
    const cardTopY = card.bounds.y + 16;

    drawExportIcon(ctx, card.iconType, cardRightX - 22, cardTopY, 22, {
      color: card.iconColor,
    });
    drawRTLText(
      ctx,
      card.title,
      cardRightX - 30,
      cardTopY + 11,
      '600 18px Tajawal',
      THEME.textSecondary
    );
    drawRTLText(
      ctx,
      card.value,
      cardRightX,
      card.bounds.y + 54,
      '700 24px Tajawal',
      card.valueColor
    );
    if (card.subtitle) {
      drawRTLText(
        ctx,
        card.subtitle,
        card.bounds.x + 18,
        card.bounds.y + 54,
        '500 16px Tajawal',
        THEME.textMuted,
        'left'
      );
    }
  }

  // Days
  for (const day of layout.days) {
    drawCard(
      ctx,
      day.cardBounds.x,
      day.cardBounds.y,
      day.cardBounds.width,
      day.cardBounds.height,
      24
    );

    // Day Header
    const colRightX = day.dayColumnBounds.x + day.dayColumnBounds.width - 24;
    const colCenterY = day.dayColumnBounds.y + 36;
    drawRTLText(ctx, day.dayName, colRightX, colCenterY, '700 24px Tajawal', THEME.primary);
    drawRTLText(
      ctx,
      day.dateNumberText,
      colRightX,
      colCenterY + 28,
      '500 18px Tajawal',
      THEME.textSecondary
    );

    if (day.isToday) {
      drawCard(
        ctx,
        colRightX - 110,
        colCenterY + 48,
        64,
        24,
        12,
        THEME.primary,
        ''
      );
      drawRTLText(
        ctx,
        'النهارده',
        colRightX - 110 + 32,
        colCenterY + 60,
        '700 14px Tajawal',
        '#FFFFFF',
        'center'
      );
    }

    if (day.isEmpty) {
      drawRTLText(
        ctx,
        'يوم رايق ومفيش مواعيد مسجلة',
        day.cardBounds.x + day.cardBounds.width - 200,
        day.cardBounds.y + day.cardBounds.height / 2,
        '500 20px Tajawal',
        THEME.textMuted
      );
    } else {
      // Events
      for (const evt of day.events) {
        const itemRightX = evt.bounds.x + evt.bounds.width;
        drawCard(
          ctx,
          evt.bounds.x,
          evt.bounds.y,
          evt.bounds.width,
          evt.bounds.height,
          16,
          '#FBF9F5',
          '#EFEBE4'
        );

        // Category accent strip
        ctx.fillStyle = evt.categoryColor;
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
          ctx.roundRect(itemRightX - 6, evt.bounds.y, 6, evt.bounds.height, [0, 16, 16, 0]);
        } else {
          ctx.rect(itemRightX - 6, evt.bounds.y, 6, evt.bounds.height);
        }
        ctx.fill();

        // Time
        drawRTLText(
          ctx,
          evt.timeText,
          itemRightX - 20,
          evt.bounds.y + 24,
          evt.timeFont,
          THEME.primary
        );

        // Titles
        const textRightX = itemRightX - 160;
        let lineY = evt.bounds.y + 22;
        for (const line of evt.titleLines) {
          drawRTLText(ctx, line, textRightX, lineY, evt.titleFont, THEME.text);
          lineY += 26;
        }

        if (evt.locationText) {
          drawIconWithText(
            ctx,
            'pin',
            evt.locationText,
            textRightX,
            lineY + 4,
            16,
            evt.locationFont || '500 18px Tajawal',
            THEME.textSecondary
          );
        }

        if (evt.isCompleted) {
          drawExportIcon(ctx, 'checkCircle', evt.bounds.x + 16, evt.bounds.y + 16, 22, {
            color: THEME.sage,
            filled: true,
          });
        }
      }

      // Tasks
      for (const t of day.tasks) {
        const tRightX = t.bounds.x + t.bounds.width;
        drawExportIcon(
          ctx,
          t.isCompleted ? 'checkedCheckbox' : 'checkbox',
          tRightX - 24,
          t.bounds.y + 6,
          20,
          { color: t.isCompleted ? THEME.sage : THEME.textSecondary }
        );

        let tLineY = t.bounds.y + 16;
        for (const line of t.titleLines) {
          drawRTLText(
            ctx,
            line,
            tRightX - 34,
            tLineY,
            t.titleFont,
            t.isCompleted ? THEME.textMuted : THEME.text
          );
          tLineY += 24;
        }
      }
    }
  }

  renderFooter(ctx, layout.footer);
  return targetCanvas;
}

// ---------------------------------------------------------------------------
// 2. Render Month
// ---------------------------------------------------------------------------

export async function renderMonthToCanvas(
  layout: MonthScheduleLayout,
  canvas?: HTMLCanvasElement
): Promise<HTMLCanvasElement> {
  await ensureFontsLoaded();
  const targetCanvas = canvas || document.createElement('canvas');
  const scale = calculateSafeScale(layout.height, layout.width);

  targetCanvas.width = Math.round(layout.width * scale);
  targetCanvas.height = Math.round(layout.height * scale);

  const ctx = targetCanvas.getContext('2d');
  if (!ctx) throw new Error('تعذر الوصول إلى سياق الرسم 2D');

  ctx.scale(scale, scale);

  ctx.fillStyle = THEME.bg;
  ctx.fillRect(0, 0, layout.width, layout.height);

  const logo = await loadLogoImage('/icons/icon-192.png');
  await renderHeader(ctx, layout.header, logo);

  // Summary
  for (const card of layout.summary.cards) {
    drawCard(ctx, card.bounds.x, card.bounds.y, card.bounds.width, card.bounds.height, 20);
    const cardRightX = card.bounds.x + card.bounds.width - 20;
    const cardTopY = card.bounds.y + 16;

    drawExportIcon(ctx, card.iconType, cardRightX - 22, cardTopY, 22, {
      color: card.iconColor,
    });
    drawRTLText(
      ctx,
      card.title,
      cardRightX - 30,
      cardTopY + 11,
      '600 18px Tajawal',
      THEME.textSecondary
    );
    drawRTLText(
      ctx,
      card.value,
      cardRightX,
      card.bounds.y + 54,
      '700 24px Tajawal',
      card.valueColor
    );
    if (card.subtitle) {
      drawRTLText(
        ctx,
        card.subtitle,
        card.bounds.x + 18,
        card.bounds.y + 54,
        '500 16px Tajawal',
        THEME.textMuted,
        'left'
      );
    }
  }

  // Weekday Headers
  for (const dCol of layout.weekdayHeader.days) {
    drawRTLText(
      ctx,
      dCol.text,
      dCol.bounds.x + dCol.bounds.width / 2,
      dCol.bounds.y + dCol.bounds.height / 2,
      '700 20px Tajawal',
      THEME.primary,
      'center'
    );
  }

  // Grid Weeks
  for (const w of layout.weeks) {
    for (const cell of w.cells) {
      drawCard(
        ctx,
        cell.bounds.x,
        cell.bounds.y,
        cell.bounds.width,
        cell.bounds.height,
        14,
        cell.isCurrentMonth ? THEME.cardBg : THEME.dimmedCellBg,
        THEME.cardBorder
      );

      // Day Number
      const numX = cell.bounds.x + cell.bounds.width - 12;
      const numY = cell.bounds.y + 18;
      const numColor = cell.isCurrentMonth ? THEME.primary : THEME.textMuted;
      drawRTLText(ctx, `${cell.dayNumber}`, numX, numY, '700 20px Tajawal', numColor);

      if (cell.isToday) {
        drawExportIcon(ctx, 'star', cell.bounds.x + 12, cell.bounds.y + 10, 16, {
          color: THEME.accent,
          filled: true,
        });
      }

      // Items in cell
      for (const it of cell.items) {
        drawCard(
          ctx,
          it.bounds.x,
          it.bounds.y,
          it.bounds.width,
          it.bounds.height,
          8,
          '#FBF9F5',
          it.categoryColor || '#E4DED4',
          1
        );

        const itRightX = it.bounds.x + it.bounds.width - 6;
        let lineY = it.bounds.y + 14;
        for (const line of it.titleLines) {
          drawRTLText(
            ctx,
            line,
            itRightX,
            lineY,
            '600 16px Tajawal',
            it.isCompleted ? THEME.textMuted : THEME.text
          );
          lineY += 20;
        }
      }
    }
  }

  // Legend
  if (layout.legend) {
    drawCard(
      ctx,
      layout.legend.bounds.x,
      layout.legend.bounds.y,
      layout.legend.bounds.width,
      layout.legend.bounds.height,
      18
    );
    for (const item of layout.legend.items) {
      ctx.fillStyle = item.color;
      ctx.beginPath();
      ctx.arc(item.bounds.x + item.bounds.width - 10, item.bounds.y + 14, 8, 0, Math.PI * 2);
      ctx.fill();

      drawRTLText(
        ctx,
        item.label,
        item.bounds.x + item.bounds.width - 24,
        item.bounds.y + 14,
        '600 18px Tajawal',
        THEME.text
      );
    }
  }

  renderFooter(ctx, layout.footer);
  return targetCanvas;
}

// ---------------------------------------------------------------------------
// 3. Render Timetable (جدول المحاضرات 2000px)
// ---------------------------------------------------------------------------

export async function renderTimetableToCanvas(
  layout: TimetableScheduleLayout,
  canvas?: HTMLCanvasElement
): Promise<HTMLCanvasElement> {
  await ensureFontsLoaded();
  const targetCanvas = canvas || document.createElement('canvas');
  const scale = calculateSafeScale(layout.height, layout.width);

  targetCanvas.width = Math.round(layout.width * scale);
  targetCanvas.height = Math.round(layout.height * scale);

  const ctx = targetCanvas.getContext('2d');
  if (!ctx) throw new Error('تعذر الوصول إلى سياق الرسم 2D');

  ctx.scale(scale, scale);

  ctx.fillStyle = THEME.bg;
  ctx.fillRect(0, 0, layout.width, layout.height);

  const logo = await loadLogoImage('/icons/icon-192.png');
  await renderHeader(ctx, layout.header, logo);

  if (layout.isEmpty) {
    const cardY = layout.header.bounds.y + layout.header.bounds.height + 40;
    drawCard(ctx, layout.gridBounds.x, cardY, layout.width - 2 * layout.gridBounds.x, 220, 24);
    drawExportIcon(
      ctx,
      'calendar',
      layout.width / 2 - 28,
      cardY + 50,
      56,
      { color: THEME.accent }
    );
    drawRTLText(
      ctx,
      layout.emptyMessage || 'مفيش محاضرات أو مواعيد الأسبوع ده',
      layout.width / 2,
      cardY + 140,
      '700 28px Tajawal',
      THEME.primary,
      'center'
    );
    renderFooter(ctx, layout.footer);
    return targetCanvas;
  }

  // Draw Grid Header (Hour Marks)
  for (const mark of layout.hourMarks) {
    drawRTLText(
      ctx,
      mark.label,
      mark.x,
      layout.gridBounds.y + 22,
      '700 20px Tajawal',
      THEME.primary,
      'center'
    );

    // Vertical guide line across full grid height
    ctx.strokeStyle = '#E4DED4';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(mark.x, layout.gridBounds.y + 44);
    ctx.lineTo(mark.x, layout.gridBounds.y + layout.gridBounds.height);
    ctx.stroke();

    // Half-hour dashed line (to the left in RTL)
    if (mark.hour24 < layout.endHour) {
      const halfX = mark.x - layout.pxPerHour / 2;
      ctx.save();
      ctx.setLineDash([4, 6]);
      ctx.strokeStyle = '#EFEBE4';
      ctx.beginPath();
      ctx.moveTo(halfX, layout.gridBounds.y + 44);
      ctx.lineTo(halfX, layout.gridBounds.y + layout.gridBounds.height);
      ctx.stroke();
      ctx.restore();
    }
  }

  // Day Rows & Blocks
  for (const day of layout.days) {
    // Row background card
    drawCard(ctx, day.bounds.x, day.bounds.y, day.bounds.width, day.bounds.height, 20);

    // Day label column on the right
    const colRightX = day.bounds.x + day.bounds.width - 24;
    const colCenterY = day.bounds.y + day.bounds.height / 2;

    drawRTLText(
      ctx,
      day.dayName,
      colRightX,
      colCenterY - 12,
      '700 26px Tajawal',
      THEME.primary
    );
    drawRTLText(
      ctx,
      day.dateFormatted,
      colRightX,
      colCenterY + 18,
      '500 18px Tajawal',
      THEME.textSecondary
    );

    if (day.isToday) {
      drawCard(
        ctx,
        colRightX - 110,
        colCenterY + 36,
        64,
        22,
        11,
        THEME.primary,
        ''
      );
      drawRTLText(
        ctx,
        'النهارده',
        colRightX - 110 + 32,
        colCenterY + 47,
        '700 14px Tajawal',
        '#FFFFFF',
        'center'
      );
    }

    // Event blocks
    for (const block of day.events) {
      const alpha = block.isCompleted ? 0.7 : 1.0;
      ctx.save();
      ctx.globalAlpha = alpha;

      drawCard(
        ctx,
        block.bounds.x,
        block.bounds.y,
        block.bounds.width,
        block.bounds.height,
        14,
        '#FFFFFF',
        block.categoryColor,
        2
      );

      // Accent strip on the right edge of block
      ctx.fillStyle = block.categoryColor;
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(
          block.bounds.x + block.bounds.width - 6,
          block.bounds.y,
          6,
          block.bounds.height,
          [0, 14, 14, 0]
        );
      } else {
        ctx.rect(block.bounds.x + block.bounds.width - 6, block.bounds.y, 6, block.bounds.height);
      }
      ctx.fill();

      // Block Content
      const blockRightX = block.bounds.x + block.bounds.width - 16;
      let lineY = block.bounds.y + 22;

      for (const line of block.titleLines) {
        drawRTLText(ctx, line, blockRightX, lineY, '700 20px Tajawal', THEME.text);
        lineY += 24;
      }

      drawRTLText(
        ctx,
        block.timeText,
        blockRightX,
        lineY,
        '600 16px Tajawal',
        THEME.primary
      );

      if (block.locationText && block.bounds.height >= 80) {
        drawIconWithText(
          ctx,
          'pin',
          block.locationText,
          blockRightX,
          lineY + 22,
          14,
          '500 15px Tajawal',
          THEME.textSecondary
        );
      }

      if (block.isCompleted) {
        drawExportIcon(ctx, 'checkCircle', block.bounds.x + 10, block.bounds.y + 10, 18, {
          color: THEME.sage,
          filled: true,
        });
      }

      ctx.restore();
    }
  }

  // Legend
  if (layout.legend) {
    drawCard(
      ctx,
      layout.legend.bounds.x,
      layout.legend.bounds.y,
      layout.legend.bounds.width,
      layout.legend.bounds.height,
      18
    );
    for (const item of layout.legend.items) {
      ctx.fillStyle = item.color;
      ctx.beginPath();
      ctx.arc(item.bounds.x + item.bounds.width - 12, item.bounds.y + 16, 9, 0, Math.PI * 2);
      ctx.fill();

      drawRTLText(
        ctx,
        item.label,
        item.bounds.x + item.bounds.width - 28,
        item.bounds.y + 16,
        '600 20px Tajawal',
        THEME.text
      );
    }
  }

  renderFooter(ctx, layout.footer);
  return targetCanvas;
}

// ---------------------------------------------------------------------------
// 4. Render Story Page (جدول اليوم - ستوري 1080x1920)
// ---------------------------------------------------------------------------

export async function renderStoryToCanvas(
  layout: StoryScheduleLayout,
  pageIndex: number = 0,
  canvas?: HTMLCanvasElement
): Promise<HTMLCanvasElement> {
  await ensureFontsLoaded();
  const targetCanvas = canvas || document.createElement('canvas');
  const scale = calculateSafeScale(layout.height, layout.width);

  targetCanvas.width = Math.round(layout.width * scale);
  targetCanvas.height = Math.round(layout.height * scale);

  const ctx = targetCanvas.getContext('2d');
  if (!ctx) throw new Error('تعذر الوصول إلى سياق الرسم 2D');

  ctx.scale(scale, scale);

  ctx.fillStyle = THEME.bg;
  ctx.fillRect(0, 0, layout.width, layout.height);

  const logo = await loadLogoImage('/icons/icon-192.png');
  await renderHeader(ctx, layout.header, logo);

  const page = layout.pages[pageIndex] || layout.pages[0];

  if (layout.isEmpty || !page || page.items.length === 0) {
    const cardY = 500;
    drawCard(ctx, 100, cardY, layout.width - 200, 320, 28);
    drawExportIcon(ctx, 'star', layout.width / 2 - 36, cardY + 60, 72, {
      color: THEME.accent,
      filled: true,
    });
    drawRTLText(
      ctx,
      layout.emptyMessage || 'يومك رايق ومفيش مواعيد أو مهام مسجلة',
      layout.width / 2,
      cardY + 180,
      '700 32px Tajawal',
      THEME.primary,
      'center'
    );
    drawRTLText(
      ctx,
      'استمتع بيومك وخليك مستعد للي جاي!',
      layout.width / 2,
      cardY + 230,
      '500 22px Tajawal',
      THEME.textSecondary,
      'center'
    );
    renderFooter(ctx, layout.footer);
    return targetCanvas;
  }

  // Draw Page indicator if multiple pages
  if (page.totalPages > 1) {
    const pageText = `صفحة ${page.pageIndex + 1} من ${page.totalPages}`;
    drawRTLText(
      ctx,
      pageText,
      layout.width - 60,
      layout.header.bounds.y + layout.header.bounds.height + 20,
      '700 20px Tajawal',
      THEME.accent
    );
  }

  // Timeline Rail on the right
  const railX = layout.width - 120;
  const firstItem = page.items[0];
  const lastItem = page.items[page.items.length - 1];

  if (firstItem && lastItem) {
    ctx.strokeStyle = '#E4DED4';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(railX, firstItem.nodeY);
    ctx.lineTo(railX, lastItem.nodeY);
    ctx.stroke();
  }

  // Timeline Items
  for (const item of page.items) {
    // Node circle
    ctx.fillStyle = item.categoryColor;
    ctx.beginPath();
    ctx.arc(railX, item.nodeY, 12, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(railX, item.nodeY, 5, 0, Math.PI * 2);
    ctx.fill();

    // Time text on right side of rail
    drawRTLText(
      ctx,
      item.timeText,
      railX - 22,
      item.nodeY,
      '700 20px Tajawal',
      THEME.primary
    );

    // Card on left side
    drawCard(
      ctx,
      item.cardBounds.x,
      item.cardBounds.y,
      item.cardBounds.width,
      item.cardBounds.height,
      20
    );

    const cardRightX = item.cardBounds.x + item.cardBounds.width - 24;
    let lineY = item.cardBounds.y + 32;

    // Title
    for (const line of item.titleLines) {
      drawRTLText(ctx, line, cardRightX, lineY, '700 24px Tajawal', THEME.text);
      lineY += 32;
    }

    // Category / Location row
    if (item.categoryLabel) {
      drawCard(
        ctx,
        cardRightX - 100,
        lineY - 14,
        96,
        28,
        14,
        item.categoryColor,
        ''
      );
      drawRTLText(
        ctx,
        item.categoryLabel,
        cardRightX - 52,
        lineY,
        '700 16px Tajawal',
        '#FFFFFF',
        'center'
      );
    }

    if (item.locationText) {
      const locX = item.categoryLabel ? cardRightX - 116 : cardRightX;
      drawIconWithText(
        ctx,
        'pin',
        item.locationText,
        locX,
        lineY,
        18,
        '500 20px Tajawal',
        THEME.textSecondary
      );
    }

    if (item.isCompleted) {
      drawExportIcon(
        ctx,
        'checkCircle',
        item.cardBounds.x + 20,
        item.cardBounds.y + 20,
        26,
        { color: THEME.sage, filled: true }
      );
    }
  }

  renderFooter(ctx, layout.footer);
  return targetCanvas;
}

// ---------------------------------------------------------------------------
// 5. Render Courses (جدول المواد 1080px)
// ---------------------------------------------------------------------------

export async function renderCoursesToCanvas(
  layout: CoursesScheduleLayout,
  canvas?: HTMLCanvasElement
): Promise<HTMLCanvasElement> {
  await ensureFontsLoaded();
  const targetCanvas = canvas || document.createElement('canvas');
  const scale = calculateSafeScale(layout.height, layout.width);

  targetCanvas.width = Math.round(layout.width * scale);
  targetCanvas.height = Math.round(layout.height * scale);

  const ctx = targetCanvas.getContext('2d');
  if (!ctx) throw new Error('تعذر الوصول إلى سياق الرسم 2D');

  ctx.scale(scale, scale);

  ctx.fillStyle = THEME.bg;
  ctx.fillRect(0, 0, layout.width, layout.height);

  const logo = await loadLogoImage('/icons/icon-192.png');
  await renderHeader(ctx, layout.header, logo);

  if (layout.hasNoCourses && layout.courses.length === 0) {
    const cardY = layout.header.bounds.y + layout.header.bounds.height + 40;
    drawCard(ctx, 48, cardY, layout.width - 96, 220, 24);
    drawExportIcon(ctx, 'book', layout.width / 2 - 28, cardY + 50, 56, {
      color: THEME.accent,
    });
    drawRTLText(
      ctx,
      layout.emptyMessage || 'مفيش مواد مسجلة في هذا الأسبوع',
      layout.width / 2,
      cardY + 140,
      '700 24px Tajawal',
      THEME.primary,
      'center'
    );
    renderFooter(ctx, layout.footer);
    return targetCanvas;
  }

  for (const c of layout.courses) {
    drawCard(ctx, c.bounds.x, c.bounds.y, c.bounds.width, c.bounds.height, 24);

    // Accent strip
    ctx.fillStyle = c.accentColor;
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(
        c.bounds.x + c.bounds.width - 8,
        c.bounds.y,
        8,
        c.bounds.height,
        [0, 24, 24, 0]
      );
    } else {
      ctx.rect(c.bounds.x + c.bounds.width - 8, c.bounds.y, 8, c.bounds.height);
    }
    ctx.fill();

    // Course Header
    const headRightX = c.bounds.x + c.bounds.width - 28;
    drawRTLText(
      ctx,
      c.courseName,
      headRightX,
      c.bounds.y + 36,
      '700 28px Tajawal',
      THEME.primary
    );

    if (c.instructor) {
      drawIconWithText(
        ctx,
        'user',
        c.instructor,
        headRightX,
        c.bounds.y + 68,
        20,
        '600 20px Tajawal',
        THEME.textSecondary
      );
    }

    // Events Rows
    for (const evt of c.events) {
      drawCard(
        ctx,
        evt.bounds.x,
        evt.bounds.y,
        evt.bounds.width,
        evt.bounds.height,
        14,
        '#FBF9F5',
        '#EFEBE4'
      );

      const evtRightX = evt.bounds.x + evt.bounds.width - 16;
      const centerY = evt.bounds.y + evt.bounds.height / 2;

      // Day & Time
      drawRTLText(
        ctx,
        `${evt.dayName} · ${evt.timeFormatted}`,
        evtRightX,
        centerY,
        '700 20px Tajawal',
        THEME.primary
      );

      // Location
      if (evt.locationText) {
        drawIconWithText(
          ctx,
          'pin',
          evt.locationText,
          evtRightX - 320,
          centerY,
          18,
          '500 18px Tajawal',
          THEME.textSecondary
        );
      }

      // Category badge on left
      drawCard(
        ctx,
        evt.bounds.x + 16,
        centerY - 14,
        96,
        28,
        14,
        evt.categoryColor,
        ''
      );
      drawRTLText(
        ctx,
        evt.categoryLabel,
        evt.bounds.x + 16 + 48,
        centerY,
        '700 16px Tajawal',
        '#FFFFFF',
        'center'
      );
    }
  }

  renderFooter(ctx, layout.footer);
  return targetCanvas;
}

// ---------------------------------------------------------------------------
// 6. Render Upcoming (اللي قدامك 14 يوم 1080px)
// ---------------------------------------------------------------------------

export async function renderUpcomingToCanvas(
  layout: UpcomingScheduleLayout,
  canvas?: HTMLCanvasElement
): Promise<HTMLCanvasElement> {
  await ensureFontsLoaded();
  const targetCanvas = canvas || document.createElement('canvas');
  const scale = calculateSafeScale(layout.height, layout.width);

  targetCanvas.width = Math.round(layout.width * scale);
  targetCanvas.height = Math.round(layout.height * scale);

  const ctx = targetCanvas.getContext('2d');
  if (!ctx) throw new Error('تعذر الوصول إلى سياق الرسم 2D');

  ctx.scale(scale, scale);

  ctx.fillStyle = THEME.bg;
  ctx.fillRect(0, 0, layout.width, layout.height);

  const logo = await loadLogoImage('/icons/icon-192.png');
  await renderHeader(ctx, layout.header, logo);

  if (layout.isEmpty || layout.groups.length === 0) {
    const cardY = layout.header.bounds.y + layout.header.bounds.height + 40;
    drawCard(ctx, 48, cardY, layout.width - 96, 220, 24);
    drawExportIcon(ctx, 'star', layout.width / 2 - 28, cardY + 50, 56, {
      color: THEME.accent,
      filled: true,
    });
    drawRTLText(
      ctx,
      layout.emptyMessage || 'قدامك أسبوعين رايقين ومفيش أي مواعيد أو مهام',
      layout.width / 2,
      cardY + 140,
      '700 26px Tajawal',
      THEME.primary,
      'center'
    );
    renderFooter(ctx, layout.footer);
    return targetCanvas;
  }

  for (const grp of layout.groups) {
    const cardBg = grp.isOverdueGroup ? THEME.warningBg : THEME.cardBg;
    const cardBorder = grp.isOverdueGroup ? THEME.warningBorder : THEME.cardBorder;
    drawCard(ctx, grp.bounds.x, grp.bounds.y, grp.bounds.width, grp.bounds.height, 24, cardBg, cardBorder);

    // Group Header
    const headRightX = grp.bounds.x + grp.bounds.width - 24;
    const titleColor = grp.isOverdueGroup ? THEME.warningText : THEME.primary;
    drawRTLText(
      ctx,
      grp.title,
      headRightX,
      grp.bounds.y + 30,
      '700 24px Tajawal',
      titleColor
    );

    if (grp.subtitle) {
      drawRTLText(
        ctx,
        grp.subtitle,
        grp.bounds.x + 24,
        grp.bounds.y + 30,
        '600 18px Tajawal',
        THEME.textSecondary,
        'left'
      );
    }

    // Items
    for (const item of grp.items) {
      drawCard(
        ctx,
        item.bounds.x,
        item.bounds.y,
        item.bounds.width,
        item.bounds.height,
        14,
        grp.isOverdueGroup ? '#FFFFFF' : '#FBF9F5',
        grp.isOverdueGroup ? '#F3D4CE' : '#EFEBE4'
      );

      const itemRightX = item.bounds.x + item.bounds.width - 16;
      const centerY = item.bounds.y + item.bounds.height / 2;

      // Icon
      drawExportIcon(ctx, item.iconType, itemRightX - 22, centerY - 11, 22, {
        color: item.categoryColor,
      });

      // Title
      drawRTLText(
        ctx,
        item.titleLines[0] || '',
        itemRightX - 32,
        centerY,
        '700 20px Tajawal',
        THEME.text
      );

      // Time / Due
      drawRTLText(
        ctx,
        item.timeOrDueText,
        item.bounds.x + 150,
        centerY,
        '600 18px Tajawal',
        THEME.primary,
        'left'
      );

      // Badge on far left
      drawCard(
        ctx,
        item.bounds.x + 14,
        centerY - 13,
        110,
        26,
        13,
        item.isOverdue ? THEME.warningText : THEME.badgeBg,
        ''
      );
      drawRTLText(
        ctx,
        item.relativeDaysBadge,
        item.bounds.x + 14 + 55,
        centerY,
        '700 14px Tajawal',
        item.isOverdue ? '#FFFFFF' : THEME.primary,
        'center'
      );
    }
  }

  renderFooter(ctx, layout.footer);
  return targetCanvas;
}

// ---------------------------------------------------------------------------
// 7. Render Summary (ملخص الإنجاز 1080px)
// ---------------------------------------------------------------------------

export async function renderSummaryToCanvas(
  layout: SummaryScheduleLayout,
  canvas?: HTMLCanvasElement
): Promise<HTMLCanvasElement> {
  await ensureFontsLoaded();
  const targetCanvas = canvas || document.createElement('canvas');
  const scale = calculateSafeScale(layout.height, layout.width);

  targetCanvas.width = Math.round(layout.width * scale);
  targetCanvas.height = Math.round(layout.height * scale);

  const ctx = targetCanvas.getContext('2d');
  if (!ctx) throw new Error('تعذر الوصول إلى سياق الرسم 2D');

  ctx.scale(scale, scale);

  ctx.fillStyle = THEME.bg;
  ctx.fillRect(0, 0, layout.width, layout.height);

  const logo = await loadLogoImage('/icons/icon-192.png');
  await renderHeader(ctx, layout.header, logo);

  // 1. Progress Ring Card
  const { progressCard } = layout;
  drawCard(
    ctx,
    progressCard.bounds.x,
    progressCard.bounds.y,
    progressCard.bounds.width,
    progressCard.bounds.height,
    24
  );

  const ringCx = progressCard.bounds.x + progressCard.bounds.width / 2;
  const ringCy = progressCard.bounds.y + 75;
  const ringR = 48;

  // Track circle
  ctx.strokeStyle = '#EFEBE4';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(ringCx, ringCy, ringR, 0, Math.PI * 2);
  ctx.stroke();

  // Progress arc
  const progressRatio = Math.max(0, Math.min(1, progressCard.completionRate / 100));
  const startAngle = -Math.PI / 2;
  const endAngle = startAngle + progressRatio * (Math.PI * 2);

  ctx.strokeStyle = THEME.sage;
  ctx.lineWidth = 10;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(ringCx, ringCy, ringR, startAngle, endAngle);
  ctx.stroke();

  drawRTLText(
    ctx,
    `${progressCard.completionRate}%`,
    ringCx,
    ringCy,
    '700 24px Tajawal',
    THEME.primary,
    'center'
  );
  drawRTLText(
    ctx,
    progressCard.title,
    ringCx,
    progressCard.bounds.y + 145,
    '700 20px Tajawal',
    THEME.primary,
    'center'
  );
  drawRTLText(
    ctx,
    progressCard.subtitle,
    ringCx,
    progressCard.bounds.y + 172,
    '500 16px Tajawal',
    THEME.textSecondary,
    'center'
  );

  // 2. Stat Cards
  for (const card of layout.statCards) {
    drawCard(ctx, card.bounds.x, card.bounds.y, card.bounds.width, card.bounds.height, 20);
    const cardRightX = card.bounds.x + card.bounds.width - 20;

    drawExportIcon(ctx, card.iconType, cardRightX - 22, card.bounds.y + 16, 22, {
      color: card.iconColor,
    });
    drawRTLText(
      ctx,
      card.title,
      cardRightX - 30,
      card.bounds.y + 27,
      '600 18px Tajawal',
      THEME.textSecondary
    );
    drawRTLText(
      ctx,
      card.value,
      cardRightX,
      card.bounds.y + 60,
      '700 24px Tajawal',
      card.valueColor
    );
    if (card.subtitle) {
      drawRTLText(
        ctx,
        card.subtitle,
        card.bounds.x + 18,
        card.bounds.y + 60,
        '500 16px Tajawal',
        THEME.textMuted,
        'left'
      );
    }
  }

  // 3. Category Bars Card
  const { categoryBarsCard } = layout;
  drawCard(
    ctx,
    categoryBarsCard.bounds.x,
    categoryBarsCard.bounds.y,
    categoryBarsCard.bounds.width,
    categoryBarsCard.bounds.height,
    24
  );

  drawRTLText(
    ctx,
    categoryBarsCard.title,
    categoryBarsCard.bounds.x + categoryBarsCard.bounds.width - 24,
    categoryBarsCard.bounds.y + 32,
    '700 24px Tajawal',
    THEME.primary
  );

  for (const bar of categoryBarsCard.bars) {
    const barRightX = bar.bounds.x + bar.bounds.width;
    const centerY = bar.bounds.y + bar.bounds.height / 2;

    // Category Label & Count
    drawRTLText(ctx, bar.label, barRightX, centerY, '700 18px Tajawal', THEME.text);
    drawRTLText(
      ctx,
      `${bar.count} (${bar.percentage}%)`,
      barRightX - 140,
      centerY,
      '600 16px Tajawal',
      THEME.textSecondary
    );

    // Track
    const trackWidth = bar.bounds.width - 260;
    const trackX = bar.bounds.x;
    drawCard(ctx, trackX, centerY - 6, trackWidth, 12, 6, '#EFEBE4', '');

    // Fill bar
    const fillWidth = Math.max(12, Math.round(trackWidth * (bar.percentage / 100)));
    drawCard(
      ctx,
      trackX + trackWidth - fillWidth,
      centerY - 6,
      fillWidth,
      12,
      6,
      bar.color,
      ''
    );
  }

  // 4. Busiest Day Card
  const { busiestCard } = layout;
  drawCard(
    ctx,
    busiestCard.bounds.x,
    busiestCard.bounds.y,
    busiestCard.bounds.width,
    busiestCard.bounds.height,
    24
  );

  const bRightX = busiestCard.bounds.x + busiestCard.bounds.width - 24;
  drawRTLText(ctx, busiestCard.title, bRightX, busiestCard.bounds.y + 32, '700 22px Tajawal', THEME.primary);
  drawRTLText(
    ctx,
    `${busiestCard.dayName} · ${busiestCard.dateFormatted}`,
    bRightX,
    busiestCard.bounds.y + 70,
    '700 24px Tajawal',
    THEME.accent
  );
  drawRTLText(
    ctx,
    `${busiestCard.eventCount} مواعيد`,
    busiestCard.bounds.x + 24,
    busiestCard.bounds.y + 70,
    '700 24px Tajawal',
    THEME.primary,
    'left'
  );

  // 5. Activity Chart Card
  const { activityChartCard } = layout;
  drawCard(
    ctx,
    activityChartCard.bounds.x,
    activityChartCard.bounds.y,
    activityChartCard.bounds.width,
    activityChartCard.bounds.height,
    24
  );

  drawRTLText(
    ctx,
    activityChartCard.title,
    activityChartCard.bounds.x + activityChartCard.bounds.width - 24,
    activityChartCard.bounds.y + 30,
    '700 22px Tajawal',
    THEME.primary
  );

  for (const bar of activityChartCard.bars) {
    const bottomY = bar.bounds.y + bar.bounds.height - 30;
    const barColor = bar.isBusiest ? THEME.accent : THEME.sage;

    drawCard(
      ctx,
      bar.bounds.x,
      bottomY - bar.barHeight,
      bar.bounds.width,
      bar.barHeight,
      8,
      barColor,
      ''
    );

    drawRTLText(
      ctx,
      bar.label,
      bar.bounds.x + bar.bounds.width / 2,
      bottomY + 14,
      '600 16px Tajawal',
      THEME.textSecondary,
      'center'
    );
    drawRTLText(
      ctx,
      bar.sublabel,
      bar.bounds.x + bar.bounds.width / 2,
      bottomY - bar.barHeight - 10,
      '700 16px Tajawal',
      THEME.primary,
      'center'
    );
  }

  renderFooter(ctx, layout.footer);
  return targetCanvas;
}
