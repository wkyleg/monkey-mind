import { CONFIG } from '../config';
import { contentLoader } from '../content/loader';
import type { PlayerIntent } from '../engine/input';
import type { Renderer } from '../engine/renderer';
import { Scene } from '../engine/scene';
import type { SessionReport, SessionSample } from '../gameplay/sessionRecorder';
import { downloadReport, saveReport } from '../util/reportStorage';

interface ReportButton {
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  action: () => void;
}

export class LevelReportScene extends Scene {
  override readonly isOverlay: boolean = true;

  private report: SessionReport | null = null;
  private scrollY = 0;
  private maxScrollY = 0;
  private contentHeight = 0;
  private time = 0;
  private inputCooldown = 0;
  private buttons: ReportButton[] = [];
  private saved = false;

  enter(): void {
    this.report = this.game.getScenes().getContext<SessionReport>('levelReport') ?? null;
    this.game.getScenes().clearContext('levelReport');
    this.scrollY = 0;
    this.contentHeight = 0;
    this.maxScrollY = 0;
    this.time = 0;
    this.inputCooldown = 0.4;
    this.buttons = [];
    this.saved = false;

    if (this.report && !this.saved) {
      saveReport(this.report);
      this.saved = true;
    }
  }

  exit(): void {
    this.report = null;
    this.buttons = [];
  }

  update(dt: number, intent: PlayerIntent): void {
    this.time += dt;
    if (this.inputCooldown > 0) {
      this.inputCooldown -= dt;
      return;
    }

    const scrollSpeed = 500;
    if (intent.menuAxis > 0.3) this.scrollY = Math.min(this.maxScrollY, this.scrollY + dt * scrollSpeed);
    if (intent.menuAxis < -0.3) this.scrollY = Math.max(0, this.scrollY - dt * scrollSpeed);

    const wheelDelta = this.game.getInput().getWheelDelta();
    if (wheelDelta !== 0) {
      this.scrollY = Math.max(0, Math.min(this.maxScrollY, this.scrollY + wheelDelta));
    }

    const mouseClick = this.game.getInput().getMouseClick();
    if (mouseClick) {
      this.handleClick(mouseClick.x, mouseClick.y);
    }

    if (intent.confirm || intent.cancel) {
      this.dismiss();
    }
  }

  private dismiss(): void {
    this.game.getScenes().pop();
  }

