"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res, err) => function __init() {
  if (err) throw err[0];
  try {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  } catch (e) {
    throw err = [e], e;
  }
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// ai/openai.ts
var OpenAIProvider;
var init_openai = __esm({
  "ai/openai.ts"() {
    "use strict";
    OpenAIProvider = class {
      name = "OpenAI-Compatible";
      baseUrl;
      apiKey;
      defaultModel;
      constructor(baseUrl, apiKey, defaultModel) {
        this.baseUrl = baseUrl.replace(/\/+$/, "");
        this.apiKey = apiKey;
        this.defaultModel = defaultModel;
      }
      async chat(options) {
        const response = await fetch(`${this.baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`
          },
          body: JSON.stringify({
            model: options.model || this.defaultModel,
            messages: options.messages.map((m) => ({
              role: m.role,
              content: m.content
            })),
            max_tokens: options.maxTokens ?? 4096,
            temperature: options.temperature ?? 0.7
          })
        });
        if (!response.ok) {
          const err = await response.text();
          throw new Error(`AI API error (${response.status}): ${err}`);
        }
        const data = await response.json();
        return data.choices[0].message.content;
      }
      async embed(text) {
        const response = await fetch(`${this.baseUrl}/embeddings`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`
          },
          body: JSON.stringify({
            input: text,
            model: "text-embedding-3-small"
          })
        });
        if (!response.ok) {
          const err = await response.text();
          throw new Error(`Embedding API error (${response.status}): ${err}`);
        }
        const data = await response.json();
        return data.data[0].embedding;
      }
      async healthCheck() {
        try {
          const response = await fetch(`${this.baseUrl}/models`, {
            headers: {
              Authorization: `Bearer ${this.apiKey}`
            }
          });
          return response.ok;
        } catch {
          return false;
        }
      }
    };
  }
});

// ai/prompts.ts
var COMPRESSION_SYSTEM_PROMPT, CHAT_SYSTEM_PROMPT;
var init_prompts = __esm({
  "ai/prompts.ts"() {
    "use strict";
    COMPRESSION_SYSTEM_PROMPT = `\u4F60\u662F\u4E00\u4E2A\u5B66\u4E60\u5361\u7247\u4F18\u5316\u4E13\u5BB6\u3002\u5C06\u7528\u6237\u63D0\u4F9B\u7684\u5B66\u4E60\u7B14\u8BB0\u5185\u5BB9\u538B\u7F29\u6210\u66F4\u6613\u8BB0\u5FC6\u7684\u5361\u7247\u683C\u5F0F\u3002

## \u4EFB\u52A1
1. \u7406\u89E3\u7B14\u8BB0\u5185\u5BB9\u7684\u6838\u5FC3\u77E5\u8BC6\u70B9
2. \u751F\u6210 1-3 \u5F20\u6700\u4F18\u5361\u7247\uFF08QA / cloze / \u52A9\u8BB0\uFF09
3. \u5BF9\u5173\u952E\u6982\u5FF5\u8FDB\u884C\u667A\u80FD\u6316\u7A7A\uFF08cloze\uFF09
4. \u751F\u6210\u52A9\u8BB0\u53E3\u8BC0\uFF08\u53EF\u9009\uFF09

## \u8F93\u51FA\u683C\u5F0F
\u5FC5\u987B\u8FD4\u56DE JSON\uFF08\u4E0D\u8981\u5305\u542B markdown \u4EE3\u7801\u5757\u6807\u8BB0\uFF09\uFF1A

{
  "compressed": "\u538B\u7F29\u540E\u7684\u4E00\u53E5\u8BDD\u603B\u7ED3\uFF0830\u5B57\u4EE5\u5185\uFF09",
  "cards": [
    {
      "type": "qa" | "cloze" | "mnemonic",
      "front": "\u5361\u7247\u6B63\u9762\u95EE\u9898",
      "back": "\u5361\u7247\u80CC\u9762\u7B54\u6848",
      "clozeSegments": [
        { "hint": "\u4E0A\u4E0B\u6587\u63D0\u793A", "answer": "\u88AB\u9690\u85CF\u7684\u7B54\u6848" }
      ]
    }
  ]
}

## \u89C4\u5219
- type=qa: \u6B63\u9762\u662F\u95EE\u9898\uFF0C\u80CC\u9762\u662F\u7B54\u6848
- type=cloze: front \u7528 {{c1::\u7B54\u6848}} \u6807\u8BB0\u6316\u7A7A\u4F4D\u7F6E\uFF0Cback \u662F\u5B8C\u6574\u53E5
- type=mnemonic: \u751F\u6210\u7B80\u77ED\u53E3\u8BC0\u8F85\u52A9\u8BB0\u5FC6
- \u4F18\u5148\u63D0\u53D6\uFF1A\u5B9A\u4E49\u3001\u673A\u5236\u3001\u5BF9\u6BD4\u3001\u4E34\u5E8A\u610F\u4E49
- \u6BCF\u5F20\u5361\u7247\u72EC\u7ACB\uFF0C\u4E0D\u4E92\u76F8\u4F9D\u8D56`;
    CHAT_SYSTEM_PROMPT = (context) => `\u4F60\u662F\u4E00\u4E2A AI \u5B66\u4E60\u52A9\u624B\uFF0C\u5E2E\u52A9\u7528\u6237\u7BA1\u7406 RemiFocus \u5B66\u4E60\u7CFB\u7EDF\u4E2D\u7684\u77E5\u8BC6\u5361\u7247\u3002

## \u5F53\u524D vault \u6982\u51B5
- \u603B\u5361\u7247\u6570: ${context.totalCards}
- \u603B\u5361\u7EC4\u6570: ${context.totalDecks}
- \u77E5\u8BC6\u5355\u5143\u6570: ${context.kuCount}

## \u80FD\u529B
1. \u56DE\u7B54\u5B66\u4E60\u65B9\u6CD5\u95EE\u9898
2. \u5206\u6790\u5B66\u4E60\u6570\u636E
3. \u5EFA\u8BAE\u590D\u4E60\u7B56\u7565
4. \u5E2E\u52A9\u7EC4\u7EC7\u5361\u7EC4\u7ED3\u6784

\u8BF7\u7528\u4E2D\u6587\u56DE\u7B54\uFF0C\u7B80\u6D01\u4E13\u4E1A\u3002`;
  }
});

// ai/compression-service.ts
var CompressionService;
var init_compression_service = __esm({
  "ai/compression-service.ts"() {
    "use strict";
    init_prompts();
    CompressionService = class {
      provider;
      model;
      constructor(provider, model) {
        this.provider = provider;
        this.model = model;
      }
      /**
       * 对单个知识单元进行压缩，生成多张卡片
       */
      async compress(ku) {
        const userMessage = this.buildUserMessage(ku);
        const rawJson = await this.provider.chat({
          model: this.model,
          messages: [
            { role: "system", content: COMPRESSION_SYSTEM_PROMPT, timestamp: Date.now() },
            { role: "user", content: userMessage, timestamp: Date.now() }
          ],
          maxTokens: 2048,
          temperature: 0.7
        });
        return this.parseResponse(rawJson);
      }
      /**
       * 批量压缩（逐个调用，可加并发限制）
       */
      async compressBatch(kus, concurrency = 3) {
        const results = [];
        const queue = [...kus];
        const worker = async () => {
          while (queue.length > 0) {
            const ku = queue.shift();
            try {
              const result = await this.compress(ku);
              results.push(result);
            } catch (err) {
              console.error("[Compression] Failed to compress:", err);
              results.push({
                compressed: ku.rawText.slice(0, 30),
                cards: []
              });
            }
          }
        };
        const workers = Array.from({ length: Math.min(concurrency, kus.length) }, () => worker());
        await Promise.all(workers);
        return results;
      }
      buildUserMessage(ku) {
        return `## \u7B14\u8BB0\u5185\u5BB9
${ku.rawText}

## \u5143\u6570\u636E
- \u7ED3\u6784\u7C7B\u578B: ${ku.structure}
- \u6807\u7B7E: ${ku.tags.join(", ") || "\u65E0"}

\u8BF7\u538B\u7F29\u4EE5\u4E0A\u5185\u5BB9\uFF0C\u751F\u6210\u6700\u6613\u8BB0\u5FC6\u7684\u5361\u7247\u3002`;
      }
      parseResponse(raw) {
        try {
          const jsonStr = raw.replace(/```(?:json)?\s*/g, "").trim();
          return JSON.parse(jsonStr);
        } catch {
          return {
            compressed: raw.slice(0, 30),
            cards: [
              {
                type: "qa",
                front: "\u538B\u7F29\u7B14\u8BB0",
                back: raw.slice(0, 200)
              }
            ]
          };
        }
      }
    };
  }
});

// ai/service.ts
var service_exports = {};
__export(service_exports, {
  AIService: () => AIService
});
var AIService;
var init_service = __esm({
  "ai/service.ts"() {
    "use strict";
    init_openai();
    init_prompts();
    init_compression_service();
    AIService = class {
      settings;
      provider = null;
      compressionService = null;
      engine = null;
      constructor(settings, engine) {
        this.settings = settings;
        this.engine = engine ?? null;
        this.rebuild();
      }
      /**
       * 重建供应器（设置变更后调用）
       */
      rebuild(settings) {
        if (settings) this.settings = settings;
        if (this.settings.enabled && this.settings.apiKey) {
          this.provider = new OpenAIProvider(
            this.settings.baseUrl,
            this.settings.apiKey,
            this.settings.model
          );
          this.compressionService = new CompressionService(
            this.provider,
            this.settings.compressionModel ?? this.settings.model
          );
        } else {
          this.provider = null;
          this.compressionService = null;
        }
      }
      /**
       * 基础聊天
       */
      async chat(messages) {
        if (!this.provider) {
          throw new Error("AI \u670D\u52A1\u672A\u914D\u7F6E\uFF0C\u8BF7\u5728\u8BBE\u7F6E\u4E2D\u586B\u5199 API Key");
        }
        const systemPrompt = await this.buildSystemPrompt();
        return this.provider.chat({
          model: this.settings.model,
          messages: [
            { role: "system", content: systemPrompt, timestamp: Date.now() },
            ...messages
          ],
          maxTokens: this.settings.maxTokens,
          temperature: this.settings.temperature
        });
      }
      /**
       * 压缩模式：对知识单元生成压缩卡片
       */
      async compressKU(ku) {
        if (!this.compressionService) {
          throw new Error("\u538B\u7F29\u670D\u52A1\u672A\u521D\u59CB\u5316\uFF0C\u8BF7\u5728\u8BBE\u7F6E\u4E2D\u586B\u5199 API Key");
        }
        return this.compressionService.compress(ku);
      }
      /**
       * 批量压缩
       */
      async compressBatch(kus) {
        if (!this.compressionService) {
          throw new Error("\u538B\u7F29\u670D\u52A1\u672A\u521D\u59CB\u5316");
        }
        return this.compressionService.compressBatch(kus);
      }
      /**
       * 检查服务是否可用
       */
      async healthCheck() {
        if (!this.provider) {
          return { ok: false, message: "AI \u672A\u914D\u7F6E" };
        }
        try {
          const healthy = await this.provider.healthCheck();
          return healthy ? { ok: true, message: "\u2705 \u8FDE\u63A5\u6B63\u5E38" } : { ok: false, message: "\u274C API \u8FDE\u63A5\u5931\u8D25" };
        } catch (err) {
          return { ok: false, message: `\u274C ${err.message}` };
        }
      }
      /**
       * 构建系统 Prompt（含 vault 上下文）
       */
      async buildSystemPrompt() {
        let totalCards = 0;
        let totalDecks = 0;
        try {
          if (this.engine) {
            const stats = await this.engine.getStats();
            totalCards = stats.total;
            const decks = await this.engine.getDeckNames();
            totalDecks = decks.length;
          }
        } catch {
        }
        return CHAT_SYSTEM_PROMPT({
          totalCards,
          totalDecks,
          kuCount: 0
        });
      }
    };
  }
});

// main.ts
var main_exports = {};
__export(main_exports, {
  default: () => RemiFocusPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian5 = require("obsidian");

// modes/exposure.ts
function getExposureQueue(deck, count) {
  const candidates = [];
  for (const [word, entry] of Object.entries(deck.words)) {
    if (entry.state === "new" || entry.state === "exposure") {
      candidates.push([word, entry]);
    }
  }
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  return candidates.slice(0, count);
}
function processExposureResult(entry, recognized, now) {
  const result = recognized ? "good" : "again";
  const next = {
    ...entry,
    state: recognized ? "test" : "exposure",
    history: [
      ...entry.history,
      { date: now, mode: "exposure", result }
    ]
  };
  return next;
}

// modes/test-mode.ts
function getTestQueue(deck, count) {
  const candidates = [];
  for (const [word, entry] of Object.entries(deck.words)) {
    if (entry.state === "test" || entry.state === "new") {
      candidates.push([word, entry]);
    }
  }
  candidates.sort((a, b) => {
    const na = a[1].next ?? "9999-12-31";
    const nb = b[1].next ?? "9999-12-31";
    return na.localeCompare(nb);
  });
  const totalAvail = candidates.length;
  if (totalAvail === 0) return [];
  if (count <= totalAvail) {
    return candidates.slice(0, count);
  }
  const result = [...candidates];
  const weights = candidates.map(([, entry]) => calcWeight(entry));
  const remaining = count - totalAvail;
  for (let i = 0; i < remaining; i++) {
    const idx = weightedPick(weights);
    result.push(candidates[idx]);
  }
  return result;
}
function calcWeight(entry) {
  const easeNorm = Math.max(0, Math.min(1, (350 - entry.ease) / 220));
  const intervalNorm = Math.max(0, Math.min(1, 1 - Math.log2(entry.interval + 1) / Math.log2(366)));
  let againCount = 0;
  let hardCount = 0;
  for (const h of entry.history) {
    if (h.result === "again") againCount++;
    else if (h.result === "hard") hardCount++;
  }
  const errorPenalty = againCount * 3 + hardCount * 1.5;
  const baseWeight = easeNorm * 0.5 + intervalNorm * 0.3 + Math.min(1, errorPenalty / 10) * 0.2;
  return Math.max(0.1, baseWeight);
}
function weightedPick(weights) {
  const total = weights.reduce((sum, w) => sum + w, 0);
  if (total <= 0) return Math.floor(Math.random() * weights.length);
  let r = Math.random() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r <= 0) return i;
  }
  return weights.length - 1;
}
function processTestResult(word, entry, result, now, scheduler) {
  const output = scheduler.schedule({
    word,
    entry,
    result,
    mode: "test",
    now
  });
  return {
    ...entry,
    state: "review",
    ease: output.ease,
    interval: output.interval,
    next: output.next,
    history: [
      ...entry.history,
      { date: now, mode: "test", result }
    ]
  };
}

// modes/review.ts
function getReviewQueue(deck, count, today) {
  const candidates = [];
  for (const [word, entry] of Object.entries(deck.words)) {
    if (entry.state === "review" && entry.next !== null && entry.next <= today) {
      candidates.push([word, entry]);
    }
  }
  candidates.sort((a, b) => a[1].next.localeCompare(b[1].next));
  return candidates.slice(0, count);
}
function processReviewResult(word, entry, result, now, scheduler) {
  const output = scheduler.schedule({
    word,
    entry,
    result,
    mode: "review",
    now
  });
  return {
    ...entry,
    ease: output.ease,
    interval: output.interval,
    next: output.next,
    history: [
      ...entry.history,
      { date: now, mode: "review", result }
    ]
  };
}

// engine/session.ts
var SessionManager = class {
  constructor(storage, scheduler, queueSize, plasticity) {
    this.storage = storage;
    this.scheduler = scheduler;
    this.queueSize = queueSize ?? 20;
    this.plasticity = plasticity ?? null;
  }
  storage;
  scheduler;
  queueSize;
  plasticity;
  // ─── 原有方法 ───
  async getQueue(mode, count) {
    const deck = await this.storage.load();
    const size = count ?? this.queueSize;
    switch (mode) {
      case "exposure":
        return getExposureQueue(deck, size);
      case "test":
        return getTestQueue(deck, size);
      case "review":
        const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
        return getReviewQueue(deck, size, today);
    }
  }
  async processResult(word, mode, result) {
    const deck = await this.storage.load();
    const entry = deck.words[word];
    if (!entry) throw new Error(`Word not found: ${word}`);
    const now = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
    let updated;
    switch (mode) {
      case "exposure":
        updated = processExposureResult(entry, result === "good", now);
        break;
      case "test":
        updated = processTestResult(word, entry, result, now, this.scheduler);
        break;
      case "review":
        updated = processReviewResult(word, entry, result, now, this.scheduler);
        break;
    }
    await this.storage.updateWord(word, updated);
    if (this.plasticity && entry.kuId) {
      try {
        await this.plasticity.processLearningResult(
          entry.kuId,
          result,
          updated.ease
        );
      } catch (err) {
        console.error(`[SessionManager] KU plasticity error for ${word}:`, err);
      }
    }
    return updated;
  }
  async getStats() {
    const deck = await this.storage.load();
    const words = Object.values(deck.words);
    const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
    return {
      total: words.length,
      new: words.filter((w) => w.state === "new").length,
      exposure: words.filter((w) => w.state === "exposure").length,
      test: words.filter((w) => w.state === "test").length,
      review: words.filter((w) => w.state === "review").length,
      dueToday: words.filter(
        (w) => w.state === "review" && w.next !== null && w.next <= today
      ).length
    };
  }
  // ─── 新增：多卡组支持 ───
  async getDeckNames() {
    const deck = await this.storage.load();
    const names = /* @__PURE__ */ new Set();
    for (const entry of Object.values(deck.words)) {
      for (const d of entry.deck) {
        names.add(d);
      }
    }
    return Array.from(names).sort();
  }
  async getDeckInfo(deckName) {
    const deck = await this.storage.load();
    const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
    let totalCards = 0;
    let newCount = 0;
    let exposureCount = 0;
    let testCount = 0;
    let reviewCount = 0;
    let dueCount = 0;
    let totalEase = 0;
    let totalInterval = 0;
    let totalSuccess = 0;
    let totalAttempts = 0;
    for (const entry of Object.values(deck.words)) {
      if (!entry.deck.includes(deckName)) continue;
      totalCards++;
      switch (entry.state) {
        case "new":
          newCount++;
          break;
        case "exposure":
          exposureCount++;
          break;
        case "test":
          testCount++;
          break;
        case "review":
          reviewCount++;
          break;
      }
      if (entry.state === "review" && entry.next !== null && entry.next <= today) {
        dueCount++;
      }
      totalEase += entry.ease;
      totalInterval += entry.interval;
      for (const h of entry.history) {
        totalAttempts++;
        if (h.result === "good" || h.result === "easy") totalSuccess++;
      }
    }
    const mastery = totalCards > 0 ? this.calcMastery(totalEase / totalCards, totalInterval / totalCards, totalAttempts > 0 ? totalSuccess / totalAttempts : 0) : 0;
    return {
      name: deckName,
      totalCards,
      dueCount,
      mastery: Math.round(mastery * 100),
      newCount,
      exposureCount,
      testCount,
      reviewCount
    };
  }
  async getAllDeckInfos() {
    const names = await this.getDeckNames();
    const results = await Promise.all(names.map((n) => this.getDeckInfo(n)));
    return results;
  }
  async computeMastery(deckName) {
    const deck = await this.storage.load();
    let totalEase = 0;
    let totalInterval = 0;
    let totalSuccess = 0;
    let totalAttempts = 0;
    let count = 0;
    for (const entry of Object.values(deck.words)) {
      if (!entry.deck.includes(deckName)) continue;
      count++;
      totalEase += entry.ease;
      totalInterval += entry.interval;
      for (const h of entry.history) {
        totalAttempts++;
        if (h.result === "good" || h.result === "easy") totalSuccess++;
      }
    }
    if (count === 0) {
      return { mastery: 0, ease: 250, interval: 0, successRate: 0 };
    }
    const avgEase = totalEase / count;
    const avgInterval = totalInterval / count;
    const successRate = totalAttempts > 0 ? totalSuccess / totalAttempts : 0;
    const mastery = this.calcMastery(avgEase, avgInterval, successRate);
    return {
      mastery: Math.round(mastery * 100),
      ease: Math.round(avgEase),
      interval: Math.round(avgInterval),
      successRate: Math.round(successRate * 100) / 100
    };
  }
  async getFolderStats() {
    const decks = await this.getAllDeckInfos();
    const folderMap = /* @__PURE__ */ new Map();
    for (const deck of decks) {
      const folder = deck.name.split("/")[0] || deck.name;
      const list = folderMap.get(folder) ?? [];
      list.push(deck);
      folderMap.set(folder, list);
    }
    const folders = [];
    for (const [path, deckList] of folderMap) {
      let totalCards = 0;
      let totalMastery = 0;
      for (const d of deckList) {
        totalCards += d.totalCards;
        totalMastery += d.mastery * d.totalCards;
      }
      folders.push({
        path,
        decks: deckList,
        totalCards,
        mastery: totalCards > 0 ? Math.round(totalMastery / totalCards) : 0
      });
    }
    return folders.sort((a, b) => a.path.localeCompare(b.path));
  }
  // ─── 私有工具 ───
  /**
   * 熟练度计算公式
   * mastery = weighted average(ease, interval, successRate)
   * ease 权重 0.4, interval 权重 0.3, successRate 权重 0.3
   * 归一化到 0–1 范围
   */
  calcMastery(avgEase, avgInterval, successRate) {
    const easeNorm = Math.min(1, Math.max(0, (avgEase - 130) / 220));
    const intervalNorm = Math.min(1, Math.log2(avgInterval + 1) / Math.log2(366));
    return easeNorm * 0.4 + intervalNorm * 0.3 + successRate * 0.3;
  }
};

// scheduler/sm2.ts
var SM2Scheduler = class {
  name = "sm-2";
  schedule(input) {
    const { entry, result } = input;
    let ease = entry.ease;
    let interval = Math.max(1, entry.interval);
    switch (result) {
      case "again":
        ease = Math.max(130, ease - 20);
        interval = 0;
        break;
      case "hard":
        ease = Math.max(130, ease - 20);
        interval = Math.max(1, Math.round(interval * 1.2));
        break;
      case "good":
        interval = Math.round(interval * ease / 100);
        break;
      case "easy":
        ease += 20;
        interval = Math.round(interval * ease / 100 * 1.3);
        break;
    }
    interval = Math.min(interval, 365);
    interval = Math.max(0, interval);
    const due = new Date(input.now);
    due.setDate(due.getDate() + interval);
    const next = due.toISOString().slice(0, 10);
    return { ease, interval, next };
  }
};

// scheduler/exam.ts
var ExamScheduler = class {
  name = "exam";
  schedule(input) {
    const { entry, result } = input;
    let ease = entry.ease;
    let interval = entry.interval;
    switch (result) {
      case "again":
        ease = Math.max(130, ease - 30);
        interval = 0;
        break;
      case "hard":
        ease = Math.max(130, ease - 15);
        interval = Math.max(1, Math.round(interval * 0.5));
        break;
      case "good":
        interval = Math.max(1, Math.round(interval * ease / 100));
        break;
      case "easy":
        ease += 15;
        interval = Math.max(1, Math.round(interval * ease / 100 * 1.5));
        break;
    }
    interval = Math.min(interval, 90);
    const due = new Date(input.now);
    due.setDate(due.getDate() + interval);
    const next = due.toISOString().slice(0, 10);
    return { ease, interval, next };
  }
};

// scheduler/fixed-interval.ts
var INTERVALS = {
  again: 0,
  hard: 1,
  good: 3,
  easy: 7
};
var FixedIntervalScheduler = class {
  name = "fixed-interval";
  schedule(input) {
    const interval = INTERVALS[input.result];
    const due = new Date(input.now);
    due.setDate(due.getDate() + interval);
    const next = due.toISOString().slice(0, 10);
    return { ease: input.entry.ease, interval, next };
  }
};

