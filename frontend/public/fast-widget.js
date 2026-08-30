(function() {
  'use strict';
  
  // ✅ LEVEL 1: Global error boundary - CRITICAL FOR PUBLIC LAUNCH
  try {
    window.BotSmithWidget = window.BotSmithWidget || {};
    
    // Prevent double initialization
    if (window.BotSmithWidget.initialized) {
      console.warn('[BotSmith Widget] Already initialized');
      return;
    }
    
    // ✅ LEVEL 2: Isolated error handler
    window.BotSmithWidget.handleError = function(error, context) {
      console.error('[BotSmith Widget Error]', context, error);
      
      // Send error to BotSmith monitoring (non-blocking)
      try {
        const errorData = {
          error: error.message,
          stack: error.stack,
          context: context,
          chatbotId: config?.chatbotId,
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString(),
          url: window.location.href
        };
        
        // Non-blocking error reporting - don't break customer site
        if (config && config.apiUrl) {
          fetch(config.apiUrl + '/widget-errors', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(errorData)
          }).catch(() => {}); // Silent fail - critical for customer site safety
        }
      } catch (e) {
        // Even error reporting failed - stay silent
      }
    };
    
    // ✅ LEVEL 3: Wrap async operations
    async function safeAsyncOperation(operation, context) {
      try {
        return await operation();
      } catch (error) {
        window.BotSmithWidget.handleError(error, context);
        return null;
      }
    }
    
    // ✅ LEVEL 4: Wrap DOM operations
    function safeDOMOperation(operation, context) {
      try {
        return operation();
      } catch (error) {
        window.BotSmithWidget.handleError(error, context);
        return null;
      }
    }
  
  // Get configuration from script tag
  const script = document.currentScript;
  const config = {
    chatbotId: script?.getAttribute('chatbot-id') || window.botsmithConfig?.chatbotId,
    domain: script?.getAttribute('domain') || window.botsmithConfig?.domain || window.location.origin,
    position: script?.getAttribute('position') || 'bottom-right',
    theme: script?.getAttribute('theme') || 'purple',
    apiUrl: script?.getAttribute('api-url') || (script?.getAttribute('domain') || window.location.origin) + '/api'
  };
  
  if (!config.chatbotId) {
    console.error('[BotSmith Widget] chatbot-id is required');
    return;
  }
  
  // Theme colors with enhanced gradients
  const themes = {
    purple: { primary: '#7c3aed', secondary: '#a78bfa', accent: '#c084fc' },
    blue: { primary: '#3b82f6', secondary: '#06b6d4', accent: '#0ea5e9' },
    green: { primary: '#10b981', secondary: '#14b8a6', accent: '#34d399' },
    orange: { primary: '#f97316', secondary: '#f59e0b', accent: '#fb923c' },
    pink: { primary: '#ec4899', secondary: '#f43f5e', accent: '#f472b6' }
  };
  
  const currentTheme = themes[config.theme] || themes.purple;
  
  // Session ID
  const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  // State
  let isOpen = false;
  let messages = [];
  let chatbot = null;
  let isLoading = false;
  let isSending = false;
  let attentionAnimationTimeout = null;
  
  // Customization defaults
  let customization = {
    accent_color: '#ec4899',
    font_family: 'Inter, system-ui, -apple-system, sans-serif',
    font_size: 'medium',
    bubble_style: 'rounded'
  };
  
  // Position styles
  const positions = {
    'bottom-right': { bottom: '20px', right: '20px' },
    'bottom-left': { bottom: '20px', left: '20px' },
    'top-right': { top: '20px', right: '20px' },
    'top-left': { top: '20px', left: '20px' }
  };
  
  const currentPosition = positions[config.position] || positions['bottom-right'];

  // Inject enhanced styles with beautiful animations
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideUp {
      from { 
        opacity: 0; 
        transform: translateY(40px) scale(0.94); 
      }
      to { 
        opacity: 1; 
        transform: translateY(0) scale(1); 
      }
    }
    @keyframes messageSlideIn {
      from { 
        opacity: 0; 
        transform: translateY(15px) scale(0.96);
      }
      to { 
        opacity: 1; 
        transform: translateY(0) scale(1);
      }
    }
    @keyframes pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.05); }
    }
    @keyframes bounce {
      0%, 20%, 50%, 80%, 100% { 
        transform: translateY(0); 
      }
      40% { 
        transform: translateY(-15px); 
      }
      60% { 
        transform: translateY(-7px); 
      }
    }
    .botsmith-attention {
      animation: bounce 1.5s ease-in-out infinite !important;
    }
    @keyframes dotBounce {
      0%, 80%, 100% { transform: translateY(0); opacity: 0.7; }
      40% { transform: translateY(-10px); opacity: 1; }
    }
    @keyframes shimmer {
      0% { background-position: -1000px 0; }
      100% { background-position: 1000px 0; }
    }
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes scaleIn {
      from { transform: scale(0.9); opacity: 0; }
      to { transform: scale(1); opacity: 1; }
    }
    @keyframes glow {
      0%, 100% { box-shadow: 0 4px 20px rgba(124, 58, 237, 0.4); }
      50% { box-shadow: 0 8px 35px rgba(124, 58, 237, 0.65); }
    }
    
    #botsmith-container * { 
      box-sizing: border-box; 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', Roboto, Helvetica, Arial, sans-serif;
    }
    
    .botsmith-bubble { 
      animation: glow 3s ease-in-out infinite;
      backdrop-filter: blur(10px);
      transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    
    .botsmith-bubble:hover {
      transform: scale(1.1);
    }
    
    .botsmith-bubble.botsmith-attention:hover {
      animation: bounce 1.5s ease-in-out infinite !important;
      transform: scale(1.05);
    }
    
    .botsmith-message-item {
      animation: messageSlideIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    
    .botsmith-typing-dot {
      width: 8px; 
      height: 8px; 
      border-radius: 50%;
      background: linear-gradient(135deg, #9ca3af 0%, #6b7280 100%);
      display: inline-block;
      margin: 0 3px; 
      animation: dotBounce 1.4s infinite ease-in-out;
    }
    
    .botsmith-typing-dot:nth-child(1) { animation-delay: 0s; }
    .botsmith-typing-dot:nth-child(2) { animation-delay: 0.2s; }
    .botsmith-typing-dot:nth-child(3) { animation-delay: 0.4s; }
    
    #botsmith-messages {
      scroll-behavior: smooth;
    }
    
    #botsmith-messages::-webkit-scrollbar {
      width: 6px;
    }
    
    #botsmith-messages::-webkit-scrollbar-track {
      background: transparent;
    }
    
    #botsmith-messages::-webkit-scrollbar-thumb {
      background: rgba(0, 0, 0, 0.15);
      border-radius: 10px;
    }
    
    #botsmith-messages::-webkit-scrollbar-thumb:hover {
      background: rgba(0, 0, 0, 0.25);
    }
    
    #botsmith-input:focus {
      border-color: #000000 !important;
      box-shadow: 0 0 0 3px #00000020 !important;
      transition: all 0.3s ease;
    }
    
    .botsmith-send-button {
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    
    .botsmith-send-button:hover {
      transform: scale(1.1) rotate(5deg);
    }
    
    .botsmith-send-button:active {
      transform: scale(0.95);
    }
    
    @media (max-width: 768px) {
      #botsmith-window {
        width: 100vw !important; 
        height: 100vh !important;
        bottom: 0 !important; 
        right: 0 !important; 
        left: 0 !important; 
        top: 0 !important;
        border-radius: 0 !important;
        max-width: 100vw !important;
        max-height: 100vh !important;
      }
    }
  `;
  document.head.appendChild(style);

  // Create container
  const container = document.createElement('div');
  container.id = 'botsmith-container';
  
  function updateContainerStyle() {
    container.style.cssText = `
      position: fixed;
      ${currentPosition.bottom ? `bottom: ${currentPosition.bottom};` : ''}
      ${currentPosition.top ? `top: ${currentPosition.top};` : ''}
      ${currentPosition.left ? `left: ${currentPosition.left};` : ''}
      ${currentPosition.right ? `right: ${currentPosition.right};` : ''}
      z-index: 999999;
      font-family: ${customization.font_family};
    `;
  }
  updateContainerStyle();

  // Create chat bubble with enhanced design
  const bubble = document.createElement('button');
  bubble.className = 'botsmith-bubble';
  bubble.innerHTML = `
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" fill="white"/>
    </svg>
  `;
  bubble.style.cssText = `
    width: 64px; 
    height: 64px; 
    border-radius: 50%;
    background: linear-gradient(135deg, ${currentTheme.primary} 0%, ${currentTheme.secondary} 50%, ${currentTheme.accent || currentTheme.secondary} 100%);
    border: none; 
    cursor: pointer; 
    box-shadow: 0 8px 25px ${currentTheme.primary}50, 0 4px 12px ${currentTheme.primary}30;
    display: flex; 
    align-items: center; 
    justify-content: center;
    position: relative;
    overflow: hidden;
    opacity: 0;
    visibility: hidden;
    transition: opacity 0.3s ease, visibility 0.3s ease;
  `;
  
  bubble.onmouseenter = () => {
    bubble.style.boxShadow = `0 12px 35px ${currentTheme.primary}65, 0 6px 16px ${currentTheme.primary}40`;
  };
  bubble.onmouseleave = () => {
    bubble.style.boxShadow = `0 8px 25px ${currentTheme.primary}50, 0 4px 12px ${currentTheme.primary}30`;
  };

  // Create chat window with glassmorphism effect
  const chatWindow = document.createElement('div');
  chatWindow.id = 'botsmith-window';
  const windowPosition = config.position.includes('bottom') ? 'bottom: 90px;' : 'top: 90px;';
  const windowAlign = config.position.includes('right') ? 'right: 0;' : 'left: 0;';
  
  chatWindow.style.cssText = `
    position: fixed; 
    ${windowPosition} 
    ${windowAlign}
    width: 420px; 
    height: 600px; 
    max-width: calc(100vw - 40px); 
    max-height: calc(100vh - 120px);
    background: white; 
    border-radius: 24px; 
    box-shadow: 0 25px 80px rgba(0, 0, 0, 0.18), 0 10px 30px rgba(0, 0, 0, 0.1);
    display: none; 
    flex-direction: column; 
    overflow: hidden; 
    animation: slideUp 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
    border: 1px solid rgba(255, 255, 255, 0.8);
  `;

  // Header with gradient and better design
  const header = document.createElement('div');
  header.style.cssText = `
    background: linear-gradient(135deg, ${currentTheme.primary} 0%, ${currentTheme.secondary} 60%, ${currentTheme.accent || currentTheme.secondary} 100%);
    color: white; 
    padding: 24px; 
    display: flex; 
    align-items: center; 
    justify-content: space-between;
    box-shadow: 0 4px 20px ${currentTheme.primary}30;
    position: relative;
    overflow: hidden;
  `;
  
  // Add subtle pattern overlay to header
  const headerOverlay = document.createElement('div');
  headerOverlay.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: url('data:image/svg+xml,<svg width="40" height="40" xmlns="http://www.w3.org/2000/svg"><defs><pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse"><circle cx="20" cy="20" r="1" fill="rgba(255,255,255,0.1)"/></pattern></defs><rect width="100%" height="100%" fill="url(%23grid)"/></svg>');
    opacity: 0.3;
    pointer-events: none;
  `;
  header.appendChild(headerOverlay);
  
  header.innerHTML += `
    <div style="display: flex; align-items: center; gap: 14px; flex: 1; position: relative; z-index: 1;">
      <div style="width: 48px; height: 48px; border-radius: 50%; background: white; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="${currentTheme.primary}" stroke-width="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
      </div>
      <div style="flex: 1;">
        <div style="font-weight: 700; font-size: 17px; letter-spacing: -0.3px;" id="botsmith-header-title">Chat Support</div>
        <div style="font-size: 13px; opacity: 0.95; font-weight: 500;">We're here to help!</div>
      </div>
    </div>
    <button id="botsmith-close" style="background: rgba(255, 255, 255, 0.2); backdrop-filter: blur(10px); border: 1px solid rgba(255, 255, 255, 0.3); color: white; cursor: pointer; padding: 10px; display: flex; border-radius: 12px; transition: all 0.3s; position: relative; z-index: 1;">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
      </svg>
    </button>
  `;
  
  const closeBtn = header.querySelector('#botsmith-close');
  closeBtn.onmouseenter = () => {
    closeBtn.style.background = 'rgba(255, 255, 255, 0.3)';
    closeBtn.style.transform = 'scale(1.05)';
  };
  closeBtn.onmouseleave = () => {
    closeBtn.style.background = 'rgba(255, 255, 255, 0.2)';
    closeBtn.style.transform = 'scale(1)';
  };

  // Messages container with better design
  const messagesContainer = document.createElement('div');
  messagesContainer.id = 'botsmith-messages';
  messagesContainer.style.cssText = `
    flex: 1; 
    overflow-y: auto; 
    padding: 24px; 
    background: linear-gradient(to bottom, #fafafa 0%, #f5f5f5 100%);
    display: flex; 
    flex-direction: column; 
    gap: 16px;
  `;

  // Input area with modern design
  const inputArea = document.createElement('div');
  inputArea.style.cssText = `
    border-top: 1px solid #e5e7eb; 
    padding: 16px 20px; 
    background: white;
    box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.05);
  `;
  inputArea.innerHTML = `
    <form id="botsmith-form" style="display: flex; gap: 10px; margin: 0;">
      <input 
        type="text" 
        id="botsmith-input" 
        placeholder="Type your message..."
        style="flex: 1; padding: 12px 18px; border: 2px solid #e5e7eb; border-radius: 28px; outline: none; font-size: 15px; transition: all 0.3s ease; background: #fafafa;"
      />
      <button 
        type="submit" 
        id="botsmith-send" 
        class="botsmith-send-button"
        style="width: 48px; height: 48px; border-radius: 50%; border: none; background: linear-gradient(135deg, ${customization.accent_color} 0%, ${customization.accent_color}dd 100%); color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; box-shadow: 0 4px 12px ${customization.accent_color}40;">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M22 2L11 13M22 2L15 22L11 13M22 2L2 9L11 13" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
    </form>
  `;

  // Branding footer with elegant design
  const brandingFooter = document.createElement('div');
  brandingFooter.style.cssText = `
    padding: 10px 16px; 
    background: linear-gradient(to top, #fafafa 0%, #f9fafb 100%); 
    text-align: center; 
    border-top: 1px solid #f0f0f0;
  `;
  brandingFooter.innerHTML = `
    <a href="https://botsmith.pro" target="_blank" rel="noopener noreferrer" style="text-decoration: none; color: #9ca3af; font-size: 11px; display: flex; align-items: center; justify-content: center; gap: 5px; transition: all 0.3s; font-weight: 500;">
      <span>Powered by</span>
      <span style="font-weight: 700; color: ${currentTheme.primary}; letter-spacing: 0.3px;">BotSmith</span>
    </a>
  `;
  
  // Add hover effect
  const brandingLink = brandingFooter.querySelector('a');
  brandingLink.addEventListener('mouseenter', () => {
    brandingLink.style.color = currentTheme.primary;
    brandingLink.style.transform = 'translateY(-1px)';
  });
  brandingLink.addEventListener('mouseleave', () => {
    brandingLink.style.color = '#9ca3af';
    brandingLink.style.transform = 'translateY(0)';
  });

  // Assemble window
  chatWindow.appendChild(header);
  chatWindow.appendChild(messagesContainer);
  chatWindow.appendChild(inputArea);
  chatWindow.appendChild(brandingFooter);

  // Assemble container
  container.appendChild(bubble);
  container.appendChild(chatWindow);

  // Add to DOM
  document.body.appendChild(container);

  // Functions
  function addMessage(role, content) {
    messages.push({ role, content, timestamp: new Date() });
    renderMessages();
  }

  function getBubbleRadius() {
    const styles = {
      'rounded': '20px',
      'smooth': '14px',
      'square': '6px'
    };
    return styles[customization.bubble_style] || '20px';
  }
  
  function getFontSize() {
    const sizes = {
      'small': '14px',
      'medium': '15px',
      'large': '17px'
    };
    return sizes[customization.font_size] || '15px';
  }

  function renderMessages() {
    messagesContainer.innerHTML = '';
    const bubbleRadius = getBubbleRadius();
    const fontSize = getFontSize();
    
    messages.forEach((msg, index) => {
      const msgDiv = document.createElement('div');
      msgDiv.className = 'botsmith-message-item';
      msgDiv.style.cssText = `
        display: flex; 
        gap: 10px; 
        align-items: flex-start;
        ${msg.role === 'user' ? 'justify-content: flex-end;' : ''}
        animation-delay: ${index === messages.length - 1 ? '0s' : '0s'};
      `;
      
      if (msg.role === 'assistant') {
        const avatarContent = chatbot?.avatar_url 
          ? `<img src="${chatbot.avatar_url}" alt="Bot" style="width: 36px; height: 36px; border-radius: 50%; object-fit: cover;">`
          : `<svg width="20" height="20" viewBox="0 0 24 24" fill="white" stroke="white" stroke-width="0.5">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>`;
            
        msgDiv.innerHTML = `
          <div style="width: 36px; height: 36px; border-radius: 50%; background: linear-gradient(135deg, ${customization.accent_color} 0%, ${customization.accent_color}dd 100%); display: flex; align-items: center; justify-content: center; flex-shrink: 0; overflow: hidden; box-shadow: 0 3px 10px ${customization.accent_color}30;">
            ${avatarContent}
          </div>
          <div style="max-width: 72%; padding: 14px 18px; border-radius: ${bubbleRadius}; background: white; box-shadow: 0 3px 12px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.05); word-wrap: break-word; font-size: ${fontSize}; line-height: 1.6; font-family: ${customization.font_family}; border: 1px solid rgba(0, 0, 0, 0.05);">
            ${msg.content}
          </div>
        `;
      } else {
        msgDiv.innerHTML = `
          <div style="max-width: 72%; padding: 14px 18px; border-radius: ${bubbleRadius}; background: linear-gradient(135deg, ${customization.accent_color} 0%, ${customization.accent_color}dd 100%); color: white; box-shadow: 0 3px 12px ${customization.accent_color}35, 0 1px 3px ${customization.accent_color}25; word-wrap: break-word; font-size: ${fontSize}; line-height: 1.6; font-family: ${customization.font_family}; font-weight: 500;">
            ${msg.content}
          </div>
        `;
      }
      
      messagesContainer.appendChild(msgDiv);
    });
    
    requestAnimationFrame(() => {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    });
  }

  function showTyping() {
    const typingDiv = document.createElement('div');
    typingDiv.id = 'botsmith-typing-indicator';
    typingDiv.className = 'botsmith-message-item';
    typingDiv.style.cssText = 'display: flex; gap: 10px; align-items: center;';
    
    const bubbleRadius = getBubbleRadius();
    
    const avatarContent = chatbot?.avatar_url 
      ? `<img src="${chatbot.avatar_url}" alt="Bot" style="width: 36px; height: 36px; border-radius: 50%; object-fit: cover;">`
      : `<svg width="20" height="20" viewBox="0 0 24 24" fill="white" stroke="white" stroke-width="0.5">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>`;
    
    typingDiv.innerHTML = `
      <div style="width: 36px; height: 36px; border-radius: 50%; background: linear-gradient(135deg, ${customization.accent_color} 0%, ${customization.accent_color}dd 100%); display: flex; align-items: center; justify-content: center; overflow: hidden; box-shadow: 0 3px 10px ${customization.accent_color}30;">
        ${avatarContent}
      </div>
      <div style="padding: 14px 18px; border-radius: ${bubbleRadius}; background: white; box-shadow: 0 3px 12px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.05); border: 1px solid rgba(0, 0, 0, 0.05);">
        <span class="botsmith-typing-dot"></span>
        <span class="botsmith-typing-dot"></span>
        <span class="botsmith-typing-dot"></span>
      </div>
    `;
    messagesContainer.appendChild(typingDiv);
    
    requestAnimationFrame(() => {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    });
  }

  function hideTyping() {
    const typing = document.getElementById('botsmith-typing-indicator');
    if (typing) typing.remove();
  }

  async function loadChatbot() {
    try {
      isLoading = true;
      const response = await fetch(`${config.apiUrl}/public/chatbot/${config.chatbotId}`);
      if (!response.ok) throw new Error('Failed to load chatbot');
      
      chatbot = await response.json();
      
      document.getElementById('botsmith-header-title').textContent = chatbot.name || 'Chat Support';
      
      if (chatbot.primary_color) {
        currentTheme.primary = chatbot.primary_color;
        currentTheme.secondary = chatbot.secondary_color || chatbot.primary_color;
        
        bubble.style.background = `linear-gradient(135deg, ${currentTheme.primary} 0%, ${currentTheme.secondary} 50%, ${currentTheme.accent || currentTheme.secondary} 100%)`;
        header.style.background = `linear-gradient(135deg, ${currentTheme.primary} 0%, ${currentTheme.secondary} 60%, ${currentTheme.accent || currentTheme.secondary} 100%)`;
        
        const sendBtn = document.getElementById('botsmith-send');
        if (sendBtn) sendBtn.style.background = `linear-gradient(135deg, ${customization.accent_color} 0%, ${customization.accent_color}dd 100%)`;
        
        updateBotAvatarColors();
        
        const brandingBotSmith = brandingFooter.querySelector('span[style*="font-weight: 700"]');
        if (brandingBotSmith) brandingBotSmith.style.color = currentTheme.primary;
      }
      
      if (chatbot.accent_color) {
        customization.accent_color = chatbot.accent_color;
        const sendBtn = document.getElementById('botsmith-send');
        if (sendBtn) sendBtn.style.background = `linear-gradient(135deg, ${customization.accent_color} 0%, ${customization.accent_color}dd 100%)`;
        updateBotAvatarColors();
      }
      if (chatbot.font_family) {
        customization.font_family = chatbot.font_family;
        updateContainerStyle();
      }
      if (chatbot.font_size) customization.font_size = chatbot.font_size;
      if (chatbot.bubble_style) customization.bubble_style = chatbot.bubble_style;
      
      if (messages.length > 0) renderMessages();
      
      if (chatbot.logo_url) {
        const flexContainer = header.querySelector('div[style*="display: flex"]');
        const logoContainer = flexContainer?.querySelector('div');
        if (logoContainer) {
          logoContainer.style.cssText = 'width: 48px; height: 48px; border-radius: 50%; background: white; display: flex; align-items: center; justify-content: center; flex-shrink: 0; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);';
          logoContainer.innerHTML = `<img src="${chatbot.logo_url}" alt="Logo" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
        }
      }
      
      if (chatbot.widget_position) {
        const newPosition = positions[chatbot.widget_position] || positions['bottom-right'];
        container.style.bottom = '';
        container.style.top = '';
        container.style.left = '';
        container.style.right = '';
        
        if (newPosition.bottom) container.style.bottom = newPosition.bottom;
        if (newPosition.top) container.style.top = newPosition.top;
        if (newPosition.left) container.style.left = newPosition.left;
        if (newPosition.right) container.style.right = newPosition.right;
        
        const windowPosition = chatbot.widget_position.includes('bottom') ? 'bottom: 90px;' : 'top: 90px;';
        const windowAlign = chatbot.widget_position.includes('right') ? 'right: 0;' : 'left: 0;';
        
        chatWindow.style.cssText = `
          position: fixed; ${windowPosition} ${windowAlign}
          width: ${chatWindow.style.width || '420px'}; height: ${chatWindow.style.height || '600px'}; 
          max-width: calc(100vw - 40px); max-height: calc(100vh - 120px);
          background: white; border-radius: 24px; box-shadow: 0 25px 80px rgba(0, 0, 0, 0.18), 0 10px 30px rgba(0, 0, 0, 0.1);
          display: ${chatWindow.style.display || 'none'}; flex-direction: column; overflow: hidden; 
          animation: slideUp 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
          border: 1px solid rgba(255, 255, 255, 0.8);
        `;
      }
      
      if (chatbot.widget_size) {
        const sizes = {
          'small': { width: '360px', height: '550px' },
          'medium': { width: '420px', height: '600px' },
          'large': { width: '500px', height: '700px' }
        };
        const size = sizes[chatbot.widget_size] || sizes['medium'];
        chatWindow.style.width = size.width;
        chatWindow.style.height = size.height;
      }
      
      if (chatbot.widget_theme) {
        const themeColors = {
          'light': 'linear-gradient(to bottom, #fafafa 0%, #f5f5f5 100%)',
          'dark': 'linear-gradient(to bottom, #1f2937 0%, #111827 100%)',
          'auto': window.matchMedia('(prefers-color-scheme: dark)').matches ? 'linear-gradient(to bottom, #1f2937 0%, #111827 100%)' : 'linear-gradient(to bottom, #fafafa 0%, #f5f5f5 100%)'
        };
        messagesContainer.style.background = themeColors[chatbot.widget_theme] || themeColors['light'];
      }
      
      if (chatbot.auto_expand && !isOpen) {
        setTimeout(() => toggleChat(), 1000);
      }
      
      updateBrandingFooter();
      
      if (chatbot.welcome_message) {
        addMessage('assistant', chatbot.welcome_message);
      }
      
      // ✅ Show widget after data is fully loaded
      bubble.style.opacity = '1';
      bubble.style.visibility = 'visible';
    } catch (error) {
      console.error('Error loading chatbot:', error);
      addMessage('assistant', 'Hello! How can I help you today?');
      
      // ✅ Show widget even on error (with defaults)
      bubble.style.opacity = '1';
      bubble.style.visibility = 'visible';
    } finally {
      isLoading = false;
    }
  }
  
  function updateBotAvatarColors() {
    const avatars = messagesContainer.querySelectorAll('div[style*="background"]');
    avatars.forEach(avatar => {
      if (avatar.querySelector('svg')) {
        avatar.style.background = `linear-gradient(135deg, ${customization.accent_color} 0%, ${customization.accent_color}dd 100%)`;
      }
    });
  }

  function updateBrandingFooter() {
    if (!chatbot) return;
    
    if (chatbot.powered_by_text === '' || chatbot.powered_by_text === null) {
      brandingFooter.style.display = 'none';
    } else {
      brandingFooter.style.display = 'block';
      const brandText = chatbot.powered_by_text || 'BotSmith';
      
      brandingFooter.innerHTML = `
        <a href="https://botsmith.pro" target="_blank" rel="noopener noreferrer" style="text-decoration: none; color: #9ca3af; font-size: 11px; display: flex; align-items: center; justify-content: center; gap: 5px; transition: all 0.3s; font-weight: 500;">
          <span>Powered by</span>
          <span style="font-weight: 700; color: ${currentTheme.primary}; letter-spacing: 0.3px;">${brandText}</span>
        </a>
      `;
      
      const brandingLink = brandingFooter.querySelector('a');
      if (brandingLink) {
        brandingLink.addEventListener('mouseenter', () => {
          brandingLink.style.color = currentTheme.primary;
          brandingLink.style.transform = 'translateY(-1px)';
        });
        brandingLink.addEventListener('mouseleave', () => {
          brandingLink.style.color = '#9ca3af';
          brandingLink.style.transform = 'translateY(0)';
        });
      }
    }
  }

  async function sendMessage(message) {
    if (!message.trim() || isSending) return;
    
    isSending = true;
    const input = document.getElementById('botsmith-input');
    input.disabled = true;
    
    addMessage('user', message);
    input.value = '';
    
    showTyping();
    
    try {
      const response = await fetch(`${config.apiUrl}/public/chat/${config.chatbotId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, session_id: sessionId })
      });
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        hideTyping();
        
        // ✅ HANDLE SUBSCRIPTION ERRORS GRACEFULLY
        if (response.status === 402) {
          // Payment required (expired/payment failed)
          if (error.detail?.error === 'subscription_expired') {
            addMessage('assistant', '⚠️ This chatbot is temporarily unavailable. The subscription has expired.');
          } else if (error.detail?.error === 'payment_failed') {
            addMessage('assistant', '⚠️ This chatbot is temporarily unavailable. Please try again later.');
          } else {
            addMessage('assistant', '⚠️ This chatbot is temporarily unavailable.');
          }
          return;
        }
        
        if (response.status === 403) {
          // Suspended
          addMessage('assistant', '⚠️ This chatbot is currently unavailable.');
          return;
        }
        
        if (response.status === 429) {
          // Limit exceeded
          addMessage('assistant', '⚠️ Monthly message limit reached. Please try again later.');
          return;
        }
        
        throw new Error('Failed to send message');
      }
      
      const data = await response.json();
      hideTyping();
      addMessage('assistant', data.message);
    } catch (error) {
      console.error('[BotSmith Widget] Error sending message:', error);
      hideTyping();
      addMessage('assistant', '❌ Unable to send message. Please check your connection and try again.');
    } finally {
      isSending = false;
      input.disabled = false;
      input.focus();
    }
  }

  function toggleChat() {
    isOpen = !isOpen;
    if (isOpen) {
      // Clear attention animation when opening
      if (attentionAnimationTimeout) {
        clearTimeout(attentionAnimationTimeout);
        attentionAnimationTimeout = null;
      }
      bubble.classList.remove('botsmith-attention');
      
      chatWindow.style.display = 'flex';
      bubble.innerHTML = `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M18 6L6 18M6 6L18 18" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
        </svg>
      `;
      bubble.className = 'botsmith-bubble';
      document.getElementById('botsmith-input').focus();
      
      if (!chatbot) loadChatbot();
    } else {
      chatWindow.style.display = 'none';
      bubble.innerHTML = `
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" fill="white"/>
        </svg>
      `;
      bubble.className = 'botsmith-bubble';
      
      // Start attention animation after delay when closing
      startAttentionAnimation();
    }
  }
  
  function startAttentionAnimation() {
    // Clear any existing timeout
    if (attentionAnimationTimeout) {
      clearTimeout(attentionAnimationTimeout);
    }
    
    // Start animation after 2.5 seconds delay (only if still closed)
    attentionAnimationTimeout = setTimeout(() => {
      if (!isOpen) {
        bubble.classList.add('botsmith-attention');
      }
    }, 2500);
  }

  // Event listeners
  bubble.onclick = toggleChat;
  document.getElementById('botsmith-close').onclick = (e) => {
    e.stopPropagation();
    toggleChat();
  };
  
  document.getElementById('botsmith-form').onsubmit = (e) => {
    e.preventDefault();
    const input = document.getElementById('botsmith-input');
    sendMessage(input.value);
  };

  // API
  window.BotSmith = {
    open: () => { if (!isOpen) toggleChat(); },
    close: () => { if (isOpen) toggleChat(); },
    toggle: toggleChat,
    isOpen: () => isOpen
  };
  
  loadChatbot();
  
  // Start attention animation after initial delay (only if not auto-expanded)
  setTimeout(() => {
    if (!isOpen && chatbot?.auto_expand !== true) {
      startAttentionAnimation();
    }
  }, 3000);
  
  /* =========================================================
   BOTSMITH SIDE GREETING - SELF CONTAINED BLOCK
   ========================================================= */