  render(renderer: Renderer, _alpha: number): void {
    const { width, height } = renderer;
    const ctx = renderer.context;
    this.buttons = [];

    // Full opaque background
    ctx.save();
    ctx.fillStyle = '#060610';
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
    renderer.radialGradientBackground(['#0c0c1a', '#0a0a16', '#060610']);
    renderer.drawScanLines(0.012, 3);

    if (!this.report) {
      renderer.glowText(
        contentLoader.getString('report_no_data'),
        width / 2,
        height / 2,
        CONFIG.COLORS.TEXT_DIM,
        24,
        'center',
        10,
      );
      return;
    }

    // Modal dimensions
    const modalMargin = Math.max(24, Math.min(60, width * 0.04));
    const modalX = modalMargin;
    const modalY = modalMargin;
    const modalW = width - modalMargin * 2;
    const footerH = 64;
    const modalContentH = height - modalMargin * 2 - footerH;
    const modalBottomY = modalY + modalContentH;

    // Modal background
    renderer.drawRoundRect(
      modalX,
      modalY,
      modalW,
      modalContentH + footerH,
      8,
      'rgba(10,10,22,0.95)',
      'rgba(0,204,204,0.25)',
      1,
    );

    // Inner content padding
    const pad = Math.max(20, Math.min(36, width * 0.03));
    const contentX = modalX + pad;
    const contentW = modalW - pad * 2;
    const chartH = 100;
    const chartGap = 24;
    const sectionGap = 18;

    const r = this.report;

    // Measure content height (for scroll calculation)
    const measuredH = this.measureContentHeight(r, contentW, chartH, chartGap, sectionGap);
    this.contentHeight = measuredH;
    this.maxScrollY = Math.max(0, measuredH - modalContentH + pad);

    // Clip to modal content area (scrollable region)
    ctx.save();
    ctx.beginPath();
    ctx.rect(modalX + 1, modalY + 1, modalW - 2, modalContentH - 2);
    ctx.clip();
    ctx.translate(0, -this.scrollY);

    let curY = modalY + pad;

    // ── HEADER ──
    renderer.glowText(
      contentLoader.getString('report_title'),
      modalX + modalW / 2,
      curY,
      CONFIG.COLORS.ACCENT,
      22,
      'center',
      12,
    );
    curY += 34;

    renderer.text(r.levelTitle, modalX + modalW / 2, curY, CONFIG.COLORS.PRIMARY, 18, 'center');
    curY += 22;
    renderer.text(r.actName, modalX + modalW / 2, curY, CONFIG.COLORS.TEXT_DIM, 12, 'center');
    curY += 24;

    // Divider
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.strokeStyle = CONFIG.COLORS.PRIMARY;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(contentX, curY);
    ctx.lineTo(contentX + contentW, curY);
    ctx.stroke();
    ctx.restore();
    curY += 14;

    // Stats row
    const duration = Math.round(r.durationMs / 1000);
    const statsItems = [
      { label: 'DURATION', value: `${duration}s` },
      { label: 'SCORE', value: `${r.finalScore}` },
      { label: 'KILLS', value: `${r.enemiesKilled}` },
      { label: 'MAX COMBO', value: `x${r.maxCombo}` },
      { label: 'DAMAGE', value: `${r.damagesTaken}` },
    ];
    const statW = contentW / statsItems.length;
    for (let i = 0; i < statsItems.length; i++) {
      const sx = contentX + statW * (i + 0.5);
      renderer.text(statsItems[i].label, sx, curY, CONFIG.COLORS.TEXT_DIM, 8, 'center');
      renderer.text(statsItems[i].value, sx, curY + 12, CONFIG.COLORS.TEXT, 14, 'center');
    }
    curY += 36;

    // ── BRAIN WAVES CHART ──
    if (r.samples.some((s) => s.alpha > 0 || s.beta > 0 || s.theta > 0)) {
      curY = this.renderChartSection(
        ctx,
        renderer,
        contentLoader.getString('report_brain_waves'),
        contentX,
        curY,
        contentW,
        chartH,
        r.samples,
        [
          { key: 'alpha', color: '#44aaff', label: 'Alpha' },
          { key: 'beta', color: '#ff6644', label: 'Beta' },
          { key: 'theta', color: '#88cc44', label: 'Theta' },
          { key: 'delta', color: '#aa88ff', label: 'Delta' },
          { key: 'gamma', color: '#ffaa88', label: 'Gamma' },
        ],
        CONFIG.COLORS.NEURAL,
      );
      curY += chartGap;
    }

    // ── HEART RATE CHART ──
    if (r.avgBpm != null) {
      const annotation = r.avgBpm != null ? `avg ${Math.round(r.avgBpm)} BPM` : '';
      curY = this.renderChartSection(
        ctx,
        renderer,
        contentLoader.getString('report_heart_rate'),
        contentX,
        curY,
        contentW,
        chartH,
        r.samples,
        [{ key: 'bpm', color: '#ff4466', label: 'BPM' }],
        '#ff4466',
        annotation,
      );
      if (r.peakBpm != null && r.minBpm != null) {
        renderer.text(`min ${Math.round(r.minBpm)}`, contentX + 4, curY - chartGap + chartH + 14, '#663344', 8, 'left');
        renderer.text(
          `peak ${Math.round(r.peakBpm)}`,
          contentX + contentW - 4,
          curY - chartGap + chartH + 14,
          '#663344',
          8,
          'right',
        );
      }
      curY += chartGap;
    }

    // ── CALM / AROUSAL CHART ──
    curY = this.renderChartSection(
      ctx,
      renderer,
      contentLoader.getString('report_calm_arousal'),
      contentX,
      curY,
      contentW,
      chartH,
      r.samples,
      [
        { key: 'calm', color: '#00ccff', label: 'Calm' },
        { key: 'arousal', color: '#ff4466', label: 'Arousal' },
      ],
      '#00ccff',
    );
    curY += chartGap;

    // ── HEALTH & SCORE CHART ──
    curY = this.renderChartSection(
      ctx,
      renderer,
      contentLoader.getString('report_health_score'),
      contentX,
      curY,
      contentW,
      chartH,
      r.samples,
      [
        { key: 'health', color: '#00ff88', label: 'Health' },
        { key: 'score', color: '#ffcc00', label: 'Score' },
      ],
      '#00ff88',
    );
    curY += chartGap;

    // ── SESSION SUMMARY ──
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.strokeStyle = CONFIG.COLORS.PRIMARY;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(contentX, curY);
    ctx.lineTo(contentX + contentW, curY);
    ctx.stroke();
    ctx.restore();
    curY += sectionGap;

    renderer.text(contentLoader.getString('report_session_summary'), contentX, curY, CONFIG.COLORS.PRIMARY, 12, 'left');
    curY += 20;

    const col2X = contentX + contentW / 2;
    const lineH = 20;

    const calmPct = Math.round(r.avgCalm * 100);
    const arousalPct = Math.round(r.avgArousal * 100);
    const calmArrow = r.netCalmChange > 0.02 ? '↑' : r.netCalmChange < -0.02 ? '↓' : '→';
    const arousalArrow = r.netArousalChange > 0.02 ? '↑' : r.netArousalChange < -0.02 ? '↓' : '→';

    renderer.text(
      `Avg Calm: ${calmPct}%  ${calmArrow}${Math.abs(Math.round(r.netCalmChange * 100))}%`,
      contentX,
      curY,
      '#00ccff',
      12,
      'left',
    );
    renderer.text(
      `Avg Arousal: ${arousalPct}%  ${arousalArrow}${Math.abs(Math.round(r.netArousalChange * 100))}%`,
      col2X,
      curY,
      '#ff4466',
      12,
      'left',
    );
    curY += lineH;

    renderer.text(`Dominant: ${r.dominantState}`, contentX, curY, CONFIG.COLORS.TEXT_LIGHT, 11, 'left');
    curY += lineH;

    if (r.avgBpm != null) {
      renderer.text(
        `Heart Rate: ${Math.round(r.avgBpm)} avg  /  ${r.peakBpm ? Math.round(r.peakBpm) : '—'} peak  /  ${r.minBpm ? Math.round(r.minBpm) : '—'} min`,
        contentX,
        curY,
        '#ff4466',
        11,
        'left',
      );
      curY += lineH;
    }

    if (r.alphaBumps > 0) {
      renderer.text(`Alpha Bursts: ${r.alphaBumps}  (2x score bonus)`, contentX, curY, '#00ffcc', 11, 'left');
      curY += lineH;
    }

    renderer.text(`Damage Taken: ${r.damagesTaken}`, contentX, curY, '#ff6644', 11, 'left');
    curY += lineH;

    // Stress performance comparison
    const highArousalSamples = r.samples.filter((s) => s.arousal > 0.5);
    const lowArousalSamples = r.samples.filter((s) => s.arousal <= 0.5);
    if (highArousalSamples.length > 3 && lowArousalSamples.length > 3) {
      const highScore = highArousalSamples.reduce((a, s) => a + s.score, 0) / highArousalSamples.length;
      const lowScore = lowArousalSamples.reduce((a, s) => a + s.score, 0) / lowArousalSamples.length;
      const label = highScore > lowScore ? 'better when alert' : 'better when calm';
      renderer.text(`Stress Performance: ${label}`, contentX, curY, CONFIG.COLORS.TEXT_LIGHT, 11, 'left');
      curY += lineH;
    }
    curY += sectionGap;

    // ── INSIGHTS ──
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.strokeStyle = CONFIG.COLORS.ACCENT;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(contentX, curY);
    ctx.lineTo(contentX + contentW, curY);
    ctx.stroke();
    ctx.restore();
    curY += sectionGap;

    renderer.text(contentLoader.getString('report_insights'), contentX, curY, CONFIG.COLORS.ACCENT, 12, 'left');
    curY += 18;

    const recommendations: string[] = [];
    if (r.avgArousal > 0.6) {
      recommendations.push(
        'Your arousal was high — try a physiological sigh: double inhale through nose, slow exhale through mouth.',
      );
    }
    if (r.avgCalm > 0.7) {
      recommendations.push('Excellent focus throughout this level. Your calm state was strong.');
    }
    if (r.avgBpm != null && r.peakBpm != null && r.minBpm != null) {
      const bpmRange = (r.peakBpm - r.minBpm) / r.minBpm;
      if (bpmRange > 0.15) {
        recommendations.push('Heart rate climbed significantly — try box breathing: 4s in, 4s hold, 4s out, 4s hold.');
      }
    }
    if (r.alphaBumps > 2) {
      recommendations.push(
        `${r.alphaBumps} alpha bursts detected — your brain produced strong alpha waves. This is linked to flow states.`,
      );
    }
    if (r.damagesTaken > 5) {
      recommendations.push('You took heavy damage — try staying centered and watching enemy patterns more closely.');
    }
    if (recommendations.length === 0) {
      recommendations.push('Keep playing to see how your brain state evolves across levels.');
    }

    const maxLineLen = Math.floor(contentW / 6.5);
    for (const rec of recommendations) {
      const words = rec.split(' ');
      let line = '';
      for (const word of words) {
        const test = line ? `${line} ${word}` : word;
        if (test.length > maxLineLen) {
          renderer.text(`  ${line}`, contentX + 8, curY, CONFIG.COLORS.TEXT_LIGHT, 10, 'left');
          curY += 14;
          line = word;
        } else {
          line = test;
        }
      }
      if (line) {
        renderer.text(`  ${line}`, contentX + 8, curY, CONFIG.COLORS.TEXT_LIGHT, 10, 'left');
        curY += 18;
      }
    }
    curY += pad;

    ctx.restore(); // end clip + scroll translation

    // Recalculate scroll bounds from measured content
    this.contentHeight = curY - modalY + this.scrollY;
    this.maxScrollY = Math.max(0, this.contentHeight - modalContentH + pad);

    // ── FOOTER (fixed, not scrolled) ──
    const footerY = modalBottomY;

    // Footer background
    ctx.save();
    ctx.fillStyle = 'rgba(8,8,18,0.98)';
    ctx.beginPath();
    const footerRadius = 8;
    ctx.moveTo(modalX, footerY);
    ctx.lineTo(modalX + modalW, footerY);
    ctx.lineTo(modalX + modalW, footerY + footerH - footerRadius);
    ctx.arcTo(modalX + modalW, footerY + footerH, modalX + modalW - footerRadius, footerY + footerH, footerRadius);
    ctx.lineTo(modalX + footerRadius, footerY + footerH);
    ctx.arcTo(modalX, footerY + footerH, modalX, footerY + footerH - footerRadius, footerRadius);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Divider line at footer top
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.strokeStyle = CONFIG.COLORS.PRIMARY;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(modalX + pad, footerY);
    ctx.lineTo(modalX + modalW - pad, footerY);
    ctx.stroke();
    ctx.restore();

    const btnW = 160;
    const btnH = 34;
    const btnY = footerY + (footerH - btnH) / 2;
    const centerX = modalX + modalW / 2;
    const btnGap = 16;

    // Download button
    const dlX = centerX - btnW - btnGap / 2;
    renderer.drawRoundRect(dlX, btnY, btnW, btnH, 4, 'rgba(0,204,204,0.08)', CONFIG.COLORS.PRIMARY, 1);
    renderer.text(
      contentLoader.getString('report_download'),
      dlX + btnW / 2,
      btnY + btnH / 2,
      CONFIG.COLORS.PRIMARY,
      11,
      'center',
      'middle',
    );
    this.buttons.push({
      label: 'download',
      x: dlX,
      y: btnY,
      w: btnW,
      h: btnH,
      action: () => {
        if (this.report) downloadReport(this.report);
      },
    });

    // Continue button
    const contX = centerX + btnGap / 2;
    renderer.drawRoundRect(contX, btnY, btnW, btnH, 4, 'rgba(0,204,204,0.15)', CONFIG.COLORS.PRIMARY, 2);
    renderer.text(
      contentLoader.getString('report_continue'),
      contX + btnW / 2,
      btnY + btnH / 2,
      '#ffffff',
      12,
      'center',
      'middle',
    );
    this.buttons.push({ label: 'continue', x: contX, y: btnY, w: btnW, h: btnH, action: () => this.dismiss() });

    // Hint text
    ctx.save();
    ctx.globalAlpha = 0.35;
    renderer.text(
      'SPACE continue  ·  ESC skip  ·  ↑↓ scroll',
      centerX,
      footerY + footerH - 8,
      CONFIG.COLORS.TEXT_DIM,
      8,
      'center',
      'bottom',
    );
    ctx.restore();

    // Scroll indicator (inside modal, right edge)
    if (this.maxScrollY > 0) {
      const scrollBarX = modalX + modalW - 6;
      const scrollBarTop = modalY + 4;
      const scrollBarH = modalContentH - 8;
      const thumbH = Math.max(20, scrollBarH * (modalContentH / this.contentHeight));
      const thumbY = scrollBarTop + (this.scrollY / this.maxScrollY) * (scrollBarH - thumbH);
      ctx.save();
      ctx.globalAlpha = 0.15;
      ctx.fillStyle = CONFIG.COLORS.TEXT_DIM;
      ctx.fillRect(scrollBarX, scrollBarTop, 3, scrollBarH);
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = CONFIG.COLORS.PRIMARY;
      ctx.fillRect(scrollBarX, thumbY, 3, thumbH);
      ctx.restore();
    }
  }

