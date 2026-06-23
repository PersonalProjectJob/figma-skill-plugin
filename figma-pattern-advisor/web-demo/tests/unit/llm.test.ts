import { describe, it, expect, vi } from 'vitest';
import { callChatAPI, type LLMConfig } from '../../src/plugin-ui/utils/llm';

describe('llm.ts (Layer 2 API Layer)', () => {
  it('callChatAPI handles missing fetch or network error gracefully', async () => {
    // Mock fetch to throw
    global.fetch = vi.fn().mockRejectedValue(new Error('Network disconnected'));

    const config: LLMConfig = {
      provider: 'openai',
      baseUrl: '',
      model: 'gpt-4o',
      apiKey: 'test-key'
    };

    const res = await callChatAPI([{ role: 'user', content: 'hello' }], config);
    expect(res.text).toBeNull();
    expect(res.error).toContain('Network disconnected');
  });
});