(() => {

  /* ---------- 1. CREATE CSS ---------- */

  const greetingStyle = document.createElement('style');

  greetingStyle.textContent = `
    #botsmith-side-greeting {
      position: fixed;
      z-index: 999998;

      width: 280px;
      max-width: calc(100vw - 120px);

      background: #ffffff;
      color: #293142;

      padding: 16px 42px 16px 18px;

      border-radius: 14px;

      box-shadow:
        0 10px 35px rgba(0, 0, 0, 0.16);

      font-family:
        -apple-system,
        BlinkMacSystemFont,
        "Segoe UI",
        sans-serif;

      font-size: 15px;
      line-height: 1.45;

      opacity: 0;
      visibility: hidden;

      transform: translateY(-50%);

      transition:
        opacity 0.3s ease,
        visibility 0.3s ease;

      pointer-events: none;
    }

    #botsmith-side-greeting.botsmith-greeting-show {
      opacity: 1;
      visibility: visible;
      pointer-events: auto;
    }

    #botsmith-side-greeting button {
      position: absolute;

      top: 7px;
      right: 10px;

      border: none;
      background: transparent;

      color: #98a2b3;

      font-size: 21px;

      cursor: pointer;

      padding: 4px;

      line-height: 1;
    }

    #botsmith-side-greeting button:hover {
      color: #344054;
    }

    @media (max-width: 600px) {

      #botsmith-side-greeting {
        width: 230px;
        font-size: 14px;
      }

    }
  `;

  document.head.appendChild(greetingStyle);


  /* ---------- 2. CREATE GREETING ---------- */

  const greeting = document.createElement('div');

  greeting.id = 'botsmith-side-greeting';

  greeting.innerHTML = `
    <button aria-label="Close">×</button>

    <strong>👋 Have questions?</strong><br>

    I'm here to help!
  `;

  document.body.appendChild(greeting);


  /* ---------- 3. GET CURRENT POSITION ---------- */

  function getWidgetPosition() {

    return config.position || 'bottom-right';

  }


  /* ---------- 4. POSITION GREETING ---------- */

  function positionGreeting() {

    const position = getWidgetPosition();

    const bubbleRect = bubble.getBoundingClientRect();

    const greetingWidth = 280;

    /* Reset */

    greeting.style.top = '';
    greeting.style.right = '';
    greeting.style.bottom = '';
    greeting.style.left = '';


    /* RIGHT SIDE WIDGET */

    if (position.includes('right')) {

      greeting.style.top =
        `${bubbleRect.top + bubbleRect.height / 2}px`;

      greeting.style.right =
        `${window.innerWidth - bubbleRect.left + 14}px`;

    }


    /* LEFT SIDE WIDGET */

    else {

      greeting.style.top =
        `${bubbleRect.top + bubbleRect.height / 2}px`;

      greeting.style.left =
        `${bubbleRect.right + 14}px`;

    }

  }


  /* ---------- 5. SHOW AFTER DELAY ---------- */

  setTimeout(() => {

    positionGreeting();

    greeting.classList.add(
      'botsmith-greeting-show'
    );

  }, 1500);


  /* ---------- 6. KEEP POSITION UPDATED ---------- */

  window.addEventListener(
    'resize',
    positionGreeting
  );


  /* ---------- 7. CLOSE BUTTON ---------- */

  greeting
    .querySelector('button')
    .addEventListener('click', (event) => {

      event.stopPropagation();

      greeting.classList.remove(
        'botsmith-greeting-show'
      );

    });


  /* ---------- 8. HIDE WHEN WIDGET OPENS ---------- */

  bubble.addEventListener('click', () => {

    greeting.classList.remove(
      'botsmith-greeting-show'
    );

  });

})();

