// Available AI models and providers
export const AI_PROVIDERS = {
  openai: {
    name: 'OpenAI',
    models: [
      { value: 'gpt-5.5', label: 'GPT-5.5' },
      { value: 'gpt-5.4', label: 'GPT-5.4' },
      { value: 'gpt-5.4-mini', label: 'GPT-5.4 Mini' },
      { value: 'gpt-5.2', label: 'GPT-5.2' },
      { value: 'gpt-5.1', label: 'GPT-5.1' },
      { value: 'gpt-4o', label: 'GPT-4o' },
      { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
      { value: 'gpt-4.1', label: 'GPT-4.1' },
      { value: 'gpt-4.1-mini', label: 'GPT-4.1 Mini' },
    ]
  },
  anthropic: {
    name: 'Anthropic (Claude)',
    models: [
      { value: 'claude-opus-4-7', label: 'Claude Opus 4.7' },
      { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
      { value: 'claude-sonnet-4-5-20250929', label: 'Claude Sonnet 4.5' },
      { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
    ]
  },
  google: {
    name: 'Google (Gemini)',
    models: [
      { value: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro' },
      { value: 'gemini-3-flash-preview', label: 'Gemini 3 Flash' },
      { value: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash' },
      { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
      { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
      { value: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite' },
    ]
  }
};

export const getProviderForModel = (model) => {
  for (const [provider, data] of Object.entries(AI_PROVIDERS)) {
    if (data.models.some(m => m.value === model)) {
      return provider;
    }
  }
  return 'openai'; // Default
};

export const getAllModels = () => {
  const allModels = [];
  Object.entries(AI_PROVIDERS).forEach(([provider, data]) => {
    data.models.forEach(model => {
      allModels.push({
        ...model,
        provider,
        providerName: data.name
      });
    });
  });
  return allModels;
};
