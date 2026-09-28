import React, { useEffect, useState } from 'react';
import { chatbotAPI } from '../utils/api';
import { createPortal } from 'react-dom'; 
import { MessageSquarePlus, Link2, X } from 'lucide-react'; 

const SuggestedMessagesModal = ({ onClose, messageCount, setMessageCount, messages, setMessages, onSave, isSaving }) => { 
  const handleCountChange = (event) => { 
    const count = Number(event.target.value); 
    setMessageCount(count); 

    setMessages((currentMessages) => 
      Array.from({ length: count }, (_, index) => currentMessages[index] || '') 
    ); 
  }; 

  const handleMessageChange = (index, value) => { 
    setMessages((currentMessages) => { 
      const updatedMessages = [...currentMessages]; 
      updatedMessages[index] = value; 
      return updatedMessages; 
    }); 
  }; 

  return ( 
    <div className="fixed inset-0 z-[9999] flex items-start justify-center bg-black/50 px-4 pt-24 pb-6"> 
      <div className="relative z-[10000] flex max-h-[calc(100vh-6rem)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl"> 
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-5"> 
          <div> 
            <h3 className="text-lg font-semibold tracking-tight text-gray-950"> 
              Suggested messages 
            </h3> 
            <p className="mt-1 text-sm text-gray-500"> 
              Add messages that users can select during a conversation. 
            </p> 
          </div> 

          <button 
            type="button" 
            onClick={onClose} 
            aria-label="Close" 
            className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900" 
          > 
            <X className="h-5 w-5" /> 
          </button> 
        </div> 

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6"> 
          <div> 
            <label 
              htmlFor="suggested-message-count" 
              className="mb-2 block text-sm font-medium text-gray-900" 
            > 
              Select suggest messages 
            </label> 

            <select 
              id="suggested-message-count" 
              value={messageCount} 
              onChange={handleCountChange} 
              className="h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none transition focus:border-gray-400 focus:ring-2 focus:ring-gray-100" 
            > 
              <option value={1}>1</option> 
              <option value={2}>2</option> 
              <option value={3}>3</option> 
              <option value={4}>4</option> 
              <option value={5}>5</option> 
            </select> 
          </div> 

          <div className="mt-5 space-y-4"> 
            {messages.map((message, index) => ( 
              <div key={index}> 
                <label 
                  htmlFor={`suggested-message-${index}`} 
                  className="mb-2 block text-sm font-medium text-gray-900" 
                > 
                  Message {index + 1} 
                </label> 

                <input 
                  id={`suggested-message-${index}`} 
                  type="text" 
                  value={message} 
                  onChange={(event) => 
                    handleMessageChange(index, event.target.value) 
                  } 
                  placeholder={`Enter suggested message ${index + 1}`} 
                  className="h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition focus:border-gray-400 focus:ring-2 focus:ring-gray-100" 
                /> 
              </div> 
            ))} 
          </div> 
        </div> 

        <div className="flex justify-end border-t border-gray-100 px-6 py-4"> 
          <button 
            type="button" 
            onClick={onSave} 
            disabled={isSaving} 
            className="rounded-lg bg-gray-950 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60" 
          > 
            {isSaving ? 'Saving...' : 'Save messages'} 
          </button> 
        </div> 
      </div> 
    </div> 
  ); 
}; 