// scheduler/fsrs.ts
var DEFAULT_W = [
  0.4197,
  // w0: initial stability offset
  1.1869,
  // w1: initial stability rating multiplier
  3.0412,
  // w2: initial difficulty offset
  15.2441,
  // w3: initial difficulty rating multiplier
  7.1439,
  // w4: difficulty decrement
  0.6473,
  // w5: mean reversion weight
  19e-4,
  // w6: mean reversion offset
  1.4997,
  // w7: mean reversion damping scale
  0.1593,
  // w8: mean reversion damping half-life
  0.2001,
  // w9: mean reversion damping steepness
  1.558,
  // w10: stability increase scale
  0.8996,
  // w11: difficulty dependence
  0.0524,
  // w12: minimum stability factor
  0.2857,
  // w13: stability decay after lapse
  1.3699,
  // w14: stability increase for "easy"
  0.2515,
  // w15: lapse stability factor
  1.5148,
  // w16: ease bonus for "easy"
  0.1504,
  // w17: retrievability decay exponent
  0.1
  // w18: retrievability decay base
];
function ratingToInt(rating) {
  switch (rating) {
    case "again":
      return 1;
    case "hard":
      return 2;
    case "good":
      return 3;
    case "easy":
      return 4;
    default:
      return 3;
  }
}
function sigmoid(x) {
  return 1 / (1 + Math.exp(-x));
}
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
var FSRSScheduler = class {
  name = "fsrs";
  w;
  constructor(weights) {
    this.w = weights ?? DEFAULT_W;
  }
  schedule(input) {
    const { entry, result, now } = input;
    const rating = ratingToInt(result);
    let difficulty = entry.interval === 0 && entry.ease === 250 ? this.initialDifficulty(rating) : this.decodeDifficulty(entry.ease);
    let stability = entry.interval;
    const isFirstReview = stability === 0;
    if (isFirstReview) {
      stability = this.initialStability(rating);
      difficulty = this.initialDifficulty(rating);
    } else {
      if (rating === 1) {
        stability = this.stabilityAfterLapse(stability, difficulty, rating);
      } else {
        stability = this.stabilityAfterSuccess(stability, difficulty, rating);
      }
      difficulty = this.difficultyAfterReview(difficulty, rating);
    }
    const retrievabilityTarget = 0.9;
    const interval = this.nextInterval(stability, retrievabilityTarget);
    const ease = this.encodeDifficulty(difficulty);
    const due = new Date(now);
    due.setDate(due.getDate() + interval);
    const next = due.toISOString().slice(0, 10);
    return {
      ease: Math.round(ease),
      interval: Math.max(1, Math.round(interval)),
      next
    };
  }
  // ─── FSRS-5 核心算法 ───
  /**
   * 初始稳定性（首次记忆强度）
   * S0 = w0 + w1 × (rating - 1)
   */
  initialStability(rating) {
    return Math.max(0.01, this.w[0] + this.w[1] * (rating - 1));
  }
  /**
   * 初始难度
   * D0 = w2 + w3 × (rating - 1)
   * 范围 [1, 10]
   */
  initialDifficulty(rating) {
    return clamp(this.w[2] + this.w[3] * (rating - 1), 1, 10);
  }
  /**
   * 成功回忆后的稳定性增长
   *
   * S' = S × (1 + w10 × (1 - w11 × D) × (1 + w12 × (1 - e^(-S / w13))) × e^(w14 × (rating - 1)))
   *
   * 简化: stability × (1 + w10 × f(D) × g(S) × h(rating))
   *   其中 f(D) = 1 - w11 × D        — 难度效应
   *        g(S) = 1 + w12 × (1 - e^(-S/w13)) — 稳定性效应
   *        h(rating) = e^(w14 × (rating - 1)) — 评分效应
   */
  stabilityAfterSuccess(stability, difficulty, rating) {
    const difficultyFactor = 1 - this.w[11] * difficulty;
    const stabilityFactor = 1 + this.w[12] * (1 - Math.exp(-stability / this.w[13]));
    const ratingFactor = Math.exp(this.w[14] * (rating - 1));
    return stability * (1 + this.w[10] * difficultyFactor * stabilityFactor * ratingFactor);
  }
  /**
   * 遗忘后的稳定性衰减
   *
   * S' = w15 × D^(-w16) × (S + 1)^w17 - 1
   *
   * 简化版本:
   * S' = min(S, S × w15 × D^(-w16))
   */
  stabilityAfterLapse(stability, difficulty, rating) {
    const lapseFactor = this.w[15] * Math.pow(difficulty, -this.w[16]);
    const newStability = Math.max(0.01, stability * lapseFactor);
    return newStability;
  }
  /**
   * 复习后的难度更新
   *
   * D' = D + w4 × (5 - rating) × meanReversion
   *
   * 其中 meanReversion = 1 - sigmoid(w5 × D + w6 + w7 × ln(1 + e^((w8 - D) / w9)))
   *
   * 范围 [1, 10]
   */
  difficultyAfterReview(difficulty, rating) {
    if (rating === 1) {
      return this.initialDifficulty(1);
    }
    const damping = this.w[5] * difficulty + this.w[6] + this.w[7] * Math.log(1 + Math.exp((this.w[8] - difficulty) / this.w[9]));
    const meanReversion = 1 - sigmoid(damping);
    const delta = this.w[4] * (5 - rating) * meanReversion;
    const newDifficulty = difficulty + delta;
    return clamp(newDifficulty, 1, 10);
  }
  /**
   * 基于目标 retrievability 计算复习间隔
   *
   * R(t) = (1 + (t / (S × 9))^(-1))^(-1/w17)
   *
   * 已知 R 和 S，求 t：
   * t = S × 9 × (R^(-w17) - 1)^(-1)
   *
   * 简化：使用 90% 目标 → t ≈ S × (一些系数)
   */
  nextInterval(stability, targetRetrievability) {
    const r = targetRetrievability;
    const denominator = Math.pow(r, -this.w[17]) - 1;
    if (denominator <= 0) return stability;
    const interval = 9 * stability / denominator;
    return Math.max(1, Math.round(interval));
  }
  // ─── 编解码 ───
  /**
   * FSRS difficulty (1-10) → SM-2 ease (100-1000)
   */
  encodeDifficulty(difficulty) {
    const ease = 50 + difficulty * 95;
    return Math.round(clamp(ease, 100, 1e3));
  }
  /**
   * SM-2 ease (100-1000) → FSRS difficulty (1-10)
   */
  decodeDifficulty(ease) {
    const difficulty = (ease - 50) / 95;
    return clamp(difficulty, 1, 10);
  }
};

// storage/obsidian-storage.ts
var ObsidianDeckStorage = class {
  adapter;
  filePath;
  /**
   * @param adapter  Obsidian 的 DataAdapter (app.vault.adapter)
   * @param filePath deck.json 的相对路径（相对于 vault 根）
   */
  constructor(adapter, filePath) {
    this.adapter = adapter;
    this.filePath = filePath;
  }
  async load() {
    try {
      const exists = await this.adapter.exists(this.filePath);
      if (!exists) {
        return { version: 1, words: {} };
      }
      const raw = await this.adapter.read(this.filePath);
      return JSON.parse(raw);
    } catch (err) {
      console.error("RemiFocus: Failed to load deck.json", err);
      return { version: 1, words: {} };
    }
  }
  async save(data) {
    const json = JSON.stringify(data, null, 2);
    await this.adapter.write(this.filePath, json);
  }
  async updateWord(word, entry) {
    const data = await this.load();
    data.words[word] = entry;
    await this.save(data);
  }
  async getWord(word) {
    const data = await this.load();
    return data.words[word];
  }
  async getWordsByState(state) {
    const data = await this.load();
    const result = [];
    for (const [word, entry] of Object.entries(data.words)) {
      if (entry.state === state) {
        result.push([word, entry]);
      }
    }
    return result;
  }
};

// ui/base.ts
var UIComponent = class {
  container;
  engine;
  constructor(container, engine) {
    this.container = container;
    this.engine = engine;
  }
  /** 卸载组件，清理 DOM */
  destroy() {
    this.container.innerHTML = "";
  }
  // ─── 工具方法 ───
  /** 创建元素 */
  el(tag, className, text) {
    const el2 = document.createElement(tag);
    if (className) el2.className = className;
    if (text !== void 0) el2.textContent = text;
    return el2;
  }
  /** 在指定父元素下创建子元素并追加 */
  appendChild(parent, tag, className, text) {
    const el2 = this.el(tag, className, text);
    parent.appendChild(el2);
    return el2;
  }
  /** 清空容器 */
  clear() {
    this.container.innerHTML = "";
  }
  /** 创建图标（使用 Unicode 或简单文本） */
  icon(emoji, className) {
    const span = document.createElement("span");
    span.textContent = emoji;
    if (className) span.className = className;
    return span;
  }
};

// ui/popup.ts
var MainPopup = class extends UIComponent {
  callbacks;
  selectedMode = "review";
  constructor(container, engine, callbacks) {
    super(container, engine);
    this.callbacks = callbacks;
    container.classList.add("remi-focus");
    container.style.padding = "24px";
  }
  async render() {
    this.clear();
    const deckInfos = await this.engine.getAllDeckInfos();
    this.renderTopBar(deckInfos);
    this.renderModeCards();
    this.renderDeckList(deckInfos);
  }
  // ─── 顶部栏 ───
  renderTopBar(decks) {
    const top = this.appendChild(this.container, "div", "");
    top.style.cssText = "display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;";
    const total = decks.reduce((s, d) => s + d.totalCards, 0);
    const title = this.appendChild(top, "div", "");
    title.style.cssText = "font-size:1.1em;font-weight:700;";
    title.textContent = `\u{1F9E0} RemiFocus  \xB7  ${total} \u8BCD`;
    const btnGroup = this.appendChild(top, "div", "");
    btnGroup.style.cssText = "display:flex;gap:8px;";
    const homeBtn = this.appendChild(btnGroup, "button", "");
    homeBtn.style.cssText = "padding:6px 16px;border:1px solid var(--remi-border);border-radius:6px;cursor:pointer;background:var(--remi-bg);color:var(--remi-text);font-size:0.85em;";
    homeBtn.textContent = "\u{1F3E0} \u4E3B\u9875";
    homeBtn.addEventListener("click", () => this.callbacks.onHomeClick());
  }
  // ─── 模式选择卡片 ───
  renderModeCards() {
    const grid = this.appendChild(this.container, "div", "");
    grid.style.cssText = "display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:24px;";
    const modes = [
      { mode: "exposure", icon: "\u{1F441}", title: "\u521D\u5B66 Exposure", desc: "\u5FEB\u901F\u7FFB\u8BCD\uFF0C\u719F\u6089\u9636\u6BB5\n\u4E0D\u5F71\u54CD\u95F4\u9694\u7B97\u6CD5", color: "#3498db" },
      { mode: "test", icon: "\u{1F9EA}", title: "\u6D4B\u8BD5 Test", desc: "\u56DE\u5FC6\u5355\u8BCD\uFF0Cagain/hard/good/easy\n\u5F71\u54CD\u8C03\u5EA6\u7CFB\u7EDF", color: "#6c5ce7" },
      { mode: "review", icon: "\u{1F504}", title: "\u590D\u4E60 Review", desc: "\u57FA\u4E8E\u95F4\u9694\u7B97\u6CD5\u81EA\u52A8\u8C03\u5EA6\nSM-2 / FSRS", color: "#27ae60" }
    ];
    for (const m of modes) {
      const isSelected = this.selectedMode === m.mode;
      const card = this.appendChild(grid, "div", "");
      card.style.cssText = `
        padding:20px 16px; border-radius:12px; cursor:pointer;
        border:2px solid ${isSelected ? m.color : "var(--remi-border)"};
        background:${isSelected ? m.color + "18" : "var(--remi-card-bg)"};
        transition:all 0.15s; display:flex; flex-direction:column; gap:8px;
        position:relative;
      `;
      if (isSelected) {
        const check = this.appendChild(card, "div", "");
        check.style.cssText = "position:absolute;top:8px;right:10px;font-size:1.2em;";
        check.textContent = "\u2713";
      }
      const iconRow = this.appendChild(card, "div", "");
      iconRow.style.cssText = "display:flex;align-items:center;gap:8px;";
      const icon = this.appendChild(iconRow, "span", "");
      icon.style.cssText = "font-size:1.5em;";
      icon.textContent = m.icon;
      const title = this.appendChild(iconRow, "span", "");
      title.style.cssText = `font-weight:700;font-size:0.95em;color:${isSelected ? m.color : "var(--remi-text)"};`;
      title.textContent = m.title;
      const desc = this.appendChild(card, "div", "");
      desc.style.cssText = "font-size:0.8em;color:var(--remi-text-muted);line-height:1.5;white-space:pre-line;";
      desc.textContent = m.desc;
      card.addEventListener("click", () => {
        this.selectedMode = m.mode;
        this.render();
      });
    }
    const startRow = this.appendChild(this.container, "div", "");
    startRow.style.cssText = "display:flex;justify-content:center;margin-bottom:24px;";
    const startBtn = this.appendChild(startRow, "button", "");
    const modeLabel = this.selectedMode === "exposure" ? "Exposure" : this.selectedMode === "test" ? "Test" : "Review";
    startBtn.style.cssText = `
      padding:12px 40px; border:none; border-radius:10px; cursor:pointer;
      background:var(--remi-accent); color:#fff; font-size:1.05em; font-weight:700;
      transition:all 0.15s;
    `;
    startBtn.textContent = `\u{1F680} \u5F00\u59CB ${modeLabel} \u5B66\u4E60`;
    startBtn.addEventListener("click", async () => {
      const decks = await this.engine.getAllDeckInfos();
      let target = decks.find(
        (d) => this.selectedMode === "review" ? d.dueCount > 0 : this.selectedMode === "test" ? d.testCount > 0 : d.exposureCount > 0 || d.newCount > 0
      );
      if (!target && decks.length > 0) target = decks[0];
      if (target) this.callbacks.onStartLearning(target.name, this.selectedMode);
    });
  }
  // ─── 卡组列表 ───
  renderDeckList(decks) {
    if (decks.length === 0) {
      const empty = this.appendChild(this.container, "div", "");
      empty.style.cssText = "text-align:center;padding:32px 0;color:var(--remi-text-muted);";
      empty.innerHTML = "\u{1F4ED} \u6682\u65E0\u5361\u7247<br><span style='font-size:0.85em'>\u7F16\u8F91\u7B14\u8BB0\u5E76\u4FDD\u5B58\u540E\u81EA\u52A8\u8BC6\u522B</span>";
      return;
    }
    const sectionTitle = this.appendChild(this.container, "div", "");
    sectionTitle.style.cssText = "font-weight:600;font-size:0.9em;margin-bottom:8px;color:var(--remi-text-muted);";
    sectionTitle.textContent = "\u{1F4C1} \u6240\u6709\u5361\u7EC4";
    for (const deck of decks) {
      const card = this.appendChild(this.container, "div", "");
      card.style.cssText = `
        display:flex;justify-content:space-between;align-items:center;
        padding:10px 14px; border-radius:8px; cursor:pointer;
        border:1px solid var(--remi-border); margin-bottom:4px;
        background:var(--remi-card-bg); transition:all 0.1s;
      `;
      card.addEventListener("mouseenter", () => card.style.borderColor = "var(--remi-accent)");
      card.addEventListener("mouseleave", () => card.style.borderColor = "var(--remi-border)");
      const left = this.appendChild(card, "div", "");
      left.style.cssText = "display:flex;align-items:center;gap:10px;";
      const name = this.appendChild(left, "span", "");
      name.style.cssText = "font-weight:600;font-size:0.9em;";
      name.textContent = deck.name;
      const chips = this.appendChild(left, "div", "");
      chips.style.cssText = "display:flex;gap:4px;font-size:0.75em;";
      chips.innerHTML = `
        <span style="color:var(--remi-text-muted)">\u{1F195}${deck.newCount}</span>
        <span style="color:var(--remi-info)">\u{1F441}${deck.exposureCount}</span>
        <span style="color:var(--remi-accent)">\u{1F9EA}${deck.testCount}</span>
        <span style="color:var(--remi-success)">\u{1F504}${deck.reviewCount}</span>
      `;
      const right = this.appendChild(card, "div", "");
      right.style.cssText = "display:flex;align-items:center;gap:8px;";
      const count = this.appendChild(right, "span", "");
      count.style.cssText = "font-size:0.85em;color:var(--remi-text-muted);";
      count.textContent = `${deck.totalCards} \u8BCD`;
      if (deck.dueCount > 0) {
        const badge = this.appendChild(right, "span", "");
        badge.style.cssText = `
          background:var(--remi-danger);color:#fff;font-size:0.75em;
          padding:2px 8px;border-radius:10px;font-weight:600;
        `;
        badge.textContent = `${deck.dueCount}`;
      }
      card.addEventListener("click", () => this.callbacks.onDeckClick(deck.name));
    }
  }
};

// ui/deckModal.ts
var DeckModal = class extends UIComponent {
  deckName;
  callbacks;
  constructor(container, engine, deckName, callbacks) {
    super(container, engine);
    this.deckName = deckName;
    this.callbacks = callbacks;
    container.classList.add("remi-focus", "remi-deck-modal");
  }
  async render() {
    this.clear();
    const info = await this.engine.getDeckInfo(this.deckName);
    this.renderHeader(info);
    this.renderModeButtons(info);
  }
  renderHeader(info) {
    const header = this.appendChild(this.container, "div", "remi-popup-header");
    const title = this.appendChild(header, "div", "remi-popup-title");
    title.textContent = `\u{1F4C7} ${info.name}  (${info.totalCards} \u8BCD)`;
    const backBtn = this.appendChild(header, "button", "remi-btn");
    backBtn.textContent = "\u2190 \u8FD4\u56DE";
    backBtn.addEventListener("click", () => this.callbacks.onBack());
  }
  renderModeButtons(info) {
    const btnGroup = this.appendChild(this.container, "div", "remi-btn-group");
    btnGroup.style.justifyContent = "center";
    btnGroup.style.flexDirection = "column";
    btnGroup.style.gap = "12px";
    btnGroup.style.marginTop = "20px";
    const modes = [
      { mode: "exposure", label: "\u{1F441} \u7EC3\u4E60\u6A21\u5F0F (Exposure)", desc: "\u5FEB\u901F\u7FFB\u8BCD\uFF0C\u719F\u6089\u9636\u6BB5", cls: "" },
      { mode: "test", label: "\u{1F9EA} \u6D4B\u8BD5\u6A21\u5F0F (Test)", desc: "\u56DE\u5FC6\u5355\u8BCD\uFF0C\u5F71\u54CD\u8C03\u5EA6", cls: "remi-btn-primary" },
      { mode: "review", label: "\u{1F504} \u590D\u4E60\u6A21\u5F0F (Review)", desc: "\u57FA\u4E8E\u95F4\u9694\u7B97\u6CD5\u81EA\u52A8\u8C03\u5EA6", cls: "" }
    ];
    for (const m of modes) {
      const wrapper = this.appendChild(btnGroup, "div", "");
      wrapper.style.display = "flex";
      wrapper.style.flexDirection = "column";
      wrapper.style.alignItems = "center";
      wrapper.style.gap = "4px";
      const btn = this.appendChild(wrapper, "button", `remi-btn ${m.cls}`);
      btn.textContent = m.label;
      btn.style.width = "100%";
      btn.style.padding = "12px 20px";
      btn.style.fontSize = "1em";
      btn.addEventListener(
        "click",
        () => this.callbacks.onStartLearning(this.deckName, m.mode)
      );
      const desc = this.appendChild(wrapper, "span", "");
      desc.textContent = m.desc;
      desc.style.fontSize = "0.8em";
      desc.style.color = "var(--remi-text-muted)";
    }
    const statsRow = this.appendChild(this.container, "div", "remi-card-stats");
    statsRow.style.justifyContent = "center";
    statsRow.style.marginTop = "20px";
    statsRow.innerHTML = `
      <span class="remi-stat">\u{1F195} \u65B0\u8BCD <strong>${info.newCount}</strong></span>
      <span class="remi-stat">\u{1F441} \u521D\u5B66 <strong>${info.exposureCount}</strong></span>
      <span class="remi-stat">\u{1F9EA} \u6D4B\u8BD5 <strong>${info.testCount}</strong></span>
      <span class="remi-stat">\u{1F504} \u590D\u4E60 <strong>${info.reviewCount}</strong></span>
    `;
  }
};

// ui/heatmap.ts
var HeatmapWidget = class extends UIComponent {
  data = {};
  async render() {
    this.clear();
    this.renderHeader();
    this.renderGrid();
    this.renderLegend();
  }
  /** 由外部注入数据 */
  setData(data) {
    this.data = data;
  }
  renderHeader() {
    const h = this.appendChild(this.container, "div", "");
    h.style.cssText = "font-weight:600;font-size:0.9em;margin-bottom:8px;";
    h.textContent = "\u{1F4C5} \u5B66\u4E60\u70ED\u529B\u56FE";
  }
  renderGrid() {
    const today = /* @__PURE__ */ new Date();
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 90);
    const startDay = startDate.getDay();
    startDate.setDate(startDate.getDate() - startDay);
    const grid = this.appendChild(this.container, "div", "");
    grid.style.cssText = "display:grid;grid-template-columns:repeat(7,1fr);gap:3px;max-width:210px;";
    const dayLabels = ["\u65E5", "\u4E00", "\u4E8C", "\u4E09", "\u56DB", "\u4E94", "\u516D"];
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
      cell.title = `${key}: ${count} \u8BCD`;
    }
  }
  renderLegend() {
    const legend = this.appendChild(this.container, "div", "");
    legend.style.cssText = "display:flex;gap:4px;align-items:center;margin-top:8px;font-size:0.7em;color:var(--remi-text-muted);";
    const levels = [0, 1, 5, 15, 30];
    const label = this.appendChild(legend, "span", "");
    label.textContent = "\u5C11";
    for (const l of levels) {
      const s = this.appendChild(legend, "span", "");
      s.style.cssText = `display:inline-block;width:10px;height:10px;border-radius:2px;background:${this.cellColor(l)};`;
    }
    const more = this.appendChild(legend, "span", "");
    more.textContent = "\u591A";
  }
  cellColor(count) {
    if (count === 0) return "var(--remi-border)";
    if (count < 5) return "#9be9a8";
    if (count < 15) return "#40c463";
    if (count < 30) return "#30a14e";
    return "#216e39";
  }
};

