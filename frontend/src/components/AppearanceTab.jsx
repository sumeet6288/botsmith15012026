import React, { useState, useEffect, useRef } from 'react';
import { Palette, Image, Type, Layout, Eye, Upload, X, Sparkles, Lock, RefreshCw } from 'lucide-react';
import { chatbotAPI, plansAPI } from '../utils/api';
import { toast } from 'sonner';

const DemoWidget = ({ chatbot, customization, refreshKey }) => {
  const [messages, setMessages] = useState(() => [
    {
      role: 'assistant',
      content: chatbot?.welcome_message || 'Hi! How can I help you today?'
    }
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const sessionIdRef = useRef(`preview-${chatbot?.id || 'chatbot'}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  const messagesContainerRef = useRef(null);
  const isUserNearBottomRef = useRef(true);

  useEffect(() => {
    sessionIdRef.current = `preview-${chatbot?.id || 'chatbot'}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setMessages([
      {
        role: 'assistant',
        content: chatbot?.welcome_message || 'Hi! How can I help you today?'
      }
    ]);
    setInput('');
    setSending(false);
    isUserNearBottomRef.current = true;
  }, [chatbot?.id, refreshKey]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container || !isUserNearBottomRef.current) return;

    const timeoutId = setTimeout(() => {
      if (isUserNearBottomRef.current) {
        container.scrollTop = container.scrollHeight;
      }
    }, 50);

    return () => clearTimeout(timeoutId);
  }, [messages, sending]);

  const handleMessagesScroll = () => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;

    isUserNearBottomRef.current = distanceFromBottom <= 80;
  };

  const size = {
    small: { width: 360, height: 520 },
    medium: { width: 420, height: 670 },
    large: { width: 500, height: 670 },
  }[customization.widget_size] || { width: 420, height: 570 };

  const fontSize = {
    small: '14px',
    medium: '16px',
    large: '18px',
  }[customization.font_size] || '16px';

  const bubbleRadius = {
    rounded: '20px',
    smooth: '14px',
    square: '6px',
  }[customization.bubble_style] || '20px';

  const isDark = customization.widget_theme === 'dark';
  const isAutoDark = customization.widget_theme === 'auto' && window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  const dark = isDark || isAutoDark;

  const surface = dark ? '#111827' : '#ffffff';
  const messageSurface = dark ? '#1f2937' : '#fafafa';
  const border = dark ? '#374151' : '#e5e7eb';
  const text = dark ? '#f9fafb' : '#111827';
  const muted = dark ? '#9ca3af' : '#6b7280';

  // The editor preview stays physically centered.
  // widget_position still remains a real customization setting, but it
  // must not move the editor preview itself.
  const positionClasses = 'left-1/2 top-[55%] -translate-x-1/2 -translate-y-1/2';

  const sendMessage = async (event) => {
    event.preventDefault();
    const message = input.trim();
    if (!message || sending || !chatbot?.id) return;

    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: message }]);
    setSending(true);

    try {
      const response = await fetch(`/api/public/chat/${chatbot.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          session_id: sessionIdRef.current,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const detail = data?.detail;
        const errorMessage =
          detail?.error === 'subscription_expired'
            ? 'This chatbot is temporarily unavailable because its subscription has expired.'
            : detail?.error === 'payment_failed'
              ? 'This chatbot is temporarily unavailable. Please try again later.'
              : response.status === 429
                ? 'Monthly message limit reached. Please try again later.'
                : 'Unable to get a response right now.';
        throw new Error(errorMessage);
      }

      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: data?.message || data?.response || 'I received your message.' }
      ]);
    } catch (error) {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: error.message || 'Unable to send message. Please try again.' }
      ]);
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className={`absolute ${positionClasses} z-10 max-w-[calc(100%-48px)] overflow-hidden`}
      style={{
        width: `min(${size.width}px, calc(100% - 48px))`,
        height: `min(${size.height}px, calc(100% - 48px))`,
        minHeight: 0,
      }}
    >
      <div
        className="flex h-full min-h-0 flex-col overflow-hidden border shadow-2xl"
        style={{
          width: '100%',
          height: '100%',
          minHeight: 0,
          background: surface,
          borderColor: border,
          borderRadius: 24,
          color: text,
          fontFamily: customization.font_family,
        }}
      >
        <div
          className="flex items-center gap-3 shrink-0"
          style={{
            minHeight: 72,
            padding: '12px 16px',
            color: '#fff',
            background: `linear-gradient(135deg, ${customization.primary_color} 0%, ${customization.secondary_color} 60%, ${customization.accent_color} 100%)`,
          }}
        >
          <div className="w-11 h-11 shrink-0 rounded-full bg-white flex items-center justify-center overflow-hidden shadow-sm">
            {customization.logo_url ? (
              <img src={customization.logo_url} alt="Chatbot logo" className="w-full h-full object-cover" />
            ) : (
              <div className="w-7 h-7 rounded-full" style={{ background: customization.primary_color }} />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-semibold truncate" style={{ fontSize: 16 }}>{chatbot?.name || 'Chat Support'}</div>
            <div className="text-xs opacity-90">We're here to help!</div>
          </div>
          <button type="button" className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center text-white" aria-label="Preview is open">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div
          ref={messagesContainerRef}
          onScroll={handleMessagesScroll}
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-5 space-y-4"
          style={{
            flex: '1 1 0%',
            minHeight: 0,
            backgroundColor: messageSurface,
            backgroundImage: dark ? 'radial-gradient(circle, rgba(255,255,255,0.08) 1px, transparent 1px)' : 'radial-gradient(circle, rgba(148,163,184,0.32) 1px, transparent 1px)',
            backgroundSize: '18px 18px',
          }}
        >
          {messages.map((message, index) => (
            <div key={`${index}-${message.role}`} className={`flex gap-2.5 ${message.role === 'user' ? 'justify-end' : 'items-start'}`}>
              {message.role === 'assistant' && (
                <div className="w-9 h-9 shrink-0 rounded-full overflow-hidden flex items-center justify-center" style={{ background: customization.accent_color }}>
                  {customization.avatar_url ? (
                    <img src={customization.avatar_url} alt="Assistant avatar" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-white/90" />
                  )}
                </div>
              )}
              <div
                className="max-w-[78%] px-4 py-3 shadow-sm whitespace-pre-wrap break-words"
                style={{
                  borderRadius: bubbleRadius,
                  fontSize,
                  lineHeight: 1.55,
                  background: message.role === 'user' ? customization.accent_color : surface,
                  color: message.role === 'user' ? '#fff' : text,
                  border: message.role === 'user' ? 'none' : `1px solid ${border}`,
                }}
              >
                {message.content}
              </div>
            </div>
          ))}
          {sending && (
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: customization.accent_color }}>
                <div className="w-5 h-5 rounded-full bg-white/90" />
              </div>
              <div className="px-4 py-3 rounded-2xl border" style={{ background: surface, borderColor: border, color: muted }}>
                <span className="animate-pulse">Thinking...</span>
              </div>
            </div>
          )}
        </div>

        <form onSubmit={sendMessage} className="shrink-0 border-t p-3" style={{ background: surface, borderColor: border }}>
          <div className="flex items-center gap-2">
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              disabled={sending}
              placeholder="Type your message..."
              className="min-w-0 flex-1 outline-none"
              style={{
                height: 46,
                padding: '0 16px',
                borderRadius: 24,
                border: `1px solid ${border}`,
                background: dark ? '#1f2937' : '#fafafa',
                color: text,
                fontSize,
                fontFamily: customization.font_family,
              }}
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              className="w-11 h-11 shrink-0 rounded-full flex items-center justify-center text-white disabled:opacity-40"
              style={{ background: customization.accent_color }}
              aria-label="Send message"
            >
              <span className="text-lg">➤</span>
            </button>
          </div>
        </form>

        {customization.powered_by_text !== '' && (
          <div className="shrink-0 text-center py-2 border-t" style={{ borderColor: border, color: muted, background: dark ? '#0f172a' : '#fafafa', fontSize: 11 }}>
            Powered by <span className="font-semibold" style={{ color: customization.primary_color }}>{customization.powered_by_text || 'BotSmith'}</span>
          </div>
        )}
      </div>
    </div>
  );
};

const AppearanceTab = ({ chatbot, onUpdate }) => {
  const [customization, setCustomization] = useState({
    primary_color: chatbot?.primary_color || '#7c3aed',
    secondary_color: chatbot?.secondary_color || '#a78bfa',
    accent_color: chatbot?.accent_color || '#ec4899',
    logo_url: chatbot?.logo_url || '',
    avatar_url: chatbot?.avatar_url || '',
    widget_position: chatbot?.widget_position || 'bottom-right',
    widget_theme: chatbot?.widget_theme || 'light',
    font_family: chatbot?.font_family || 'Inter, system-ui, sans-serif',
    font_size: chatbot?.font_size || 'medium',
    bubble_style: chatbot?.bubble_style || 'rounded',
    widget_size: chatbot?.widget_size || 'medium',
    auto_expand: chatbot?.auto_expand || false,
    powered_by_text: chatbot?.powered_by_text || '',
  });

  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [userPlan, setUserPlan] = useState(null);
  const [loadingPlan, setLoadingPlan] = useState(true);
  const logoInputRef = useRef(null);
  const avatarInputRef = useRef(null);
  const [activeSection, setActiveSection] = useState('customization');
  const [previewVersion, setPreviewVersion] = useState(0);
  const appearanceRootRef = useRef(null);

  // The parent screen currently wraps this component in its own card and heading.
  // Normalize that wrapper here so this component can occupy the full Appearance area
  // even before the parent component is updated.
  useEffect(() => {
    const root = appearanceRootRef.current;
    const wrapper = root?.parentElement;
    if (!wrapper) return;

    const heading = Array.from(wrapper.querySelectorAll('h2')).find(
      (node) => node.textContent?.trim() === 'Customize Appearance'
    );

    const previous = {
      headingDisplay: heading?.style.display || '',
      wrapperCssText: wrapper.style.cssText,
    };

    if (heading) {
      heading.style.display = 'none';
    }

    wrapper.style.padding = '0';
    wrapper.style.margin = '0';
    wrapper.style.maxWidth = 'none';
    wrapper.style.width = '100%';
    wrapper.style.height = '100%';
    wrapper.style.minHeight = '0';
    wrapper.style.background = 'transparent';
    wrapper.style.border = '0';
    wrapper.style.borderRadius = '0';
    wrapper.style.boxShadow = 'none';

    return () => {
      if (heading) heading.style.display = previous.headingDisplay;
      wrapper.style.cssText = previous.wrapperCssText;
    };
  }, []);

  // Sync customization state when chatbot prop changes
  useEffect(() => {
    if (chatbot) {
      setCustomization({
        primary_color: chatbot?.primary_color || '#7c3aed',
        secondary_color: chatbot?.secondary_color || '#a78bfa',
        accent_color: chatbot?.accent_color || '#ec4899',
        logo_url: chatbot?.logo_url || '',
        avatar_url: chatbot?.avatar_url || '',
        widget_position: chatbot?.widget_position || 'bottom-right',
        widget_theme: chatbot?.widget_theme || 'light',
        font_family: chatbot?.font_family || 'Inter, system-ui, sans-serif',
        font_size: chatbot?.font_size || 'medium',
        bubble_style: chatbot?.bubble_style || 'rounded',
        widget_size: chatbot?.widget_size || 'medium',
        auto_expand: chatbot?.auto_expand || false,
        powered_by_text: chatbot?.powered_by_text || '',
      });
    }
  }, [chatbot]);

  // Fetch user's plan to check if they have custom branding
  useEffect(() => {
    const fetchUserPlan = async () => {
      try {
        const response = await plansAPI.getUsageStats();
        setUserPlan(response.data.plan);
      } catch (error) {
        console.error('Error fetching user plan:', error);
      } finally {
        setLoadingPlan(false);
      }
    };
    fetchUserPlan();
  }, []);

  const handleChange = (field, value) => {
    setCustomization(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await chatbotAPI.update(chatbot.id, customization);
      toast.success('Appearance updated successfully! Open the live preview to see changes.');
      // Non-blocking refresh - don't wait for it
      if (onUpdate) {
        onUpdate().catch(err => console.error('Error refreshing chatbot:', err));
      }
    } catch (error) {
      console.error('Error updating appearance:', error);
      toast.error('Failed to update appearance. Please upgrade to use premium features');
    } finally {
      setSaving(false);
    }
  };

  const handleViewLivePreview = () => {
    // Add timestamp to force reload and bypass cache
    const previewUrl = `/public-chat/${chatbot.id}?t=${Date.now()}`;
    window.open(previewUrl, '_blank');
  };

  const handleLogoUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp', 'image/svg+xml'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Invalid file type. Please upload PNG, JPEG, JPG, GIF, WEBP, or SVG');
      return;
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      toast.error(`Image size exceeds 5MB. Current size: ${(file.size / 1024 / 1024).toFixed(2)}MB`);
      return;
    }

    setUploadingLogo(true);
    try {
      const response = await chatbotAPI.uploadBrandingImage(chatbot.id, file, 'logo');

      if (response.data.success) {
        setCustomization(prev => ({ ...prev, logo_url: response.data.url }));
        toast.success('Logo uploaded successfully!');
        // Non-blocking refresh
        if (onUpdate) {
          onUpdate().catch(err => console.error('Error refreshing chatbot:', err));
        }
      }
    } catch (error) {
      console.error('Error uploading logo:', error);
      toast.error(error.response?.data?.detail || 'Failed to upload logo');
    } finally {
      setUploadingLogo(false);
      // Reset file input
      if (logoInputRef.current) {
        logoInputRef.current.value = '';
      }
    }
  };

  const handleAvatarUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp', 'image/svg+xml'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Invalid file type. Please upload PNG, JPEG, JPG, GIF, WEBP, or SVG');
      return;
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      toast.error(`Image size exceeds 5MB. Current size: ${(file.size / 1024 / 1024).toFixed(2)}MB`);
      return;
    }

    setUploadingAvatar(true);
    try {
      const response = await chatbotAPI.uploadBrandingImage(chatbot.id, file, 'avatar');

      if (response.data.success) {
        setCustomization(prev => ({ ...prev, avatar_url: response.data.url }));
        toast.success('Avatar uploaded successfully!');
        // Non-blocking refresh
        if (onUpdate) {
          onUpdate().catch(err => console.error('Error refreshing chatbot:', err));
        }
      }
    } catch (error) {
      console.error('Error uploading avatar:', error);
      toast.error(error.response?.data?.detail || 'Failed to upload avatar');
    } finally {
      setUploadingAvatar(false);
      // Reset file input
      if (avatarInputRef.current) {
        avatarInputRef.current.value = '';
      }
    }
  };

  const handleRemoveLogo = async () => {
    try {
      setCustomization(prev => ({ ...prev, logo_url: '' }));
      await chatbotAPI.update(chatbot.id, { logo_url: '' });
      toast.success('Logo removed successfully!');
      // Non-blocking refresh
      if (onUpdate) {
        onUpdate().catch(err => console.error('Error refreshing chatbot:', err));
      }
    } catch (error) {
      console.error('Error removing logo:', error);
      toast.error('Failed to remove logo');
    }
  };

  const handleRemoveAvatar = async () => {
    try {
      setCustomization(prev => ({ ...prev, avatar_url: '' }));
      await chatbotAPI.update(chatbot.id, { avatar_url: '' });
      toast.success('Avatar removed successfully!');
      // Non-blocking refresh
      if (onUpdate) {
        onUpdate().catch(err => console.error('Error refreshing chatbot:', err));
      }
    } catch (error) {
      console.error('Error removing avatar:', error);
      toast.error('Failed to remove avatar');
    }
  };

  // The preview is intentionally a local demo widget. It uses the chatbot id for
  // real conversations, while its appearance is driven directly by unsaved form state.
  const tabItems = [
    { id: 'customization', label: 'Customization', icon: Palette },
    { id: 'branding', label: 'Branding', icon: Image },
    { id: 'settings', label: 'Settings', icon: Layout },
  ];

  const sectionCard = 'bg-white border border-gray-200 rounded-xl shadow-sm';
  const inputClass = 'w-full px-3 py-2.5 border border-gray-200 rounded-lg bg-white text-sm text-gray-900 outline-none transition-all focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400';
  const colorInputClass = 'h-10 w-14 rounded-lg border border-gray-200 cursor-pointer bg-white p-1';

  return (
    <div ref={appearanceRootRef} className="relative h-auto md:h-full min-h-[calc(100vh-120px)] md:min-h-0 flex flex-col overflow-hidden bg-gray-50">
      <div className="relative flex-1 min-h-0 h-auto md:h-full overflow-visible md:overflow-hidden">
        <div className="relative md:absolute md:inset-y-0 md:left-0 w-full md:w-[45%] min-h-0 h-auto md:h-full flex flex-col overflow-visible md:overflow-hidden border-r-0 md:border-r-2 border-gray-300 bg-gray-50">
          <div className="flex-shrink-0 bg-white border-b border-gray-200 px-3 py-3">
            <div className="flex w-full max-w-full overflow-x-auto rounded-lg bg-gray-100 p-1 border border-gray-200">
              {tabItems.map(({ id, label, icon: Icon }) => {
                const active = activeSection === id;
                return (
                  <button key={id} type="button" onClick={() => setActiveSection(id)} className={`inline-flex flex-1 min-w-0 items-center justify-center gap-2 whitespace-nowrap rounded-md px-2 sm:px-5 py-2 text-sm font-medium transition-all ${active ? 'bg-white text-gray-900 shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-800 hover:bg-white/60'}`}>
                    <Icon className="w-4 h-4" />
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
            <div className="w-full max-w-none px-3 py-5 space-y-4">
          {/* CUSTOMIZATION */}
          {activeSection === 'customization' && (
            <div className="space-y-4">
              <div className={sectionCard}>
                <div className="px-5 py-4 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <Palette className="w-4.5 h-4.5 text-purple-600" />
                    <h3 className="text-base font-semibold text-gray-900">Colors</h3>
                  </div>
                  <p className="mt-1 text-sm text-gray-500">
                    Set the colors used throughout your agent.
                  </p>
                </div>

                <div className="p-5 space-y-4">
                  {[
                    { key: 'primary_color', label: 'Primary color', placeholder: '#7c3aed' },
                    { key: 'secondary_color', label: 'Secondary color', placeholder: '#a78bfa' },
                    { key: 'accent_color', label: 'Accent color', placeholder: '#ec4899' },
                  ].map(({ key, label, placeholder }) => (
                    <div key={key}>
                      <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={customization[key]}
                          onChange={(e) => handleChange(key, e.target.value)}
                          className={colorInputClass}
                          aria-label={`${label} picker`}
                        />
                        <input
                          type="text"
                          value={customization[key]}
                          onChange={(e) => handleChange(key, e.target.value)}
                          className={inputClass}
                          placeholder={placeholder}
                          aria-label={label}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className={sectionCard}>
                <div className="px-5 py-4 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <Type className="w-4.5 h-4.5 text-purple-600" />
                    <h3 className="text-base font-semibold text-gray-900">Font</h3>
                  </div>
                  <p className="mt-1 text-sm text-gray-500">
                    Choose the typography used inside the chatbot.
                  </p>
                </div>

                <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Font family</label>
                    <select
                      value={customization.font_family}
                      onChange={(e) => handleChange('font_family', e.target.value)}
                      className={inputClass}
                    >
                      <option value="Inter, system-ui, sans-serif">Inter (Default)</option>
                      <option value="Arial, sans-serif">Arial</option>
                      <option value="Helvetica, sans-serif">Helvetica</option>
                      <option value="Georgia, serif">Georgia</option>
                      <option value="'Times New Roman', serif">Times New Roman</option>
                      <option value="'Courier New', monospace">Courier New</option>
                      <option value="Verdana, sans-serif">Verdana</option>
                      <option value="'Trebuchet MS', sans-serif">Trebuchet MS</option>
                      <option value="Roboto, sans-serif">Roboto</option>
                      <option value="'Open Sans', sans-serif">Open Sans</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Font size</label>
                    <select
                      value={customization.font_size}
                      onChange={(e) => handleChange('font_size', e.target.value)}
                      className={inputClass}
                    >
                      <option value="small">Small (14px)</option>
                      <option value="medium">Medium (16px)</option>
                      <option value="large">Large (18px)</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* BRANDING */}
          {activeSection === 'branding' && (
            <div className="space-y-4">
              <div className={sectionCard}>
                <div className="px-5 py-4 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <Image className="w-4.5 h-4.5 text-purple-600" />
                    <h3 className="text-base font-semibold text-gray-900">Branding</h3>
                  </div>
                  <p className="mt-1 text-sm text-gray-500">
                    Personalize the agent with your logo and assistant avatar.
                  </p>
                </div>

                <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-5">
                  {/* Logo */}
                  <div className="rounded-xl border border-gray-200 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">Logo</p>
                        <p className="text-xs text-gray-500 mt-0.5">Displayed in the agent branding.</p>
                      </div>
                      {customization.logo_url && (
                        <button
                          type="button"
                          onClick={handleRemoveLogo}
                          className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Remove logo"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {!customization.logo_url ? (
                      <>
                        <input
                          ref={logoInputRef}
                          type="file"
                          accept="image/png,image/jpeg,image/jpg,image/gif,image/webp,image/svg+xml"
                          onChange={handleLogoUpload}
                          className="hidden"
                          disabled={uploadingLogo}
                        />
                        <button
                          type="button"
                          onClick={() => logoInputRef.current?.click()}
                          disabled={uploadingLogo}
                          className="w-full h-28 rounded-lg border border-dashed border-gray-300 hover:border-purple-400 hover:bg-purple-50/50 transition-colors flex flex-col items-center justify-center gap-2 text-gray-500 hover:text-purple-600 disabled:opacity-50"
                        >
                          {uploadingLogo ? (
                            <>
                              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-purple-600" />
                              <span className="text-sm">Uploading...</span>
                            </>
                          ) : (
                            <>
                              <Upload className="w-5 h-5" />
                              <span className="text-sm font-medium">Upload logo</span>
                              <span className="text-xs">PNG, JPG, GIF, WEBP or SVG · 5MB max</span>
                            </>
                          )}
                        </button>
                      </>
                    ) : (
                      <div className="space-y-3">
                        <div className="h-28 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center p-3">
                          <img
                            src={customization.logo_url}
                            alt="Logo preview"
                            className="max-h-20 max-w-full object-contain"
                            onError={(e) => { e.target.style.display = 'none'; }}
                          />
                        </div>
                        <input
                          ref={logoInputRef}
                          type="file"
                          accept="image/png,image/jpeg,image/jpg,image/gif,image/webp,image/svg+xml"
                          onChange={handleLogoUpload}
                          className="hidden"
                          disabled={uploadingLogo}
                        />
                        <button
                          type="button"
                          onClick={() => logoInputRef.current?.click()}
                          disabled={uploadingLogo}
                          className="w-full px-3 py-2 text-sm font-medium border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          <Upload className="w-4 h-4" />
                          Change logo
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Avatar */}
                  <div className="rounded-xl border border-gray-200 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">Avatar</p>
                        <p className="text-xs text-gray-500 mt-0.5">Displayed alongside assistant messages.</p>
                      </div>
                      {customization.avatar_url && (
                        <button
                          type="button"
                          onClick={handleRemoveAvatar}
                          className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Remove avatar"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {!customization.avatar_url ? (
                      <>
                        <input
                          ref={avatarInputRef}
                          type="file"
                          accept="image/png,image/jpeg,image/jpg,image/gif,image/webp,image/svg+xml"
                          onChange={handleAvatarUpload}
                          className="hidden"
                          disabled={uploadingAvatar}
                        />
                        <button
                          type="button"
                          onClick={() => avatarInputRef.current?.click()}
                          disabled={uploadingAvatar}
                          className="w-full h-28 rounded-lg border border-dashed border-gray-300 hover:border-purple-400 hover:bg-purple-50/50 transition-colors flex flex-col items-center justify-center gap-2 text-gray-500 hover:text-purple-600 disabled:opacity-50"
                        >
                          {uploadingAvatar ? (
                            <>
                              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-purple-600" />
                              <span className="text-sm">Uploading...</span>
                            </>
                          ) : (
                            <>
                              <Upload className="w-5 h-5" />
                              <span className="text-sm font-medium">Upload avatar</span>
                              <span className="text-xs">PNG, JPG, GIF, WEBP or SVG · 5MB max</span>
                            </>
                          )}
                        </button>
                      </>
                    ) : (
                      <div className="space-y-3">
                        <div className="h-28 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center p-3">
                          <img
                            src={customization.avatar_url}
                            alt="Avatar preview"
                            className="w-20 h-20 rounded-full object-cover border border-gray-200"
                            onError={(e) => { e.target.style.display = 'none'; }}
                          />
                        </div>
                        <input
                          ref={avatarInputRef}
                          type="file"
                          accept="image/png,image/jpeg,image/jpg,image/gif,image/webp,image/svg+xml"
                          onChange={handleAvatarUpload}
                          className="hidden"
                          disabled={uploadingAvatar}
                        />
                        <button
                          type="button"
                          onClick={() => avatarInputRef.current?.click()}
                          disabled={uploadingAvatar}
                          className="w-full px-3 py-2 text-sm font-medium border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          <Upload className="w-4 h-4" />
                          Change avatar
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Chat bubble */}
              <div className={sectionCard}>
                <div className="px-5 py-4 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <Layout className="w-4.5 h-4.5 text-purple-600" />
                    <h3 className="text-base font-semibold text-gray-900">Chat bubble</h3>
                  </div>
                  <p className="mt-1 text-sm text-gray-500">Choose the shape used by the floating chat launcher.</p>
                </div>

                <div className="p-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { value: 'rounded', label: 'Rounded', radius: 'rounded-2xl' },
                    { value: 'smooth', label: 'Smooth', radius: 'rounded-lg' },
                    { value: 'square', label: 'Square', radius: 'rounded-md' },
                  ].map(({ value, label, radius }) => {
                    const active = customization.bubble_style === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => handleChange('bubble_style', value)}
                        className={`p-3 text-left rounded-xl border transition-all ${
                          active
                            ? 'border-purple-500 bg-purple-50 ring-2 ring-purple-100'
                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <div className={`h-14 bg-gradient-to-r from-purple-500 to-pink-500 ${radius} mb-3`} />
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-900">{label}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* White label */}
              <div className={sectionCard}>
                <div className="px-5 py-4 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4.5 h-4.5 text-purple-600" />
                    <h3 className="text-base font-semibold text-gray-900">White-label branding</h3>
                    {(!userPlan?.limits?.custom_branding && !loadingPlan) && (
                      <span className="px-2 py-0.5 text-[10px] font-bold bg-purple-100 text-purple-700 rounded-full">PRO</span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-gray-500">Control the branding shown at the bottom of your widget.</p>
                </div>

                <div className="p-5">
                  {loadingPlan ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600" />
                    </div>
                  ) : userPlan?.limits?.custom_branding ? (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Custom “Powered by” text</label>
                      <input
                        type="text"
                        value={customization.powered_by_text || ''}
                        onChange={(e) => handleChange('powered_by_text', e.target.value)}
                        placeholder="e.g. Your Brand Name (leave empty to hide)"
                        className={inputClass}
                        maxLength={50}
                      />
                      <p className="mt-2 text-xs text-gray-500">
                        {customization.powered_by_text
                          ? `Preview: “Powered by ${customization.powered_by_text}”`
                          : 'Branding will be hidden when empty.'}
                      </p>
                    </div>
                  ) : (
                    <div className="flex items-start gap-4 p-4 rounded-xl bg-gray-50 border border-gray-200">
                      <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-white border border-gray-200 flex items-center justify-center">
                        <Lock className="w-5 h-5 text-gray-500" />
                      </div>
                      <div className="flex-1">
                        <h4 className="text-sm font-semibold text-gray-900">White-label branding is a paid feature</h4>
                        <p className="mt-1 text-sm text-gray-600">
                          Starter, Professional, and Enterprise plans can customize or remove the “Powered by” text.
                        </p>
                        <button
                          type="button"
                          onClick={() => window.location.href = '/subscription'}
                          className="mt-3 px-3.5 py-2 text-sm font-semibold text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors"
                        >
                          Upgrade plan
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* SETTINGS */}
          {activeSection === 'settings' && (
            <div className="space-y-4">
              <div className={sectionCard}>
                <div className="px-5 py-4 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <Layout className="w-4.5 h-4.5 text-purple-600" />
                    <h3 className="text-base font-semibold text-gray-900">Widget settings</h3>
                  </div>
                  <p className="mt-1 text-sm text-gray-500">Control the widget position, theme, and size.</p>
                </div>

                <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Position</label>
                    <select
                      value={customization.widget_position}
                      onChange={(e) => handleChange('widget_position', e.target.value)}
                      className={inputClass}
                    >
                      <option value="bottom-right">Bottom right</option>
                      <option value="bottom-left">Bottom left</option>
                      <option value="top-right">Top right</option>
                      <option value="top-left">Top left</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Theme</label>
                    <select
                      value={customization.widget_theme}
                      onChange={(e) => handleChange('widget_theme', e.target.value)}
                      className={inputClass}
                    >
                      <option value="light">Light</option>
                      <option value="dark">Dark</option>
                      <option value="auto">Auto</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Widget size</label>
                    <select
                      value={customization.widget_size}
                      onChange={(e) => handleChange('widget_size', e.target.value)}
                      className={inputClass}
                    >
                      <option value="small">Small (360px)</option>
                      <option value="medium">Medium (420px)</option>
                      <option value="large">Large (500px)</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className={sectionCard}>
                <div className="px-5 py-4 border-b border-gray-100">
                  <h3 className="text-base font-semibold text-gray-900">Behavior</h3>
                  <p className="mt-1 text-sm text-gray-500">Choose how the widget behaves when visitors arrive.</p>
                </div>
                <div className="p-5">
                  <div className="flex items-center justify-between gap-4 p-4 rounded-xl border border-gray-200 bg-gray-50/70">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Auto-expand widget</p>
                      <p className="mt-1 text-sm text-gray-500">Automatically open the chat widget when the page loads.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                      <input
                        type="checkbox"
                        checked={customization.auto_expand}
                        onChange={(e) => handleChange('auto_expand', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600" />
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}


            <div className="sticky bottom-0 z-10 -mx-5 px-5 py-4 bg-gray-50/95 backdrop-blur border-t border-gray-200 flex items-center justify-end gap-3">
              <button type="button" onClick={handleViewLivePreview} className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                <Eye className="w-4 h-4" />
                Open live preview
              </button>
              <button type="button" onClick={handleSave} disabled={saving} className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                {saving && <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/40 border-t-white" />}
                {saving ? 'Saving...' : 'Save appearance'}
              </button>
            </div>
          </div>
        </div>
        </div>

        <div className="relative md:absolute md:inset-y-0 md:right-0 w-full md:w-[55%] min-h-[700px] md:min-h-0 h-[700px] md:h-full overflow-hidden bg-white border-l-0">
          <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle, rgba(148,163,184,0.28) 1px, transparent 1px)', backgroundSize: '18px 18px' }} />
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute top-4 left-2 right-5 flex items-center justify-between z-20 pointer-events-none">
              <button type="button" onClick={() => setPreviewVersion(v => v + 1)} className="pointer-events-auto inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-600 bg-white/95 border border-gray-200 rounded-lg shadow-sm hover:bg-white transition-colors" title="Reset preview conversation">
                <RefreshCw className="w-3.5 h-3.5" />
                Refresh
              </button>
            </div>
            <DemoWidget
              key={`${chatbot?.id || 'chatbot'}-${previewVersion}`}
              chatbot={chatbot}
              customization={customization}
              refreshKey={previewVersion}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default AppearanceTab;
