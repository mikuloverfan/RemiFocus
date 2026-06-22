// RemiFocus — 解析器统一导出
export { CardExtractor, ExtractedCard, CardGroup, ExtractResult, CardFormat } from "./cardExtractor";
export { KUExtractor, ExtractedKU } from "./ku-extractor";
export { KUStore, generateKUId } from "./ku-store";
export { KUDedupEngine, DedupAction } from "./ku-dedup";
export { KUStagingPool } from "./ku-staging";
export { KUStabilityGuard, Actor } from "./ku-stability";
export { EmbeddingService, EmbeddingConfig } from "./embedding";

// ─── Phase 1: DSL 引擎 ───
export { DSLParser, ParseResult } from "../core/dsl/parser";
export { DSLMatcher, NoteBlock } from "../core/dsl/matcher";
export { RuleConflictResolver } from "../core/dsl/conflict-resolver";
export { DSLExecutor, ExtractedField, ExtractedKU as DSLExecutedKU } from "../core/dsl/executor";
export { DSLRegistry, DSLRegistryConfig } from "../core/dsl/registry";
export {
  DSLRule,
  DSLMatchRule,
  DSLAction,
  DSLOutputConfig,
  DSLMatchType,
  DSLExtractSource,
  MatchedRule as DSLMatchedRule,
  ResolvedRule,
  BUILTIN_RULE_PRIORITIES,
} from "../core/dsl/types";

// ─── Phase 1: Pipeline ───
export { BlockSplitter, SplitResult } from "../pipeline/block-splitter";
export { KUBuilder, generateKUId as generateKUBuilderId } from "../pipeline/ku-builder";
export { NoteProcessor, ProcessResult, NoteProcessorOptions } from "../pipeline/note-processor";

// ─── Phase 3: Projection Engine ───
export { LiteralProjector, LiteralProjectorOptions } from "../core/projection/literal";
export { CompressionProjector, CompressionProjectorOptions, AICompressionService } from "../core/projection/compression";
export { TrainingProjector, TrainingProjectorOptions, TrainingView } from "../core/projection/training";
