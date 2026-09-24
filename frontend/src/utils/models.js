// Available AI models and providers

export const AI_PROVIDERS = {
  openai: {
    name: 'OpenAI',
    models: [
      { value: 'gpt-6-astra', label: 'GPT-6 Astra' },
      { value: 'gpt-5.6-sol', label: 'GPT-5.6 Sol' },
      { value: 'gpt-5.6-luna', label: 'GPT-5.6 Luna' },
      { value: 'gpt-5.4', label: 'GPT-5.4' },
      { value: 'gpt-5.2', label: 'GPT-5.2' },
      { value: 'gpt-4o', label: 'GPT-4o' },
      { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
      { value: 'gpt-4.1', label: 'GPT-4.1' },
      { value: 'gpt-4.1-mini', label: 'GPT-4.1 Mini' },
      { value: 'gpt-4', label: 'GPT-4' },
      { value: 'o1', label: 'o1' },
      { value: 'o3', label: 'o3' },
      { value: 'o3-mini', label: 'o3 Mini' },
      { value: 'o4-mini', label: 'o4 Mini' },
    ]
  },

  anthropic: {
    name: 'Anthropic (Claude)',
    models: [
      { value: 'claude-opus-4-7', label: 'Claude Opus 4.7' },
      { value: 'claude-opus-4-6', label: 'Claude Opus 4.6' },
      { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
      { value: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5' },
      { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
      { value: 'claude-3-7-sonnet-20250219', label: 'Claude 3.7 Sonnet' },
      { value: 'claude-haiku-4-5', label: 'Claude Haiku 4.5' },
      { value: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku' },
    ]
  },

  google: {
    name: 'Google (Gemini)',
    models: [
      { value: 'gemini/gemini-3.7-flash', label: 'Gemini 3.7 Flash' },
      { value: 'gemini/gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro Preview' },
      { value: 'gemini/gemini-3-flash-preview', label: 'Gemini 3 Flash' },
      { value: 'gemini/gemini-3.5-flash', label: 'Gemini 3.5 Flash' },
      { value: 'gemini/gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
      { value: 'gemini/gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
      { value: 'gemini/gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
      { value: 'gemini/gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
      { value: 'gemini/gemini-pro', label: 'Gemini Pro' },
    ]
  },

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
