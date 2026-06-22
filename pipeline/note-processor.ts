// RemiFocus — 流水线编排器
// 编排完整处理流水线: split → dsl match → execute → build ku → dedup → store
// 集成 DSL 引擎、KU 构建器、去重引擎和后续的投影引擎

import { BlockSplitter, SplitResult } from "./block-splitter";
import { DSLMatcher, NoteBlock } from "../core/dsl/matcher";
import { RuleConflictResolver } from "../core/dsl/conflict-resolver";
import { DSLExecutor, ExtractedKU } from "../core/dsl/executor";
import { DSLRegistry } from "../core/dsl/registry";
import { KUBuilder } from "./ku-builder";
import { KnowledgeUnit } from "../models/knowledge-unit";

// 去重引擎接口（引用现有 resolver/ku-dedup.ts）
// 实际去重逻辑在 Phase 2 中增强
import { KUDedupEngine, DedupAction } from "../resolver/ku-dedup";
import { KUStore } from "../resolver/ku-store";

// ─── 处理结果 ───

export interface ProcessResult {
  /** 新建的 KU */
  newKUs: KnowledgeUnit[];
  /** 合并的 KU 数量 */
  mergedCount: number;
  /** 跳过的块数量 */
  skippedBlocks: number;
  /** 处理的块数量 */
  totalBlocks: number;
  /** 处理耗时（ms） */
  duration: number;
  /** 详细的处理日志 */
  log: string[];
}

export interface NoteProcessorOptions {
  /** 是否启用去重 */
  enableDedup: boolean;
  /** 是否生成 canonicalKey 匹配（Phase 2 启用） */
  enableCanonicalKeyMatch: boolean;
  /** 是否跳过无匹配的块 */
  skipUnmatchedBlocks: boolean;
}

const DEFAULT_OPTIONS: NoteProcessorOptions = {
  enableDedup: true,
  enableCanonicalKeyMatch: false, // Phase 2 启用
  skipUnmatchedBlocks: true,
};

// ─── 编排器 ───

export class NoteProcessor {
  private blockSplitter: BlockSplitter;
  private dslMatcher: DSLMatcher;
  private conflictResolver: RuleConflictResolver;
  private dslExecutor: DSLExecutor;
  private dslRegistry: DSLRegistry;
  private kuBuilder: KUBuilder;
  private dedupEngine: KUDedupEngine | null;
  private kuStore: KUStore | null;
  private options: NoteProcessorOptions;
  private _log!: string[];

  constructor(
    dslRegistry: DSLRegistry,
    kuStore?: KUStore,
    dedupEngine?: KUDedupEngine,
    options?: Partial<NoteProcessorOptions>
  ) {
    this.blockSplitter = new BlockSplitter();
    this.dslMatcher = new DSLMatcher();
    this.conflictResolver = new RuleConflictResolver();
    this.dslExecutor = new DSLExecutor();
    this.dslRegistry = dslRegistry;
    this.kuBuilder = new KUBuilder();
    this.dedupEngine = dedupEngine ?? null;
    this.kuStore = kuStore ?? null;
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this._log = [];
  }

