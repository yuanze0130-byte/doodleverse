/**
 * 联网模型拉取服务
 * 通过 API Key 调用各 Provider 的接口获取可用模型列表。
 * 优先支持：Google Gemini、DeepSeek、OpenAI 及兼容接口。
 */

import type { AIProvider, AICapability } from '../types';

export interface FetchedModel {
    id: string;
    name: string;
    capability: AICapability;
    description?: string;
}

export interface FetchModelsResult {
    ok: boolean;
    models: FetchedModel[];
    error?: string;
}

// ── Capability 推断规则 ─────────────────────────────
function inferCapability(modelId: string): AICapability {
    const id = modelId.toLowerCase();
    if (/^veo|video/.test(id)) return 'video';
    if (/^imagen|image-generation|dall-e|gpt-image|stable-diffusion|sdxl|flux|midjourney/.test(id)) return 'image';
    if (/image/.test(id) && /gemini/.test(id)) return 'image';
    return 'text';
}

// ── Google Gemini ──────────────────────────────────
async function fetchGoogleModels(apiKey: string, baseUrl?: string): Promise<FetchModelsResult> {
    try {
        const base = (baseUrl || 'https://generativelanguage.googleapis.com/v1beta').replace(/\/+$/, '');
        const url = `${base}/models?key=${encodeURIComponent(apiKey)}`;
        const res = await fetch(url);
        if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            return { ok: false, models: [], error: body?.error?.message || `HTTP ${res.status}` };
        }
        const data = await res.json();
        const models: FetchedModel[] = (data.models || [])
            .filter((m: any) => {
                const name: string = m.name || '';
                // 只保留有实用能力的模型，排除 embedding/AQA 等
                return !(/embed|aqa|retrieval|attribution/i.test(name));
            })
            .map((m: any) => {
                const id = (m.name || '').replace(/^models\//, '');
                const methods: string[] = m.supportedGenerationMethods || [];
                let capability: AICapability = 'text';
                if (methods.includes('generateImages') || /imagen/i.test(id)) {
                    capability = 'image';
                } else if (/veo/i.test(id)) {
                    capability = 'video';
                } else if (/image/i.test(id) && /gemini/i.test(id)) {
                    capability = 'image';
                }
                return {
                    id,
                    name: m.displayName || id,
                    capability,
                    description: m.description?.slice(0, 120),
                };
            });
        return { ok: true, models };
    } catch (err) {
        return { ok: false, models: [], error: err instanceof Error ? err.message : '网络错误' };
    }
}

// ── OpenAI / 兼容接口（DeepSeek、SiliconFlow、Qwen 等）──
async function fetchOpenAICompatibleModels(
    apiKey: string,
    baseUrl: string,
    provider: AIProvider
): Promise<FetchModelsResult> {
    try {
        const url = `${baseUrl.replace(/\/+$/, '')}/models`;
        const res = await fetch(url, {
            headers: { Authorization: `Bearer ${apiKey}` },
        });
        if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            return { ok: false, models: [], error: body?.error?.message || `HTTP ${res.status}` };
        }
        const data = await res.json();
        const rawModels: any[] = data.data || data.models || [];
        const models: FetchedModel[] = rawModels
            .filter((m: any) => {
                const id: string = m.id || '';
                // 排除明显的非生成模型
                return !(/embed|whisper|tts|moderation|babbage|davinci-002/i.test(id));
            })
            .map((m: any) => {
                const id = m.id || '';
                return {
                    id,
                    name: id,
                    capability: inferCapability(id),
                };
            });
        return { ok: true, models };
    } catch (err) {
        return { ok: false, models: [], error: err instanceof Error ? err.message : '网络错误' };
    }
}

// ── Provider 默认 Base URL ──────────────────────────
const PROVIDER_BASE_URLS: Partial<Record<AIProvider, string>> = {
    openai: 'https://api.openai.com/v1',
    deepseek: 'https://api.deepseek.com/v1',
    siliconflow: 'https://api.siliconflow.cn/v1',
    qwen: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
};

// ── 主入口 ──────────────────────────────────────────
export async function fetchModelsForProvider(
    provider: AIProvider,
    apiKey: string,
    baseUrl?: string
): Promise<FetchModelsResult> {
    if (provider === 'google') {
        return fetchGoogleModels(apiKey, baseUrl);
    }

    // OpenAI 兼容类
    if (['openai', 'deepseek', 'siliconflow', 'qwen', 'custom'].includes(provider)) {
        const url = baseUrl || PROVIDER_BASE_URLS[provider];
        if (!url) {
            return { ok: false, models: [], error: '未指定 Base URL' };
        }
        return fetchOpenAICompatibleModels(apiKey, url, provider);
    }

    // 其他 Provider 无法联网拉取，返回空（使用内置列表）
    return { ok: true, models: [] };
}

// ── 免费 Key 申请链接 ───────────────────────────────
export const FREE_KEY_LINKS: { provider: AIProvider; label: string; url: string; description: string }[] = [
    {
        provider: 'google',
        label: 'Google AI Studio',
        url: 'https://aistudio.google.com/apikey',
        description: '免费额度：每分钟 15 次请求，支持 Gemini 和 Imagen 模型',
    },
    {
        provider: 'deepseek',
        label: 'DeepSeek 开放平台',
        url: 'https://platform.deepseek.com/api_keys',
        description: '注册即送 500 万 Tokens，DeepSeek-V3 和 DeepSeek-R1',
    },
    {
        provider: 'siliconflow',
        label: 'SiliconFlow 硅基流动',
        url: 'https://cloud.siliconflow.cn/account/ak',
        description: '注册即送 14 元额度，支持多种开源模型',
    },
];