// ui/home.ts
var RemiDashboard = class extends UIComponent {
  callbacks;
  statsMode = "heatmap";
  constructor(container, engine, callbacks) {
    super(container, engine);
    this.callbacks = callbacks;
    container.classList.add("remi-focus");
    container.style.cssText = "padding:20px 24px;height:100%;overflow-y:auto;box-sizing:border-box;";
  }
  async render() {
    this.clear();
    const stats = await this.engine.getStats();
    const decks = await this.engine.getAllDeckInfos();
    this.renderHeader();
    this.renderTodayStatus(stats);
    this.renderChartSection(decks);
    this.renderRecentDecks(decks);
    this.renderFooter();
  }
  renderHeader() {
    const header = this.appendChild(this.container, "div", "");
    header.style.cssText = "display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;";
    const title = this.appendChild(header, "h2", "");
    title.textContent = "\u{1F3E0} \u4E3B\u9875";
    title.style.margin = "0";
    const actions = this.appendChild(header, "div", "");
    actions.style.cssText = "display:flex;gap:6px;";
    this.addSmallBtn(actions, "\u{1F4C5} \u8BA1\u5212", () => this.callbacks.onOpenPlan());
    this.addSmallBtn(actions, "\u{1F4D0} \u7B97\u6CD5", () => this.callbacks.onOpenAlgo());
    this.addSmallBtn(actions, "\u{1F4C7} \u5361\u7EC4", () => this.callbacks.onOpenDeck());
  }
  // ─── 今日状态（Q1: 我学了多少？） ───
  renderTodayStatus(stats) {
    const card = this.appendChild(this.container, "div", "");
    card.style.cssText = "padding:16px;border-radius:12px;border:1px solid var(--background-modifier-border);background:var(--background-primary);margin-bottom:16px;";
    const title = this.appendChild(card, "div", "");
    title.textContent = "\u{1F4CA} \u4ECA\u65E5\u72B6\u6001";
    title.style.cssText = "font-weight:600;font-size:0.95em;margin-bottom:12px;";
    const grid = this.appendChild(card, "div", "");
    grid.style.cssText = "display:grid;grid-template-columns:repeat(3,1fr);gap:12px;";
    this.addMetric(grid, "\u{1F4C4} \u603B\u5361\u7247", `${stats.total}`, "");
    this.addMetric(grid, "\u{1F195} \u65B0\u8BCD", `${stats.new}`, stats.new > 0 ? "var(--interactive-accent)" : "");
    this.addMetric(grid, "\u{1F534} \u5F85\u590D\u4E60", `${stats.dueToday}`, stats.dueToday > 0 ? "var(--text-error)" : "var(--color-green)");
    const summary = this.appendChild(card, "div", "");
    summary.style.cssText = "margin-top:12px;font-size:0.82em;color:var(--text-muted);text-align:center;";
    if (stats.dueToday > 0) {
      summary.textContent = `\u{1F4CC} \u6709 ${stats.dueToday} \u5F20\u5361\u7247\u5F85\u590D\u4E60\uFF0C\u5EFA\u8BAE\u524D\u5F80\u5361\u7EC4\u9875\u5F00\u59CB\u5B66\u4E60`;
    } else if (stats.new > 0) {
      summary.textContent = `\u{1F4CC} \u6709 ${stats.new} \u5F20\u65B0\u5361\u7247\u7B49\u5F85\u521D\u6B21\u5B66\u4E60`;
    } else {
      summary.textContent = "\u{1F4CC} \u4ECA\u65E5\u4EFB\u52A1\u5DF2\u5168\u90E8\u5B8C\u6210\uFF0C\u505A\u5F97\u5F88\u68D2\uFF01";
    }
  }
  // ─── 图表区（Q2: 我忘得怎么样？） ───
  async renderChartSection(decks) {
    const section = this.appendChild(this.container, "div", "");
    section.style.cssText = "margin-bottom:16px;";
    const tabRow = this.appendChild(section, "div", "");
    tabRow.style.cssText = "display:flex;gap:4px;margin-bottom:8px;";
    const tabs = [
      { key: "heatmap", label: "\u{1F525} \u70ED\u529B\u56FE" },
      { key: "line_day", label: "\u{1F4C8} \u65E5" },
      { key: "line_week", label: "\u{1F4C8} \u5468" },
      { key: "line_month", label: "\u{1F4C8} \u6708" }
    ];
    for (const tab of tabs) {
      const btn = this.appendChild(tabRow, "button", "");
      btn.textContent = tab.label;
      const isActive = this.statsMode === tab.key;
      btn.style.cssText = `
        padding:4px 12px;border-radius:14px;border:1px solid var(--background-modifier-border);
        background:${isActive ? "var(--interactive-accent)" : "var(--background-primary-alt)"};
        color:${isActive ? "var(--text-on-accent, white)" : "var(--text-normal)"};
        cursor:pointer;font-size:0.8em;transition:all 0.2s;
      `;
      btn.addEventListener("click", () => {
        this.statsMode = tab.key;
        this.render();
      });
    }
    const chartArea = this.appendChild(section, "div", "");
    chartArea.style.cssText = "padding:16px;border-radius:10px;border:1px solid var(--background-modifier-border);background:var(--background-primary);";
    if (this.statsMode === "heatmap") {
      const heatmap = new HeatmapWidget(chartArea, this.engine);
      await heatmap.render();
    } else {
      this.renderSimpleLineChart(chartArea, this.statsMode);
    }
    const insight = this.appendChild(section, "div", "");
    insight.style.cssText = "margin-top:6px;font-size:0.8em;color:var(--text-muted);padding:8px 12px;border-radius:8px;background:var(--background-primary-alt);";
    const totalDue = decks.reduce((s, d) => s + d.dueCount, 0);
    if (totalDue > 10) {
      insight.textContent = `\u{1F4CC} \u8FD1\u671F\u5F85\u590D\u4E60\u5361\u7247\u8F83\u591A (${totalDue}\u5F20)\uFF0C\u5EFA\u8BAE\u5236\u5B9A\u590D\u4E60\u8BA1\u5212\u907F\u514D\u5806\u79EF \u2192 [\u6253\u5F00\u8BA1\u5212]`;
      insight.addEventListener("click", () => this.callbacks.onOpenPlan());
      insight.style.cursor = "pointer";
    } else if (totalDue > 0) {
      insight.textContent = `\u{1F4CC} \u5C11\u91CF\u5F85\u590D\u4E60 (${totalDue}\u5F20)\uFF0C\u4FDD\u6301\u8282\u594F\u5373\u53EF \u{1F44D}`;
    } else {
      insight.textContent = `\u{1F4CC} \u5168\u90E8\u5361\u7247\u5DF2\u590D\u4E60\uFF0C\u505A\u5F97\u5F88\u68D2\uFF01\u7EE7\u7EED\u4FDD\u6301 \u{1F44F}`;
    }
  }
  renderSimpleLineChart(container, mode) {
    const lines = this.appendChild(container, "div", "");
    lines.style.cssText = "height:80px;display:flex;align-items:flex-end;gap:3px;padding:0 4px;";
    const count = mode === "line_day" ? 7 : mode === "line_week" ? 4 : 12;
    for (let i = 0; i < count; i++) {
      const h = 20 + Math.random() * 50;
      const bar = this.appendChild(lines, "div", "");
      bar.style.cssText = `flex:1;height:${h}px;border-radius:2px;background:var(--interactive-accent);opacity:${0.4 + i / count * 0.6};`;
    }
    const label = this.appendChild(container, "div", "");
    label.textContent = mode === "line_day" ? "\u8FD1 7 \u5929\u5B66\u4E60\u8D8B\u52BF" : mode === "line_week" ? "\u8FD1 4 \u5468\u8D8B\u52BF" : "\u8FD1 12 \u6708\u8D8B\u52BF";
    label.style.cssText = "text-align:center;font-size:0.78em;color:var(--text-faint);margin-top:8px;";
  }
  // ─── 最近卡组入口（Q3: 我该学什么？） ───
  renderRecentDecks(decks) {
    if (decks.length === 0) return;
    const section = this.appendChild(this.container, "div", "");
    section.style.cssText = "margin-bottom:16px;";
    const title = this.appendChild(section, "div", "");
    title.textContent = "\u{1F4C1} \u6700\u8FD1\u5361\u7EC4";
    title.style.cssText = "font-weight:500;font-size:0.9em;margin-bottom:8px;";
    const recent = decks.filter((d) => d.dueCount > 0).sort((a, b) => b.dueCount - a.dueCount).slice(0, 3);
    if (recent.length === 0) {
      const empty = this.appendChild(section, "div", "");
      empty.textContent = "\u2705 \u6240\u6709\u5361\u7EC4\u5DF2\u590D\u4E60\u5B8C\u6BD5";
      empty.style.cssText = "font-size:0.85em;color:var(--text-muted);padding:8px 4px;";
      return;
    }
    for (const d of recent) {
      const row = this.appendChild(section, "div", "");
      row.style.cssText = `
        display:flex;align-items:center;gap:10px;
        padding:8px 12px;border-radius:8px;
        border:1px solid var(--background-modifier-border);
        background:var(--background-primary);cursor:pointer;
        margin-bottom:4px;transition:all 0.2s;
      `;
      row.addEventListener("click", () => this.callbacks.onDeckClick(d.name));
      row.addEventListener("mouseenter", () => row.style.borderColor = "var(--interactive-accent)");
      const name = this.appendChild(row, "span", "");
      name.textContent = `\u{1F4C7} ${d.name}`;
      name.style.cssText = "flex:1;font-size:0.85em;";
      const barBg = this.appendChild(row, "div", "");
      barBg.style.cssText = "flex:0 0 60px;height:5px;border-radius:3px;background:var(--background-modifier-border);overflow:hidden;";
      const bar = this.appendChild(barBg, "div", "");
      bar.style.cssText = `height:100%;background:var(--interactive-accent);width:${d.mastery}%;`;
      const due = this.appendChild(row, "span", "");
      due.textContent = `\u{1F534} ${d.dueCount}`;
      due.style.cssText = "font-size:0.8em;color:var(--text-error);";
    }
  }
  // ─── 底部 ───
  renderFooter() {
    const footer = this.appendChild(this.container, "div", "");
    footer.style.cssText = "margin-top:16px;padding-top:10px;border-top:1px solid var(--background-modifier-border);font-size:0.78em;color:var(--text-faint);text-align:center;";
    footer.textContent = "\u{1F4CC} \u4E3B\u9875\u53EA\u5C55\u793A\u5B66\u4E60\u72B6\u6001\uFF0C\u5B66\u4E60\u8BF7\u4ECE\u300C\u5361\u7EC4\u9875\u300D\u8FDB\u5165";
  }
  // ─── 工具方法 ───
  addMetric(container, label, value, color) {
    const el2 = this.appendChild(container, "div", "");
    el2.style.cssText = "text-align:center;";
    const valEl = this.appendChild(el2, "div", "");
    valEl.textContent = value;
    valEl.style.cssText = `font-size:1.6em;font-weight:700;${color ? `color:${color};` : ""}`;
    const labelEl = this.appendChild(el2, "div", "");
    labelEl.textContent = label;
    labelEl.style.cssText = "font-size:0.78em;color:var(--text-muted);margin-top:2px;";
  }
  addSmallBtn(container, text, onClick) {
    const btn = this.appendChild(container, "button", "");
    btn.textContent = text;
    btn.style.cssText = "padding:4px 10px;border-radius:6px;border:1px solid var(--background-modifier-border);background:var(--background-primary-alt);cursor:pointer;font-size:0.78em;";
    btn.addEventListener("click", onClick);
  }
};

// ui/sessionView.ts
var SessionView = class extends UIComponent {
  deckName;
  mode;
  callbacks;
  sessionCount;
  // 自定义测试数量
  queue = [];
  currentIndex = 0;
  completed = 0;
  total = 0;
  revealed = false;
  // Test/Review 模式下是否显示了释义
  constructor(container, engine, deckName, mode, callbacks, sessionCount) {
    super(container, engine);
    this.deckName = deckName;
    this.mode = mode;
    this.callbacks = callbacks;
    this.sessionCount = sessionCount ?? 20;
    container.classList.add("remi-focus", "remi-session");
  }
  async render() {
    this.clear();
    await this.loadQueue();
    this.renderSessionFrame();
  }
  // ─── 加载队列 ───
  async loadQueue() {
    const raw = await this.engine.getQueue(this.mode, this.sessionCount);
    this.queue = raw.filter(([, entry]) => entry.deck.includes(this.deckName)).map(([word, entry]) => ({ word, entry }));
    this.total = this.queue.length;
    this.currentIndex = 0;
    this.completed = 0;
  }
  // ─── 主渲染 ───
  renderSessionFrame() {
    this.clear();
    if (this.queue.length === 0) {
      this.renderEmpty();
      return;
    }
    if (this.currentIndex >= this.queue.length) {
      this.renderComplete();
      return;
    }
    const current = this.queue[this.currentIndex];
    this.revealed = false;
    const modeLabels = {
      exposure: "\u{1F441} Exposure",
      test: "\u{1F9EA} Test",
      review: "\u{1F504} Review"
    };
    const header = this.appendChild(this.container, "div", "remi-session-header");
    header.innerHTML = `
      <span class="remi-session-header-title">${modeLabels[this.mode]}</span>
      <span class="remi-session-header-deck">\u{1F4C7} ${this.deckName}</span>
      <button class="remi-btn" style="font-size:0.8em;padding:4px 10px;">\u2715 \u9000\u51FA</button>
    `;
    header.querySelector("button").addEventListener("click", () => this.callbacks.onExit());
    const progressContainer = this.appendChild(this.container, "div", "remi-session-progress");
    const progress = this.total > 0 ? this.completed / this.total * 100 : 0;
    const bar = this.appendChild(progressContainer, "div", "remi-progress-bar");
    const fill = this.appendChild(bar, "div", `remi-progress-fill ${progress >= 60 ? "high" : progress >= 30 ? "medium" : "low"}`);
    fill.style.width = `${progress}%`;
    const progressText = this.appendChild(progressContainer, "div", "remi-session-progress-text");
    progressText.textContent = `${this.completed} / ${this.total} (${Math.round(progress)}%)`;
    const renderMd = (s) => {
      return s.replace(/==(.+?)==/g, "<mark>$1</mark>").replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\n/g, "<br>");
    };
    const stripEquals = (s) => renderMd(s);
    const wordEl = this.appendChild(this.container, "div", "remi-session-word");
    wordEl.innerHTML = renderMd(current.word);
    const cardArea = this.appendChild(this.container, "div", "remi-session-card-area");
    const clozeData = current.entry.cloze;
    const isCloze = clozeData && Array.isArray(clozeData) && clozeData.length > 0;
    if (isCloze) {
      this.renderClozeMode(current, stripEquals, clozeData, cardArea);
    } else {
      this.renderAnkiCard(current, stripEquals, cardArea);
    }
  }
  // ─── Cloze 挖空渲染 ───
  renderClozeMode(current, strip, segments, cardArea) {
    const container = this.appendChild(cardArea, "div", "");
    container.style.cssText = "margin:8px 0;";
    const mnemonic = current.entry.mnemonic;
    if (mnemonic) {
      const memoEl = this.appendChild(container, "div", "");
      memoEl.style.cssText = "font-size:0.85em;color:var(--remi-accent);margin-bottom:12px;padding:8px 12px;background:var(--remi-bg-secondary);border-radius:6px;";
      memoEl.innerHTML = `\u{1F4A1} <strong>${strip(mnemonic)}</strong>`;
    }
    const revealedFlags = new Array(segments.length).fill(false);
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const segEl = this.appendChild(container, "div", "");
      segEl.style.cssText = "margin-bottom:8px;padding:8px 12px;border-radius:6px;border:1px solid var(--remi-border);cursor:pointer;transition:all 0.15s;";
      const hintEl = this.appendChild(segEl, "div", "");
      hintEl.style.cssText = "font-size:0.85em;color:var(--remi-text-muted);margin-bottom:4px;";
      hintEl.textContent = "\u{1F4DD} " + strip(this.shorten(seg.hint, 80));
      const answerEl = this.appendChild(segEl, "div", "");
      answerEl.style.cssText = "font-size:1em;font-weight:600;min-height:1.5em;";
      if (this.mode === "exposure") {
        answerEl.textContent = strip(seg.answer);
      } else {
        answerEl.textContent = "______";
        answerEl.style.color = "var(--remi-text-muted)";
      }
      segEl.addEventListener("click", () => {
        if (this.mode === "exposure") return;
        if (!revealedFlags[i]) {
          revealedFlags[i] = true;
          answerEl.textContent = strip(seg.answer);
          answerEl.style.color = "var(--remi-text)";
          segEl.style.borderColor = "var(--remi-success)";
          segEl.style.background = "rgba(39,174,96,0.05)";
          if (revealedFlags.every((r) => r)) {
            setTimeout(() => {
              const existing = this.container.querySelector("#remi-feedback-area");
              if (!existing) this.renderFeedbackButtons(current);
            }, 300);
          }
        }
      });
    }
    if (this.mode !== "exposure") {
      const fc = this.appendChild(this.container, "div", "remi-feedback");
      fc.id = "remi-feedback-area";
      fc.style.marginTop = "16px";
    }
  }
  // ─── Anki 风格卡片 ───
  // 先看题（正面），点击后看答案（背面），然后评分
  renderAnkiCard(current, strip, cardArea) {
    const cardEl = this.appendChild(cardArea, "div", "remi-session-card");
    cardEl.innerHTML = `<div class="remi-session-hint">\u{1F446} \u70B9\u51FB\u663E\u793A\u7B54\u6848</div>`;
    cardEl.addEventListener("click", () => {
      if (this.revealed) return;
      this.revealed = true;
      cardEl.classList.add("revealed");
      cardEl.innerHTML = strip(current.entry.meaning);
      const fc = this.appendChild(this.container, "div", "remi-feedback");
      fc.id = "remi-feedback-area";
      this.renderFeedbackButtons(current);
    });
  }
  shorten(s, max) {
    return s.length > max ? s.slice(0, max) + "..." : s;
  }
  // ─── Exposure 模式按钮 ───
  renderExposureButtons(current) {
    const btnGroup = this.appendChild(this.container, "div", "remi-exposure-btns");
    const unknownBtn = this.appendChild(btnGroup, "button", "remi-exposure-btn unknown");
    unknownBtn.textContent = "\u2717 \u4E0D\u8BA4\u8BC6";
    unknownBtn.addEventListener(
      "click",
      () => this.handleResult(current, "again")
    );
    const knownBtn = this.appendChild(btnGroup, "button", "remi-exposure-btn known");
    knownBtn.textContent = "\u2713 \u8BA4\u8BC6";
    knownBtn.addEventListener(
      "click",
      () => this.handleResult(current, "good")
    );
  }
  // ─── Test/Review 反馈按钮 ───
  renderFeedbackButtons(current) {
    const feedbackArea = this.container.querySelector("#remi-feedback-area");
    if (!feedbackArea) return;
    feedbackArea.innerHTML = "";
    const buttons = [
      { result: "again", label: "\u{1F504} Again", desc: "\u5B8C\u5168\u5FD8\u4E86", className: "again" },
      { result: "hard", label: "\u{1F613} Hard", desc: "\u56DE\u5FC6\u56F0\u96BE", className: "hard" },
      { result: "good", label: "\u{1F44D} Good", desc: "\u6B63\u786E\u56DE\u5FC6", className: "good" },
      { result: "easy", label: "\u26A1 Easy", desc: "\u77AC\u95F4\u60F3\u8D77", className: "easy" }
    ];
    for (const btn of buttons) {
      const el2 = this.appendChild(feedbackArea, "button", `remi-feedback-btn ${btn.className}`);
      el2.innerHTML = `<span class="label">${btn.label}</span><span class="desc">${btn.desc}</span>`;
      el2.addEventListener("click", () => this.handleResult(current, btn.result));
    }
  }
  // ─── 处理结果 ───
  async handleResult(current, result) {
    try {
      await this.engine.processResult(current.word, this.mode, result);
    } catch (err) {
      console.error("RemiFocus: processResult error", err);
    }
    this.completed++;
    this.currentIndex++;
    setTimeout(() => this.renderSessionFrame(), 300);
  }
  // ─── 完成状态 ───
  renderComplete() {
    this.clear();
    const modeEmoji = {
      exposure: "\u{1F441}",
      test: "\u{1F9EA}",
      review: "\u{1F504}"
    };
    const completeEl = this.appendChild(this.container, "div", "remi-session-complete");
    completeEl.innerHTML = `
      <div style="font-size:3em;margin-bottom:12px;">\u{1F389}</div>
      <div style="font-size:1.3em;font-weight:700;margin-bottom:8px;">
        ${modeEmoji[this.mode]} ${this.deckName} \u5B66\u4E60\u5B8C\u6210\uFF01
      </div>
      <div style="color:var(--remi-text-muted);margin-bottom:20px;">
        \u672C\u6B21\u5B8C\u6210 ${this.total} \u4E2A\u5355\u8BCD
      </div>
      <div style="font-size:0.9em;color:var(--remi-text-muted);margin-bottom:24px;">
        ${this.mode === "exposure" ? "\u{1F4A1} \u5EFA\u8BAE\u8FDB\u5165 Test \u6A21\u5F0F\u8FDB\u884C\u8BB0\u5FC6\u6D4B\u8BD5" : this.mode === "test" ? "\u{1F4A1} \u7CFB\u7EDF\u5DF2\u8C03\u5EA6\u590D\u4E60\u8BA1\u5212\uFF0C\u8BB0\u5F97\u6309\u65F6\u56DE\u6765\u590D\u4E60" : "\u{1F4A1} \u590D\u4E60\u5B8C\u6210\uFF01\u770B\u770B\u5176\u4ED6\u5361\u7EC4\u662F\u5426\u9700\u8981\u590D\u4E60"}
      </div>
      <div class="remi-btn-group" style="justify-content:center;gap:12px;">
        <button class="remi-btn">\u2190 \u8FD4\u56DE</button>
        ${this.mode === "exposure" ? '<button class="remi-btn remi-btn-primary">\u{1F9EA} \u8FDB\u5165 Test \u6A21\u5F0F</button>' : ""}
      </div>
    `;
    completeEl.querySelector(".remi-btn").addEventListener(
      "click",
      () => this.callbacks.onComplete(this.deckName)
    );
    if (this.mode === "exposure") {
      const testBtn = completeEl.querySelector(".remi-btn-primary");
      testBtn.addEventListener("click", () => {
        this.mode = "test";
        this.render();
      });
    }
  }
  // ─── 空状态 ───
  renderEmpty() {
    this.clear();
    const modeLabels = {
      exposure: "\u521D\u5B66 (Exposure)",
      test: "\u6D4B\u8BD5 (Test)",
      review: "\u590D\u4E60 (Review)"
    };
    const empty = this.appendChild(this.container, "div", "remi-empty");
    empty.innerHTML = `
      <div class="remi-empty-icon">\u2705</div>
      <p>${this.deckName} \u5361\u7EC4\u6682\u65E0 ${modeLabels[this.mode]} \u4EFB\u52A1</p>
      <p style="font-size:0.85em;margin-top:4px;">\u5C1D\u8BD5\u5207\u6362\u5230\u5176\u4ED6\u5B66\u4E60\u6A21\u5F0F</p>
    `;
    const btnGroup = this.appendChild(this.container, "div", "remi-btn-group");
    btnGroup.style.justifyContent = "center";
    btnGroup.style.marginTop = "16px";
    const backBtn = this.appendChild(btnGroup, "button", "remi-btn");
    backBtn.textContent = "\u2190 \u8FD4\u56DE";
    backBtn.addEventListener("click", () => this.callbacks.onExit());
  }
};