/* =========================================================
   BOTSMITH THREE DOT MENU
   SELF-CONTAINED BLOCK
   ========================================================= */

(() => {

  /* =========================
     1. ADD CSS
     ========================= */

  const botsmithMenuStyle = document.createElement('style');

  botsmithMenuStyle.textContent = `

    #botsmith-three-dot-wrapper {
      position: relative;
      display: flex;
      align-items: center;
      z-index: 999999;
    }

    #botsmith-three-dot-btn {
      width: 40px;
      height: 40px;

      padding: 0;

      border-radius: 12px;

      border: 1px solid rgba(255,255,255,0.3);

      background: rgba(255,255,255,0.2);

      backdrop-filter: blur(10px);

      color: white;

      cursor: pointer;

      display: flex;
      align-items: center;
      justify-content: center;

      transition: all 0.2s ease;
    }

    #botsmith-three-dot-btn:hover {
      background: rgba(255,255,255,0.3);
      transform: scale(1.05);
    }


    /* DROPDOWN MENU */

    #botsmith-chat-menu {
      position: fixed;

      width: 245px;

      background: #ffffff;

      border: 1px solid rgba(0,0,0,0.08);

      border-radius: 12px;

      box-shadow: 0 16px 45px rgba(0,0,0,0.22);

      padding: 7px;

      opacity: 0;
      visibility: hidden;

      transform: translateY(-8px) scale(0.98);

      transform-origin: top right;

      transition: all 0.18s ease;

      z-index: 2147483647;
    }


    #botsmith-chat-menu.botsmith-menu-active {
      opacity: 1;
      visibility: visible;

      transform: translateY(0) scale(1);
    }


    /* MENU ITEM */

    .botsmith-menu-item {
      width: 100%;

      border: none;

      background: transparent;

      color: #30343b;

      display: flex;
      align-items: center;

      gap: 13px;

      padding: 13px 14px;

      border-radius: 8px;

      cursor: pointer;

      text-align: left;

      font-size: 15px;

      font-weight: 500;

      font-family: inherit;

      transition: background 0.15s ease;
    }


    .botsmith-menu-item:hover {
      background: #f4f5f7;
    }


    /* MENU ICON */

    .botsmith-menu-icon {
      width: 20px;
      height: 20px;

      display: flex;

      align-items: center;
      justify-content: center;

      color: #7b818c;

      flex-shrink: 0;
    }


    /* DIVIDER */

    .botsmith-menu-divider {
      height: 1px;

      background: #e8eaed;

      margin: 5px 0;
    }


    @media (max-width: 600px) {
      #botsmith-chat-menu {
        width: 235px;
      }
    }

  `;

  document.head.appendChild(botsmithMenuStyle);



  /* =========================
     2. CREATE THREE DOT BUTTON
     ========================= */

  const menuWrapper = document.createElement('div');

  menuWrapper.id = 'botsmith-three-dot-wrapper';


  menuWrapper.innerHTML = `

    <button
      id="botsmith-three-dot-btn"
      aria-label="More options"
    >

      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="currentColor"
      >

        <circle cx="5" cy="12" r="1.8"></circle>

        <circle cx="12" cy="12" r="1.8"></circle>

        <circle cx="19" cy="12" r="1.8"></circle>

      </svg>

    </button>

  `;



  /* =========================
     3. FIND CLOSE BUTTON
     AND INSERT THREE DOTS
     BEFORE IT
     ========================= */

  const existingCloseButton =
    header.querySelector(
      '#botsmith-close'
    );


  if (existingCloseButton) {

    existingCloseButton.parentNode.insertBefore(
      menuWrapper,
      existingCloseButton
    );

  } else {

    console.warn(
      '[BotSmith] Close button not found'
    );

  }



  /* =========================
     4. CREATE DROPDOWN
     OUTSIDE HEADER
     ========================= */

  const chatMenu = document.createElement('div');

  chatMenu.id = 'botsmith-chat-menu';


  chatMenu.innerHTML = `


    <!-- START NEW CHAT -->

    <button
      class="botsmith-menu-item"
      id="botsmith-new-chat"
    >

      <span class="botsmith-menu-icon">

        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >

          <path d="M12 20h9"></path>

          <path
            d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"
          ></path>

        </svg>

      </span>

      Start a new chat

    </button>



    <!-- END CHAT -->

    <button
      class="botsmith-menu-item"
      id="botsmith-end-chat"
    >

      <span class="botsmith-menu-icon">

        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >

          <path d="M18 6L6 18"></path>

          <path d="M6 6l12 12"></path>

        </svg>

      </span>

      End chat

    </button>



    <!-- DIVIDER -->

    <div
      class="botsmith-menu-divider"
    ></div>



    <!-- RECENT CHATS -->

    <button
      class="botsmith-menu-item"
      id="botsmith-recent-chats"
    >

      <span class="botsmith-menu-icon">

        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >

          <circle
            cx="12"
            cy="12"
            r="9"
          ></circle>

          <path d="M12 7v5l3 2"></path>

        </svg>

      </span>

      View recent chats

    </button>

  `;


  /* IMPORTANT:
     Add to body so existing header overflow
     cannot clip the dropdown
  */

  document.body.appendChild(chatMenu);



  /* =========================
     5. GET BUTTON
     ========================= */

  const threeDotBtn =
    document.getElementById(
      'botsmith-three-dot-btn'
    );



  /* =========================
     6. POSITION MENU
     ========================= */

  function positionBotSmithMenu() {

    const buttonRect =
      threeDotBtn.getBoundingClientRect();


    const menuWidth = 245;


    let menuLeft =
      buttonRect.right - menuWidth;


    /* Prevent going outside left screen */

    if (menuLeft < 12) {
      menuLeft = 12;
    }


    /* Prevent going outside right screen */

    if (
      menuLeft + menuWidth >
      window.innerWidth - 12
    ) {

      menuLeft =
        window.innerWidth -
        menuWidth -
        12;

    }


    chatMenu.style.top =
      buttonRect.bottom + 8 + 'px';


    chatMenu.style.left =
      menuLeft + 'px';

  }



  /* =========================
     7. OPEN / CLOSE MENU
     ========================= */

  threeDotBtn.addEventListener(
    'click',
    (event) => {

      event.stopPropagation();


      positionBotSmithMenu();


      chatMenu.classList.toggle(
        'botsmith-menu-active'
      );

    }
  );



  /* =========================
     8. CLOSE WHEN CLICKING
     OUTSIDE
     ========================= */

  document.addEventListener(
    'click',
    (event) => {

      if (
        !menuWrapper.contains(event.target) &&
        !chatMenu.contains(event.target)
      ) {

        chatMenu.classList.remove(
          'botsmith-menu-active'
        );

      }

    }
  );



  /* =========================
     9. REPOSITION ON RESIZE
     ========================= */

  window.addEventListener(
    'resize',
    () => {

      if (
        chatMenu.classList.contains(
          'botsmith-menu-active'
        )
      ) {

        positionBotSmithMenu();

      }

    }
  );



  /* =========================
     10. START NEW CHAT
     ========================= */

  document
    .getElementById('botsmith-new-chat')
    .addEventListener(
      'click',
      () => {

        /*
         Clear existing UI messages
        */

        messages.length = 0;

        messagesContainer.innerHTML = '';



        /*
         Add welcome message again
        */

        if (
          chatbot &&
          chatbot.welcome_message
        ) {

          addMessage(
            'assistant',
            chatbot.welcome_message
          );

        }


        /*
         Close menu
        */

        chatMenu.classList.remove(
          'botsmith-menu-active'
        );

      }
    );



  /* =========================
     11. END CHAT
     ========================= */

  document
    .getElementById('botsmith-end-chat')
    .addEventListener(
      'click',
      () => {

        chatMenu.classList.remove(
          'botsmith-menu-active'
        );


        /*
         Use existing widget close logic
        */

        if (
          typeof isOpen !== 'undefined' &&
          isOpen &&
          typeof toggleChat === 'function'
        ) {

          toggleChat();

        }

      }
    );



  /* =========================
     12. RECENT CHATS
     ========================= */

  document
    .getElementById('botsmith-recent-chats')
    .addEventListener(
      'click',
      () => {

        chatMenu.classList.remove(
          'botsmith-menu-active'
        );


        /*
         Placeholder for future
         conversation history system
        */

        console.log(
          '[BotSmith] Recent chats clicked'
        );


        alert(
          'Recent chats feature coming soon!'
        );

      }
    );


})();

