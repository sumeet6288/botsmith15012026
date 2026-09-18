(function () {
  'use strict';

  if (window.__BOTSMITH_EMBED_LOADED__) {
    return;
  }

  window.__BOTSMITH_EMBED_LOADED__ = true;

  const embedScript = document.currentScript;

  if (!embedScript) {
    console.error('[BotSmith] Unable to detect embed script.');
    return;
  }

  const chatbotId = embedScript.getAttribute('data-botsmith-id');

  if (!chatbotId) {
    console.error('[BotSmith] Missing data-botsmith-id.');
    return;
  }

  const domain = new URL(embedScript.src).origin;

  window.__BOTSMITH_EMBED_CONFIG__ = {
    chatbotId,
    domain,
    apiUrl: domain + '/api'
  };

  const widgetScript = document.createElement('script');

  widgetScript.src = domain + '/fast-widget.js';
  widgetScript.async = true;

  // Pass configuration directly to fast-widget.js
  widgetScript.setAttribute('chatbot-id', chatbotId);
  widgetScript.setAttribute('domain', domain);
  widgetScript.setAttribute('api-url', domain + '/api');

  widgetScript.onload = function () {
    console.log('[BotSmith] Widget loaded');
  };

  widgetScript.onerror = function () {
    console.error('[BotSmith] Failed to load widget');
    window.__BOTSMITH_EMBED_LOADED__ = false;
  };

  document.head.appendChild(widgetScript);
})();