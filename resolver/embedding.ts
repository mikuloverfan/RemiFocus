// RemiFocus — 向量嵌入服务
// 用 OpenAI 兼容 API 生成文本 embedding，用于语义搜索

export interface EmbeddingConfig {
  apiKey: string;
  baseUrl: string;       // 默认 https://api.openai.com/v1
  model: string;         // 默认 text-embedding-3-small
}

export class EmbeddingService {
  private config: EmbeddingConfig;

  constructor(config: EmbeddingConfig) {
    this.config = config;
  }

  /**
   * 为单个文本生成 embedding
   */
  async embed(text: string): Promise<Float32Array> {
    const response = await fetch(
      `${this.config.baseUrl}/embeddings`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          input: text,
          model: this.config.model,
        }),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Embedding API error: ${response.status} ${err}`);
    }

    const data = await response.json();
    const vector = data.data[0].embedding;
    return new Float32Array(vector);
  }

  /**
   * 批量生成 embedding（最多 100 条）
   */
  async embedBatch(texts: string[]): Promise<Float32Array[]> {
    const response = await fetch(
      `${this.config.baseUrl}/embeddings`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          input: texts,
          model: this.config.model,
        }),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Embedding API error: ${response.status} ${err}`);
    }

    const data = await response.json();
    return data.data.map((d: any) => new Float32Array(d.embedding));
  }

  /**
   * 计算余弦相似度
   */
  cosineSimilarity(a: Float32Array, b: Float32Array): number {
    if (a.length !== b.length) {
      throw new Error(`Dimension mismatch: ${a.length} vs ${b.length}`);
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom === 0 ? 0 : dotProduct / denom;
  }
}
