// RemiFocus — UI 基类
// 所有 UI 组件继承此基类，使用标准 DOM API

import { IEngine } from "../engine/interface";

/**
 * UI 组件基类
 * 负责渲染到指定容器，提供统一的挂载/卸载生命周期
 */
export abstract class UIComponent {
  protected container: HTMLElement;
  protected engine: IEngine;

  constructor(container: HTMLElement, engine: IEngine) {
    this.container = container;
    this.engine = engine;
  }

  /** 渲染组件到 container */
  abstract render(): Promise<void>;

  /** 卸载组件，清理 DOM */
  destroy(): void {
    this.container.innerHTML = "";
  }

  // ─── 工具方法 ───

  /** 创建元素 */
  protected el<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    className?: string,
    text?: string
  ): HTMLElementTagNameMap[K] {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
  }

  /** 在指定父元素下创建子元素并追加 */
  protected appendChild<K extends keyof HTMLElementTagNameMap>(
    parent: HTMLElement,
    tag: K,
    className?: string,
    text?: string
  ): HTMLElementTagNameMap[K] {
    const el = this.el(tag, className, text);
    parent.appendChild(el);
    return el;
  }

  /** 清空容器 */
  protected clear(): void {
    this.container.innerHTML = "";
  }

  /** 创建图标（使用 Unicode 或简单文本） */
  protected icon(emoji: string, className?: string): HTMLSpanElement {
    const span = document.createElement("span");
    span.textContent = emoji;
    if (className) span.className = className;
    return span;
  }
}
