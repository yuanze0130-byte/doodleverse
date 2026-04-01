/**
 * aiGateway 单元测试 — 验证 inferProviderFromModel 模型名称→Provider 推断逻辑
 * 覆盖所有 7 个 provider：google, openai, anthropic, stability, qwen, banana, custom
 */
import { describe, it, expect } from 'vitest';
import { inferCapabilityFromModel, inferProviderFromModel, isGoogleImageEditModel, isGoogleTextToImageModel } from '../services/aiGateway';

describe('inferProviderFromModel', () => {
    it('识别 Google 模型', () => {
        expect(inferProviderFromModel('gemini-2.5-pro')).toBe('google');
        expect(inferProviderFromModel('imagen-4.0-generate-001')).toBe('google');
        expect(inferProviderFromModel('veo-2.0-generate-001')).toBe('google');
        expect(inferProviderFromModel('veo-3.1-fast-generate-preview')).toBe('google');
    });

    it('识别 OpenAI 模型', () => {
        expect(inferProviderFromModel('dall-e-3')).toBe('openai');
        expect(inferProviderFromModel('gpt-image-1')).toBe('openai');
        expect(inferProviderFromModel('gpt-4o')).toBe('openai');
    });

    it('识别 Anthropic 模型', () => {
        expect(inferProviderFromModel('claude-3-haiku-20240307')).toBe('anthropic');
        expect(inferProviderFromModel('claude-3.5-sonnet')).toBe('anthropic');
    });

    it('识别 Stability 模型', () => {
        expect(inferProviderFromModel('sdxl-turbo')).toBe('stability');
        expect(inferProviderFromModel('stable-diffusion-xl-1024')).toBe('stability');
    });

    it('识别 Qwen 模型', () => {
        expect(inferProviderFromModel('qwen-vl-plus')).toBe('qwen');
    });

    it('识别 Banana 模型', () => {
        expect(inferProviderFromModel('banana-vision-agent')).toBe('banana');
        expect(inferProviderFromModel('banana2-video-fast')).toBe('banana');
    });

    it('推断模型能力', () => {
        expect(inferCapabilityFromModel('gemini-2.5-pro')).toBe('text');
        expect(inferCapabilityFromModel('gemini-2.5-flash-image')).toBe('image');
        expect(inferCapabilityFromModel('imagen-4.0-generate-001')).toBe('image');
        expect(inferCapabilityFromModel('veo-3.1-fast-generate-preview')).toBe('video');
        expect(inferCapabilityFromModel('banana2-video-fast')).toBe('agent');
    });

    it('识别 Google 图片模型类型', () => {
        expect(isGoogleImageEditModel('gemini-2.5-flash-image')).toBe(true);
        expect(isGoogleImageEditModel('imagen-4.0-generate-001')).toBe(false);
        expect(isGoogleTextToImageModel('imagen-4.0-generate-001')).toBe(true);
        expect(isGoogleTextToImageModel('gemini-2.5-flash-image')).toBe(false);
    });

    it('未知模型回退到 custom', () => {
        expect(inferProviderFromModel('some-unknown-model')).toBe('custom');
        expect(inferProviderFromModel('')).toBe('custom');
    });
});
