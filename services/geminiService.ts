/**
 * ============================================
 * Gemini AI 服务 (Gemini Service) — 中转站兼容版
 * ============================================
 * 
 * 改造说明：
 * - 原版使用 @google/genai SDK，内部硬编码 Google 官方域名，无法走中转站
 * - 新版改用原生 fetch，完整支持自定义 baseUrl（中转站地址）
 * - 所有函数签名保持不变，对外接口兼容
 */

import type { PromptEnhanceRequest, PromptEnhanceResult } from "../types";

// 从环境变量获取默认 API Key（低优先级，仅作兜底）
const ENV_API_KEY = process.env.API_KEY;

// ============ Runtime Config（由 App.tsx 注入，来自用户设置） ============
let runtimeConfig: {
  textApiKey?: string;
  imageApiKey?: string;
  videoApiKey?: string;
  textBaseUrl?: string;   // ← 新增：中转站地址
  imageBaseUrl?: string;  // ← 新增
  videoBaseUrl?: string;  // ← 新增
  textModel?: string;
  imageModel?: string;
  textToImageModel?: string;
  videoModel?: string;
} = {};

export function setGeminiRuntimeConfig(config: {
  textApiKey?: string;
  imageApiKey?: string;
  videoApiKey?: string;
  textBaseUrl?: string;   // ← 新增
  imageBaseUrl?: string;  // ← 新增
  videoBaseUrl?: string;  // ← 新增
  textModel?: string;
  imageModel?: string;
  textToImageModel?: string;
  videoModel?: string;
}) {
  runtimeConfig = { ...runtimeConfig, ...config };
}

// ============ Google 官方默认 baseUrl（无中转站时使用） ============
const GOOGLE_BASE_URL = "https://generativelanguage.googleapis.com";

/**
 * 获取 API Key，按优先级：显式传入 > runtimeConfig > 环境变量
 */
function getApiKey(
  capability: "text" | "image" | "video" = "text",
  explicitKey?: string
): string {
  if (explicitKey) return explicitKey;
  const scopedKey =
    capability === "text"
      ? runtimeConfig.textApiKey
      : capability === "image"
      ? runtimeConfig.imageApiKey
      : runtimeConfig.videoApiKey;
  const key =
    scopedKey ||
    runtimeConfig.textApiKey ||
    runtimeConfig.imageApiKey ||
    runtimeConfig.videoApiKey ||
    ENV_API_KEY;
  if (!key) {
    throw new Error(
      "未配置 API Key。请在设置 → API Keys 中添加你的 Key（支持中转站），" +
      "或在 .env.local 中设置 API_KEY=xxx 后重启服务。"
    );
  }
  return key;
}

/**
 * 获取 baseUrl，按优先级：runtimeConfig（用户填写的中转站）> Google 官方
 */
function getBaseUrl(
  capability: "text" | "image" | "video" = "text",
  explicitBaseUrl?: string
): string {
  if (explicitBaseUrl) return explicitBaseUrl.replace(/\/$/, "");
  const scopedUrl =
    capability === "text"
      ? runtimeConfig.textBaseUrl
      : capability === "image"
      ? runtimeConfig.imageBaseUrl
      : runtimeConfig.videoBaseUrl;
  return (
    scopedUrl ||
    runtimeConfig.textBaseUrl ||
    runtimeConfig.imageBaseUrl ||
    runtimeConfig.videoBaseUrl ||
    GOOGLE_BASE_URL
  ).replace(/\/$/, "");
}

/**
 * 统一的 Gemini REST 请求函数（用 fetch 替代 SDK）
 * 
 * Google 官方格式：
 *   POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key=xxx
 * 
 * 中转站格式（OpenAI 兼容 / Google 格式各异，这里兼容两种）：
 *   POST https://your-relay.com/v1beta/models/{model}:generateContent  (Header: Authorization: Bearer xxx)
 */