// New UI-only modal for Keyword Link Actions. No persistence or widget logic yet.
const KeywordLinkActionsModal = ({ onClose, actionCount, setActionCount, actions, setActions, onSave, isSaving }) => {
  const handleCountChange = (event) => {
    const count = Number(event.target.value);
    setActionCount(count);
    setActions((currentActions) =>
      Array.from(
        { length: count },
        (_, index) => currentActions[index] || { keyword: '', buttonName: '', link: '' }
      )
    );
  };

  const handleActionChange = (index, field, value) => {
    setActions((currentActions) => {
      const updatedActions = [...currentActions];
      updatedActions[index] = { ...updatedActions[index], [field]: value };
      return updatedActions;
    });
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-start justify-center bg-black/50 px-4 pt-24 pb-6">
      <div className="relative z-[10000] flex max-h-[calc(100vh-6rem)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-5">
          <div>
            <h3 className="text-lg font-semibold tracking-tight text-gray-950">
              Keyword link actions
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Configure a keyword, button name, and link for each action.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
          <div>
            <label htmlFor="keyword-action-count" className="mb-2 block text-sm font-medium text-gray-900">
              Select number of actions
            </label>
            <select
              id="keyword-action-count"
              value={actionCount}
              onChange={handleCountChange}
              className="h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none transition focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
            >
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={3}>3</option>
              <option value={4}>4</option>
              <option value={5}>5</option>
            </select>
          </div>

          <div className="mt-5 space-y-5">
            {actions.map((action, index) => (
              <div key={index} className="space-y-3">
                <h4 className="text-sm font-semibold text-gray-900">Action {index + 1}</h4>
                <div>
                  <label htmlFor={`keyword-action-keyword-${index}`} className="mb-2 block text-sm font-medium text-gray-900">
                    Keyword
                  </label>
                  <input
                    id={`keyword-action-keyword-${index}`}
                    type="text"
                    value={action.keyword}
                    onChange={(event) => handleActionChange(index, 'keyword', event.target.value)}
                    placeholder="Enter keyword"
                    className="h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
                  />
                </div>
                <div>
                  <label htmlFor={`keyword-action-button-${index}`} className="mb-2 block text-sm font-medium text-gray-900">
                    Button Name
                  </label>
                  <input
                    id={`keyword-action-button-${index}`}
                    type="text"
                    value={action.buttonName}
                    onChange={(event) => handleActionChange(index, 'buttonName', event.target.value)}
                    placeholder="Enter button name"
                    className="h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
                  />
                </div>
                <div>
                  <label htmlFor={`keyword-action-link-${index}`} className="mb-2 block text-sm font-medium text-gray-900">
                    Link
                  </label>
                  <input
                    id={`keyword-action-link-${index}`}
                    type="url"
                    value={action.link}
                    onChange={(event) => handleActionChange(index, 'link', event.target.value)}
                    placeholder="https://example.com"
                    className="h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end border-t border-gray-100 px-6 py-4">
          <button type="button" onClick={onSave} disabled={isSaving} className="rounded-lg bg-gray-950 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60">
            {isSaving ? 'Saving...' : 'Save actions'}
          </button>
        </div>
      </div>
    </div>
  );
};

const AIActions = ({ chatbotId }) => { 
  const [isSuggestedMessagesOpen, setIsSuggestedMessagesOpen] = useState(false); 
  const [isSuggestedMessagesEnabled, setIsSuggestedMessagesEnabled] = useState(false); 
  const [messageCount, setMessageCount] = useState(1); 
  const [messages, setMessages] = useState(['']); 
  const [isSaving, setIsSaving] = useState(false); 

  // New feature state is local UI state only for this step.
  const [isKeywordLinksOpen, setIsKeywordLinksOpen] = useState(false);
  const [isKeywordLinksEnabled, setIsKeywordLinksEnabled] = useState(false);
  const [actionCount, setActionCount] = useState(1);
  const [keywordActions, setKeywordActions] = useState([
    { keyword: '', buttonName: '', link: '' },
  ]);

  useEffect(() => { 
    if (!chatbotId) return; 

    const loadAIActions = async () => { 
      try { 
        const response = await chatbotAPI.get(chatbotId); 
        const suggestedMessages = 
          response.data?.ai_actions?.suggested_messages || {}; 

        const keywordLinks = response.data?.ai_actions?.keyword_links || {};
        const savedActions = Array.isArray(keywordLinks.actions) ? keywordLinks.actions : [];
        const normalizedActions = savedActions.map((action) => ({
          keyword: action.keyword || '',
          buttonName: action.button_name || action.buttonName || '',
          link: action.link || '',
        }));

        if (normalizedActions.length > 0) {
          setActionCount(normalizedActions.length);
          setKeywordActions(normalizedActions);
        }
        setIsKeywordLinksEnabled(keywordLinks.enabled === true);

        const savedMessages = Array.isArray(suggestedMessages.messages) 
          ? suggestedMessages.messages 
          : []; 

        if (savedMessages.length > 0) { 
          setMessageCount(savedMessages.length); 
          setMessages(savedMessages); 
        } 

        setIsSuggestedMessagesEnabled( 
          suggestedMessages.enabled === true 
        ); 
      } catch (error) { 
        console.error('Failed to load AI Actions:', error); 
      } 
    }; 

    loadAIActions(); 
  }, [chatbotId]); 

  const updateAiActions = async (sectionName, sectionValue) => {
    const currentResponse = await chatbotAPI.get(chatbotId);
    const currentActions = currentResponse.data?.ai_actions || {};
    await chatbotAPI.update(chatbotId, {
      ai_actions: {
        ...currentActions,
        [sectionName]: sectionValue,
      },
    });
  };

  const saveKeywordLinks = async () => {
    if (!chatbotId) return;
    try {
      setIsSaving(true);
      await updateAiActions('keyword_links', {
        enabled: isKeywordLinksEnabled,
        actions: keywordActions.slice(0, actionCount).map((action) => ({
          keyword: action.keyword,
          button_name: action.buttonName,
          link: action.link,
        })),
      });
      setIsKeywordLinksOpen(false);
    } catch (error) {
      console.error('Failed to save keyword link actions:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeywordLinksToggle = async () => {
    if (!chatbotId) return;
    const nextEnabled = !isKeywordLinksEnabled;
    setIsKeywordLinksEnabled(nextEnabled);
    try {
      await updateAiActions('keyword_links', {
        enabled: nextEnabled,
        actions: keywordActions.slice(0, actionCount).map((action) => ({
          keyword: action.keyword,
          button_name: action.buttonName,
          link: action.link,
        })),
      });
    } catch (error) {
      setIsKeywordLinksEnabled(!nextEnabled);
      console.error('Failed to update keyword link actions status:', error);
    }
  };

  const saveSuggestedMessages = async () => { 
    if (!chatbotId) return; 

    try { 
      setIsSaving(true); 

      await updateAiActions('suggested_messages', {
        enabled: isSuggestedMessagesEnabled,
        messages,
      }); 

      setIsSuggestedMessagesOpen(false); 
    } catch (error) { 
      console.error('Failed to save suggested messages:', error); 
    } finally { 
      setIsSaving(false); 
    } 
  }; 

  const handleSuggestedMessagesToggle = async () => { 
    if (!chatbotId) return; 

    const nextEnabled = !isSuggestedMessagesEnabled; 
    setIsSuggestedMessagesEnabled(nextEnabled); 

    try { 
      await updateAiActions('suggested_messages', {
        enabled: nextEnabled,
        messages,
      }); 
    } catch (error) { 
      setIsSuggestedMessagesEnabled(!nextEnabled); 
      console.error('Failed to update suggested messages status:', error); 
    } 
  }; 

  return ( 
    <div className="m-0 animate-fade-in-up"> 
      <div className="px-1 py-2"> 
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"> 
          <div className="relative rounded-xl border border-gray-200 bg-white p-5 shadow-none"> 
            <div className="absolute right-5 top-5"> 
              <button 
                type="button" 
                role="switch" 
                aria-checked={isSuggestedMessagesEnabled} 
                aria-label="Enable or disable suggested messages" 
                onClick={handleSuggestedMessagesToggle} 
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${ 
                  isSuggestedMessagesEnabled ? 'bg-gray-950' : 'bg-gray-300' 
                }`} 
              > 
                <span 
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${ 
                    isSuggestedMessagesEnabled 
                      ? 'translate-x-5' 
                      : 'translate-x-0.5' 
                  }`} 
                /> 
              </button> 
            </div> 

            <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-amber-300 bg-amber-50"> 
              <MessageSquarePlus className="h-6 w-6 text-amber-600" /> 
            </div> 

            <div className="mt-4"> 
              <h2 className="text-lg font-semibold tracking-tight text-gray-950"> 
                Suggested messages 
              </h2> 

              <p className="mt-2 max-w-xl text-[15px] leading-6 text-gray-500"> 
                Customize suggested messages based on the conversation 
              </p> 

              <button 
                type="button" 
                onClick={() => setIsSuggestedMessagesOpen(true)} 
                className="mt-5 rounded-full border border-gray-200 bg-gray-50 px-4 py-2 text-[13px] font-medium text-gray-900 transition-colors hover:bg-gray-100" 
              > 
                Suggested messages 
              </button> 
            </div> 
          </div> 

          {/* New Keyword Link Actions card; existing card above is unchanged. */}
          <div className="relative rounded-xl border border-gray-200 bg-white p-5 shadow-none">
            <div className="absolute right-5 top-5">
              <button
                type="button"
                role="switch"
                aria-checked={isKeywordLinksEnabled}
                aria-label="Enable or disable keyword link actions"
                onClick={handleKeywordLinksToggle}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  isKeywordLinksEnabled ? 'bg-gray-950' : 'bg-gray-300'
                }`}
              >
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
                  isKeywordLinksEnabled ? 'translate-x-5' : 'translate-x-0.5'
                }`} />
              </button>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-blue-300 bg-blue-50">
              <Link2 className="h-6 w-6 text-blue-600" />
            </div>
            <div className="mt-4">
              <h2 className="text-lg font-semibold tracking-tight text-gray-950">Keyword link actions</h2>
              <p className="mt-2 max-w-xl text-[15px] leading-6 text-gray-500">
                Show a clickable button when the AI response contains a configured keyword.
              </p>
              <button
                type="button"
                onClick={() => setIsKeywordLinksOpen(true)}
                className="mt-5 rounded-full border border-gray-200 bg-gray-50 px-4 py-2 text-[13px] font-medium text-gray-900 transition-colors hover:bg-gray-100"
              >
                Configure actions
              </button>
            </div>
          </div>
        </div> 
      </div> 

      {isSuggestedMessagesOpen && 
        createPortal( 
          <SuggestedMessagesModal
            onClose={() => setIsSuggestedMessagesOpen(false)}
            messageCount={messageCount}
            setMessageCount={setMessageCount}
            messages={messages}
            setMessages={setMessages}
            onSave={saveSuggestedMessages}
            isSaving={isSaving}
          />, 
          document.body 
        )} 

      {isKeywordLinksOpen &&
        createPortal(
          <KeywordLinkActionsModal
            onClose={() => setIsKeywordLinksOpen(false)}
            actionCount={actionCount}
            setActionCount={setActionCount}
            actions={keywordActions}
            setActions={setKeywordActions}
            onSave={saveKeywordLinks}
            isSaving={isSaving}
          />,
          document.body
        )}
    </div> 
  ); 
}; 

export default AIActions;