// ui/sessionConfig.ts
var SessionConfigView = class extends UIComponent {
  deckName;
  mode;
  callbacks;
  mastery = { mastery: 0, ease: 250, interval: 0, successRate: 0 };
  deckTotal = 0;
  constructor(container, engine, deckName, mode, callbacks) {
    super(container, engine);
    this.deckName = deckName;
    this.mode = mode;
    this.callbacks = callbacks;
    container.classList.add("remi-focus", "remi-session-config");
  }
  async render() {
    this.clear();
    const deckInfo = await this.engine.getDeckInfo(this.deckName);
    this.deckTotal = deckInfo.totalCards;
    this.mastery = await this.engine.computeMastery(this.deckName);
    const modeLabels = {
      exposure: { icon: "\u{1F441}", label: "\u521D\u5B66 Exposure" },
      test: { icon: "\u{1F9EA}", label: "\u6D4B\u8BD5 Test" },
      review: { icon: "\u{1F504}", label: "\u590D\u4E60 Review" }
    };
    const ml = modeLabels[this.mode];
    const header = this.appendChild(this.container, "div", "remi-config-header");
    header.innerHTML = `
      <span style="font-size:1.1em;font-weight:700;">${ml.icon} ${ml.label}</span>
      <button class="remi-btn" style="font-size:0.85em;">\u2715 \u53D6\u6D88</button>
    `;
    header.querySelector("button").addEventListener("click", () => this.callbacks.onCancel());
    const deckRow = this.appendChild(this.container, "div", "remi-config-deck");
    deckRow.textContent = `\u{1F4C7} ${this.deckName}`;
    const masteryPanel = this.appendChild(this.container, "div", "remi-config-mastery");
    const masteryPct = this.mastery.mastery;
    const getMasteryColor = (pct) => {
      if (pct >= 80) return "var(--remi-success)";
      if (pct >= 50) return "var(--remi-warning)";
      return "var(--remi-danger)";
    };
    const mColor = getMasteryColor(masteryPct);
    masteryPanel.innerHTML = `
      <div class="remi-config-mastery-ring" style="--pct:${masteryPct};--color:${mColor};">
        <span class="remi-config-mastery-pct">${masteryPct}%</span>
      </div>
      <div class="remi-config-mastery-details">
        <div class="remi-config-mastery-title">\u{1F4CA} \u5361\u7EC4\u719F\u7EC3\u5EA6</div>
        <div class="remi-config-mastery-stats">
          <span>\u{1F0CF} \u5361\u7247\u603B\u6570: <strong>${this.deckTotal}</strong></span>
          <span>\u{1F4C8} \u8F7B\u677E\u5EA6: <strong>${this.mastery.ease}</strong></span>
          <span>\u23F1 \u5E73\u5747\u95F4\u9694: <strong>${this.mastery.interval} \u5929</strong></span>
          <span>\u{1F3AF} \u5386\u53F2\u6B63\u786E\u7387: <strong>${Math.round(this.mastery.successRate * 100)}%</strong></span>
        </div>
      </div>
    `;
    const configArea = this.appendChild(this.container, "div", "remi-config-count");
    const labelRow = this.appendChild(configArea, "div", "remi-config-count-label");
    labelRow.innerHTML = `
      <span>\u{1F522} \u672C\u6B21\u6D4B\u8BD5\u6570\u91CF</span>
      <span style="font-size:0.8em;color:var(--remi-text-muted);">
        \u53EF\u5927\u4E8E\u5361\u7247\u603B\u6570\uFF08\u8D85\u51FA\u90E8\u5206\u81EA\u52A8\u52A0\u6743\u62BD\u5361\uFF0C\u4E0D\u719F\u7EC3\u7684\u8BCD\u51FA\u73B0\u6982\u7387\u66F4\u9AD8\uFF09
      </span>
    `;
    const inputRow = this.appendChild(configArea, "div", "remi-config-count-input");
    const decBtn = this.appendChild(inputRow, "button", "remi-btn");
    decBtn.textContent = "\u2212";
    decBtn.style.cssText = "font-size:1.2em;font-weight:700;width:36px;height:36px;padding:0;display:flex;align-items:center;justify-content:center;";
    const input = this.appendChild(inputRow, "input", "remi-config-input");
    input.type = "number";
    input.min = "1";
    input.max = "999";
    input.value = String(Math.max(this.deckTotal, 20));
    input.style.cssText = `
      width:80px;text-align:center;font-size:1.3em;font-weight:700;
      border:2px solid var(--remi-border);border-radius:8px;
      padding:6px 12px;background:var(--remi-bg);color:var(--remi-text);
    `;
    const incBtn = this.appendChild(inputRow, "button", "remi-btn");
    incBtn.textContent = "+";
    incBtn.style.cssText = "font-size:1.2em;font-weight:700;width:36px;height:36px;padding:0;display:flex;align-items:center;justify-content:center;";
    const quickRow = this.appendChild(configArea, "div", "remi-config-quick");
    const quickValues = [10, 20, 40, this.deckTotal, this.deckTotal * 2];
    const uniqueQuick = [...new Set(quickValues.filter((v) => v > 0))].sort((a, b) => a - b);
    for (const qv of uniqueQuick) {
      const qBtn = this.appendChild(quickRow, "button", "remi-btn");
      qBtn.textContent = `${qv} \u8BCD`;
      qBtn.style.cssText = `font-size:0.85em;${qv === this.deckTotal ? "border-color:var(--remi-accent);" : ""}`;
      qBtn.addEventListener("click", () => {
        input.value = String(qv);
      });
    }
    if (this.deckTotal < 40) {
      const tip = this.appendChild(this.container, "div", "remi-config-tip");
      tip.innerHTML = `\u{1F4A1} <strong>\u52A0\u6743\u62BD\u5361\u63D0\u793A\uFF1A</strong>\u5F53\u6D4B\u8BD5\u6570\u91CF\u8D85\u8FC7 ${this.deckTotal} \u8BCD\u65F6\uFF0C\u7CFB\u7EDF\u4F1A\u4F18\u5148\u62BD\u53D6\u4E4B\u524D\u7B54\u9519\u7684\u8BCD\uFF0C\u5F3A\u5316\u8584\u5F31\u73AF\u8282\u3002`;
    }
    const updateValue = (delta) => {
      let v = parseInt(input.value) || this.deckTotal;
      v = Math.max(1, Math.min(999, v + delta));
      input.value = String(v);
    };
    decBtn.addEventListener("click", () => updateValue(-5));
    incBtn.addEventListener("click", () => updateValue(5));
    const startBtnRow = this.appendChild(this.container, "div", "remi-config-start");
    const startBtn = this.appendChild(startBtnRow, "button", "remi-btn remi-btn-primary");
    startBtn.style.cssText = `
      padding:14px 48px;border:none;border-radius:10px;cursor:pointer;
      background:var(--remi-accent);color:#fff;font-size:1.1em;font-weight:700;
      transition:all 0.15s;
    `;
    startBtn.textContent = `\u{1F680} \u5F00\u59CB\u5B66\u4E60 (${input.value} \u8BCD)`;
    const updateStartBtn = () => {
      const v = parseInt(input.value) || this.deckTotal;
      const extra = v > this.deckTotal ? `\uFF08\u542B ${v - this.deckTotal} \u6B21\u52A0\u6743\u590D\u62BD\uFF09` : "";
      startBtn.textContent = `\u{1F680} \u5F00\u59CB\u5B66\u4E60 ${v} \u8BCD${extra}`;
    };
    input.addEventListener("input", updateStartBtn);
    input.addEventListener("change", updateStartBtn);
    startBtn.addEventListener("click", () => {
      const count = Math.max(1, parseInt(input.value) || this.deckTotal);
      this.callbacks.onStart(count);
    });
  }
};

// ui/quickView.ts
var QuickView = class extends UIComponent {
  callbacks;
  constructor(container, engine, callbacks) {
    super(container, engine);
    this.callbacks = callbacks;
    container.classList.add("remi-focus");
  }
  async render() {
    this.clear();
    const stats = await this.engine.getStats();
    const decks = await this.engine.getAllDeckInfos();
    this.renderTitle();
    this.renderTodayOverview(stats);
    this.renderQuickActions();
    this.renderFolderSummary(decks);
  }
  renderTitle() {
    const h = this.appendChild(this.container, "div", "remi-popup-header");
    h.style.padding = "8px 0";
    h.style.marginBottom = "8px";
    const t = this.appendChild(h, "div", "remi-popup-title");
    t.style.fontSize = "1em";
    t.textContent = "\u{1F9E0} RemiFocus";
  }
  renderTodayOverview(stats) {
    const card = this.appendChild(this.container, "div", "remi-card");
    card.style.cursor = "default";
    const h = this.appendChild(card, "div", "");
    h.style.cssText = "font-weight:600;font-size:0.9em;margin-bottom:8px;";
    h.textContent = "\u{1F4CA} \u4ECA\u65E5\u6982\u89C8";
    const progress = stats.total > 0 ? Math.round(stats.review / stats.total * 100) : 0;
    const bar = this.appendChild(card, "div", "remi-progress-bar");
    const fill = this.appendChild(bar, "div", "remi-progress-fill medium");
    fill.style.width = `${progress}%`;
    const text = this.appendChild(card, "div", "");
    text.style.cssText = "font-size:0.85em;margin-top:4px;color:var(--remi-text-muted);";
    text.innerHTML = `
      \u5F85\u590D\u4E60 <strong>${stats.dueToday}</strong> \u8BCD
      &nbsp;|&nbsp; \u65B0\u8BCD <strong>${stats.new}</strong>
      &nbsp;|&nbsp; \u603B\u8BA1 <strong>${stats.total}</strong>
    `;
  }
  renderQuickActions() {
    const btnGroup = this.appendChild(this.container, "div", "remi-btn-group");
    btnGroup.style.marginTop = "8px";
    btnGroup.style.gap = "4px";
    const modeBtn = this.appendChild(btnGroup, "button", "remi-btn");
    modeBtn.textContent = "\u{1F916} AI \u5236\u5361";
    modeBtn.style.width = "100%";
    modeBtn.style.fontSize = "0.9em";
    modeBtn.style.fontWeight = "600";
    modeBtn.style.padding = "8px";
    modeBtn.style.background = "linear-gradient(135deg, #6c5ce7, #a29bfe)";
    modeBtn.style.color = "#fff";
    modeBtn.style.border = "none";
    modeBtn.style.borderRadius = "8px";
    modeBtn.style.marginBottom = "4px";
    modeBtn.addEventListener("click", () => this.callbacks.onOpenModeSelector());
    const row = this.appendChild(btnGroup, "div", "");
    row.style.cssText = "display:flex;gap:4px;width:100%;flex-wrap:wrap;";
    this.addJumpBtn(row, "\u{1F4C7} \u5361\u7EC4", "var(--interactive-accent)", () => this.callbacks.onOpenDashboard());
    this.addJumpBtn(row, "\u{1F3E0} \u4E3B\u9875", "var(--background-modifier-border)", () => this.callbacks.onOpenDashboard());
    this.addJumpBtn(row, "\u{1F4C5} \u8BA1\u5212", "var(--background-modifier-border)", () => this.callbacks.onOpenDashboard());
    this.addJumpBtn(row, "\u2699\uFE0F \u8BBE\u7F6E", "var(--background-modifier-border)", () => this.callbacks.onOpenDashboard());
  }
  addJumpBtn(container, text, borderColor, onClick) {
    const btn = this.appendChild(container, "button", "remi-btn");
    btn.textContent = text;
    btn.style.cssText = `flex:1;font-size:0.82em;border:1px solid ${borderColor};`;
    btn.addEventListener("click", onClick);
  }
  renderFolderSummary(decks) {
    if (decks.length === 0) return;
    const card = this.appendChild(this.container, "div", "remi-card");
    card.style.cursor = "default";
    card.style.marginTop = "8px";
    const h = this.appendChild(card, "div", "");
    h.style.cssText = "font-weight:600;font-size:0.9em;margin-bottom:8px;";
    h.textContent = "\u{1F4C1} \u6587\u4EF6\u5939\u901F\u89C8";
    const folderMap = /* @__PURE__ */ new Map();
    for (const d of decks) {
      const f = d.name.split("/")[0] || d.name;
      const prev = folderMap.get(f) ?? { cards: 0, mastery: 0 };
      prev.cards += d.totalCards;
      prev.mastery += d.mastery * d.totalCards;
      folderMap.set(f, prev);
    }
    for (const [folder, data] of folderMap) {
      const avgMastery = data.cards > 0 ? Math.round(data.mastery / data.cards) : 0;
      const row = this.appendChild(card, "div", "remi-plan-row");
      row.style.padding = "4px 0";
      row.innerHTML = `
        <span style="font-size:0.85em">\u{1F4C2} ${folder}</span>
        <span style="font-size:0.85em;font-weight:600">${data.cards}\u8BCD</span>
      `;
    }
  }
};

