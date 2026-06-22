// RemiFocus — 日历热力图组件
// GitHub contribution style heatmap
// 接收逐日数据，纯渲染组件

import { UIComponent } from "./base";

export interface HeatmapData {
  [date: string]: number;  // "YYYY-MM-DD" → 学习卡片数
}

export class HeatmapWidget extends UIComponent {
  private data: HeatmapData = {};

  async render(): Promise<void> {
    this.clear();
    this.renderHeader();
    this.renderGrid();
    this.renderLegend();
  }

  /** 由外部注入数据 */
  setData(data: HeatmapData): void {
    this.data = data;
  }

  private renderHeader(): void {
    const h = this.appendChild(this.container, "div", "");
    h.style.cssText = "font-weight:600;font-size:0.9em;margin-bottom:8px;";
    h.textContent = "📅 学习热力图";
  }

  private renderGrid(): void {
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 90);
    const startDay = startDate.getDay();
    startDate.setDate(startDate.getDate() - startDay);

    const grid = this.appendChild(this.container, "div", "");
    grid.style.cssText = "display:grid;grid-template-columns:repeat(7,1fr);gap:3px;max-width:210px;";

    const dayLabels = ["日", "一", "二", "三", "四", "五", "六"];
    for (const label of dayLabels) {
      const cell = this.appendChild(grid, "div", "");
      cell.style.cssText = "font-size:0.6em;text-align:center;color:var(--remi-text-muted);padding-bottom:2px;";
      cell.textContent = label;
    }

    for (let i = 0; i < 91; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      const count = this.data[key] ?? 0;

      const cell = this.appendChild(grid, "div", "");
      cell.style.cssText = `width:100%;aspect-ratio:1;border-radius:2px;background:${this.cellColor(count)};cursor:pointer;`;
      cell.title = `${key}: ${count} 词`;
    }
  }

  private renderLegend(): void {
    const legend = this.appendChild(this.container, "div", "");
    legend.style.cssText = "display:flex;gap:4px;align-items:center;margin-top:8px;font-size:0.7em;color:var(--remi-text-muted);";

    const levels = [0, 1, 5, 15, 30];
    const label = this.appendChild(legend, "span", "");
    label.textContent = "少";
    for (const l of levels) {
      const s = this.appendChild(legend, "span", "");
      s.style.cssText = `display:inline-block;width:10px;height:10px;border-radius:2px;background:${this.cellColor(l)};`;
    }
    const more = this.appendChild(legend, "span", "");
    more.textContent = "多";
  }

  private cellColor(count: number): string {
    if (count === 0) return "var(--remi-border)";
    if (count < 5) return "#9be9a8";
    if (count < 15) return "#40c463";
    if (count < 30) return "#30a14e";
    return "#216e39";
  }
}