  /**
   * 处理一篇笔记的完整流水线
   *
   * @param notePath 笔记路径
   * @param content 笔记内容
   * @returns 处理结果
   */
  async process(notePath: string, content: string): Promise<ProcessResult> {
    const startTime = Date.now();
    this._log = [];
    this.log(`📝 Processing: ${notePath}`);

    // Step 1: 分割块
    const splitResult = this.blockSplitter.split(content);
    this.log(`  Split into ${splitResult.blocks.length} blocks (${splitResult.skippedLines.length} skipped lines)`);

    if (splitResult.blocks.length === 0) {
      return this.result([], 0, splitResult, startTime);
    }

    // Step 2: DSL 匹配 + 冲突解决 + 提取
    const extractedKUs: ExtractedKU[] = [];
    const rules = this.dslRegistry.getEnabledRules();

    for (const block of splitResult.blocks) {
      const extracted = this.processBlock(block, rules, notePath);
      if (extracted) {
        extractedKUs.push(extracted);
      }
    }

    this.log(`  Extracted ${extractedKUs.length} KUs from ${splitResult.blocks.length} blocks`);

    if (extractedKUs.length === 0) {
      return this.result([], 0, splitResult, startTime);
    }

    // Step 3: 构建 KU + 去重
    const newKUs: KnowledgeUnit[] = [];
    let mergedCount = 0;

    for (const extracted of extractedKUs) {
      // 验证提取有效性
      if (!this.dslExecutor.isValidExtraction(extracted)) {
        this.log(`  ⏭️ Skipped invalid extraction: ${extracted.structure}`);
        continue;
      }

      if (this.options.enableDedup && this.dedupEngine && this.kuStore) {
        const action = await this.dedupEngine.deduplicate(
          extracted.rawText,
          notePath,
          extracted.source.blockId
        );

        if (action.type === "new_ku") {
          const ku = this.kuBuilder.build(extracted);
          newKUs.push(ku);
          this.log(`  ✨ New KU: ${ku.id} (${extracted.structure})`);
        } else if (
          action.type === "exact_merge" ||
          action.type === "signature_merge" ||
          action.type === "vector_merge"
        ) {
          mergedCount++;
          this.log(`  🔗 Merged into: ${action.targetKu.id} (${action.type})`);
          // TODO: 更新已有 KU 的 sources 和 rawVariants
        } else if (action.type === "staged") {
          this.log(`  ⏳ Staged for review: ${action.stageId}`);
          // 暂存区等待人工/AI 判定
        } else {
          const ku = this.kuBuilder.build(extracted);
          newKUs.push(ku);
          this.log(`  ✨ New KU (after LLM): ${ku.id}`);
        }
      } else {
        // 不去重，直接构建
        const ku = this.kuBuilder.build(extracted);
        newKUs.push(ku);
        this.log(`  ✨ New KU: ${ku.id} (no dedup)`);
      }
    }

    // Step 4: 持久化 KU
    if (this.kuStore && newKUs.length > 0) {
      for (const ku of newKUs) {
        await this.kuStore.put(ku);
      }
      this.log(`  💾 Saved ${newKUs.length} KUs to store`);
    }

    const duration = Date.now() - startTime;
    this.log(`  ✅ Done in ${duration}ms`);

    return {
      newKUs,
      mergedCount,
      skippedBlocks: splitResult.skippedLines.length,
      totalBlocks: splitResult.blocks.length,
      duration,
      log: this._log,
    };
  }

  /**
   * 处理单个块
   */
  private processBlock(
    block: NoteBlock,
    rules: any[],
    notePath: string
  ): ExtractedKU | null {
    // 1. 匹配规则
    const matchedRules = this.dslMatcher.match(block, rules);

    if (matchedRules.length === 0) {
      if (this.options.skipUnmatchedBlocks) {
        return null;
      }
      // 使用默认段落规则处理
      this.log(`  ⚠️ No rule matched for block at line ${block.startLine}, trying fallback`);
      return this.tryFallback(block, notePath);
    }

    // 2. 冲突解决
    const resolved = this.conflictResolver.resolve(matchedRules, block);

    // 记录冲突报告
    if (matchedRules.length > 1) {
      this.log(`  ${this.conflictResolver.generateReport(matchedRules, resolved)}`);
    }

    // 3. 获取可执行的规则
    const executable = this.conflictResolver.getExecutable(resolved);

    if (executable.length === 0) {
      this.log(`  ⚠️ All rules blocked for block at line ${block.startLine}`);
      return null;
    }

    // 4. 执行提取（目前只执行第一个可执行规则）
    // 多规则并行会在未来版本支持（生成多个 KU candidate）
    const rule = executable[0];
    const extracted = this.dslExecutor.execute(rule, block, notePath);

    this.log(`  ✅ Block L${block.startLine}: ${rule.rule} → ${extracted.structure}`);

    return extracted;
  }

  /**
   * 兜底处理：用段落规则处理无匹配的块
   */
  private tryFallback(block: NoteBlock, notePath: string): ExtractedKU | null {
    // 查找 paragraph 兜底规则
    const rules = this.dslRegistry.getEnabledRules();
    const paragraphRule = rules.find((r) => r.rule === "paragraph");

    if (paragraphRule) {
      return this.dslExecutor.execute(paragraphRule, block, notePath);
    }

    return null;
  }

  /**
   * 获取处理日志
   */
  getLog(): string[] {
    return [...this._log];
  }

  /**
   * 清空日志
   */
  clearLog(): void {
    this._log = [];
  }

  // ─── 私有工具 ───

  private log(message: string): void {
    this._log.push(message);
    console.log(`[NoteProcessor] ${message}`);
  }

  private result(
    newKUs: KnowledgeUnit[],
    mergedCount: number,
    splitResult: SplitResult,
    startTime: number
  ): ProcessResult {
    return {
      newKUs,
      mergedCount,
      skippedBlocks: splitResult.skippedLines.length,
      totalBlocks: splitResult.blocks.length,
      duration: Date.now() - startTime,
      log: this._log,
    };
  }
}