// resolver/cardExtractor.ts
var CardExtractor = class {
  extract(content, filePath, extractTables = false) {
    const lines = content.split("\n");
    const allCards = [];
    const groupMap = /* @__PURE__ */ new Map();
    const bigCards = this.extractBigCards(lines, filePath);
    for (const card of bigCards) {
      allCards.push(card);
      this.ensureGroup(groupMap, card.group, 3, card);
    }
    const bigCardLines = /* @__PURE__ */ new Set();
    for (const card of bigCards) {
      for (let l = card.line; l < card.line + 30; l++) bigCardLines.add(l);
    }
    const smallCards = this.extractSmallCards(lines, filePath, bigCardLines);
    for (const card of smallCards) {
      allCards.push(card);
      this.ensureGroup(groupMap, card.group, 2, card);
    }
    if (extractTables) {
      const tableCards = this.extractTableCards(lines, filePath);
      for (const card of tableCards) {
        allCards.push(card);
        this.ensureGroup(groupMap, card.group, 1, card);
      }
    }
    const byType = { "big-cloze": 0, "small-vocab": 0, "table": 0 };
    for (const c of allCards) byType[c.cardType]++;
    return {
      cards: allCards,
      groups: Array.from(groupMap.values()),
      stats: {
        totalCards: allCards.length,
        groupsCount: groupMap.size,
        byType,
        byGroup: Object.fromEntries(allCards.map((c) => [c.group, allCards.filter((x) => x.group === c.group).length]))
      }
    };
  }
  // ════════════════════════════════════════
  //  Pass 1: 大卡片（西综 Cloze 模式）
  // ════════════════════════════════════════
  extractBigCards(lines, filePath) {
    const cards = [];
    let current = null;
    let cardLines = [];
    for (let i = 0; i < lines.length; i++) {
      const t = lines[i].trim();
      if (i === 0 && t === "---") {
        i = this.skipFm(lines, i);
        continue;
      }
      if (!t || t.startsWith("```")) continue;
      const hm = t.match(/^(#{1,6})\s+(.+)$/);
      if (hm) {
        this.finalizeBigCard(current, cardLines, cards);
        cardLines = [];
        const text = hm[2].trim();
        if (this.isBigCardHeading(lines, i, text)) {
          current = {
            word: text,
            meaning: "",
            group: text,
            line: i,
            format: "big-cloze",
            sourceFile: filePath,
            cardType: "big-cloze",
            cloze: [],
            mnemonic: ""
          };
        } else {
          current = null;
        }
        continue;
      }
      if (!current) continue;
      cardLines.push(t);
      const arrowMatch = t.match(/→\s*(.+)$/);
      if (arrowMatch) {
        const after = arrowMatch[1].trim();
        current.cloze.push({
          hint: after.length > 60 ? after.slice(0, 60) + "\u2026" : after,
          answer: after
        });
      }
      const remMatch = t.match(/【记住啥】[`'"]?\s*(.+?)\s*[`'"]?$/);
      if (remMatch) current.mnemonic = remMatch[1].trim();
    }
    this.finalizeBigCard(current, cardLines, cards);
    return cards;
  }
  /** 检测标题下是否是"大卡片模式" */
  isBigCardHeading(lines, idx, headingText) {
    if (/[【\[]看到啥[】\]]/.test(headingText)) return true;
    const lookAhead = 5;
    for (let i = idx + 1; i <= idx + lookAhead && i < lines.length; i++) {
      const t = lines[i].trim();
      if (/【想到啥】/.test(t) || /【记住啥】/.test(t)) return true;
      if (/^#{1,6}\s/.test(t)) break;
    }
    return false;
  }
  finalizeBigCard(card, cardLines, cards) {
    if (card && card.word) {
      card.meaning = cardLines.join("\n");
      if (!card.cloze || card.cloze.length === 0) {
        card.cloze = [{ hint: card.meaning.slice(0, 60), answer: card.meaning }];
      }
      cards.push(card);
    }
  }
  // ════════════════════════════════════════
  //  Pass 2: 小卡片（列表项模式）
  // ════════════════════════════════════════
  extractSmallCards(lines, filePath, skipLines) {
    const cards = [];
    let currentGroup = "default";
    let currentLevel = 0;
    for (let i = 0; i < lines.length; i++) {
      const t = lines[i].trim();
      if (i === 0 && t === "---") {
        i = this.skipFm(lines, i);
        continue;
      }
      if (!t || t.startsWith("```")) continue;
      if (skipLines.has(i)) continue;
      const headingMatch = t.match(/^(#{2,3})\s+(.+)$/);
      if (headingMatch) {
        currentLevel = headingMatch[1].length;
        currentGroup = headingMatch[2].replace(/#\S+/g, "").trim() || "default";
        continue;
      }
      const card = this.matchSmallCard(t, currentGroup, i, filePath);
      if (card) cards.push(card);
    }
    return cards;
  }
  matchSmallCard(text, group, line, filePath) {
    const listMatch = text.match(/^\s*[-*]\s+(.+)$/);
    if (!listMatch) return null;
    const content = listMatch[1].trim();
    const patterns = [
      { format: "highlight-colon", regex: /^==(.+?)==\s*[:：]\s*(.+)$/ },
      { format: "highlight-dash", regex: /^==(.+?)==\s*[-–—]\s*(.+)$/ },
      { format: "bold-colon", regex: /^\*\*(.+?)\*\*\s*[:：]\s*(.+)$/ },
      { format: "dash", regex: /^(.+?)\s+[-–—]\s+(.+)$/ },
      { format: "colon", regex: /^(.+?)\s*[:：]\s+(.+)$/ },
      { format: "parens", regex: /^\((.+?)\)\s*[:：]?\s*(.+)$/ },
      { format: "highlight-alone", regex: /^==(.+?)==$/ }
    ];
    for (const { format, regex } of patterns) {
      const m = content.match(regex);
      if (m) {
        return {
          word: this.clean(m[1]),
          meaning: m[2] ? this.clean(m[2]) : "",
          group,
          line,
          format,
          sourceFile: filePath,
          cardType: "small-vocab"
        };
      }
    }
    return null;
  }
  // ════════════════════════════════════════
  //  Pass 3: 表格卡片
  // ════════════════════════════════════════
  extractTableCards(lines, filePath) {
    const cards = [];
    let inTable = false;
    let headers = [];
    let tableStartLine = -1;
    let currentGroup = "default";
    for (let i = 0; i < lines.length; i++) {
      const t = lines[i].trim();
      const hm = t.match(/^(#{1,3})\s+(.+)$/);
      if (hm) {
        currentGroup = hm[2].replace(/#\S+/g, "").trim() || "default";
      }
      if (t.startsWith("|") && t.endsWith("|")) {
        const cells = t.split("|").filter((c) => c.trim()).map((c) => c.trim());
        if (!inTable) {
          if (cells.length >= 2 && !/[-]+/.test(cells[0])) {
            inTable = true;
            headers = cells;
            tableStartLine = i;
          }
        } else if (i === tableStartLine + 1) {
          continue;
        } else {
          const word = this.clean(cells[0]);
          const meaning = cells.slice(1).map((c, j) => `${headers[j + 1] || ""}:${this.clean(c)}`).join(" | ");
          if (word) {
            cards.push({
              word,
              meaning,
              group: currentGroup,
              line: i,
              format: "table-row",
              sourceFile: filePath,
              cardType: "table"
            });
          }
        }
      } else {
        inTable = false;
      }
    }
    return cards;
  }
  // ════════════════════════════════════════
  //  工具方法
  // ════════════════════════════════════════
  skipFm(lines, start) {
    for (let i = start + 1; i < lines.length; i++) {
      if (lines[i].trim() === "---") return i;
    }
    return start;
  }
  clean(text) {
    return text.replace(/^==|==$/g, "").replace(/^\*\*|\*\*$/g, "").replace(/\[\[|\]\]/g, "").replace(/^`|`$/g, "").replace(/\*\*/g, "").trim();
  }
  ensureGroup(m, name, level, card) {
    if (!m.has(name)) m.set(name, { name, level, cards: [] });
    m.get(name).cards.push(card);
  }
};

// ui/cardMaker.ts
var import_obsidian = require("obsidian");
function autoSplit(text) {
  const cleaned = text.replace(/^[-*]\s+/, "").trim();
  const m1 = cleaned.match(/^==(.+?)==\s*[:：]\s*`\[([^\]]+)\]`\s*(.+)$/);
  if (m1) return { word: m1[1].trim(), meaning: `[${m1[2]}] ${m1[3].trim()}` };
  const m2 = cleaned.match(/^==(.+?)==\s*[:：]\s*(.+)$/);
  if (m2) return { word: m2[1].trim(), meaning: m2[2].trim() };
  const m3 = cleaned.match(/^\*\*(.+?)\*\*\s*[:：]\s*(.+)$/);
  if (m3) return { word: m3[1].trim(), meaning: m3[2].trim() };
  const m4 = cleaned.match(/^(.+?)\s*[:：]\s*(.+)$/);
  if (m4) return { word: m4[1].trim(), meaning: m4[2].trim() };
  const m5 = cleaned.match(/^(.+?)\s+[-–—]\s+(.+)$/);
  if (m5) return { word: m5[1].trim(), meaning: m5[2].trim() };
  return { word: cleaned, meaning: "" };
}
var FloatingToolbar = class {
  el;
  expandedEl;
  collapsedEl;
  selections = [];
  selecting = false;
  cards = [];
  currentDeck = "default";
  decks = [];
  callbacks;
  visible = false;
  expanded = false;
  dragging = false;
  constructor(callbacks) {
    this.callbacks = callbacks;
    this.el = document.createElement("div");
    this.el.onmousedown = (e) => {
      if (e.target.closest("button, select, input, textarea, .rf-icon")) return;
      this.dragging = true;
      const rect = this.el.getBoundingClientRect();
      const offsetX = e.clientX - rect.left;
      const offsetY = e.clientY - rect.top;
      this.el.style.right = "auto";
      this.el.style.left = rect.left + "px";
      this.el.style.top = rect.top + "px";
      this.el.style.transition = "none";
      const onMove = (ev) => {
        if (!this.dragging) return;
        this.el.style.left = ev.clientX - offsetX + "px";
        this.el.style.top = ev.clientY - offsetY + "px";
      };
      const onUp = () => {
        this.dragging = false;
        document.removeEventListener("mousemove", onMove);
        const r = this.el.getBoundingClientRect();
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const snapEdge = 60;
        const distLeft = r.left;
        const distRight = vw - r.right;
        const distTop = r.top;
        const distBot = vh - r.bottom;
        const min = Math.min(distLeft, distRight, distTop, distBot);
        if (min === distLeft && distLeft < snapEdge) {
          this.el.style.left = "0px";
        } else if (min === distRight && distRight < snapEdge) {
          this.el.style.left = vw - this.el.offsetWidth + "px";
        } else if (min === distTop && distTop < snapEdge / 2) {
          this.el.style.top = "0px";
        } else if (min === distBot && distBot < snapEdge / 2) {
          this.el.style.top = vh - this.el.offsetHeight + "px";
        }
        if (r.top < 0) this.el.style.top = "0px";
        this.el.style.transition = "left 0.15s ease, top 0.15s ease";
      };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp, { once: true });
    };
    this.el.className = "rf-toolbar";
    this.el.style.cssText = `
      position:fixed;top:80px;right:16px;z-index:9999;
      background:var(--background-primary);
      border:1px solid var(--background-modifier-border);
      border-right:none;border-radius:10px 0 0 10px;
      box-shadow:-2px 2px 12px rgba(0,0,0,0.1);
      overflow:hidden;display:none;font-size:0.85em;
      transition:width 0.2s ease;
    `;
    this.collapsedEl = document.createElement("div");
    this.collapsedEl.style.cssText = "display:flex;flex-direction:column;align-items:center;gap:6px;padding:8px 0;width:40px;cursor:pointer;";
    this.collapsedEl.innerHTML = `
      <div class="rf-icon" style="font-size:1.3em;padding:4px;border-radius:6px;transition:background 0.15s;" title="\u5C55\u5F00\u5236\u5361\u5668">\u{1F9E0}</div>
    `;
    this.collapsedEl.onmouseenter = () => this.expand();
    this.el.appendChild(this.collapsedEl);
    this.expandedEl = document.createElement("div");
    this.expandedEl.style.cssText = "display:none;width:240px;padding:10px 12px;";
    this.expandedEl.onmouseleave = () => this.collapse();
    this.el.appendChild(this.expandedEl);
    document.body.appendChild(this.el);
  }
  async show() {
    this.visible = true;
    this.el.style.display = "block";
    this.decks = await this.callbacks.getExistingDecks();
    if (this.decks.length > 0 && !this.decks.includes(this.currentDeck)) this.currentDeck = this.decks[0];
    this.renderExpanded();
  }
  hide() {
    this.visible = false;
    this.el.style.display = "none";
    this.exitSelectionMode();
  }
  toggle() {
    this.visible ? this.hide() : this.show();
  }
  isVisible() {
    return this.visible;
  }
  destroy() {
    this.exitSelectionMode();
    this.el.remove();
  }
  expand() {
    this.expanded = true;
    this.el.style.width = "240px";
    this.collapsedEl.style.display = "none";
    this.expandedEl.style.display = "block";
    this.renderExpanded();
  }
  collapse() {
    this.expanded = false;
    this.el.style.width = "40px";
    this.collapsedEl.style.display = "flex";
    this.expandedEl.style.display = "none";
  }
  renderExpanded() {
    this.expandedEl.innerHTML = "";
    const header = el("div", "display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;");
    header.innerHTML = `<span style="font-weight:700;font-size:0.9em;">\u{1F9E0} \u5236\u5361\u5668</span>
      <span style="font-size:0.85em;cursor:pointer;opacity:0.5;" id="rf-collapse-btn">\u25C0</span>`;
    header.querySelector("#rf-collapse-btn").onclick = () => this.collapse();
    this.expandedEl.appendChild(header);
    if (this.selecting) {
      const info = el("div", "font-size:0.82em;color:var(--text-muted);margin-bottom:6px;padding:6px 8px;background:var(--background-secondary);border-radius:6px;");
      info.textContent = `\u2702 \u5DF2\u9009 ${this.selections.length} \u6BB5`;
      this.expandedEl.appendChild(info);
      const btnRow = el("div", "display:flex;gap:4px;");
      const doneBtn = mkBtn("\u2705 \u5B8C\u6210", "flex:1;padding:6px;", () => {
        this.exitSelectionMode();
        this.openBatchDialog();
      });
      btnRow.appendChild(doneBtn);
      const cancelBtn = mkBtn("\u2715 \u53D6\u6D88", "flex:1;padding:6px;", () => this.exitSelectionMode());
      btnRow.appendChild(cancelBtn);
      this.expandedEl.appendChild(btnRow);
      return;
    }
    const tools = el("div", "display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px;margin-bottom:8px;");
    const btns = [
      { icon: "\u{1F58A}", label: "\u5236\u5361", hint: "\u70B9\u51FB\u8FDB\u5165\u9009\u62E9\u6A21\u5F0F", action: () => this.enterSelectionMode() },
      { icon: "\u2702", label: "\u6316\u7A7A", hint: "\u9009\u4E2D\u6587\u672C\u2192\u6316\u7A7A", action: () => this.quickCloze() },
      { icon: "\u{1F50D}", label: "\u9884\u89C8", hint: "\u9884\u89C8\u5DF2\u521B\u5EFA\u7684\u5361\u7247", action: () => {
        if (this.cards.length > 0) this.showPreview();
      } }
    ];
    for (const b of btns) {
      const btn = el("div", "display:flex;flex-direction:column;align-items:center;justify-content:center;padding:6px 4px;border-radius:6px;cursor:pointer;transition:background 0.15s;font-size:0.7em;");
      btn.title = b.hint;
      btn.innerHTML = `<span style="font-size:1.3em">${b.icon}</span><span>${b.label}</span>`;
      btn.onmouseenter = () => btn.style.background = "var(--background-modifier-hover)";
      btn.onmouseleave = () => btn.style.background = "transparent";
      btn.onclick = b.action;
      tools.appendChild(btn);
    }
    this.expandedEl.appendChild(tools);
    const deckRow = el("div", "display:flex;gap:4px;align-items:center;margin-bottom:6px;");
    const select = document.createElement("select");
    select.style.cssText = "flex:1;padding:4px 6px;border:1px solid var(--background-modifier-border);border-radius:4px;font-size:0.8em;background:var(--background-primary);color:var(--text-normal);";
    for (const d of this.decks) {
      const opt = document.createElement("option");
      opt.value = d;
      opt.textContent = d.split("/").pop() || d;
      if (d === this.currentDeck) opt.selected = true;
      select.appendChild(opt);
    }
    select.onchange = () => {
      this.currentDeck = select.value;
    };
    deckRow.appendChild(select);
    const newBtn = document.createElement("button");
    newBtn.textContent = "+";
    newBtn.style.cssText = "padding:4px 8px;border:1px solid var(--background-modifier-border);border-radius:4px;cursor:pointer;font-size:0.8em;background:var(--background-primary);";
    newBtn.onclick = () => {
      const name = prompt("\u65B0\u5361\u7EC4\u540D:");
      if (name && !this.decks.includes(name)) {
        this.decks.push(name);
        const opt = document.createElement("option");
        opt.value = name;
        opt.textContent = name;
        select.appendChild(opt);
        select.value = name;
        this.currentDeck = name;
      }
    };
    deckRow.appendChild(newBtn);
    this.expandedEl.appendChild(deckRow);
    if (this.selections.length > 0) {
      const info = el("div", "font-size:0.78em;color:var(--text-muted);margin-bottom:4px;");
      info.textContent = `\u{1F4CB} \u5DF2\u9009 ${this.selections.length} \u6BB5\u6587\u672C`;
      this.expandedEl.appendChild(info);
    }
    if (this.cards.length > 0) {
      const list = el("div", "max-height:120px;overflow-y:auto;margin-bottom:6px;border:1px solid var(--background-modifier-border);border-radius:6px;padding:4px;");
      for (const card of this.cards) {
        const row = el("div", "display:flex;align-items:center;gap:4px;padding:3px 6px;font-size:0.78em;border-radius:4px;");
        row.innerHTML = `<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(card.word)}</span>
          <span style="font-size:0.75em;color:var(--text-muted);">${card.cloze ? "\u{1F4CB}" : "\u{1F4C7}"}</span>`;
        list.appendChild(row);
      }
      this.expandedEl.appendChild(list);
      const saveBtn = document.createElement("button");
      saveBtn.textContent = `\u{1F4BE} \u4FDD\u5B58 ${this.cards.length} \u5F20`;
      saveBtn.style.cssText = "width:100%;padding:7px;border:none;border-radius:6px;background:var(--interactive-accent);color:#fff;font-weight:600;cursor:pointer;font-size:0.82em;";
      saveBtn.onclick = async () => {
        const filePath = this.callbacks.getActiveFilePath() || "unknown";
        await this.callbacks.onSave(this.cards, this.currentDeck, filePath);
        this.cards = [];
        this.renderExpanded();
      };
      this.expandedEl.appendChild(saveBtn);
    }
  }
  // ─── 选择模式 ───
  enterSelectionMode() {
    this.selecting = true;
    this.selections = [];
    this.renderExpanded();
    const handler = () => {
      if (!this.selecting) return;
      const sel = window.getSelection();
      const text = sel ? sel.toString().trim() : "";
      if (text && !this.selections.includes(text)) {
        this.selections.push(text);
        this.renderExpanded();
      }
    };
    document.addEventListener("mouseup", handler);
    const cleanup = () => document.removeEventListener("mouseup", handler);
    window.__rf_select_cleanup = cleanup;
    new import_obsidian.Notice("\u{1F58A} \u9009\u62E9\u6A21\u5F0F: \u70B9\u51FB\u6587\u672C\u9009\u62E9\uFF0C\u5B8C\u6210\u540E\u70B9\u51FB \u2705 \u5B8C\u6210");
  }
  exitSelectionMode() {
    this.selecting = false;
    if (window.__rf_select_cleanup) {
      window.__rf_select_cleanup();
      delete window.__rf_select_cleanup;
    }
    this.renderExpanded();
  }
  quickCloze() {
    const sel = window.getSelection()?.toString().trim();
    if (!sel) return;
    const { word, meaning } = autoSplit(sel);
    this.cards.push({ word, meaning, cloze: [{ hint: "\u70B9\u51FB\u63ED\u793A", answer: meaning }], priority: 1, source: "manual" });
    this.renderExpanded();
  }
  // ─── 批量弹窗 ───
  openBatchDialog() {
    if (this.selections.length === 0) return;
    const allLines = [];
    for (const sel of this.selections) {
      const lines = sel.split("\n").map((l) => l.trim()).filter((l) => l && /^[-*]/.test(l));
      allLines.push(...lines.length > 0 ? lines : [sel]);
    }
    this.cards = allLines.map((s) => {
      const { word, meaning } = autoSplit(s);
      return { word, meaning, priority: 1, source: "manual" };
    });
    this.showBatchModal();
  }
  showBatchModal() {
    const overlay = modalOverlay();
    const modal = modalBox("660px", overlay);
    let deckPerCard = this.cards.map(() => this.currentDeck);
    let html = `<div style="font-weight:700;font-size:1em;margin-bottom:12px;">\u{1F9E0} \u6279\u91CF\u5236\u5361</div>`;
    html += `<textarea id="rf-paste-area" rows="3" placeholder="\u{1F4CB} \u7C98\u8D34\u6587\u672C\u5230\u8FD9\u91CC\uFF0C\u81EA\u52A8\u8BC6\u522B\u4E3A\u5361\u7247
\u6216\u70B9\u51FB [\u4ECE\u7B14\u8BB0\u9009\u62E9] \u6309\u94AE" style="width:100%;padding:8px 10px;border:1px solid var(--background-modifier-border);border-radius:8px;margin-bottom:10px;font-size:0.85em;resize:vertical;box-sizing:border-box;background:var(--background-primary);color:var(--text-normal);font-family:inherit;"></textarea>`;
    html += `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;padding:6px 10px;background:var(--background-secondary);border-radius:6px;font-size:0.82em;">
      <span>\u{1F50D} \u68C0\u6D4B\u5230 <strong id="rf-card-count">${this.cards.length}</strong> \u5F20\u5361\u7247</span>
      <div style="display:flex;gap:6px;">
        <button id="rf-auto-cloze" style="padding:3px 10px;border:1px solid var(--background-modifier-border);border-radius:4px;cursor:pointer;font-size:0.8em;background:var(--background-primary);">\u2702 \u5168\u90E8\u6316\u7A7A</button>
        <button id="rf-reparse-btn" style="padding:3px 10px;border:1px solid var(--background-modifier-border);border-radius:4px;cursor:pointer;font-size:0.8em;background:var(--background-primary);">\u{1F504} \u91CD\u65B0\u8BC6\u522B</button>
      </div>
    </div>`;
    html += `<div id="rf-card-list" style="max-height:45vh;overflow-y:auto;margin-bottom:10px;">`;
    for (let i = 0; i < this.cards.length; i++) {
      const c = this.cards[i];
      html += `
        <div class="rf-card-item" data-idx="${i}" style="padding:8px 10px;margin-bottom:4px;border:1px solid var(--background-modifier-border);border-radius:8px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
            <span style="font-weight:600;font-size:0.8em;color:var(--text-muted);">#${i + 1}</span>
            <div style="display:flex;gap:4px;align-items:center;">
              <select class="rf-card-deck" data-idx="${i}" style="padding:2px 4px;border:1px solid var(--background-modifier-border);border-radius:4px;font-size:0.75em;background:var(--background-primary);color:var(--text-normal);">
                ${this.decks.map((d) => `<option value="${d}" ${d === (deckPerCard[i] || this.currentDeck) ? "selected" : ""}>${d.split("/").pop()}</option>`).join("")}
              </select>
              <span class="rf-cloze-single" style="font-size:0.7em;cursor:pointer;color:var(--text-accent);padding:2px 6px;border-radius:4px;border:1px solid var(--background-modifier-border);">\u2702\u6316\u7A7A</span>
              <span class="rf-del-single" style="font-size:0.7em;cursor:pointer;color:var(--text-error);padding:2px 4px;">\u{1F5D1}</span>
            </div>
          </div>
          <div style="display:flex;gap:6px;margin-bottom:4px;">
            <input class="rf-w-${i}" value="${esc(c.word)}" placeholder="\u5355\u8BCD" style="flex:1;padding:4px 8px;border:1px solid var(--background-modifier-border);border-radius:4px;font-size:0.88em;font-weight:600;background:var(--background-primary);color:var(--text-normal);">
          </div>
          <textarea class="rf-m-${i}" rows="2" placeholder="\u91CA\u4E49" style="width:100%;padding:4px 8px;border:1px solid var(--background-modifier-border);border-radius:4px;font-size:0.82em;box-sizing:border-box;resize:vertical;background:var(--background-primary);color:var(--text-normal);font-family:inherit;">${esc(c.meaning)}</textarea>
        </div>`;
    }
    html += `</div>`;
    html += `<div style="display:flex;gap:6px;margin-bottom:10px;">
      <input id="rf-new-word" placeholder="\u65B0\u5355\u8BCD..." style="flex:1;padding:5px 8px;border:1px solid var(--background-modifier-border);border-radius:4px;font-size:0.82em;background:var(--background-primary);color:var(--text-normal);">
      <input id="rf-new-meaning" placeholder="\u65B0\u91CA\u4E49..." style="flex:2;padding:5px 8px;border:1px solid var(--background-modifier-border);border-radius:4px;font-size:0.82em;background:var(--background-primary);color:var(--text-normal);">
      <button id="rf-add-card" style="padding:5px 12px;border:1px solid var(--background-modifier-border);border-radius:4px;cursor:pointer;font-size:0.82em;background:var(--background-primary);">\u2795 \u6DFB\u52A0</button>
    </div>`;
    html += `<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;border-top:1px solid var(--background-modifier-border);padding-top:10px;">
      <span style="font-size:0.82em;color:var(--text-muted);">\u{1F4E6} \u6279\u91CF\u5B58\u5165:</span>
      <select id="rf-batch-deck-all" style="flex:1;min-width:100px;padding:5px 8px;border:1px solid var(--background-modifier-border);border-radius:6px;font-size:0.82em;background:var(--background-primary);color:var(--text-normal);">
        ${this.decks.map((d) => `<option value="${d}" ${d === this.currentDeck ? "selected" : ""}>${d.split("/").pop()}</option>`).join("")}
      </select>
      <button id="rf-apply-deck" style="padding:4px 10px;border:1px solid var(--background-modifier-border);border-radius:4px;cursor:pointer;font-size:0.78em;background:var(--background-primary);">\u5E94\u7528\u5230\u5168\u90E8</button>
      <button id="rf-preview-btn" style="padding:5px 12px;border:1px solid var(--background-modifier-border);border-radius:6px;cursor:pointer;font-size:0.82em;background:var(--background-primary);">\u{1F50D}\u9884\u89C8</button>
      <button id="rf-save-btn" style="padding:6px 24px;border:none;border-radius:8px;cursor:pointer;background:var(--interactive-accent);color:#fff;font-weight:600;font-size:0.85em;">\u{1F4BE} \u4FDD\u5B58\u5168\u90E8</button>
      <button id="rf-cancel-btn" style="padding:5px 12px;border:1px solid var(--background-modifier-border);border-radius:6px;cursor:pointer;font-size:0.82em;background:var(--background-primary);">\u2715\u53D6\u6D88</button>
    </div>`;
    modal.innerHTML = html;
    document.body.appendChild(overlay);
    const pasteArea = modal.querySelector("#rf-paste-area");
    pasteArea.oninput = () => {
      const text = pasteArea.value;
      const lines = text.split("\n").map((l) => l.trim()).filter((l) => l && /^[-*]/.test(l) || l && /^==/.test(l));
      if (lines.length > 0) {
        const newCards = lines.map((l) => {
          const { word, meaning } = autoSplit(l);
          return { word, meaning, priority: 1, source: "manual" };
        });
        this.cards = newCards;
        deckPerCard = this.cards.map(() => this.currentDeck);
        overlay.remove();
        this.showBatchModal();
      }
    };
    modal.querySelector("#rf-auto-cloze")?.addEventListener("click", () => {
      for (const card of this.cards) {
        if (!card.cloze) {
          const hlMatch = card.meaning.match(/==(.+?)==/g);
          if (hlMatch) {
            card.cloze = hlMatch.map((m) => ({ hint: m.replace(/==/g, "").slice(0, 60), answer: m.replace(/==/g, "") }));
          }
        }
      }
      new import_obsidian.Notice(`\u2702 \u5DF2\u4E3A ${this.cards.filter((c) => c.cloze).length} \u5F20\u5361\u7247\u521B\u5EFA\u6316\u7A7A`);
    });
    modal.querySelectorAll(".rf-cloze-single").forEach((btn) => {
      btn.addEventListener("click", () => {
        const item = btn.closest(".rf-card-item");
        const idx = parseInt(item.getAttribute("data-idx") || "0");
        const ta = modal.querySelector(`.rf-m-${idx}`);
        if (!ta) return;
        const s = ta.selectionStart, e = ta.selectionEnd;
        if (s !== null && e !== null && s !== e) {
          const txt = ta.value;
          ta.value = txt.slice(0, s) + `{{c1::${txt.slice(s, e)}}}` + txt.slice(e);
          this.cards[idx].meaning = ta.value;
          this.cards[idx].cloze = [{ hint: "\u70B9\u51FB\u63ED\u793A", answer: txt.slice(s, e) }];
        }
      });
    });
    modal.querySelectorAll(".rf-del-single").forEach((btn) => {
      btn.addEventListener("click", () => {
        const item = btn.closest(".rf-card-item");
        const idx = parseInt(item.getAttribute("data-idx") || "0");
        this.cards.splice(idx, 1);
        overlay.remove();
        this.showBatchModal();
      });
    });
    modal.querySelector("#rf-add-card")?.addEventListener("click", () => {
      const w = modal.querySelector("#rf-new-word").value.trim();
      const m = modal.querySelector("#rf-new-meaning").value.trim();
      if (w) {
        this.cards.push({ word: w, meaning: m, priority: 1, source: "manual" });
        overlay.remove();
        this.showBatchModal();
      }
    });
    modal.querySelector("#rf-apply-deck")?.addEventListener("click", () => {
      const deck = modal.querySelector("#rf-batch-deck-all").value;
      this.currentDeck = deck;
      modal.querySelectorAll(".rf-card-deck").forEach((sel) => sel.value = deck);
      new import_obsidian.Notice(`\u2705 \u5168\u90E8\u5361\u7EC4\u5DF2\u8BBE\u4E3A "${deck.split("/").pop()}"`);
    });
    modal.querySelector("#rf-save-btn")?.addEventListener("click", async () => {
      for (let i = 0; i < this.cards.length; i++) {
        const w = modal.querySelector(`.rf-w-${i}`);
        const m = modal.querySelector(`.rf-m-${i}`);
        const d = modal.querySelector(`.rf-card-deck[data-idx="${i}"]`);
        if (w) this.cards[i].word = w.value.trim();
        if (m) this.cards[i].meaning = m.value.trim();
        if (d) this.currentDeck = d.value;
      }
      const filePath = this.callbacks.getActiveFilePath() || "unknown";
      await this.callbacks.onSave(this.cards, this.currentDeck, filePath);
      this.cards = [];
      this.selections = [];
      overlay.remove();
      this.renderExpanded();
    });
    modal.querySelector("#rf-cancel-btn")?.addEventListener("click", () => overlay.remove());
    modal.querySelector("#rf-preview-btn")?.addEventListener("click", () => {
      overlay.remove();
      this.showPreview();
    });
  }
  // ─── 预览 ───
  showPreview() {
    if (this.cards.length === 0) return;
    let idx = 0;
    const overlay = modalOverlay();
    const modal = modalBox("360px", overlay);
    const render = () => {
      const card = this.cards[idx];
      modal.innerHTML = `
        <div style="font-weight:600;font-size:0.9em;margin-bottom:10px;">\u{1F50D} \u9884\u89C8 \u2014 ${idx + 1}/${this.cards.length}</div>
        <div style="text-align:center;padding:24px;border:1px solid var(--background-modifier-border);border-radius:10px;margin-bottom:10px;">
          <div style="font-size:1.3em;font-weight:700;margin-bottom:6px;">${esc(card.word)}</div>
          <div style="color:var(--text-muted);font-size:0.9em;">${esc(card.meaning)}</div>
          ${card.cloze ? '<div style="margin-top:6px;color:var(--text-accent);font-size:0.8em;">\u{1F4CB} \u542B\u6316\u7A7A</div>' : ""}
        </div>
        <div style="display:flex;gap:6px;justify-content:center;">
          <button class="rf-prev" style="padding:5px 14px;border:1px solid var(--background-modifier-border);border-radius:6px;cursor:pointer;background:var(--background-primary);font-size:0.85em;" ${idx === 0 ? "disabled" : ""}>\u2190</button>
          <button class="rf-next" style="padding:5px 14px;border:1px solid var(--background-modifier-border);border-radius:6px;cursor:pointer;background:var(--background-primary);font-size:0.85em;" ${idx >= this.cards.length - 1 ? "disabled" : ""}>\u2192</button>
        </div>
        <div style="text-align:center;margin-top:8px;"><button class="rf-close" style="padding:4px 16px;border:none;border-radius:6px;cursor:pointer;color:var(--text-muted);font-size:0.82em;">\u2715 \u5173\u95ED</button></div>
      `;
      modal.querySelector(".rf-prev")?.addEventListener("click", () => {
        if (idx > 0) {
          idx--;
          render();
        }
      });
      modal.querySelector(".rf-next")?.addEventListener("click", () => {
        if (idx < this.cards.length - 1) {
          idx++;
          render();
        }
      });
      modal.querySelector(".rf-close")?.addEventListener("click", () => overlay.remove());
    };
    render();
    document.body.appendChild(overlay);
  }
};
function el(tag, style) {
  const e = document.createElement(tag);
  e.style.cssText = style;
  return e;
}
function mkBtn(label, style, onClick) {
  const b = document.createElement("button");
  b.textContent = label;
  b.style.cssText = `padding:5px 10px;border:1px solid var(--background-modifier-border);border-radius:6px;cursor:pointer;font-size:0.82em;background:var(--background-primary);${style}`;
  b.onclick = onClick;
  return b;
}
function esc(s) {
  return s.replace(/&/g, "&").replace(/</g, "<").replace(/>/g, ">");
}
function modalOverlay() {
  const o = document.createElement("div");
  o.style.cssText = "position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;";
  o.onclick = (e) => {
    if (e.target === o) o.remove();
  };
  return o;
}
function modalBox(width, overlay) {
  const m = document.createElement("div");
  m.style.cssText = `background:var(--background-primary);border-radius:14px;padding:20px;width:${width};max-height:80vh;overflow-y:auto;box-shadow:0 8px 32px rgba(0,0,0,0.2);`;
  m.onclick = (e) => e.stopPropagation();
  overlay.appendChild(m);
  return m;
}

// ui/mode-selector.ts
var import_obsidian2 = require("obsidian");
var ModeSelectorModal = class extends import_obsidian2.Modal {
  callbacks;
  constructor(app, callbacks) {
    super(app);
    this.callbacks = callbacks;
    this.titleEl.style.display = "none";
    this.modalEl.style.width = "460px";
    this.modalEl.style.maxWidth = "90vw";
    this.modalEl.style.borderRadius = "16px";
    this.modalEl.style.padding = "8px";
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.createEl("h2", {
      text: "\u{1F9E0} RemiFocus",
      attr: {
        style: "text-align:center;margin:8px 0 4px 0;font-size:1.5em;"
      }
    });
    contentEl.createEl("p", {
      text: "\u9009\u62E9\u5236\u5361\u6A21\u5F0F",
      attr: {
        style: "text-align:center;color:var(--text-muted);margin:0 0 20px 0;font-size:0.95em;"
      }
    });
    this.addModeButton(
      "\u{1F9F1} \u624B\u52A8\u7F16\u8F91",
      "\u50CF Notion \u4E00\u6837\u81EA\u7531 \u2014 \u5B8C\u5168\u624B\u52A8\u63A7\u5236\u5361\u7247\u5185\u5BB9\u548C\u683C\u5F0F",
      "var(--text-accent)",
      () => {
        this.close();
        this.callbacks.onSelectManual();
      }
    );
    this.addModeButton(
      "\u2699\uFE0F \u5FEB\u901F\u751F\u6210",
      "\u50CF Anki \u4E00\u6837\u5FEB\u901F \u2014 \u81EA\u52A8\u626B\u63CF\u7B14\u8BB0\u4E2D\u7684\u8BCD\u6C47\u548C\u7ED3\u6784",
      "var(--color-orange)",
      () => {
        this.close();
        this.callbacks.onSelectClassic();
      }
    );
    this.addModeButton(
      "\u{1F9E0} \u667A\u80FD\u7ED3\u6784\u5316 \u2B50",
      "\u50CF\u5B66\u4E60\u64CD\u4F5C\u7CFB\u7EDF\u4E00\u6837\u667A\u80FD \u2014 KU\u77E5\u8BC6\u56FE\u8C31 + DSL\u89C4\u5219 + AI\u538B\u7F29",
      "var(--color-green)",
      () => {
        this.close();
        this.callbacks.onSelectKU();
      }
    );
    contentEl.createEl("hr", {
      attr: { style: "margin:16px 0 12px 0;border-color:var(--background-modifier-border);" }
    });
    const quickReviewBtn = contentEl.createEl("button", {
      text: "\u25B6 \u5FEB\u901F\u5F00\u59CB\u4ECA\u65E5\u590D\u4E60",
      attr: {
        style: `
          display:block;width:100%;padding:10px;border-radius:10px;
          border:1px solid var(--background-modifier-border);
          background:var(--background-primary-alt);color:var(--text-normal);
          cursor:pointer;font-size:0.95em;font-weight:500;
          transition:background 0.2s;
        `
      }
    });
    quickReviewBtn.addEventListener("click", () => {
      this.close();
      this.callbacks.onQuickReview();
    });
    quickReviewBtn.addEventListener("mouseenter", () => {
      quickReviewBtn.style.background = "var(--background-modifier-hover)";
    });
    quickReviewBtn.addEventListener("mouseleave", () => {
      quickReviewBtn.style.background = "var(--background-primary-alt)";
    });
    contentEl.createEl("p", {
      text: "\u{1F4A1} \u9996\u6B21\u4F7F\u7528\u8BF7\u9009\u300C\u5FEB\u901F\u751F\u6210\u300D\uFF0C\u540E\u7EED\u53EF\u5728\u8BBE\u7F6E\u4E2D\u5207\u6362\u9ED8\u8BA4\u6A21\u5F0F",
      attr: {
        style: "text-align:center;color:var(--text-faint);margin:12px 0 0 0;font-size:0.8em;"
      }
    });
  }
  addModeButton(label, description, accentColor, onClick) {
    const { contentEl } = this;
    const container = contentEl.createEl("div", {
      attr: {
        style: `
          display:flex;flex-direction:column;gap:4px;
          padding:14px 16px;margin:6px 0;border-radius:12px;
          border:1px solid var(--background-modifier-border);
          background:var(--background-primary);
          cursor:pointer;transition:all 0.2s;
        `
      }
    });
    container.addEventListener("click", onClick);
    container.addEventListener("mouseenter", () => {
      container.style.borderColor = accentColor;
      container.style.background = "var(--background-primary-alt)";
      container.style.transform = "translateX(4px)";
    });
    container.addEventListener("mouseleave", () => {
      container.style.borderColor = "var(--background-modifier-border)";
      container.style.background = "var(--background-primary)";
      container.style.transform = "none";
    });
    container.createEl("div", {
      text: label,
      attr: { style: `font-size:1.1em;font-weight:600;color:${accentColor};` }
    });
    container.createEl("div", {
      text: description,
      attr: {
        style: "font-size:0.85em;color:var(--text-muted);line-height:1.4;"
      }
    });
  }
  onClose() {
    this.contentEl.empty();
  }
};

// main.ts
init_service();

// ai/types.ts
var DEFAULT_AI_SETTINGS = {
  enabled: false,
  provider: "openai",
  apiKey: "",
  baseUrl: "https://api.openai.com/v1",
  model: "gpt-4o-mini",
  maxTokens: 4096,
  temperature: 0.7,
  compressionModel: "gpt-4o-mini"
};

// ui/aiChat.ts
var import_obsidian3 = require("obsidian");
var AIChatModal = class extends import_obsidian3.Modal {
  aiService;
  settings;
  sessions = [];
  currentSession = null;
  onSettingsChange;
  constructor(app, aiService, settings, onSettingsChange) {
    super(app);
    this.aiService = aiService;
    this.settings = settings;
    this.onSettingsChange = onSettingsChange;
    this.titleEl.style.display = "none";
    this.modalEl.style.width = "85vw";
    this.modalEl.style.maxWidth = "750px";
    this.modalEl.style.height = "75vh";
    this.modalEl.style.maxHeight = "650px";
    this.modalEl.style.borderRadius = "12px";
    this.modalEl.style.padding = "0";
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.classList.add("remi-focus");
    contentEl.style.cssText = "display:flex;flex-direction:column;height:100%;padding:0;overflow:hidden;";
    const body = contentEl.createDiv();
    body.style.cssText = "display:flex;flex:1;min-height:0;overflow:hidden;";
    const leftPanel = body.createDiv();
    leftPanel.style.cssText = "width:180px;border-right:1px solid var(--remi-border);display:flex;flex-direction:column;overflow:hidden;flex-shrink:0;";
    this.renderLeftPanel(leftPanel);
    const rightPanel = body.createDiv();
    rightPanel.style.cssText = "flex:1;display:flex;flex-direction:column;overflow:hidden;";
    this.renderRightPanel(rightPanel);
    const bottomBar = contentEl.createDiv();
    bottomBar.style.cssText = "display:flex;align-items:center;gap:8px;padding:8px 12px;border-top:1px solid var(--remi-border);flex-shrink:0;";
    this.renderBottomBar(bottomBar);
  }
  // ════════════════════════════════════════
  //  左侧：历史会话
  // ════════════════════════════════════════
  renderLeftPanel(container) {
    const title = container.createDiv();
    title.style.cssText = "font-weight:600;font-size:0.85em;padding:10px 12px 6px;color:var(--remi-text-muted);";
    title.textContent = "\u{1F4CB} \u5BF9\u8BDD\u5386\u53F2";
    const list = container.createDiv();
    list.style.cssText = "overflow-y:auto;flex:1;min-height:0;";
    if (this.sessions.length === 0) {
      const empty = list.createDiv();
      empty.style.cssText = "text-align:center;padding:16px;color:var(--remi-text-muted);font-size:0.8em;";
      empty.textContent = "\u6682\u65E0\u5BF9\u8BDD";
    }
    for (const session of this.sessions) {
      const item = list.createDiv();
      item.style.cssText = "padding:6px 12px;cursor:pointer;font-size:0.82em;border-left:3px solid transparent;transition:all 0.1s;" + (this.currentSession?.id === session.id ? "background:var(--remi-accent)15;border-left-color:var(--remi-accent);font-weight:500;" : "");
      item.textContent = session.title;
      item.title = session.messages[0]?.content.slice(0, 60) || "";
      item.addEventListener("mouseenter", () => {
        item.style.background = "var(--remi-bg-secondary)";
      });
      item.addEventListener("mouseleave", () => {
        if (this.currentSession?.id !== session.id) {
          item.style.background = "transparent";
        }
      });
      item.addEventListener("click", () => {
        this.currentSession = session;
        this.onOpen();
      });
    }
    const newBtn = container.createDiv();
    newBtn.style.cssText = "padding:8px 12px;cursor:pointer;font-size:0.82em;color:var(--remi-accent);border-top:1px solid var(--remi-border);font-weight:500;";
    newBtn.textContent = "\uFF0B \u65B0\u5EFA\u5BF9\u8BDD";
    newBtn.addEventListener("click", () => {
      this.currentSession = {
        id: `session_${Date.now()}`,
        title: `\u5BF9\u8BDD ${this.sessions.length + 1}`,
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      this.sessions.push(this.currentSession);
      this.onOpen();
    });
  }
  // ════════════════════════════════════════
  //  右侧：聊天区域
  // ════════════════════════════════════════
  renderRightPanel(container) {
    const header = container.createDiv();
    header.style.cssText = "display:flex;justify-content:space-between;align-items:center;padding:8px 14px;border-bottom:1px solid var(--remi-border);flex-shrink:0;";
    const title = header.createSpan();
    title.style.cssText = "font-weight:600;font-size:0.9em;";
    title.textContent = this.currentSession?.title || "\u{1F4AC} AI \u8BC6\u5361";
    const configIndicator = header.createSpan();
    configIndicator.style.cssText = "font-size:0.78em;color:var(--remi-text-muted);";
    configIndicator.textContent = this.settings.enabled ? `\u{1F916} ${this.settings.model}` : "\u26A0\uFE0F \u672A\u914D\u7F6E";
    const msgContainer = container.createDiv();
    msgContainer.style.cssText = "flex:1;overflow-y:auto;padding:8px 14px;display:flex;flex-direction:column;gap:8px;min-height:0;";
    if (!this.currentSession || this.currentSession.messages.length === 0) {
      const welcome = msgContainer.createDiv();
      welcome.style.cssText = "text-align:center;padding:32px;color:var(--remi-text-muted);font-size:0.85em;line-height:1.6;";
      welcome.innerHTML = "\u{1F916} \u60A8\u597D\uFF01\u6211\u662F AI \u5B66\u4E60\u52A9\u624B<br/>\u6211\u53EF\u4EE5\u5E2E\u60A8\uFF1A<br/>\u2022 \u{1F4D6} \u5206\u6790\u7B14\u8BB0\u5185\u5BB9\uFF0C\u63D0\u53D6\u5361\u7247<br/>\u2022 \u{1F9E0} \u538B\u7F29\u5197\u957F\u7B14\u8BB0\u4E3A\u6613\u8BB0\u5361\u7247<br/>\u2022 \u{1F4CA} \u5206\u6790\u5B66\u4E60\u6570\u636E\uFF0C\u4F18\u5316\u5361\u7EC4<br/>\u2022 \u{1F4A1} \u56DE\u7B54\u5B66\u4E60\u65B9\u6CD5\u95EE\u9898<br/><br/><span style='font-size:0.85em;color:var(--remi-text-muted)'>\u8BF7\u5728\u4E0B\u65B9\u8F93\u5165\u6846\u53D1\u9001\u6D88\u606F\u5F00\u59CB</span>";
    }
    for (const msg of this.currentSession?.messages ?? []) {
      this.renderMessage(msgContainer, msg);
    }
    msgContainer.scrollTop = msgContainer.scrollHeight;
  }
  renderMessage(container, msg) {
    const isUser = msg.role === "user";
    const bubble = container.createDiv();
    bubble.style.cssText = "max-width:85%;padding:8px 12px;border-radius:10px;font-size:0.85em;line-height:1.5;word-wrap:break-word;align-self:" + (isUser ? "flex-end" : "flex-start") + ";";
    if (isUser) {
      bubble.style.background = "var(--remi-accent)";
      bubble.style.color = "#fff";
    } else {
      bubble.style.background = "var(--remi-bg-secondary)";
      bubble.style.color = "var(--remi-text)";
      bubble.style.border = "1px solid var(--remi-border)";
    }
    bubble.textContent = msg.content;
    const time = container.createDiv();
    time.style.cssText = "font-size:0.7em;color:var(--remi-text-muted);text-align:" + (isUser ? "right" : "left") + ";padding:0 4px;";
    time.textContent = new Date(msg.timestamp).toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit"
    });
  }
  // ════════════════════════════════════════
  //  底部操作栏
  // ════════════════════════════════════════
  renderBottomBar(container) {
    const settingsBtn = container.createEl("button");
    settingsBtn.textContent = "\u2699\uFE0F";
    settingsBtn.style.cssText = "padding:6px 10px;border:1px solid var(--remi-border);border-radius:6px;cursor:pointer;background:var(--remi-bg);font-size:0.9em;flex-shrink:0;";
    settingsBtn.title = "AI \u8BBE\u7F6E";
    settingsBtn.addEventListener("click", () => this.openSettingsModal());
    const input = container.createEl("input");
    input.setAttribute("type", "text");
    input.setAttribute("placeholder", "\u8F93\u5165\u6D88\u606F...");
    input.style.cssText = "flex:1;padding:8px 12px;border:1px solid var(--remi-border);border-radius:8px;background:var(--remi-bg);color:var(--remi-text);font-size:0.88em;outline:none;";
    const sendBtn = container.createEl("button");
    sendBtn.textContent = "\u53D1\u9001 \u25B6";
    sendBtn.style.cssText = "padding:8px 16px;border:none;border-radius:8px;cursor:pointer;background:var(--remi-accent);color:#fff;font-size:0.85em;font-weight:500;flex-shrink:0;";
    const sendMessage = async () => {
      const text = input.value.trim();
      if (!text || !this.currentSession) return;
      if (!this.settings.enabled || !this.settings.apiKey) {
        new import_obsidian3.Notice("\u26A0\uFE0F \u8BF7\u5148\u5728\u8BBE\u7F6E\u4E2D\u914D\u7F6E AI API");
        this.openSettingsModal();
        return;
      }
      this.currentSession.messages.push({
        role: "user",
        content: text,
        timestamp: Date.now()
      });
      input.value = "";
      sendBtn.textContent = "\u23F3...";
      sendBtn.disabled = true;
      this.onOpen();
      try {
        const response = await this.aiService.chat(
          this.currentSession.messages
        );
        this.currentSession.messages.push({
          role: "assistant",
          content: response,
          timestamp: Date.now()
        });
        this.currentSession.updatedAt = Date.now();
      } catch (err) {
        new import_obsidian3.Notice(`\u274C ${err.message}`);
        this.currentSession.messages.pop();
      } finally {
        sendBtn.textContent = "\u53D1\u9001 \u25B6";
        sendBtn.disabled = false;
        this.onOpen();
      }
    };
    sendBtn.addEventListener("click", sendMessage);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
    const quickActions = container.createDiv();
    quickActions.style.cssText = "display:flex;gap:4px;flex-shrink:0;";
    const analyzeBtn = quickActions.createEl("button");
    analyzeBtn.textContent = "\u{1F4CA} \u5206\u6790";
    analyzeBtn.style.cssText = "padding:6px 10px;border:1px solid var(--remi-border);border-radius:6px;cursor:pointer;background:var(--remi-bg);font-size:0.78em;color:var(--remi-text-muted);";
    analyzeBtn.title = "\u5206\u6790\u5F53\u524D\u7B14\u8BB0";
    analyzeBtn.addEventListener("click", () => {
      input.value = "\u5E2E\u6211\u5206\u6790\u5F53\u524D\u7B14\u8BB0\u7684\u5185\u5BB9\uFF0C\u63D0\u53D6\u5361\u7247";
    });
    const compressBtn = quickActions.createEl("button");
    compressBtn.textContent = "\u{1F9E0} \u538B\u7F29";
    compressBtn.style.cssText = "padding:6px 10px;border:1px solid var(--remi-border);border-radius:6px;cursor:pointer;background:var(--remi-bg);font-size:0.78em;color:var(--remi-text-muted);";
    compressBtn.title = "\u538B\u7F29\u5F53\u524D\u7B14\u8BB0";
    compressBtn.addEventListener("click", () => {
      input.value = "\u5E2E\u6211\u538B\u7F29\u5F53\u524D\u7B14\u8BB0\uFF0C\u751F\u6210\u6613\u8BB0\u5361\u7247";
    });
  }
  // ════════════════════════════════════════
  //  设置弹窗（内嵌）
  // ════════════════════════════════════════
  openSettingsModal() {
    const modal = new import_obsidian3.Modal(this.app);
    modal.titleEl.setText("\u{1F916} AI \u8BBE\u7F6E");
    modal.modalEl.style.width = "480px";
    modal.modalEl.style.maxWidth = "90vw";
    modal.modalEl.style.borderRadius = "10px";
    const settings = { ...this.settings };
    modal.onOpen = () => {
      const { contentEl } = modal;
      contentEl.classList.add("remi-focus");
      contentEl.style.padding = "8px";
      new import_obsidian3.Setting(contentEl).setName("\u542F\u7528 AI").setDesc("\u5F00\u542F AI \u8BC6\u5361\u548C\u538B\u7F29\u529F\u80FD").addToggle(
        (t) => t.setValue(settings.enabled).onChange(async (v) => {
          settings.enabled = v;
        })
      );
      new import_obsidian3.Setting(contentEl).setName("API \u5730\u5740").setDesc("OpenAI \u517C\u5BB9\u63A5\u53E3\u7684\u57FA\u7840 URL").addText(
        (t) => t.setValue(settings.baseUrl).setPlaceholder("https://api.openai.com/v1").onChange((v) => {
          settings.baseUrl = v;
        })
      );
      new import_obsidian3.Setting(contentEl).setName("API Key").setDesc("\u4F60\u7684 API \u5BC6\u94A5").addText(
        (t) => t.setValue(settings.apiKey).setPlaceholder("sk-...").onChange((v) => {
          settings.apiKey = v;
        })
      );
      new import_obsidian3.Setting(contentEl).setName("\u6A21\u578B").setDesc("\u6A21\u578B\u540D\u79F0\uFF08\u5982 gpt-4o-mini, deepseek-chat\uFF09").addText(
        (t) => t.setValue(settings.model).setPlaceholder("gpt-4o-mini").onChange((v) => {
          settings.model = v;
        })
      );
      new import_obsidian3.Setting(contentEl).setName("\u6700\u5927 Token").setDesc("\u5355\u6B21\u54CD\u5E94\u7684\u6700\u5927\u957F\u5EA6").addSlider(
        (sl) => sl.setLimits(512, 8192, 512).setValue(settings.maxTokens).setDynamicTooltip().onChange((v) => {
          settings.maxTokens = v;
        })
      );
      new import_obsidian3.Setting(contentEl).setName("\u6E29\u5EA6").setDesc("\u521B\u9020\u529B\u53C2\u6570\uFF080=\u7CBE\u786E\uFF0C2=\u968F\u673A\uFF09").addSlider(
        (sl) => sl.setLimits(0, 200, 10).setValue(Math.round(settings.temperature * 100)).setDynamicTooltip().onChange((v) => {
          settings.temperature = v / 100;
        })
      );
      const btnDiv = contentEl.createDiv();
      btnDiv.style.cssText = "display:flex;gap:8px;justify-content:flex-end;margin-top:16px;";
      const testBtn = btnDiv.createEl("button");
      testBtn.textContent = "\u{1F50D} \u6D4B\u8BD5\u8FDE\u63A5";
      testBtn.style.cssText = "padding:6px 16px;border:1px solid var(--remi-border);border-radius:6px;cursor:pointer;background:var(--remi-bg);font-size:0.85em;";
      testBtn.addEventListener("click", async () => {
        testBtn.textContent = "\u23F3 \u6D4B\u8BD5\u4E2D...";
        testBtn.disabled = true;
        try {
          const testService = new (await Promise.resolve().then(() => (init_service(), service_exports))).AIService(settings);
          const result = await testService.healthCheck();
          new import_obsidian3.Notice(result.message);
        } catch (err) {
          new import_obsidian3.Notice(`\u274C ${err.message}`);
        }
        testBtn.textContent = "\u{1F50D} \u6D4B\u8BD5\u8FDE\u63A5";
        testBtn.disabled = false;
      });
      const saveBtn = btnDiv.createEl("button");
      saveBtn.textContent = "\u{1F4BE} \u4FDD\u5B58\u8BBE\u7F6E";
      saveBtn.style.cssText = "padding:6px 16px;border:none;border-radius:6px;cursor:pointer;background:var(--remi-accent);color:#fff;font-size:0.85em;font-weight:500;";
      saveBtn.addEventListener("click", async () => {
        this.settings = { ...settings };
        this.aiService.rebuild(this.settings);
        this.onSettingsChange(this.settings);
        new import_obsidian3.Notice("\u2705 AI \u8BBE\u7F6E\u5DF2\u4FDD\u5B58");
        modal.close();
        this.onOpen();
      });
    };
    modal.open();
  }
};

// ui/dsl-editor.ts
var import_obsidian4 = require("obsidian");
var DSLEditorModal = class extends import_obsidian4.Modal {
  registry;
  rules = [];
  filterBuiltin = null;
  // null = all, true = builtin, false = user
  constructor(app, registry) {
    super(app);
    this.registry = registry;
    this.titleEl.setText("\u{1F4DC} DSL \u89C4\u5219\u7BA1\u7406");
    this.modalEl.style.width = "640px";
    this.modalEl.style.maxWidth = "90vw";
    this.modalEl.style.maxHeight = "80vh";
  }
  async onOpen() {
    await this.refreshRules();
    this.render();
  }
  async refreshRules() {
    await this.registry.initialize();
    this.rules = this.registry.getAllRules();
  }
  render() {
    const { contentEl } = this;
    contentEl.empty();
    this.renderStats();
    this.renderFilter();
    const filtered = this.getFilteredRules();
    if (filtered.length === 0) {
      contentEl.createEl("p", {
        text: "\u{1F4ED} \u6CA1\u6709\u5339\u914D\u7684\u89C4\u5219",
        attr: { style: "text-align:center;padding:20px;color:var(--text-muted);" }
      });
      return;
    }
    const listEl = contentEl.createEl("div", {
      attr: { style: "display:flex;flex-direction:column;gap:6px;max-height:50vh;overflow-y:auto;padding:4px 0;" }
    });
    for (const rule of filtered) {
      this.renderRuleItem(listEl, rule);
    }
    contentEl.createEl("p", {
      text: "\u{1F4A1} \u81EA\u5B9A\u4E49\u89C4\u5219\u8BF7\u7F16\u8F91 .obsidian/plugins/remifocus/system/dsl-rules.yaml",
      attr: { style: "text-align:center;font-size:0.8em;color:var(--text-faint);margin-top:12px;" }
    });
  }
  renderStats() {
    const { contentEl } = this;
    const stats = this.registry.getStats();
    const statsEl = contentEl.createEl("div", {
      attr: {
        style: "display:flex;gap:16px;justify-content:center;margin-bottom:12px;font-size:0.85em;"
      }
    });
    this.addStat(statsEl, `\u{1F4CA} \u603B\u8BA1 ${stats.total}`);
    this.addStat(statsEl, `\u2705 \u542F\u7528 ${stats.enabled}`);
    this.addStat(statsEl, `\u{1F535} \u5185\u7F6E ${stats.builtin}`);
    this.addStat(statsEl, `\u{1F7E2} \u81EA\u5B9A\u4E49 ${stats.user}`);
  }
  addStat(container, text) {
    const el2 = container.createEl("span", {
      text,
      attr: { style: "padding:4px 10px;border-radius:12px;background:var(--background-modifier-border);" }
    });
  }
  renderFilter() {
    const { contentEl } = this;
    const filterEl = contentEl.createEl("div", {
      attr: { style: "display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;" }
    });
    const filters = [
      { label: "\u{1F4CB} \u5168\u90E8", value: null },
      { label: "\u{1F535} \u5185\u7F6E\u89C4\u5219", value: true },
      { label: "\u{1F7E2} \u81EA\u5B9A\u4E49\u89C4\u5219", value: false }
    ];
    for (const f of filters) {
      const btn = filterEl.createEl("button", {
        text: f.label,
        attr: {
          style: `
            padding:4px 14px;border-radius:14px;border:1px solid var(--background-modifier-border);
            background:${this.filterBuiltin === f.value ? "var(--interactive-accent)" : "var(--background-primary-alt)"};
            color:${this.filterBuiltin === f.value ? "var(--text-on-accent, white)" : "var(--text-normal)"};
            cursor:pointer;font-size:0.82em;transition:all 0.2s;
          `
        }
      });
      btn.addEventListener("click", () => {
        this.filterBuiltin = f.value;
        this.render();
      });
    }
    const refreshBtn = filterEl.createEl("button", {
      text: "\u{1F504} \u5237\u65B0",
      attr: {
        style: `
          margin-left:auto;padding:4px 14px;border-radius:14px;
          border:1px solid var(--background-modifier-border);
          background:var(--background-primary-alt);cursor:pointer;font-size:0.82em;
        `
      }
    });
    refreshBtn.addEventListener("click", async () => {
      await this.refreshRules();
      this.render();
      new import_obsidian4.Notice("\u2705 DSL \u89C4\u5219\u5DF2\u5237\u65B0");
    });
  }
  getFilteredRules() {
    if (this.filterBuiltin === null) return this.rules;
    return this.rules.filter((r) => r.builtin === this.filterBuiltin);
  }
  renderRuleItem(container, rule) {
    const item = container.createEl("div", {
      attr: {
        style: `
          display:flex;align-items:center;gap:10px;
          padding:8px 12px;border-radius:8px;
          border:1px solid var(--background-modifier-border);
          background:var(--background-primary);
          transition:all 0.2s;
        `
      }
    });
    const toggle = item.createEl("input", { attr: { type: "checkbox" } });
    toggle.checked = rule.enabled;
    toggle.style.cssText = "cursor:pointer;flex-shrink:0;";
    toggle.addEventListener("change", async () => {
      if (rule.enabled) {
        this.registry.disableRule(rule.id);
        new import_obsidian4.Notice(`\u26D4 \u5DF2\u7981\u7528: ${rule.rule}`);
      } else {
        this.registry.enableRule(rule.id);
        new import_obsidian4.Notice(`\u2705 \u5DF2\u542F\u7528: ${rule.rule}`);
      }
      rule.enabled = !rule.enabled;
    });
    const info = item.createEl("div", {
      attr: { style: "flex:1;min-width:0;" }
    });
    const nameRow = info.createEl("div", {
      attr: { style: "display:flex;align-items:center;gap:6px;flex-wrap:wrap;" }
    });
    nameRow.createEl("span", {
      text: rule.rule,
      attr: { style: "font-weight:500;font-size:0.9em;" }
    });
    if (rule.builtin) {
      this.addTag(nameRow, "\u5185\u7F6E", "var(--interactive-accent)");
    } else {
      this.addTag(nameRow, "\u81EA\u5B9A\u4E49", "var(--color-green)");
    }
    if (rule.exclusive) {
      this.addTag(nameRow, "\u72EC\u5360", "var(--color-orange)");
    }
    if (rule.fallback) {
      this.addTag(nameRow, "\u515C\u5E95", "var(--text-faint)");
    }
    if (rule.description) {
      info.createEl("div", {
        text: rule.description,
        attr: { style: "font-size:0.78em;color:var(--text-muted);margin-top:2px;" }
      });
    }
    const metaRow = info.createEl("div", {
      attr: { style: "display:flex;gap:8px;margin-top:3px;font-size:0.75em;color:var(--text-faint);" }
    });
    metaRow.createEl("span", { text: `\u26A1 priority: ${rule.priority}` });
    metaRow.createEl("span", { text: `\u{1F4D0} ${rule.output.structure}` });
    if (rule.output.domain) {
      metaRow.createEl("span", { text: `\u{1F4C1} ${rule.output.domain}` });
    }
    if (rule.output.tags && rule.output.tags.length > 0) {
      metaRow.createEl("span", { text: `\u{1F3F7}\uFE0F ${rule.output.tags.join(", ")}` });
    }
  }
  addTag(container, text, color) {
    container.createEl("span", {
      text,
      attr: {
        style: `
          font-size:0.65em;padding:1px 6px;border-radius:8px;
          background:${color};color:white;white-space:nowrap;
        `
      }
    });
  }
  onClose() {
    this.contentEl.empty();
  }
};

// core/dsl/types.ts
var BUILTIN_RULE_PRIORITIES = {
  rule_card: { priority: 90, exclusive: true, fallback: false },
  comparison_table: { priority: 85, exclusive: true, fallback: false },
  vocab_highlight: { priority: 80, exclusive: false, fallback: false },
  vocab_bold: { priority: 70, exclusive: false, fallback: false },
  simple_list: { priority: 60, exclusive: false, fallback: false },
  paragraph: { priority: 10, exclusive: false, fallback: true }
};
var DEFAULT_RULE_PRIORITY = 50;
var DEFAULT_RULE_EXCLUSIVE = false;
var DEFAULT_RULE_FALLBACK = false;

// core/dsl/parser.ts
var BUILTIN_RULES_YAML = `
- rule: vocab_highlight
  description: "\u63D0\u53D6\u9AD8\u4EAE\u6807\u8BB0\u7684\u8BCD\u6C47"
  match:
    - type: regex
      pattern: "- ==.*==:"
  action:
    extract:
      front: { source: highlight_word }
      meaning: { source: after_colon }
  output:
    structure: small-vocab
    tags: [vocabulary]

- rule: vocab_bold
  description: "\u63D0\u53D6\u52A0\u7C97\u6807\u8BB0\u7684\u8BCD\u6C47"
  match:
    - type: regex
      pattern: "- \\*\\*.*\\*\\*:"
  action:
    extract:
      front: { source: bold_word }
      meaning: { source: after_colon }
  output:
    structure: small-vocab
    tags: [vocabulary]

- rule: rule_card
  description: "\u63D0\u53D6\u3010\u770B\u5230\u5565\u3011\u2192\u3010\u60F3\u5230\u5565\u3011\u7ED3\u6784\u7684\u89C4\u5219\u5361\u7247"
  match:
    - type: heading_contains
      heading_contains: "\u770B\u5230\u5565"
  action:
    extract:
      concept: { source: heading }
      core: { source: section, section_name: "\u60F3\u5230\u5565" }
      wrong: { source: section, section_name: "\u522B\u9009\u5565" }
      mnemonic: { source: section, section_name: "\u8BB0\u4F4F\u5565" }
  output:
    structure: big-cloze
    tags: [rule]

- rule: comparison_table
  description: "\u5C06\u5BF9\u6BD4\u8868\u683C\u6309\u884C\u63D0\u53D6\u4E3A\u5361\u7247"
  match:
    - type: block_type
      block_type: table
  action:
    split_rows: true
    map_columns:
      left: A
      right: B
  output:
    structure: table
    tags: [comparison]

- rule: simple_list
  description: "\u63D0\u53D6\u7B80\u5355\u7684 term: definition \u683C\u5F0F"
  match:
    - type: regex
      pattern: "- .+:"
  action:
    extract:
      front: { source: line_content }
      meaning: { source: after_colon }
  output:
    structure: small-vocab
    tags: [list]

- rule: paragraph
  description: "\u6BB5\u843D\u515C\u5E95\u89C4\u5219\uFF0C\u63D0\u53D6\u666E\u901A\u6BB5\u843D\u6587\u672C"
  match:
    - type: block_type
      block_type: paragraph
  action:
    extract:
      content: { source: line_content }
  output:
    structure: paragraph
    tags: [paragraph]
`;
var DSLParser = class {
  /**
   * 解析内置规则
   */
  parseBuiltinRules() {
    return this.parseYAML(BUILTIN_RULES_YAML, true);
  }
  /**
   * 解析用户自定义 YAML 规则文件内容
   */
  parseUserRules(yamlContent) {
    const rules = this.parseYAML(yamlContent, false);
    const errors = [];
    return { rules, errors };
  }
  /**
   * 从文件内容解析所有规则（包含内置 + 自定义）
   */
  parseAll(yamlContent) {
    const builtin = this.parseBuiltinRules();
    const user = yamlContent ? this.parseYAML(yamlContent, false) : [];
    return { builtin, user };
  }
  // ─── 简化 YAML 解析 ───
  parseYAML(yaml, builtin) {
    const rules = [];
    const lines = yaml.split("\n");
    let i = 0;
    while (i < lines.length) {
      const trimmed = lines[i].trim();
      if (trimmed.startsWith("- rule:") || trimmed.startsWith("rule:")) {
        const ruleName = trimmed.replace(/^- rule:\s*|^rule:\s*/, "").trim();
        const block = this.extractRuleBlock(lines, i);
        const rule = this.buildRule(block, ruleName, builtin);
        if (rule) rules.push(rule);
        i += block.linesConsumed;
        continue;
      }
      i++;
    }
    return rules;
  }
  extractRuleBlock(lines, startIdx) {
    const blockLines = [];
    let i = startIdx;
    let baseIndent = -1;
    while (i < lines.length) {
      const line = lines[i];
      const trimmed = line.trim();
      if (trimmed === "" || trimmed.startsWith("#")) {
        if (blockLines.length > 0) blockLines.push(line);
        i++;
        continue;
      }
      const indent = line.length - line.trimStart().length;
      if (blockLines.length === 0) {
        if (trimmed.startsWith("- rule:") || trimmed.startsWith("rule:")) {
          baseIndent = indent;
          blockLines.push(line);
          i++;
          continue;
        }
      } else {
        if (indent <= baseIndent && trimmed.startsWith("- rule:")) {
          break;
        }
        blockLines.push(line);
        i++;
        continue;
      }
      i++;
    }
    return { lines: blockLines, linesConsumed: i - startIdx };
  }
  buildRule(block, ruleName, builtin) {
    const lines = block.lines;
    let description = "";
    const matchRules = [];
    let action;
    let output = { structure: "paragraph" };
    let inMatch = false;
    let inAction = false;
    let inExtract = false;
    let inOutput = false;
    let inMapColumns = false;
    for (const line of lines) {
      const trimmed = line.trim();
      const keyValue = trimmed.match(/^(\w[\w-]*):\s*(.*)$/);
      if (keyValue) {
        const key = keyValue[1];
        const value = keyValue[2].trim();
        if (key === "description") {
          description = value.replace(/^"|"$/g, "").replace(/^'|'$/g, "");
          inMatch = false;
          inAction = false;
          inExtract = false;
          inOutput = false;
          inMapColumns = false;
        } else if (key === "match") {
          inMatch = true;
          inAction = false;
          inExtract = false;
          inOutput = false;
          inMapColumns = false;
        } else if (key === "action") {
          inMatch = false;
          inAction = true;
          inExtract = false;
          inOutput = false;
          inMapColumns = false;
        } else if (key === "output") {
          inMatch = false;
          inAction = false;
          inExtract = false;
          inOutput = true;
          inMapColumns = false;
        } else if (key === "extract") {
          inExtract = true;
          inMapColumns = false;
          action = action ?? { extract: {} };
        } else if (key === "map_columns") {
          inMapColumns = true;
          inExtract = false;
          action = action ?? { extract: {} };
        } else if (inMatch && key === "type") {
          matchRules.push({ type: value });
        } else if (inMatch && key === "pattern") {
          if (matchRules.length > 0) matchRules[matchRules.length - 1].pattern = value.replace(/^"|"$/g, "").replace(/^'|'$/g, "");
        } else if (inMatch && key === "heading_contains") {
          if (matchRules.length > 0) matchRules[matchRules.length - 1].heading_contains = value.replace(/^"|"$/g, "").replace(/^'|'$/g, "");
        } else if (inMatch && key === "block_type") {
          if (matchRules.length > 0) matchRules[matchRules.length - 1].block_type = value;
        } else if (inOutput && key === "structure") {
          output.structure = value;
        } else if (inOutput && key === "domain") {
          output.domain = value;
        } else if (inOutput && key === "tags") {
          output.tags = this.parseTagList(value);
        } else if (inAction && key === "split_rows") {
          action = action ?? { extract: {} };
          action.split_rows = value === "true";
        }
      }
      if (inExtract && trimmed.startsWith("  ") && !trimmed.startsWith("    ")) {
        const fieldMatch = trimmed.match(/^(\w[\w-]*):\s*\{(.+)\}$/);
        if (fieldMatch && action) {
          const fieldName = fieldMatch[1];
          const propsStr = fieldMatch[2];
          const sourceMatch = propsStr.match(/source:\s*(\w+)/);
          const sectionMatch = propsStr.match(/section_name:\s*"([^"]+)"/);
          if (sourceMatch) {
            action.extract[fieldName] = {
              source: sourceMatch[1],
              section_name: sectionMatch ? sectionMatch[1] : void 0
            };
          }
        }
        const shortMatch = trimmed.match(/^(\w[\w-]*):\s*(\w+)$/);
        if (shortMatch && action && !fieldMatch) {
          action.extract[shortMatch[1]] = {
            source: shortMatch[2]
          };
        }
      }
      if (inMapColumns) {
        const colMatch = trimmed.match(/^(\w[\w-]*):\s*(.+)$/);
        if (colMatch && action) {
          action.map_columns = action.map_columns ?? {};
          action.map_columns[colMatch[1]] = colMatch[2].trim().replace(/^"|"$/g, "");
        }
      }
    }
    const preset = BUILTIN_RULE_PRIORITIES[ruleName];
    if (matchRules.length === 0) {
      matchRules.push({ type: "block_type", block_type: "paragraph" });
    }
    return {
      id: `${builtin ? "builtin" : "user"}_${ruleName}`,
      rule: ruleName,
      description,
      enabled: true,
      builtin,
      priority: preset?.priority ?? DEFAULT_RULE_PRIORITY,
      exclusive: preset?.exclusive ?? DEFAULT_RULE_EXCLUSIVE,
      fallback: preset?.fallback ?? DEFAULT_RULE_FALLBACK,
      match: matchRules,
      action,
      output
    };
  }
  parseTagList(value) {
    const cleaned = value.replace(/^\[|\]$/g, "").replace(/"/g, "");
    return cleaned.split(",").map((s) => s.trim()).filter(Boolean);
  }
};

// core/dsl/registry.ts
var DEFAULT_CONFIG = {
  enableBuiltin: true
};
var DSLRegistry = class {
  config;
  parser;
  /** 所有规则（内置 + 用户）按 ID 索引 */
  rulesById = /* @__PURE__ */ new Map();
  /** 用户已禁用的规则 ID 列表 */
  disabledRuleIds = /* @__PURE__ */ new Set();
  constructor(config) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.parser = new DSLParser();
  }
  /**
   * 初始化注册表：加载内置规则和用户规则
   */
  async initialize(userYamlContent) {
    this.rulesById.clear();
    if (this.config.enableBuiltin) {
      const builtinRules = this.parser.parseBuiltinRules();
      for (const rule of builtinRules) {
        this.rulesById.set(rule.id, rule);
      }
    }
    if (userYamlContent) {
      const { rules: userRules, errors } = this.parser.parseUserRules(userYamlContent);
      for (const rule of userRules) {
        this.rulesById.set(rule.id, rule);
      }
      if (errors.length > 0) {
        console.warn("[DSLRegistry] User rule parse errors:", errors);
      }
    }
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
  getEnabledRules() {
    return Array.from(this.rulesById.values()).filter((r) => r.enabled);
  }
  /**
   * 获取所有规则（含已禁用的）
   */
  getAllRules() {
    return Array.from(this.rulesById.values());
  }
  /**
   * 按 ID 获取规则
   */
  getRule(id) {
    return this.rulesById.get(id);
  }
  /**
   * 获取特定类型的规则
   */
  getRulesByStructure(structure) {
    return this.getEnabledRules().filter((r) => r.output.structure === structure);
  }
  /**
   * 获取非 fallback 规则（主动匹配规则）
   */
  getActiveRules() {
    return this.getEnabledRules().filter((r) => !r.fallback);
  }
  /**
   * 获取 fallback 规则（兜底规则）
   */
  getFallbackRules() {
    return this.getEnabledRules().filter((r) => r.fallback);
  }
  /**
   * 禁用规则
   */
  disableRule(id) {
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
  enableRule(id) {
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
  addUserRule(rule) {
    rule.builtin = false;
    rule.enabled = true;
    this.rulesById.set(rule.id, rule);
  }
  /**
   * 删除用户自定义规则
   */
  removeUserRule(id) {
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
  getStats() {
    const all = this.getAllRules();
    return {
      total: all.length,
      enabled: all.filter((r) => r.enabled).length,
      builtin: all.filter((r) => r.builtin).length,
      user: all.filter((r) => !r.builtin).length
    };
  }
  /**
   * 重置为默认状态
   */
  async reset() {
    this.disabledRuleIds.clear();
    await this.initialize();
  }
};

// main.ts
var REMI_QUICK_VIEW_TYPE = "remifocus-quick-view";
var DECK_JSON_PATH = ".obsidian/plugins/remifocus/system/deck.json";
var DEFAULT_SETTINGS = {
  scheduler: "sm-2",
  queueSize: 20,
  defaultMode: "review",
  reminderThreshold: 10,
  autoScan: true,
  dailyGoal: 20,
  sourcePriority: {
    inline: true,
    frontmatter: true,
    filename: true,
    tag: true
  },
  aiSettings: DEFAULT_AI_SETTINGS,
  defaultCardMode: "classic",
  dslRulePath: ".obsidian/plugins/remifocus/system/dsl-rules.yaml",
  defaultProjection: "literal"
};
var RemiFocusSettingTab = class extends import_obsidian5.PluginSettingTab {
  plugin;
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "\u{1F9E0} RemiFocus \u8BBE\u7F6E" });
    containerEl.createEl("h3", { text: "\u2699\uFE0F \u901A\u7528\u8BBE\u7F6E" });
    new import_obsidian5.Setting(containerEl).setName("\u8C03\u5EA6\u7B97\u6CD5").setDesc("\u9009\u62E9\u95F4\u9694\u91CD\u590D\u7B97\u6CD5 \u2014 FSRS-5 \u6BD4 SM-2 \u66F4\u7CBE\u51C6").addDropdown(
      (dd) => dd.addOption("sm-2", "SM-2\uFF08\u57FA\u7840\uFF09").addOption("fsrs", "FSRS-5\uFF08\u9AD8\u7EA7\uFF09").addOption("exam", "\u8003\u8BD5\u6A21\u5F0F\uFF08\u5F3A\u5316\uFF09").addOption("fixed-interval", "\u56FA\u5B9A\u95F4\u9694").setValue(this.plugin.settings.scheduler).onChange(async (v) => {
        this.plugin.settings.scheduler = v;
        await this.plugin.saveSettings();
        this.plugin.rebuildEngine();
      })
    );
    new import_obsidian5.Setting(containerEl).setName("\u9ED8\u8BA4\u5B66\u4E60\u6A21\u5F0F").setDesc("\u6253\u5F00\u5B66\u4E60 session \u65F6\u7684\u9ED8\u8BA4\u6A21\u5F0F").addDropdown(
      (dd) => dd.addOption("exposure", "\u{1F441} Exposure\uFF08\u521D\u5B66\uFF09").addOption("test", "\u{1F9EA} Test\uFF08\u6D4B\u8BD5\uFF09").addOption("review", "\u{1F504} Review\uFF08\u590D\u4E60\uFF09").setValue(this.plugin.settings.defaultMode).onChange(async (v) => {
        this.plugin.settings.defaultMode = v;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian5.Setting(containerEl).setName("\u961F\u5217\u5927\u5C0F").setDesc("\u6BCF\u6B21\u5B66\u4E60\u52A0\u8F7D\u7684\u6700\u5927\u5355\u8BCD\u6570\uFF085\u201350\uFF09").addSlider(
      (sl) => sl.setLimits(5, 50, 5).setValue(this.plugin.settings.queueSize).setDynamicTooltip().onChange(async (v) => {
        this.plugin.settings.queueSize = v;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian5.Setting(containerEl).setName("\u6BCF\u65E5\u5B66\u4E60\u76EE\u6807").setDesc("\u6BCF\u5929\u8BA1\u5212\u5B66\u4E60\u7684\u5361\u7247\u6570").addSlider(
      (sl) => sl.setLimits(5, 100, 5).setValue(this.plugin.settings.dailyGoal).setDynamicTooltip().onChange(async (v) => {
        this.plugin.settings.dailyGoal = v;
        await this.plugin.saveSettings();
      })
    );
    containerEl.createEl("h3", { text: "\u{1F514} \u63D0\u9192\u8BBE\u7F6E" });
    new import_obsidian5.Setting(containerEl).setName("\u81EA\u52A8\u590D\u4E60\u63D0\u9192").setDesc("\u6253\u5F00 Obsidian \u65F6\u81EA\u52A8\u68C0\u67E5\u5E76\u63D0\u9192\u5F85\u590D\u4E60\u5355\u8BCD").addToggle(
      (t) => t.setValue(this.plugin.settings.autoScan).onChange(async (v) => {
        this.plugin.settings.autoScan = v;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian5.Setting(containerEl).setName("\u63D0\u9192\u9608\u503C").setDesc("\u5F85\u590D\u4E60\u5355\u8BCD\u6570\u8D85\u8FC7\u6B64\u503C\u65F6\u663E\u793A\u5F3A\u63D0\u9192").addSlider(
      (sl) => sl.setLimits(3, 50, 1).setValue(this.plugin.settings.reminderThreshold).setDynamicTooltip().onChange(async (v) => {
        this.plugin.settings.reminderThreshold = v;
        await this.plugin.saveSettings();
      })
    );
    containerEl.createEl("h3", { text: "\u{1F4C4} \u5361\u7247\u63D0\u53D6\u89C4\u5219" });
    new import_obsidian5.Setting(containerEl).setName("\u81EA\u52A8\u63D0\u53D6\u5361\u7247").setDesc("\u4FDD\u5B58\u7B14\u8BB0\u65F6\u81EA\u52A8\u626B\u63CF\u5E76\u63D0\u53D6\u5355\u8BCD\u5361\u7247\u5230 deck.json").addToggle(
      (t) => t.setValue(this.plugin.settings.autoScan).onChange(async (v) => {
        this.plugin.settings.autoScan = v;
        await this.plugin.saveSettings();
        if (v) new import_obsidian5.Notice("\u2705 \u81EA\u52A8\u63D0\u53D6\u5DF2\u5F00\u542F\uFF0C\u4FDD\u5B58\u7B14\u8BB0\u65F6\u5C06\u81EA\u52A8\u626B\u63CF\u5361\u7247");
      })
    );
    new import_obsidian5.Setting(containerEl).setName("\u5185\u8054\u6807\u8BB0 #deck/xxx").setDesc("\u8BC6\u522B\u7B14\u8BB0\u4E2D\u7684 #deck/xxx \u6807\u8BB0\u4F5C\u4E3A\u5361\u7EC4\u6765\u6E90\uFF08\u6700\u9AD8\u4F18\u5148\u7EA7\uFF09").addToggle(
      (t) => t.setValue(this.plugin.settings.sourcePriority.inline).onChange(async (v) => {
        this.plugin.settings.sourcePriority.inline = v;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian5.Setting(containerEl).setName("Frontmatter decks").setDesc("\u4ECE YAML \u5934\u90E8\u7684 decks \u5B57\u6BB5\u8BFB\u53D6\u5361\u7EC4").addToggle(
      (t) => t.setValue(this.plugin.settings.sourcePriority.frontmatter).onChange(async (v) => {
        this.plugin.settings.sourcePriority.frontmatter = v;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian5.Setting(containerEl).setName("\u6587\u4EF6\u540D\u6620\u5C04").setDesc("\u6839\u636E\u7B14\u8BB0\u6240\u5728\u6587\u4EF6\u5939\u540D\u63A8\u65AD\u5361\u7EC4").addToggle(
      (t) => t.setValue(this.plugin.settings.sourcePriority.filename).onChange(async (v) => {
        this.plugin.settings.sourcePriority.filename = v;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian5.Setting(containerEl).setName("Tag \u6620\u5C04").setDesc("\u4ECE\u7B14\u8BB0\u6807\u7B7E\u63A8\u65AD\u5361\u7EC4\uFF08\u5982 #e \u2192 e \u5361\u7EC4\uFF0C\u6700\u4F4E\u4F18\u5148\u7EA7\uFF09").addToggle(
      (t) => t.setValue(this.plugin.settings.sourcePriority.tag).onChange(async (v) => {
        this.plugin.settings.sourcePriority.tag = v;
        await this.plugin.saveSettings();
      })
    );
    containerEl.createEl("h3", { text: "\u{1F4BE} \u6570\u636E\u7BA1\u7406" });
    new import_obsidian5.Setting(containerEl).setName("\u624B\u52A8\u626B\u63CF\u5F53\u524D\u7B14\u8BB0").setDesc("\u7ACB\u5373\u626B\u63CF\u5F53\u524D\u6253\u5F00\u7684\u7B14\u8BB0\uFF0C\u63D0\u53D6\u5361\u7247\u5230 deck.json").addButton(
      (btn) => btn.setButtonText("\u{1F50D} \u626B\u63CF").onClick(async () => {
        await this.plugin.scanActiveNote();
      })
    );
    new import_obsidian5.Setting(containerEl).setName("\u91CD\u65B0\u7EDF\u8BA1\u6240\u6709\u5361\u7EC4").setDesc("\u91CD\u65B0\u8BA1\u7B97\u6240\u6709\u5361\u7EC4\u7684\u7EDF\u8BA1\u6570\u636E\u548C\u719F\u7EC3\u5EA6").addButton(
      (btn) => btn.setButtonText("\u{1F4CA} \u5237\u65B0\u7EDF\u8BA1").onClick(async () => {
        await this.plugin.refreshStats();
      })
    );
    containerEl.createEl("h3", { text: "\u{1F916} AI \u8BBE\u7F6E" });
    new import_obsidian5.Setting(containerEl).setName("\u542F\u7528 AI \u8BC6\u5361").setDesc("\u5F00\u542F AI \u529F\u80FD\u540E\u53EF\u5728\u53F3\u4FA7\u680F\u4F7F\u7528 \u{1F916} AI\u8BC6\u5361 \u804A\u5929").addToggle(
      (t) => t.setValue(this.plugin.settings.aiSettings.enabled).onChange(async (v) => {
        this.plugin.settings.aiSettings.enabled = v;
        await this.plugin.saveSettings();
        this.plugin.aiService?.rebuild(this.plugin.settings.aiSettings);
      })
    );
    new import_obsidian5.Setting(containerEl).setName("API \u5730\u5740").setDesc("OpenAI \u517C\u5BB9\u63A5\u53E3\uFF08\u652F\u6301 DeepSeek / \u901A\u4E49\u5343\u95EE / Claude \u7B49\uFF09").addText(
      (t) => t.setValue(this.plugin.settings.aiSettings.baseUrl).setPlaceholder("https://api.openai.com/v1").onChange(async (v) => {
        this.plugin.settings.aiSettings.baseUrl = v;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian5.Setting(containerEl).setName("API Key").setDesc("\u4F60\u7684 API \u5BC6\u94A5").addText(
      (t) => t.setValue(this.plugin.settings.aiSettings.apiKey).setPlaceholder("sk-...").onChange(async (v) => {
        this.plugin.settings.aiSettings.apiKey = v;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian5.Setting(containerEl).setName("\u6A21\u578B").setDesc("\u6A21\u578B\u540D\u79F0\uFF08\u5982 gpt-4o-mini, deepseek-chat, qwen-turbo\uFF09").addText(
      (t) => t.setValue(this.plugin.settings.aiSettings.model).setPlaceholder("gpt-4o-mini").onChange(async (v) => {
        this.plugin.settings.aiSettings.model = v;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian5.Setting(containerEl).setName("\u6700\u5927 Token").setDesc("\u5355\u6B21\u54CD\u5E94\u6700\u5927\u957F\u5EA6").addSlider(
      (sl) => sl.setLimits(512, 8192, 512).setValue(this.plugin.settings.aiSettings.maxTokens).setDynamicTooltip().onChange(async (v) => {
        this.plugin.settings.aiSettings.maxTokens = v;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian5.Setting(containerEl).setName("\u6E29\u5EA6").setDesc("\u521B\u9020\u529B\u53C2\u6570").addSlider(
      (sl) => sl.setLimits(0, 200, 10).setValue(Math.round(this.plugin.settings.aiSettings.temperature * 100)).setDynamicTooltip().onChange(async (v) => {
        this.plugin.settings.aiSettings.temperature = v / 100;
        await this.plugin.saveSettings();
      })
    );
    containerEl.createEl("h3", { text: "\u{1F4DC} DSL \u89C4\u5219\u7BA1\u7406" });
    new import_obsidian5.Setting(containerEl).setName("\u7BA1\u7406 DSL \u89C4\u5219").setDesc("\u67E5\u770B\u5185\u7F6E\u89C4\u5219\u3001\u542F\u7528/\u7981\u7528\u3001\u81EA\u5B9A\u4E49\u89C4\u5219\u7BA1\u7406").addButton(
      (btn) => btn.setButtonText("\u{1F4DC} \u6253\u5F00\u89C4\u5219\u7BA1\u7406\u5668").onClick(() => {
        const registry = new DSLRegistry({ enableBuiltin: true });
        registry.initialize().then(() => {
          new DSLEditorModal(this.plugin.app, registry).open();
        });
      })
    );
  }
};
var RemiQuickView = class extends import_obsidian5.ItemView {
  plugin;
  widget = null;
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
  }
  getViewType() {
    return REMI_QUICK_VIEW_TYPE;
  }
  getDisplayText() {
    return "RemiFocus";
  }
  getIcon() {
    return "brain";
  }
  async onOpen() {
    const callbacks = {
      onStartQuickReview: () => {
        this.plugin.startReviewSession();
      },
      onOpenDashboard: () => {
        new DashboardModal(this.app, this.plugin.getEngine()).open();
      },
      onOpenModeSelector: () => {
        this.plugin.showModeSelector();
      },
      onOpenCardMaker: () => {
        if (this.plugin.cardMaker) this.plugin.cardMaker.toggle();
      },
      onOpenAIChat: () => {
        this.plugin.openAIChat();
      }
    };
    this.widget = new QuickView(this.contentEl, this.plugin.getEngine(), callbacks);
    await this.widget.render();
  }
  async onClose() {
    if (this.widget) {
      this.widget.destroy();
      this.widget = null;
    }
  }
};
var MainPopupModal = class extends import_obsidian5.Modal {
  engine;
  popup = null;
  constructor(app, engine) {
    super(app);
    this.engine = engine;
    this.titleEl.style.display = "none";
    this.modalEl.style.width = "90vw";
    this.modalEl.style.maxWidth = "720px";
    this.modalEl.style.borderRadius = "12px";
  }
  onOpen() {
    const callbacks = {
      onDeckClick: (name) => {
        this.close();
        new DeckDetailModal(this.app, this.engine, name).open();
      },
      onHomeClick: () => {
        this.close();
        new DashboardModal(this.app, this.engine).open();
      },
      onStartLearning: (name, mode) => {
        this.close();
        new SessionConfigModal(this.app, this.engine, name, mode).open();
      }
    };
    this.popup = new MainPopup(this.contentEl, this.engine, callbacks);
    this.popup.render();
  }
  onClose() {
    if (this.popup) {
      this.popup.destroy();
      this.popup = null;
    }
  }
};
var DashboardModal = class extends import_obsidian5.Modal {
  engine;
  dashboard = null;
  constructor(app, engine) {
    super(app);
    this.engine = engine;
    this.titleEl.style.display = "none";
    this.modalEl.style.width = "95vw";
    this.modalEl.style.maxWidth = "1000px";
    this.modalEl.style.height = "90vh";
    this.modalEl.style.borderRadius = "12px";
  }
  onOpen() {
    const callbacks = {
      onOpenDeck: () => {
        this.close();
        new MainPopupModal(this.app, this.engine).open();
      },
      onOpenPlan: () => {
        new import_obsidian5.Notice("\u{1F4C5} \u8BA1\u5212\u9875\u9762\u5373\u5C06\u4E0A\u7EBF");
      },
      onOpenAlgo: () => {
        new import_obsidian5.Notice("\u{1F4D0} \u7B97\u6CD5\u8BF4\u660E\u5373\u5C06\u4E0A\u7EBF");
      },
      onDeckClick: (name) => {
        this.close();
        new DeckDetailModal(this.app, this.engine, name).open();
      }
    };
    this.dashboard = new RemiDashboard(this.contentEl, this.engine, callbacks);
    this.dashboard.render();
  }
  onClose() {
    if (this.dashboard) {
      this.dashboard.destroy();
      this.dashboard = null;
    }
  }
};
var DeckDetailModal = class extends import_obsidian5.Modal {
  engine;
  deckName;
  deckModal = null;
  constructor(app, engine, deckName) {
    super(app);
    this.engine = engine;
    this.deckName = deckName;
    this.titleEl.setText(`\u{1F4C7} ${deckName}`);
  }
  onOpen() {
    const callbacks = {
      onBack: () => {
        this.close();
        new MainPopupModal(this.app, this.engine).open();
      },
      onStartLearning: (name, mode) => {
        this.close();
        new SessionConfigModal(this.app, this.engine, name, mode).open();
      }
    };
    this.deckModal = new DeckModal(this.contentEl, this.engine, this.deckName, callbacks);
    this.deckModal.render();
  }
  onClose() {
    if (this.deckModal) {
      this.deckModal.destroy();
      this.deckModal = null;
    }
  }
};
var SessionConfigModal = class extends import_obsidian5.Modal {
  engine;
  deckName;
  mode;
  configView = null;
  constructor(app, engine, deckName, mode) {
    super(app);
    this.engine = engine;
    this.deckName = deckName;
    this.mode = mode;
    const modeLabels = {
      exposure: "\u{1F441} Exposure",
      test: "\u{1F9EA} Test",
      review: "\u{1F504} Review"
    };
    this.titleEl.style.display = "none";
    this.modalEl.style.width = "480px";
    this.modalEl.style.maxWidth = "90vw";
    this.modalEl.style.borderRadius = "14px";
    this.modalEl.style.padding = "4px";
  }
  onOpen() {
    const callbacks = {
      onStart: (count) => {
        this.close();
        new SessionModal(this.app, this.engine, this.deckName, this.mode, count).open();
      },
      onCancel: () => {
        this.close();
        new DeckDetailModal(this.app, this.engine, this.deckName).open();
      }
    };
    this.configView = new SessionConfigView(
      this.contentEl,
      this.engine,
      this.deckName,
      this.mode,
      callbacks
    );
    this.configView.render();
  }
  onClose() {
    if (this.configView) {
      this.configView.destroy();
      this.configView = null;
    }
  }
};
var SessionModal = class extends import_obsidian5.Modal {
  engine;
  deckName;
  mode;
  sessionCount;
  session = null;
  constructor(app, engine, deckName, mode, sessionCount) {
    super(app);
    this.engine = engine;
    this.deckName = deckName;
    this.mode = mode;
    this.sessionCount = sessionCount ?? 20;
    const modeLabels = {
      exposure: "\u{1F441} Exposure",
      test: "\u{1F9EA} Test",
      review: "\u{1F504} Review"
    };
    this.titleEl.style.display = "none";
    this.modalEl.style.width = "85vw";
    this.modalEl.style.maxWidth = "650px";
    this.modalEl.style.height = "80vh";
    this.modalEl.style.maxHeight = "700px";
    this.modalEl.style.borderRadius = "14px";
    this.modalEl.style.padding = "4px";
  }
  onOpen() {
    const callbacks = {
      onComplete: () => {
        new import_obsidian5.Notice(`\u2705 ${this.deckName} \u5B66\u4E60\u5B8C\u6210\uFF01`);
        this.close();
      },
      onExit: () => {
        this.close();
      }
    };
    this.session = new SessionView(
      this.contentEl,
      this.engine,
      this.deckName,
      this.mode,
      callbacks,
      this.sessionCount
    );
    this.session.render();
  }
  onClose() {
    if (this.session) {
      this.session.destroy();
      this.session = null;
    }
  }
};
var RemiFocusPlugin = class extends import_obsidian5.Plugin {
  settings = DEFAULT_SETTINGS;
  engine = null;
  extractor = null;
  scanDebounce = null;
  cardMaker = null;
  aiService = null;
  // ─── 生命周期 ───
  async onload() {
    console.log("RemiFocus: loading plugin");
    await this.loadSettings();
    this.rebuildEngine();
    this.extractor = new CardExtractor();
    this.registerView(REMI_QUICK_VIEW_TYPE, (leaf) => new RemiQuickView(leaf, this));
    this.app.workspace.onLayoutReady(() => {
      if (this.app.workspace.getLeavesOfType(REMI_QUICK_VIEW_TYPE).length === 0) {
        this.app.workspace.getRightLeaf(false)?.setViewState({ type: REMI_QUICK_VIEW_TYPE, active: true });
      }
    });
    this.cardMaker = new FloatingToolbar({
      getActiveFilePath: () => this.app.workspace.getActiveFile()?.path ?? null,
      getExistingDecks: async () => {
        try {
          return await this.getEngine().getDeckNames();
        } catch {
          return [];
        }
      },
      onSave: async (cards, deckName, filePath) => {
        const storage = new ObsidianDeckStorage(this.app.vault.adapter, DECK_JSON_PATH);
        const data = await storage.load();
        const base = filePath.replace(/\.md$/i, "");
        let added = 0;
        for (const card of cards) {
          const word = card.word.toLowerCase().trim();
          if (!word) continue;
          const fullDeck = `${base}/${deckName}`;
          if (data.words[word]) {
            if (!data.words[word].deck.includes(fullDeck)) data.words[word].deck.push(fullDeck);
          } else {
            const e = { meaning: card.meaning, deck: [fullDeck], state: "new", ease: 250, interval: 0, next: null, history: [], priority: 1, source: "manual" };
            if (card.cloze?.length) e.cloze = card.cloze;
            data.words[word] = e;
            added++;
          }
        }
        await storage.save(data);
        new import_obsidian5.Notice(`\u2705 \u5236\u5361\u5668: \u4FDD\u5B58 ${added} \u5F20\u65B0\u5361\u7247`);
      }
    });
    this.aiService = new AIService(this.settings.aiSettings, this.engine ?? void 0);
    this.addSettingTab(new RemiFocusSettingTab(this.app, this));
    this.registerCommands();
    this.addRibbonIcon("brain", "RemiFocus - \u9009\u62E9\u5236\u5361\u6A21\u5F0F", () => {
      if (!this.engine) {
        new import_obsidian5.Notice("\u26A0\uFE0F RemiFocus \u5F15\u64CE\u672A\u521D\u59CB\u5316");
        return;
      }
      this.showModeSelector();
    });
    this.registerNoteScan();
    if (this.settings.autoScan) {
      this.checkRemindersOnStartup();
    }
    setTimeout(() => {
      const activeFile = this.app.workspace.getActiveFile();
      if (activeFile && activeFile.extension === "md" && this.settings.autoScan) {
        console.log("RemiFocus: scanning active file on startup:", activeFile.path);
        this.scanFile(activeFile);
      }
    }, 2e3);
    console.log("RemiFocus: plugin loaded");
  }
  onunload() {
    console.log("RemiFocus: unloading plugin");
    if (this.cardMaker) {
      this.cardMaker.destroy();
      this.cardMaker = null;
    }
    this.app.workspace.detachLeavesOfType(REMI_QUICK_VIEW_TYPE);
    this.engine = null;
    this.extractor = null;
  }
  // ─── 命令注册 ───
  registerCommands() {
    this.addCommand({
      id: "open-remifocus-popup",
      name: "\u6253\u5F00 RemiFocus \u5F39\u7A97",
      icon: "brain",
      callback: () => {
        if (!this.engine) {
          new import_obsidian5.Notice("\u26A0\uFE0F RemiFocus \u5F15\u64CE\u672A\u521D\u59CB\u5316");
          return;
        }
        new MainPopupModal(this.app, this.engine).open();
      }
    });
    this.addCommand({
      id: "open-remifocus-dashboard",
      name: "\u6253\u5F00 Remi OS \u4E3B\u9875",
      icon: "layout-dashboard",
      callback: () => {
        if (!this.engine) return;
        new DashboardModal(this.app, this.engine).open();
      }
    });
    this.addCommand({
      id: "start-remifocus-review",
      name: "\u5F00\u59CB\u4ECA\u65E5\u590D\u4E60",
      icon: "play",
      callback: async () => {
        await this.startReviewSession();
      }
    });
    this.addCommand({
      id: "scan-current-note",
      name: "\u626B\u63CF\u5F53\u524D\u7B14\u8BB0\u4E2D\u7684\u5361\u7247",
      icon: "search",
      callback: async () => {
        await this.scanActiveNote();
      }
    });
    this.addCommand({
      id: "toggle-card-maker",
      name: "\u5207\u6362\u5236\u5361\u5DE5\u5177\u680F",
      icon: "plus-with-circle",
      callback: () => {
        if (this.cardMaker) this.cardMaker.toggle();
      }
    });
    this.addCommand({
      id: "open-remifocus-ai-chat",
      name: "\u6253\u5F00 AI \u8BC6\u5361\u804A\u5929",
      icon: "bot",
      callback: () => {
        this.openAIChat();
      }
    });
  }
  // ─── AI 聊天 ───
  openAIChat() {
    if (!this.aiService) {
      new import_obsidian5.Notice("\u26A0\uFE0F AI \u670D\u52A1\u672A\u521D\u59CB\u5316");
      return;
    }
    new AIChatModal(
      this.app,
      this.aiService,
      this.settings.aiSettings,
      async (newSettings) => {
        this.settings.aiSettings = newSettings;
        await this.saveSettings();
        this.aiService?.rebuild(newSettings);
      }
    ).open();
  }
  // ─── 自动笔记扫描 ───
  registerNoteScan() {
    this.registerEvent(
      this.app.vault.on("modify", async (file) => {
        if (!this.settings.autoScan || !this.extractor) return;
        if (!(file instanceof import_obsidian5.TFile) || file.extension !== "md") return;
        if (this.scanDebounce) clearTimeout(this.scanDebounce);
        this.scanDebounce = setTimeout(() => {
          this.scanFile(file);
        }, 500);
      })
    );
    this.registerEvent(
      this.app.workspace.on("file-open", async (file) => {
        if (!this.settings.autoScan || !this.extractor) return;
        if (!file || file.extension !== "md") return;
        setTimeout(() => this.scanFile(file), 300);
      })
    );
    this.registerEvent(
      this.app.vault.on("delete", async (file) => {
        if (!(file instanceof import_obsidian5.TFile) || file.extension !== "md") return;
        const prefix = file.path.replace(/\.md$/i, "");
        const storage = new ObsidianDeckStorage(
          this.app.vault.adapter,
          DECK_JSON_PATH
        );
        const deckData = await storage.load();
        let changed = false;
        for (const [word, entry] of Object.entries(deckData.words)) {
          const before = entry.deck.length;
          entry.deck = entry.deck.filter((d) => !d.startsWith(prefix));
          if (entry.deck.length !== before) changed = true;
          if (entry.deck.length === 0) {
            delete deckData.words[word];
          }
        }
        if (changed) await storage.save(deckData);
      })
    );
  }
  /**
   * 扫描单个笔记文件，提取卡片
   */
  async scanFile(file) {
    const start = Date.now();
    try {
      const content = await this.app.vault.read(file);
      const filePath = file.path;
      console.log(`RemiFocus: scanFile start [${filePath}]`);
      if (!/^\s*[-*]\s+\S/m.test(content)) {
        console.log(`RemiFocus: no list items found in [${filePath}]`);
        return;
      }
      const result = this.extractor.extract(content, filePath);
      console.log(`RemiFocus: extract result [${filePath}]: ${result.cards.length} cards, ${result.groups.length} groups`);
      if (result.cards.length === 0) {
        console.log(`RemiFocus: no cards extracted from [${filePath}], type breakdown:`, result.stats.byType);
        return;
      }
      const deckNameForCard = (card) => {
        const base = card.sourceFile.replace(/\.md$/i, "");
        if (card.cardType === "big-cloze") return base;
        return `${base}/${card.group}`;
      };
      const storage = new ObsidianDeckStorage(
        this.app.vault.adapter,
        DECK_JSON_PATH
      );
      const deckData = await storage.load();
      let newCount = 0;
      let existingCount = 0;
      for (const card of result.cards) {
        const word = card.word.toLowerCase().trim();
        if (!word) continue;
        const deckName = deckNameForCard(card);
        if (deckData.words[word]) {
          const existing = deckData.words[word];
          if (!existing.deck.includes(deckName)) {
            existing.deck.push(deckName);
          }
          existingCount++;
        } else {
          const newEntry = {
            meaning: card.meaning,
            deck: [deckName],
            state: "new",
            ease: 250,
            interval: 0,
            next: null,
            history: []
          };
          if (card.cloze && card.cloze.length > 0) newEntry.cloze = card.cloze;
          if (card.mnemonic) newEntry.mnemonic = card.mnemonic;
          deckData.words[word] = newEntry;
          newCount++;
        }
      }
      if (newCount > 0 || existingCount > 0) {
        await storage.save(deckData);
        const groupSummary = Object.entries(result.stats.byGroup).map(([g, c]) => `${g}:${c}`).join(" ");
        new import_obsidian5.Notice(
          `\u{1F4DA} RemiFocus: \u65B0\u589E ${newCount} \u8BCD, \u66F4\u65B0 ${existingCount} \u8BCD
\u{1F4C2} ${groupSummary}`
        );
      }
    } catch (err) {
      console.error("RemiFocus: scan error", err);
    }
  }
  /**
   * 扫描当前活动笔记
   */
  async scanActiveNote() {
    const activeFile = this.app.workspace.getActiveFile();
    if (!activeFile) {
      new import_obsidian5.Notice("\u26A0\uFE0F \u6CA1\u6709\u6253\u5F00\u7684\u7B14\u8BB0");
      return;
    }
    if (activeFile.extension !== "md") {
      new import_obsidian5.Notice("\u26A0\uFE0F \u53EA\u652F\u6301 Markdown \u6587\u4EF6");
      return;
    }
    await this.scanFile(activeFile);
  }
  // ─── 启动提醒检查 ───
  async checkRemindersOnStartup() {
    if (!this.engine) return;
    const decks = await this.engine.getAllDeckInfos();
    const totalDue = decks.reduce((sum, d) => sum + d.dueCount, 0);
    if (totalDue >= this.settings.reminderThreshold) {
      new import_obsidian5.Notice(
        `\u26A0\uFE0F RemiFocus: \u4F60\u6709 ${totalDue} \u4E2A\u5355\u8BCD\u5F85\u590D\u4E60\uFF01
\u8D85\u8FC7\u63D0\u9192\u9608\u503C ${this.settings.reminderThreshold} \u8BCD`,
        8e3
      );
    } else if (totalDue > 0) {
      new import_obsidian5.Notice(`\u{1F4DA} RemiFocus: ${totalDue} \u4E2A\u5355\u8BCD\u5F85\u590D\u4E60`, 4e3);
    }
    const stats = await this.engine.getStats();
    if (stats.dueToday < this.settings.dailyGoal) {
      const remaining = this.settings.dailyGoal - stats.dueToday;
      if (remaining > 0) {
        new import_obsidian5.Notice(
          `\u{1F3AF} \u4ECA\u65E5\u76EE\u6807: ${this.settings.dailyGoal} \u8BCD | \u8FD8\u9700\u5B66\u4E60 ${remaining} \u8BCD`,
          5e3
        );
      }
    }
  }
  // ─── 刷新统计 ───
  async refreshStats() {
    new import_obsidian5.Notice("\u{1F4CA} RemiFocus: \u7EDF\u8BA1\u5DF2\u5237\u65B0");
    if (this.engine) {
      new DashboardModal(this.app, this.engine).open();
    }
  }
  // ─── 引擎管理 ───
  getEngine() {
    if (!this.engine) {
      throw new Error("RemiFocus engine not initialized");
    }
    return this.engine;
  }
  rebuildEngine() {
    const adapter = this.app.vault.adapter;
    const storage = new ObsidianDeckStorage(adapter, DECK_JSON_PATH);
    let scheduler;
    switch (this.settings.scheduler) {
      case "fsrs":
        scheduler = new FSRSScheduler();
        break;
      case "exam":
        scheduler = new ExamScheduler();
        break;
      case "fixed-interval":
        scheduler = new FixedIntervalScheduler();
        break;
      default:
        scheduler = new SM2Scheduler();
    }
    this.engine = new SessionManager(storage, scheduler, this.settings.queueSize);
    console.log(`RemiFocus: engine rebuilt (scheduler: ${this.settings.scheduler})`);
  }
  // ─── 三模式选择器 ───
  showModeSelector() {
    if (!this.engine) {
      new import_obsidian5.Notice("\u26A0\uFE0F RemiFocus \u5F15\u64CE\u672A\u521D\u59CB\u5316");
      return;
    }
    new ModeSelectorModal(this.app, {
      onSelectManual: () => {
        if (this.cardMaker) {
          this.cardMaker.toggle();
          new import_obsidian5.Notice("\u{1F9F1} \u624B\u52A8\u5236\u5361\u6A21\u5F0F\u5DF2\u5F00\u542F");
        } else {
          new import_obsidian5.Notice("\u26A0\uFE0F \u5236\u5361\u5DE5\u5177\u680F\u672A\u521D\u59CB\u5316");
        }
      },
      onSelectClassic: () => {
        new MainPopupModal(this.app, this.engine).open();
      },
      onSelectKU: () => {
        new import_obsidian5.Notice("\u{1F9E0} KU \u7CFB\u7EDF\u5373\u5C06\u4E0A\u7EBF\uFF0C\u656C\u8BF7\u671F\u5F85");
        new MainPopupModal(this.app, this.engine).open();
      },
      onQuickReview: () => {
        this.startReviewSession();
      }
    }).open();
  }
  // ─── 快速复习 ───
  async startReviewSession() {
    if (!this.engine) return;
    const decks = await this.engine.getAllDeckInfos();
    const dueDeck = decks.find((d) => d.dueCount > 0);
    if (!dueDeck) {
      new import_obsidian5.Notice("\u2705 \u6240\u6709\u5361\u7EC4\u5DF2\u5B8C\u6210\u590D\u4E60\uFF01");
      return;
    }
    new SessionModal(
      this.app,
      this.engine,
      dueDeck.name,
      this.settings.defaultMode
    ).open();
  }
  // ─── 设置持久化 ───
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }
};