/* =========================================================
   BOTSMITH LEAD CAPTURE FORM
   SELF-CONTAINED BLOCK
   ========================================================= */

(() => {

  /* =========================
     1. ADD LEAD FORM CSS
     Uses existing theme color
     ========================= */

  const leadFormStyle = document.createElement('style');

  leadFormStyle.textContent = `

    #botsmith-lead-form-wrapper {
      flex: 1;

      display: flex;

      align-items: center;
      justify-content: center;

      padding: 20px;

      background: #ffffff;

      overflow-y: auto;
    }


    #botsmith-lead-form-card {
      width: 100%;

      max-width: 340px;

      background: #ffffff;

      border: 1px solid rgba(0, 0, 0, 0.08);

      border-radius: 18px;

      padding: 24px;

      box-shadow:
        0 8px 30px rgba(0, 0, 0, 0.08);

      animation:
        botsmithLeadFormEnter
        0.35s ease;
    }


    @keyframes botsmithLeadFormEnter {

      from {
        opacity: 0;
        transform: translateY(12px);
      }

      to {
        opacity: 1;
        transform: translateY(0);
      }

    }


   


    #botsmith-lead-title {

      margin: 0 0 8px 0;

      font-size: 21px;

      font-weight: 700;

      color: #222222;

      line-height: 1.2;
    }


    #botsmith-lead-description {

      margin: 0 0 22px 0;

      color: #737373;

      font-size: 13.5px;

      line-height: 1.5;
    }


    .botsmith-lead-field {

      margin-bottom: 14px;
    }


    .botsmith-lead-label {

      display: block;

      margin-bottom: 7px;

      font-size: 12px;

      font-weight: 600;

      color: #4b5563;
    }


    .botsmith-lead-input {

      width: 100%;

      height: 46px;

      border:
        1.5px solid
        #e1e1e1;

      border-radius: 10px;

      padding: 0 13px;

      font-size: 14px;

      font-family: inherit;

      color: #222222;

      outline: none;

      background: #ffffff;

      transition:
        border-color 0.2s ease,
        box-shadow 0.2s ease;
    }


    .botsmith-lead-input:focus {

      border-color:
        ${currentTheme.primary};

      box-shadow:
        0 0 0 3px
        ${currentTheme.primary}20;
    }


    .botsmith-lead-input::placeholder {

      color: #a3a3a3;
    }


    #botsmith-lead-submit {

      width: 100%;

      height: 47px;

      margin-top: 4px;

      border: none;

      border-radius: 11px;

      background:
        ${customization.primary_color} !important;

      color: #ffffff;

      font-family: inherit;

      font-size: 14px;

      font-weight: 600;

      cursor: pointer;

      transition:
        transform 0.2s ease,
        opacity 0.2s ease,
        box-shadow 0.2s ease;
    }


    #botsmith-lead-submit:hover {

      transform:
        translateY(-1px);

      opacity: 0.92;

      box-shadow:
        0 8px 20px
        ${currentTheme.primary}40;
    }


    #botsmith-lead-submit:active {

      transform:
        translateY(0);
    }


    #botsmith-lead-submit:disabled {

      opacity: 0.6;

      cursor: not-allowed;
    }


    #botsmith-lead-note {

      margin-top: 12px;

      text-align: center;

      font-size: 10.5px;

      color: #a3a3a3;

      line-height: 1.4;
    }


    #botsmith-lead-error {

      display: none;

      margin-top: 8px;

      font-size: 11px;

      color: #dc2626;
    }


    @media (max-width: 480px) {

      #botsmith-lead-form-wrapper {

        padding: 16px;
      }


      #botsmith-lead-form-card {

        max-width: none;

        padding: 22px;
      }

    }

  `;


  document.head.appendChild(
    leadFormStyle
  );



  /* =========================
     2. FIND EXISTING CHAT
     ELEMENTS
     ========================= */

  const existingMessages =
    document.getElementById(
      'botsmith-messages'
    );


  const existingInput =
    document.getElementById(
      'botsmith-input'
    );


  const chatWindow =
    document.getElementById(
      'botsmith-window'
    );


  if (
    !existingMessages ||
    !existingInput ||
    !chatWindow
  ) {

    console.warn(
      '[BotSmith] Lead form could not find widget elements'
    );

    return;
  }



  /* =========================
     3. FIND INPUT AREA
     ========================= */

  const existingInputArea =
    existingInput.parentElement;



  /* =========================
     4. SAVE ORIGINAL DISPLAY
     STATES
     ========================= */

  const originalMessagesDisplay =
    existingMessages.style.display;


  const originalInputDisplay =
    existingInputArea.style.display;



  /* =========================
     5. HIDE CHAT INITIALLY
     ========================= */

  existingMessages.style.display =
    'none';


  existingInputArea.style.display =
    'none';



  /* =========================
     6. CREATE LEAD FORM
     ========================= */

  const leadFormWrapper =
    document.createElement('div');


  leadFormWrapper.id =
    'botsmith-lead-form-wrapper';


  leadFormWrapper.innerHTML = `

    <form id="botsmith-lead-form-card">


      <!-- ICON -->

      



      <!-- TITLE -->

      <h2 id="botsmith-lead-title">

        Before we begin

      </h2>



      <!-- DESCRIPTION -->

      <p id="botsmith-lead-description">

        Tell us a little about yourself so we can assist you better.

      </p>



      <!-- NAME -->

      <div class="botsmith-lead-field">

        <label
          class="botsmith-lead-label"
          for="botsmith-lead-name"
        >

          Your name

        </label>


        <input
          id="botsmith-lead-name"
          class="botsmith-lead-input"
          type="text"
          placeholder="Enter your name"
          autocomplete="name"
          required
        >

      </div>



      <!-- PHONE -->

      <div class="botsmith-lead-field">

        <label
          class="botsmith-lead-label"
          for="botsmith-lead-phone"
        >

          Phone number

        </label>


        <input
          id="botsmith-lead-phone"
          class="botsmith-lead-input"
          type="tel"
          placeholder="Enter your phone number"
          autocomplete="tel"
          required
        >

      </div>



      <!-- SUBMIT -->

      <button
        id="botsmith-lead-submit"
        type="submit"
      >

        Start chatting →

      </button>



      <!-- ERROR -->

      <div id="botsmith-lead-error">

        Please enter your name and phone number.

      </div>



      <!-- NOTE -->

      <div id="botsmith-lead-note">

        Your information is kept private.

      </div>


    </form>

  `;



  /* =========================
     7. INSERT FORM
     BEFORE CHAT MESSAGES
     ========================= */

  existingMessages.parentNode.insertBefore(
    leadFormWrapper,
    existingMessages
  );



  /* =========================
     8. GET FORM ELEMENTS
     ========================= */

  const leadForm =
    document.getElementById(
      'botsmith-lead-form-card'
    );


  const leadNameInput =
    document.getElementById(
      'botsmith-lead-name'
    );


  const leadPhoneInput =
    document.getElementById(
      'botsmith-lead-phone'
    );


  const leadSubmitButton =
    document.getElementById(
      'botsmith-lead-submit'
    );


  const leadError =
    document.getElementById(
      'botsmith-lead-error'
    );



  /* =========================
     9. HANDLE SUBMISSION
     ========================= */

  leadForm.addEventListener(
    'submit',
    (event) => {

      event.preventDefault();


      const leadName =
        leadNameInput.value.trim();


      const leadPhone =
        leadPhoneInput.value.trim();



      /* VALIDATION */

      if (
        !leadName ||
        !leadPhone
      ) {

        leadError.style.display =
          'block';

        return;
      }



      leadError.style.display =
        'none';



      /* DISABLE BUTTON */

      leadSubmitButton.disabled =
        true;


      leadSubmitButton.textContent =
        'Starting...';



      /* =========================
         CAPTURE LEAD DATA

         Later connect this
         to your backend API
         ========================= */

      const leadData = {

        name:
          leadName,

        phone:
          leadPhone,

        chatbot_id:
          chatbot?.id ||
          chatbotId ||
          null,

        captured_at:
          new Date().toISOString()

      };



      /* TEMPORARY STORAGE */

      window.BotSmithLeadData =
        leadData;



      console.log(
        '[BotSmith] Lead captured:',
        leadData
      );



      /* CUSTOM EVENT

         Useful later for backend
         or analytics integration
      */

      window.dispatchEvent(

        new CustomEvent(
          'botsmithLeadCaptured',
          {
            detail: leadData
          }
        )

      );



      /* =========================
         SMALL TRANSITION
         ========================= */

      leadFormWrapper.style.transition =
        'opacity 0.25s ease, transform 0.25s ease';


      leadFormWrapper.style.opacity =
        '0';


      leadFormWrapper.style.transform =
        'translateY(-10px)';



      setTimeout(
        () => {


          /* REMOVE LEAD FORM */

          leadFormWrapper.remove();



          /* SHOW CHAT */

          existingMessages.style.display =
            originalMessagesDisplay ||
            'flex';


          existingInputArea.style.display =
            originalInputDisplay ||
            'flex';



          /* OPTIONAL:
             Update first assistant
             greeting with name
          */

          const firstAssistantMessage =
            existingMessages.querySelector(
              '.botsmith-message-item'
            );


          console.log(
            '[BotSmith] Chat started for:',
            leadName
          );



          /* FOCUS CHAT INPUT */

          setTimeout(
            () => {

              existingInput.focus();

            },
            100
          );


        },
        250
      );

    }
  );


})();

  // Mark as initialized
  window.BotSmithWidget.initialized = true;
  window.BotSmithWidget.version = '2.0.0'; // Version tracking
  
  } catch (error) {
    // ✅ ULTIMATE FAILSAFE: If widget completely fails, don't break customer site
    console.error('[BotSmith Widget] Fatal error during initialization:', error);
    // Silently fail - customer's website continues to work
  }
})();