  private renderChartSection(
    ctx: CanvasRenderingContext2D,
    renderer: Renderer,
    title: string,
    x: number,
    y: number,
    w: number,
    h: number,
    samples: SessionSample[],
    series: Array<{ key: string; color: string; label: string }>,
    titleColor: string,
    annotation?: string,
  ): number {
    renderer.text(title, x, y, titleColor, 10, 'left');
    if (annotation) renderer.text(annotation, x + w, y, titleColor, 9, 'right');
    y += 14;
    this.renderLineChart(ctx, renderer, samples, x, y, w, h, series);
    return y + h;
  }

  handleClick(mouseX: number, mouseY: number): boolean {
    for (const btn of this.buttons) {
      if (mouseX >= btn.x && mouseX <= btn.x + btn.w && mouseY >= btn.y && mouseY <= btn.y + btn.h) {
        btn.action();
        return true;
      }
    }
    return false;
  }

  private measureContentHeight(
    r: SessionReport,
    _contentW: number,
    chartH: number,
    chartGap: number,
    sectionGap: number,
  ): number {
    let h = 0;
    h += 34 + 22 + 24 + 14 + 36; // header area
    if (r.samples.some((s) => s.alpha > 0 || s.beta > 0 || s.theta > 0)) h += 14 + chartH + chartGap;
    if (r.avgBpm != null) h += 14 + chartH + chartGap;
    h += 14 + chartH + chartGap; // calm/arousal
    h += 14 + chartH + chartGap; // health/score
    h += sectionGap + 20 + 20 * 5 + sectionGap; // summary
    h += sectionGap + 18 + 18 * 4; // insights
    h += 40; // bottom padding
    return h;
  }

