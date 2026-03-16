/**
 * API 配置管理 — 类型定义
 *
 * 用户自定义多个 API 服务商配置，每个配置包含 KEY、地址、模型列表。
 * 可在 PromptBar 中快速切换已保存的配置方案。
 */

// ─── 服务商类型 ─────────────────────────────────────────────────
export type ProviderType = 'banana' | 'google_veo' | 'openai_sora' | 'custom';

// ─── 模型项 ─────────────────────────────────────────────────────
export interface ModelItem {
  id: string;   // 如 "sora-1", "veo-2"
  name: string; // 显示名称
}

// ─── 单条 API 配置 ──────────────────────────────────────────────
export interface APIConfig {
  id: string;                                // UUID
  name: string;                              // 配置名称，如 "我的Sora"
  provider: ProviderType;                    // 服务商类型
  apiKey: string;                            // 用户输入的 API KEY（存储时 base64 混淆）
  apiBaseUrl: string;                        // API 基础地址
  models: ModelItem[];                       // 该 KEY 可调用的模型列表
  defaultModel: string;                      // 默认模型 id
  extraConfig?: Record<string, string>;      // 额外配置（如 Google 的 projectId）
  createdAt: number;
  updatedAt: number;
}

// ─── 服务商预设 ─────────────────────────────────────────────────
export interface ProviderPreset {
  name: string;
  baseUrl: string;
  headerKey: string;                         // 请求 header 名称
  models: ModelItem[];                       // 推荐模型
  extraFields: string[];                     // 需要用户额外输入的字段 key
}

export const PROVIDER_PRESETS: Record<ProviderType, ProviderPreset> = {
  banana: {
    name: 'Banana2',
    baseUrl: 'https://api.banana.dev/v2',
    headerKey: 'Banana-Api-Key',
    models: [
      { id: 'flux-video', name: 'Flux Video' },
      { id: 'banana-default', name: 'Banana Default' },
    ],
    extraFields: [],
  },
  google_veo: {
    name: 'Google Veo',
    baseUrl: 'https://vertexai.googleapis.com/v1',
    headerKey: 'Authorization',
    models: [
      { id: 'veo-2', name: 'Veo 2' },
      { id: 'veo-3', name: 'Veo 3' },
    ],
    extraFields: ['projectId'],
  },
  openai_sora: {
    name: 'OpenAI Sora',
    baseUrl: 'https://api.openai.com/v1',
    headerKey: 'Authorization',
    models: [
      { id: 'sora-1', name: 'Sora 1' },
      { id: 'sora-2', name: 'Sora 2' },
    ],
    extraFields: [],
  },
  custom: {
    name: '自定义',
    baseUrl: '',
    headerKey: 'Authorization',
    models: [],
    extraFields: [],
  },
};

// ─── Store 状态 ─────────────────────────────────────────────────
export interface APIConfigState {
  configs: APIConfig[];
  activeConfigId: string | null;
  activeModelId: string | null;
}

// ─── 视频生成请求 & 响应（供 api-client 使用）─────────────────
export interface VideoGenerationRequest {
  prompt: string;
  parameters?: Record<string, unknown>;
}

export interface VideoGenerationResponse {
  taskId?: string;
  status?: string;
  videoUrl?: string;
  [key: string]: unknown;
}
