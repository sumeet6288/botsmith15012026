(function () {
  'use strict';

  /*
   * BotSmith Universal Embed Loader
   *
   * Customer installation:
   * <script
   *   src="https://botsmith.pro/embed.js"
   *   data-botsmith-id="YOUR_BOT_ID">
   * </script>
   *
   * Keep this file stable. fast-widget.js is an internal runtime.
   */

  // Prevent duplicate BotSmith installations on the same page.
  if (window.__BOTSMITH_EMBED_LOADED__) {
    return;
  }

  window.__BOTSMITH_EMBED_LOADED__ = true;

  // This is the customer's BotSmith embed script.
  const embedScript = document.currentScript;

  if (!embedScript) {
    console.error('[BotSmith] Unable to detect embed script.');
    window.__BOTSMITH_EMBED_LOADED__ = false;
    return;
  }

  // Primary installation attribute.
  // The other two are backward-compatible fallbacks.
  const chatbotId =
    embedScript.getAttribute('data-botsmith-id') ||
    embedScript.getAttribute('data-chatbot-id') ||
    (
      embedScript.id &&
      embedScript.id !== 'botsmith-embed'
        ? embedScript.id
        : null
    );

  if (!chatbotId) {
    console.error('[BotSmith] Missing data-botsmith-id.');
    window.__BOTSMITH_EMBED_LOADED__ = false;
    return;
  }

  let domain;

  try {
    domain = new URL(embedScript.src, window.location.href).origin;
  } catch (error) {
    console.error('[BotSmith] Unable to determine BotSmith domain.', error);
    window.__BOTSMITH_EMBED_LOADED__ = false;
    return;
  }

  // Stable configuration contract shared with fast-widget.js.
  const embedConfig = {
    chatbotId,
    domain,
    apiUrl: domain + '/api'
  };

  window.__BOTSMITH_EMBED_CONFIG__ = embedConfig;

  /*
   * Commands called before fast-widget.js loads are queued here.
   *
   * Example:
   *   window.BotSmith.open();
   *   window.BotSmith.close();
   *
   * The real widget API replaces this temporary API after the runtime loads.
   */
  const commandQueue = [];

  const queueCommand = function (method, args) {
    commandQueue.push({
      method,
      args: Array.isArray(args) ? args : []
    });
  };

  // Expose the queue for fast-widget.js.
  window.__BOTSMITH_COMMAND_QUEUE__ = commandQueue;

  /*
   * Temporary API.
   *
   * This prevents a race condition where a customer's own code calls
   * BotSmith.open() immediately after the embed snippet, before
   * fast-widget.js has finished loading.
   */
  if (!window.BotSmith) {
    window.BotSmith = {
      open: function () {
        queueCommand('open');
      },

      close: function () {
        queueCommand('close');
      },

      toggle: function () {
        queueCommand('toggle');
      },

      reset: function () {
        queueCommand('reset');
      },

      identify: function (data) {
        queueCommand('identify', [data]);
      },

      sendMessage: function (message) {
        queueCommand('sendMessage', [message]);
      },

      isOpen: function () {
        // The real state is unavailable until the runtime loads.
        return false;
      }
    };
  }

  /*
   * Load the real widget runtime.
   *
   * Script attributes are intentionally retained for compatibility with
   * the current fast-widget.js and any older deployment behavior.
   */
  const widgetScript = document.createElement('script');

  widgetScript.src = domain + '/fast-widget.js';
  widgetScript.async = true;
  widgetScript.setAttribute('chatbot-id', chatbotId);
  widgetScript.setAttribute('domain', domain);
  widgetScript.setAttribute('api-url', embedConfig.apiUrl);
  widgetScript.setAttribute('data-botsmith-runtime', 'true');

  widgetScript.onload = function () {
    const runtimeInitialized =
      window.BotSmithWidget &&
      window.BotSmithWidget.initialized === true;

    window.__BOTSMITH_EMBED_RUNTIME_LOADED__ = runtimeInitialized;

    /*
     * fast-widget.js normally flushes the queue itself.
     * This fallback handles a runtime that exposes _flushQueue
     * but has not flushed yet.
     */
    if (
      window.BotSmith &&
      typeof window.BotSmith._flushQueue === 'function' &&
      Array.isArray(window.__BOTSMITH_COMMAND_QUEUE__) &&
      window.__BOTSMITH_COMMAND_QUEUE__.length > 0
    ) {
      window.BotSmith._flushQueue(window.__BOTSMITH_COMMAND_QUEUE__);
    }

    console.log('[BotSmith] Widget loaded');
  };

  widgetScript.onerror = function () {
    console.error('[BotSmith] Failed to load widget runtime.');

    window.__BOTSMITH_EMBED_RUNTIME_LOADED__ = false;
    window.__BOTSMITH_EMBED_LOADED__ = false;
  };

  const loadWidget = function () {
    // Do not inject fast-widget.js more than once.
    if (document.querySelector('script[data-botsmith-runtime="true"]')) {
      return;
    }

    document.head.appendChild(widgetScript);
  };

  // Works whether embed.js is placed in <head>, <body>, or loaded later.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadWidget, {
      once: true
    });
  } else {
    loadWidget();
  }
})();