async function geminiPost(
  path: string,       // 例如 "/v1beta/models/gemini-3-flash-preview:generateContent"
  body: object,
  capability: "text" | "image" | "video",
  explicitKey?: string,
  explicitBaseUrl?: string
): Promise<unknown> {
  const apiKey = getApiKey(capability, explicitKey);
  const baseUrl = getBaseUrl(capability, explicitBaseUrl);
  const isOfficialGoogle = baseUrl.includes("googleapis.com");

  // 官方 Google API：key 放 query string
  // 中转站：key 放 Authorization header（更安全，且大多数中转站支持）
  const url = isOfficialGoogle
    ? `${baseUrl}${path}?key=${encodeURIComponent(apiKey)}`
    : `${baseUrl}${path}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (!isOfficialGoogle) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let msg = `HTTP ${res.status}`;
    try {
      const json = JSON.parse(text);
      msg = json?.error?.message || msg;
    } catch {}
    // 友好错误提示
    if (res.status === 401 || res.status === 403) {
      throw new Error(`API Key 无效或权限不足 (${res.status})：${msg}`);
    }
    if (res.status === 429) {
      throw new Error(`调用配额已用完 (429)，请稍后重试或更换 Key。`);
    }
    throw new Error(`Gemini API 请求失败 (${res.status}): ${msg}`);
  }

  return res.json();
}

// ============ API Key 验证 ============

export async function validateGeminiApiKey(
  apiKey: string
): Promise<{ ok: boolean; message?: string }> {
  try {
    const baseUrl = getBaseUrl("text");
    const isOfficialGoogle = baseUrl.includes("googleapis.com");
    const url = isOfficialGoogle
      ? `${baseUrl}/v1beta/models?key=${encodeURIComponent(apiKey)}&pageSize=1`
      : `${baseUrl}/v1beta/models`;
    const headers: Record<string, string> = {};
    if (!isOfficialGoogle) {
      headers["Authorization"] = `Bearer ${apiKey}`;
    }
    const res = await fetch(url, { headers });
    if (res.ok) return { ok: true };
    const body = await res.json().catch(() => ({}));
    return {
      ok: false,
      message: body?.error?.message || `HTTP ${res.status}`,
    };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "网络错误",
    };
  }
}

// ============ 工具函数 ============

function safeParseEnhanceJson(
  raw: string,
  fallbackPrompt: string
): PromptEnhanceResult {
  const defaultResult: PromptEnhanceResult = {
    enhancedPrompt: fallbackPrompt,
    negativePrompt: "",
    suggestions: [],
    notes: raw || "No response content returned by model.",
  };
  if (!raw) return defaultResult;
  const clean = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```/i, "")
    .replace(/```$/i, "")
    .trim();
  try {
    const parsed = JSON.parse(clean) as Partial<PromptEnhanceResult>;
    return {
      enhancedPrompt: parsed.enhancedPrompt?.trim() || fallbackPrompt,
      negativePrompt: parsed.negativePrompt?.trim() || "",
      suggestions: Array.isArray(parsed.suggestions)
        ? parsed.suggestions.filter(Boolean).slice(0, 8)
        : [],
      notes: parsed.notes?.trim() || "",
    };
  } catch {
    return defaultResult;
  }
}

// ============ 提示词润色 ============

export async function enhancePromptWithGemini(
  request: PromptEnhanceRequest,
  apiKey?: string,
  baseUrl?: string  // ← 新增参数
): Promise<PromptEnhanceResult> {
  const modeHintMap: Record<PromptEnhanceRequest["mode"], string> = {
    smart: "Do intelligent enhancement with richer cinematic details, composition, and lighting.",
    style: `Rewrite with strong style intent. Preferred style preset: ${request.stylePreset || "cinematic"}.`,
    precise: "Preserve user intent strictly; only optimize clarity and structure.",
    translate: "Translate and optimize prompt for model friendliness while preserving semantics.",
  };

  const systemPrompt = [
    "You are a professional prompt engineer for image/video generation.",
    "Return ONLY valid JSON with keys: enhancedPrompt, negativePrompt, suggestions, notes.",
    "Keep enhancedPrompt concise but vivid, no markdown.",
    "negativePrompt should be a comma-separated phrase list.",
    "suggestions should be short keyword phrases.",
    modeHintMap[request.mode],
  ].join("\n");

  const model = runtimeConfig.textModel || "gemini-3-flash-preview";

  try {
    const data = (await geminiPost(
      `/v1beta/models/${model}:generateContent`,
      {
        contents: {
          parts: [{ text: `${systemPrompt}\n\nUser prompt:\n${request.prompt}` }],
        },
      },
      "text",
      apiKey,
      baseUrl
    )) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };

    const raw =
      data?.candidates?.[0]?.content?.parts
        ?.map((p) => p.text || "")
        .join("\n")
        .trim() || "";

    return safeParseEnhanceJson(raw, request.prompt);
  } catch (error) {
    console.error("enhancePromptWithGemini error:", error);
    throw error instanceof Error ? error : new Error("润色提示词时发生未知错误。");
  }
}

// ============ 图像编辑（AI 改图） ============

type ImageInput = {
  href: string;
  mimeType: string;
};

export async function editImage(
  images: ImageInput[],
  prompt: string,
  mask?: ImageInput,
  apiKey?: string,
  baseUrl?: string  // ← 新增参数
): Promise<{
  newImageBase64: string | null;
  newImageMimeType: string | null;
  textResponse: string | null;
}> {
  const imageParts = images.map((image) => {
    const b64 = image.href.includes(",") ? image.href.split(",")[1] : image.href;
    return { inlineData: { data: b64, mimeType: image.mimeType } };
  });

  const maskPart = mask
    ? {
        inlineData: {
          data: mask.href.includes(",") ? mask.href.split(",")[1] : mask.href,
          mimeType: mask.mimeType,
        },
      }
    : null;

  const textPart = { text: prompt };
  const parts = maskPart
    ? [textPart, ...imageParts, maskPart]
    : [...imageParts, textPart];

  const model = runtimeConfig.imageModel || "gemini-3.1-flash-image-preview";

  try {
    const data = (await geminiPost(
      `/v1beta/models/${model}:generateContent`,
      {
        contents: { parts },
        generationConfig: { responseModalities: ["IMAGE", "TEXT"] },
      },
      "image",
      apiKey,
      baseUrl
    )) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{
            inlineData?: { data: string; mimeType: string };
            text?: string;
          }>;
        };
        finishReason?: string;
      }>;
    };

    let newImageBase64: string | null = null;
    let newImageMimeType: string | null = null;
    let textResponse: string | null = null;

    const responseParts = data?.candidates?.[0]?.content?.parts || [];
    for (const part of responseParts) {
      if (part.inlineData) {
        newImageBase64 = part.inlineData.data;
        newImageMimeType = part.inlineData.mimeType;
      } else if (part.text) {
        textResponse = part.text;
      }
    }

    if (!newImageBase64) {
      const reason = data?.candidates?.[0]?.finishReason || "unknown";
      textResponse =
        textResponse ||
        `AI 未生成图片（原因：${reason}），请换一个提示词试试。`;
    }

    return { newImageBase64, newImageMimeType, textResponse };
  } catch (error) {
    console.error("editImage error:", error);
    throw error instanceof Error ? error : new Error("调用图像编辑 API 时发生未知错误。");
  }
}

// ============ 文本生成图像（Imagen） ============

export async function generateImageFromText(
  prompt: string,
  apiKey?: string,
  baseUrl?: string
): Promise<{
  newImageBase64: string | null;
  newImageMimeType: string | null;
  textResponse: string | null;
}> {
  const model = runtimeConfig.textToImageModel || runtimeConfig.imageModel || "gemini-3.1-flash-image-preview";
  const isImagenModel = /^imagen/i.test(model);

  try {
    if (isImagenModel) {
      // Imagen 模型：用 :predict 接口
      const data = (await geminiPost(
        `/v1beta/models/${model}:predict`,
        {
          instances: [{ prompt }],
          parameters: { sampleCount: 1, mimeType: "image/png" },
        },
        "image",
        apiKey,
        baseUrl
      )) as {
        predictions?: Array<{ bytesBase64Encoded?: string; mimeType?: string }>;
      };

      const prediction = data?.predictions?.[0];
      if (prediction?.bytesBase64Encoded) {
        return {
          newImageBase64: prediction.bytesBase64Encoded,
          newImageMimeType: prediction.mimeType || "image/png",
          textResponse: null,
        };
      }
    } else {
      // Gemini 模型：用 :generateContent 接口
      const data = (await geminiPost(
        `/v1beta/models/${model}:generateContent`,
        {
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseModalities: ["IMAGE", "TEXT"] },
        },
        "image",
        apiKey,
        baseUrl
      )) as {
        candidates?: Array<{
          content?: {
            parts?: Array<{
              inlineData?: { data: string; mimeType: string };
              text?: string;
            }>;
          };
          finishReason?: string;
        }>;
      };

      const parts = data?.candidates?.[0]?.content?.parts || [];
      let newImageBase64: string | null = null;
      let newImageMimeType: string | null = null;
      let textResponse: string | null = null;

      for (const part of parts) {
        if (part.inlineData) {
          newImageBase64 = part.inlineData.data;
          newImageMimeType = part.inlineData.mimeType;
        } else if (part.text) {
          textResponse = part.text;
        }
      }

      if (newImageBase64) {
        return { newImageBase64, newImageMimeType, textResponse };
      }

      const reason = data?.candidates?.[0]?.finishReason || "unknown";
      return {
        newImageBase64: null,
        newImageMimeType: null,
        textResponse: textResponse || `AI 未生成图片（原因：${reason}），请换一个提示词试试。`,
      };
    }

    return {
      newImageBase64: null,
      newImageMimeType: null,
      textResponse: "AI 未生成图片，请换一个提示词试试。",
    };
  } catch (error) {
    console.error("generateImageFromText error:", error);
    throw error instanceof Error ? error : new Error("调用文本生图 API 时发生未知错误。");
  }
}


// ============ 视频生成（Veo） ============

export async function generateVideo(
  prompt: string,
  aspectRatio: "16:9" | "9:16",
  onProgress: (message: string) => void,
  image?: ImageInput,
  apiKey?: string,
  baseUrl?: string  // ← 新增参数
): Promise<{ videoBlob: Blob; mimeType: string }> {
  const resolvedKey = getApiKey("video", apiKey);
  const resolvedBaseUrl = getBaseUrl("video", baseUrl);
  const isOfficialGoogle = resolvedBaseUrl.includes("googleapis.com");
  const model = runtimeConfig.videoModel || "veo-3.1-generate-preview";

  onProgress("正在初始化视频生成...");

  // 构建请求 body
  const requestBody: Record<string, unknown> = {
    instances: [
      {
        prompt,
        ...(image
          ? {
              image: {
                imageBytes: image.href.includes(",")
                  ? image.href.split(",")[1]
                  : image.href,
                mimeType: image.mimeType,
              },
            }
          : {}),
      },
    ],
    parameters: { aspectRatio, sampleCount: 1 },
  };

  // 提交任务
  const submitUrl = isOfficialGoogle
    ? `${resolvedBaseUrl}/v1beta/models/${model}:predictLongRunning?key=${encodeURIComponent(resolvedKey)}`
    : `${resolvedBaseUrl}/v1beta/models/${model}:predictLongRunning`;

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (!isOfficialGoogle) headers["Authorization"] = `Bearer ${resolvedKey}`;

  const submitRes = await fetch(submitUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(requestBody),
  });

  if (!submitRes.ok) {
    const text = await submitRes.text().catch(() => "");
    throw new Error(`视频生成任务提交失败 (${submitRes.status}): ${text}`);
  }

  const operation = (await submitRes.json()) as { name?: string; done?: boolean; error?: { message: string }; response?: { generatedSamples?: Array<{ video?: { uri?: string } }> } };

  if (!operation.name) {
    throw new Error("视频生成任务提交后未返回操作 ID，请检查中转站是否支持视频生成。");
  }

  onProgress("视频生成已提交，正在排队中...");

  // 轮询进度
  const progressMessages = [
    "正在渲染帧...",
    "正在合成视频...",
    "后期处理中...",
    "即将完成...",
  ];
  let msgIndex = 0;
  let currentOperation = operation;

  while (!currentOperation.done) {
    await new Promise((r) => setTimeout(r, 10000));
    onProgress(progressMessages[msgIndex % progressMessages.length]);
    msgIndex++;

    const pollUrl = isOfficialGoogle
      ? `${resolvedBaseUrl}/v1beta/${currentOperation.name}?key=${encodeURIComponent(resolvedKey)}`
      : `${resolvedBaseUrl}/v1beta/${currentOperation.name}`;

    const pollRes = await fetch(pollUrl, { headers });
    if (!pollRes.ok) {
      const text = await pollRes.text().catch(() => "");
      throw new Error(`轮询视频状态失败 (${pollRes.status}): ${text}`);
    }
    currentOperation = await pollRes.json();
  }

  if (currentOperation.error) {
    throw new Error(`视频生成失败：${currentOperation.error.message}`);
  }

  const videoUri =
    currentOperation.response?.generatedSamples?.[0]?.video?.uri;
  if (!videoUri) {
    throw new Error("视频生成完成，但未返回下载链接。");
  }

  onProgress("正在下载生成的视频...");
  const videoRes = await fetch(videoUri, {
    headers: isOfficialGoogle
      ? { "x-goog-api-key": resolvedKey }
      : { Authorization: `Bearer ${resolvedKey}` },
  });

  if (!videoRes.ok) {
    throw new Error(`视频文件下载失败 (${videoRes.status}): ${videoRes.statusText}`);
  }

  const videoBlob = await videoRes.blob();
  const mimeType = videoRes.headers.get("Content-Type") || "video/mp4";
  return { videoBlob, mimeType };
}
