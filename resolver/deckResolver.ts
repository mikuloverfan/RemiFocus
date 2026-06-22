// RemiFocus — 多源卡组解析器
// 优先级：inline > frontmatter > filename > tag
//
// 一个笔记可以属于多个卡组，解析规则：
// 1. inline deck 标记（最高优先级）— 笔记内容中的 [[deck:xxx]] 或 #deck/xxx
// 2. frontmatter decks — YAML frontmatter 中的 decks 字段
// 3. 文件名映射 — 根据文件路径推断卡组
// 4. tag (#flashcards, #e) — 最低优先级

export interface ResolveInput {
  /** 笔记完整内容（含 frontmatter） */
  content: string;
  /** 笔记文件路径（相对 vault 根） */
  filePath: string;
  /** 笔记的 tags 列表（从 Obsidian 元数据获取） */
  tags: string[];
}

export interface ResolveOutput {
  /** 解析出的卡组列表（去重，按优先级排序） */
  decks: string[];
  /** 每个卡组的来源说明 */
  sources: Record<string, string>;
}

/**
 * 多源卡组解析器
 */
export class DeckResolver {
  /**
   * 解析一个笔记所属的所有卡组
   * 优先级：inline > frontmatter > filename > tag
   */
  resolve(input: ResolveInput): ResolveOutput {
    const decks = new Set<string>();
    const sources: Record<string, string> = {};

    // 1. inline deck 标记（最高优先级）
    this.resolveInline(input.content, decks, sources);

    // 2. frontmatter decks
    this.resolveFrontmatter(input.content, decks, sources);

    // 3. 文件名映射
    this.resolveFilename(input.filePath, decks, sources);

    // 4. tag 映射（最低优先级）
    this.resolveTags(input.tags, decks, sources);

    return {
      decks: Array.from(decks),
      sources,
    };
  }

  // ─── 各来源解析 ───

  /**
   * 从内容中提取 inline deck 标记
   * 格式: [[deck:xxx]] 或 #deck/xxx
   */
  private resolveInline(
    content: string,
    decks: Set<string>,
    sources: Record<string, string>
  ): void {
    // [[deck:xxx]] 格式
    const wikiMatch = content.match(/\[\[deck:([^\]]+)\]\]/g);
    if (wikiMatch) {
      for (const m of wikiMatch) {
        const name = m.replace(/\[\[deck:|\]\]/g, "").trim();
        if (name && !decks.has(name)) {
          decks.add(name);
          sources[name] = "inline";
        }
      }
    }

    // #deck/xxx 格式
    const tagMatch = content.match(/#deck\/(\S+)/g);
    if (tagMatch) {
      for (const m of tagMatch) {
        const name = m.replace("#deck/", "").trim();
        if (name && !decks.has(name)) {
          decks.add(name);
          sources[name] = sources[name] || "inline";
        }
      }
    }
  }

  /**
   * 从 YAML frontmatter 中提取 decks 字段
   * 格式:
   * ---
   * decks: [e, biology]
   * ---
   * 或
   * ---
   * decks:
   *   - e
   *   - biology
   * ---
   */
  private resolveFrontmatter(
    content: string,
    decks: Set<string>,
    sources: Record<string, string>
  ): void {
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!fmMatch) return;

    const fm = fmMatch[1];

    // decks: [e, biology] 格式
    const inlineArr = fm.match(/decks:\s*\[([^\]]+)\]/);
    if (inlineArr) {
      const names = inlineArr[1].split(",").map((s) => s.trim()).filter(Boolean);
      for (const name of names) {
        if (!decks.has(name)) {
          decks.add(name);
          sources[name] = "frontmatter";
        }
      }
      return;
    }

    // decks:\n  - e\n  - biology 格式
    const listMatch = fm.match(/decks:\n((?:\s+-\s+\S+\n?)+)/);
    if (listMatch) {
      const names = listMatch[1]
        .split("\n")
        .map((s) => s.replace(/^\s*-\s*/, "").trim())
        .filter(Boolean);
      for (const name of names) {
        if (!decks.has(name)) {
          decks.add(name);
          sources[name] = "frontmatter";
        }
      }
    }
  }

  /**
   * 根据文件路径推断卡组
   * 规则：
   * - Biology/xxx.md → biology
   * - English/xxx.md → e
   * - 根目录文件 → 取文件名（不含扩展名）
   */
  private resolveFilename(
    filePath: string,
    decks: Set<string>,
    sources: Record<string, string>
  ): void {
    // 将反斜杠统一为斜杠
    const normalized = filePath.replace(/\\/g, "/");
    const parts = normalized.split("/");

    // 如果文件在子文件夹中，取文件夹名作为卡组
    if (parts.length > 1) {
      const folder = parts[0].toLowerCase();
      if (folder && !decks.has(folder)) {
        decks.add(folder);
        sources[folder] = sources[folder] || "filename";
      }
    }
  }

  /**
   * 从 Obsidian tags 推断卡组
   * #flashcards → 添加到 "default"
   * #e → 添加到 "e"
   * #biology → 添加到 "biology"
   */
  private resolveTags(
    tags: string[],
    decks: Set<string>,
    sources: Record<string, string>
  ): void {
    for (const tag of tags) {
      const clean = tag.startsWith("#") ? tag.slice(1) : tag;

      // #flashcards → "default" 卡组
      if (clean === "flashcards" && !decks.has("default")) {
        decks.add("default");
        sources["default"] = sources["default"] || "tag";
        continue;
      }

      // 其他 tag 直接作为卡组名
      if (!decks.has(clean)) {
        decks.add(clean);
        sources[clean] = sources[clean] || "tag";
      }
    }
  }
}
