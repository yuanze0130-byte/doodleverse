/**
 * API 配置 Store — 增删改查 + localStorage 持久化
 *
 * 纯 React hooks 实现（不依赖 zustand），与项目其余状态管理方式一致。
 * API KEY 在 localStorage 中做 base64 混淆存储。
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { APIConfig, APIConfigState, ModelItem, ProviderType, PROVIDER_PRESETS } from '../types/api-config';

// ─── localStorage Keys ──────────────────────────────────────────
const STORAGE_KEY = 'apiConfigs.v2';

// ─── base64 混淆工具 ────────────────────────────────────────────
function obfuscate(plain: string): string {
  try {
    return btoa(unescape(encodeURIComponent(plain)));
  } catch {
    return plain;
  }
}

function deobfuscate(encoded: string): string {
  try {
    return decodeURIComponent(escape(atob(encoded)));
  } catch {
    return encoded;
  }
}

// ─── 序列化 / 反序列化 ─────────────────────────────────────────
function serialize(state: APIConfigState): string {
  const safe: APIConfigState = {
    ...state,
    configs: state.configs.map(c => ({ ...c, apiKey: obfuscate(c.apiKey) })),
  };
  return JSON.stringify(safe);
}

function deserialize(raw: string): APIConfigState {
  const parsed = JSON.parse(raw) as APIConfigState;
  return {
    ...parsed,
    configs: (parsed.configs || []).map(c => ({ ...c, apiKey: deobfuscate(c.apiKey) })),
  };
}

function loadState(): APIConfigState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { configs: [], activeConfigId: null, activeModelId: null };
    return deserialize(raw);
  } catch {
    return { configs: [], activeConfigId: null, activeModelId: null };
  }
}

// ─── UUID 生成 ──────────────────────────────────────────────────
function uuid(): string {
  return 'cfg_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

// ─── Hook ───────────────────────────────────────────────────────
export function useAPIConfigStore() {
  const [state, setState] = useState<APIConfigState>(loadState);

  // 持久化
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, serialize(state));
  }, [state]);

  // ── 查询 ──────────────────────────────────────────────────────
  const configs = state.configs;
  const activeConfigId = state.activeConfigId;
  const activeModelId = state.activeModelId;

  const activeConfig = useMemo(
    () => configs.find(c => c.id === activeConfigId) ?? null,
    [configs, activeConfigId],
  );

  const activeModels = useMemo<ModelItem[]>(
    () => activeConfig?.models ?? [],
    [activeConfig],
  );

  // ── 创建 ──────────────────────────────────────────────────────
  const addConfig = useCallback((draft: Omit<APIConfig, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = Date.now();
    const newConfig: APIConfig = {
      ...draft,
      id: uuid(),
      createdAt: now,
      updatedAt: now,
    };
    setState(prev => {
      const next: APIConfigState = {
        ...prev,
        configs: [...prev.configs, newConfig],
      };
      // 第一条自动激活
      if (!prev.activeConfigId) {
        next.activeConfigId = newConfig.id;
        next.activeModelId = newConfig.defaultModel || newConfig.models[0]?.id || null;
      }
      return next;
    });
    return newConfig.id;
  }, []);

  // ── 更新 ──────────────────────────────────────────────────────
  const updateConfig = useCallback((id: string, patch: Partial<Omit<APIConfig, 'id' | 'createdAt'>>) => {
    setState(prev => ({
      ...prev,
      configs: prev.configs.map(c =>
        c.id === id ? { ...c, ...patch, updatedAt: Date.now() } : c,
      ),
    }));
  }, []);

  // ── 删除 ──────────────────────────────────────────────────────
  const deleteConfig = useCallback((id: string) => {
    setState(prev => {
      const next = prev.configs.filter(c => c.id !== id);
      const wasActive = prev.activeConfigId === id;
      return {
        configs: next,
        activeConfigId: wasActive ? (next[0]?.id ?? null) : prev.activeConfigId,
        activeModelId: wasActive ? (next[0]?.defaultModel ?? next[0]?.models[0]?.id ?? null) : prev.activeModelId,
      };
    });
  }, []);

  // ── 激活配置 ──────────────────────────────────────────────────
  const setActiveConfig = useCallback((id: string) => {
    setState(prev => {
      const cfg = prev.configs.find(c => c.id === id);
      return {
        ...prev,
        activeConfigId: id,
        activeModelId: cfg?.defaultModel || cfg?.models[0]?.id || null,
      };
    });
  }, []);

  // ── 激活模型 ──────────────────────────────────────────────────
  const setActiveModel = useCallback((modelId: string) => {
    setState(prev => ({ ...prev, activeModelId: modelId }));
  }, []);

  return {
    configs,
    activeConfigId,
    activeModelId,
    activeConfig,
    activeModels,
    addConfig,
    updateConfig,
    deleteConfig,
    setActiveConfig,
    setActiveModel,
  } as const;
}

export type APIConfigStore = ReturnType<typeof useAPIConfigStore>;
