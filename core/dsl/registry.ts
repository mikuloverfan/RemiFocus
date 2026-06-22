// RemiFocus — DSL 规则注册表
// 管理内置规则 + 用户自定义规则的加载、合并、查询

import { DSLRule } from "./types";
import { DSLParser } from "./parser";

export interface DSLRegistryConfig {
  /** 用户自定义规则文件路径（可选） */
  userRuleFilePath?: string;
  /** 是否启用所有内置规则 */
  enableBuiltin: boolean;
}

const DEFAULT_CONFIG: DSLRegistryConfig = {
  enableBuiltin: true,
};

export class DSLRegistry {
  private config: DSLRegistryConfig;
  private parser: DSLParser;

  /** 所有规则（内置 + 用户）按 ID 索引 */
  private rulesById: Map<string, DSLRule> = new Map();

  /** 用户已禁用的规则 ID 列表 */
  private disabledRuleIds: Set<string> = new Set();

  constructor(config?: Partial<DSLRegistryConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.parser = new DSLParser();
  }

  /**
   * 初始化注册表：加载内置规则和用户规则
   */
  async initialize(userYamlContent?: string): Promise<void> {
    this.rulesById.clear();

    // 1. 加载内置规则
    if (this.config.enableBuiltin) {
      const builtinRules = this.parser.parseBuiltinRules();
      for (const rule of builtinRules) {
        this.rulesById.set(rule.id, rule);
      }
    }

    // 2. 加载用户自定义规则
    if (userYamlContent) {
      const { rules: userRules, errors } = this.parser.parseUserRules(userYamlContent);
      for (const rule of userRules) {
        // 用户规则覆盖同名内置规则
        this.rulesById.set(rule.id, rule);
      }
      if (errors.length > 0) {
        console.warn("[DSLRegistry] User rule parse errors:", errors);
      }
    }

    // 3. 应用禁用列表
    for (const disabledId of this.disabledRuleIds) {
      const rule = this.rulesById.get(disabledId);
      if (rule) {
        rule.enabled = false;
      }
    }

    console.log(`[DSLRegistry] Loaded ${this.rulesById.size} rules (${this.getEnabledRules().length} enabled)`);
  }

  /**
   * 获取所有启用的规则
   */
  getEnabledRules(): DSLRule[] {
    return Array.from(this.rulesById.values()).filter((r) => r.enabled);
  }

  /**
   * 获取所有规则（含已禁用的）
   */
  getAllRules(): DSLRule[] {
    return Array.from(this.rulesById.values());
  }

  /**
   * 按 ID 获取规则
   */
  getRule(id: string): DSLRule | undefined {
    return this.rulesById.get(id);
  }

  /**
   * 获取特定类型的规则
   */
  getRulesByStructure(structure: string): DSLRule[] {
    return this.getEnabledRules().filter((r) => r.output.structure === structure);
  }

  /**
   * 获取非 fallback 规则（主动匹配规则）
   */
  getActiveRules(): DSLRule[] {
    return this.getEnabledRules().filter((r) => !r.fallback);
  }

  /**
   * 获取 fallback 规则（兜底规则）
   */
  getFallbackRules(): DSLRule[] {
    return this.getEnabledRules().filter((r) => r.fallback);
  }

  /**
   * 禁用规则
   */
  disableRule(id: string): boolean {
    const rule = this.rulesById.get(id);
    if (rule) {
      rule.enabled = false;
      this.disabledRuleIds.add(id);
      return true;
    }
    return false;
  }

  /**
   * 启用规则
   */
  enableRule(id: string): boolean {
    const rule = this.rulesById.get(id);
    if (rule) {
      rule.enabled = true;
      this.disabledRuleIds.delete(id);
      return true;
    }
    return false;
  }

  /**
   * 添加用户自定义规则
   */
  addUserRule(rule: DSLRule): void {
    rule.builtin = false;
    rule.enabled = true;
    this.rulesById.set(rule.id, rule);
  }

  /**
   * 删除用户自定义规则
   */
  removeUserRule(id: string): boolean {
    const rule = this.rulesById.get(id);
    if (rule && !rule.builtin) {
      this.rulesById.delete(id);
      return true;
    }
    return false;
  }

  /**
   * 获取注册表统计
   */
  getStats(): { total: number; enabled: number; builtin: number; user: number; } {
    const all = this.getAllRules();
    return {
      total: all.length,
      enabled: all.filter((r) => r.enabled).length,
      builtin: all.filter((r) => r.builtin).length,
      user: all.filter((r) => !r.builtin).length,
    };
  }

  /**
   * 重置为默认状态
   */
  async reset(): Promise<void> {
    this.disabledRuleIds.clear();
    await this.initialize();
  }
}