  private getSampleValue(sample: SessionSample, key: string): number | null {
    switch (key) {
      case 'calm':
        return sample.calm;
      case 'arousal':
        return sample.arousal;
      case 'alpha':
        return sample.alpha;
      case 'beta':
        return sample.beta;
      case 'theta':
        return sample.theta;
      case 'delta':
        return sample.delta;
      case 'gamma':
        return sample.gamma;
      case 'bpm':
        return sample.bpm;
      case 'hrv':
        return sample.hrv;
      case 'score':
        return sample.score;
      case 'combo':
        return sample.combo;
      case 'playerX':
        return sample.playerX;
      case 'health':
        return sample.health;
      case 'healthMax':
        return sample.healthMax;
      default:
        return null;
    }
  }

  private renderLineChart(
    ctx: CanvasRenderingContext2D,
    renderer: Renderer,
    samples: SessionSample[],
    x: number,
    y: number,
    w: number,
    h: number,
    series: Array<{ key: string; color: string; label: string }>,
  ): void {
    if (samples.length < 2) {
      renderer.text(
        contentLoader.getString('report_not_enough_data'),
        x + w / 2,
        y + h / 2,
        CONFIG.COLORS.TEXT_DIM,
        11,
        'center',
      );
      return;
    }

    // Chart background
    renderer.drawRoundRect(x, y, w, h, 4, 'rgba(6,6,14,0.7)', 'rgba(40,40,60,0.35)', 1);

    // Grid lines
    ctx.save();
    ctx.strokeStyle = 'rgba(50,50,70,0.25)';
    ctx.lineWidth = 0.5;
    for (let i = 1; i < 4; i++) {
      const gy = y + (h / 4) * i;
      ctx.beginPath();
      ctx.moveTo(x, gy);
      ctx.lineTo(x + w, gy);
      ctx.stroke();
    }
    ctx.restore();

    const pad = 4;
    const chartX = x + pad;
    const chartY = y + pad;
    const chartW = w - pad * 2;
    const chartH = h - pad * 2;

    for (const s of series) {
      let min = Infinity;
      let max = -Infinity;
      for (const sample of samples) {
        const v = this.getSampleValue(sample, s.key);
        if (v == null) continue;
        if (v < min) min = v;
        if (v > max) max = v;
      }
      if (min === Infinity) continue;
      const range = Math.max(max - min, 0.01);

      // Area fill
      ctx.save();
      ctx.globalAlpha = 0.06;
      ctx.fillStyle = s.color;
      ctx.beginPath();
      let started = false;
      for (let i = 0; i < samples.length; i++) {
        const v = this.getSampleValue(samples[i], s.key);
        if (v == null) continue;
        const px = chartX + (i / (samples.length - 1)) * chartW;
        const py = chartY + chartH - ((v - min) / range) * chartH;
        if (!started) {
          ctx.moveTo(px, chartY + chartH);
          ctx.lineTo(px, py);
          started = true;
        } else ctx.lineTo(px, py);
      }
      ctx.lineTo(chartX + chartW, chartY + chartH);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // Line
      ctx.save();
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 1.5;
      ctx.shadowColor = s.color;
      ctx.shadowBlur = 2;
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      started = false;
      for (let i = 0; i < samples.length; i++) {
        const v = this.getSampleValue(samples[i], s.key);
        if (v == null) continue;
        const px = chartX + (i / (samples.length - 1)) * chartW;
        const py = chartY + chartH - ((v - min) / range) * chartH;
        if (!started) {
          ctx.moveTo(px, py);
          started = true;
        } else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.restore();
    }

    // Legend (top-right inside chart)
    const legendX = x + w - 10;
    let legendY = y + 10;
    for (const s of series) {
      ctx.save();
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = s.color;
      ctx.fillRect(legendX - 36, legendY - 4, 8, 8);
      ctx.restore();
      renderer.text(s.label, legendX - 24, legendY, s.color, 8, 'left');
      legendY += 12;
    }

    // Time axis labels
    if (samples.length > 1) {
      const endT = samples[samples.length - 1].t;
      ctx.save();
      ctx.globalAlpha = 0.35;
      renderer.text('0s', x + 4, y + h + 6, CONFIG.COLORS.TEXT_DIM, 7, 'left');
      renderer.text(`${Math.round(endT)}s`, x + w - 4, y + h + 6, CONFIG.COLORS.TEXT_DIM, 7, 'right');
      ctx.restore();
    }
  }
}
