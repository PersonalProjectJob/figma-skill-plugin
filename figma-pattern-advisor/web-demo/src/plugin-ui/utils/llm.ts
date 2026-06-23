import type { FigmaContext, MatchResult } from './matcher';

export interface LLMConfig {
  provider: 'gemini' | 'openai' | 'anthropic' | 'deepseek' | 'custom';
  baseUrl: string;
  model: string;
  apiKey: string;
}

export async function callLLMAPI(context: FigmaContext, config: LLMConfig): Promise<MatchResult | null> {
  const prompt = `
You are an expert Design System Pattern Advisor.
Your job is to analyze the following extracted context from a Figma selection and recommend the most appropriate UI design pattern.
Respond ONLY with a valid JSON object matching the following schema exactly (no markdown formatting, no backticks, just raw JSON).

Schema:
{
  "patternId": "string (e.g. pattern.form.submission)",
  "name": "string (Human readable pattern name)",
  "version": "string (e.g. 1.0.0)",
  "confidence": number (0 to 100),
  "requiredAnatomy": ["string", "string"],
  "antiPatterns": ["string", "string"],
  "explanation": "string (Why you recommended this)"
}

Figma Context:
- Node Names: ${context.nodeNames.join(', ') || 'None'}
- Text Contents: ${context.textContents.join(' | ') || 'None'}
- Component Names: ${context.componentNames.join(', ') || 'None'}
- Frame Names: ${context.frameNames.join(', ') || 'None'}

If there is not enough context to make a recommendation, return a JSON object with confidence 0 and empty arrays.
  `.trim();

  try {
    let textResult = '';

    if (config.provider === 'gemini') {
      const url = config.baseUrl || `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${config.apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json", temperature: 0.1 }
        })
      });
      if (!response.ok) throw new Error(`Gemini Error: ${response.statusText}`);
      const data = await response.json();
      textResult = data.candidates?.[0]?.content?.parts?.[0]?.text;

    } else if (config.provider === 'anthropic') {
      const url = config.baseUrl || 'https://api.anthropic.com/v1/messages';
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': config.apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: config.model || 'claude-3-haiku-20240307',
          max_tokens: 1024,
          system: "You are a helpful assistant. Respond ONLY with a valid JSON object.",
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.1
        })
      });
      if (!response.ok) throw new Error(`Anthropic Error: ${response.statusText}`);
      const data = await response.json();
      textResult = data.content?.[0]?.text;

    } else {
      // OpenAI, Deepseek, Custom (OpenAI-compatible)
      let url = config.baseUrl || 'https://api.openai.com/v1/chat/completions';
      // Auto-fix URL if user only provided the base domain
      if (config.provider === 'deepseek' && !url.includes('/chat/completions')) {
        url = url.replace(/\/+$/, '') + '/chat/completions';
      } else if (config.provider === 'openai' && !url.includes('/chat/completions')) {
        url = url.replace(/\/+$/, '') + '/v1/chat/completions';
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`
        },
        body: JSON.stringify({
          model: config.model || 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'You are a helpful assistant. Respond ONLY with a valid JSON object.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.1,
          response_format: { type: "json_object" }
        })
      });
      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        throw new Error(`OpenAI-compatible Error: ${response.status} ${response.statusText} - ${errText}`);
      }
      const data = await response.json();
      textResult = data.choices?.[0]?.message?.content;
    }
    
    if (textResult) {
      // Clean markdown code blocks if the LLM ignored instructions
      const cleanedText = textResult.replace(/^\\s*\`\`\`(json)?|\\s*\`\`\`\\s*$/g, '');
      const parsed = JSON.parse(cleanedText) as MatchResult;
      if (parsed.confidence >= 20) {
        return parsed;
      }
    }
    return null;
  } catch (error) {
    console.error('Failed to call LLM:', error);
    return null;
  }
}

export async function callChatAPI(messages: {role: string, content: string}[], config: LLMConfig): Promise<{text: string | null, error?: string}> {
  try {
    let textResult = '';

    if (config.provider === 'gemini') {
      const url = config.baseUrl || `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${config.apiKey}`;
      // Map standard roles to Gemini roles
      const contents = messages.filter(m => m.role !== 'system').map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      }));
      // If there's a system message, we can pass it in systemInstruction
      const systemMsg = messages.find(m => m.role === 'system');
      const body: any = { contents, generationConfig: { temperature: 0.7 } };
      if (systemMsg) {
        body.systemInstruction = { parts: [{ text: systemMsg.content }] };
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        throw new Error(`Gemini Error: ${response.status} ${response.statusText} - ${errText}`);
      }
      const data = await response.json();
      textResult = data.candidates?.[0]?.content?.parts?.[0]?.text;

    } else if (config.provider === 'anthropic') {
      const url = config.baseUrl || 'https://api.anthropic.com/v1/messages';
      const systemMsg = messages.find(m => m.role === 'system');
      const apiMessages = messages.filter(m => m.role !== 'system');
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': config.apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: config.model || 'claude-3-haiku-20240307',
          max_tokens: 1024,
          system: systemMsg?.content || "You are a helpful assistant.",
          messages: apiMessages,
          temperature: 0.7
        })
      });
      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        throw new Error(`Anthropic Error: ${response.status} ${response.statusText} - ${errText}`);
      }
      const data = await response.json();
      textResult = data.content?.[0]?.text;

    } else {
      // OpenAI, Deepseek, Custom
      let url = config.baseUrl || 'https://api.openai.com/v1/chat/completions';
      // Auto-fix URL if user only provided the base domain
      if (config.provider === 'deepseek' && !url.includes('/chat/completions')) {
        url = url.replace(/\/+$/, '') + '/chat/completions';
      } else if (config.provider === 'openai' && !url.includes('/chat/completions')) {
        url = url.replace(/\/+$/, '') + '/v1/chat/completions';
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`
        },
        body: JSON.stringify({
          model: config.model || 'gpt-4o-mini',
          messages: messages,
          temperature: 0.7
        })
      });
      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        throw new Error(`API Error (${response.status}): ${errText || response.statusText}`);
      }
      const data = await response.json();
      textResult = data.choices?.[0]?.message?.content;
    }
    
    return { text: textResult || null };
  } catch (error: any) {
    console.error('Failed to call Chat API:', error);
    return { text: null, error: error.message || String(error) };
  }
}
