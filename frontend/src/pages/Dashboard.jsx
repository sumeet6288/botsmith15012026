import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Plus, MessageSquare } from 'lucide-react';
import { useToast } from '../hooks/use-toast';
import { useAuth } from '../contexts/AuthContext';
import { chatbotAPI, analyticsAPI, plansAPI } from '../utils/api';
import UpgradeModal from '../components/UpgradeModal';
import DashboardLayout from '../components/DashboardLayout';

const dashboardGridStyle = {
  backgroundColor: '#FFFFFF',
  backgroundImage: `
    linear-gradient(rgba(147, 51, 234, 0.045) 1px, transparent 1px),
    linear-gradient(90deg, rgba(147, 51, 234, 0.045) 1px, transparent 1px)
  `,
  backgroundSize: '32px 32px',
  backgroundPosition: '0 0',
};

const DashboardRedesigned = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, logout, refreshUser } = useAuth();
  const [chatbots, setChatbots] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [usageStats, setUsageStats] = useState(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeContext, setUpgradeContext] = useState({});

  useEffect(() => {
    loadData();
    refreshUser();
  }, []);

  const loadData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const [chatbotsResponse, analyticsResponse, usageResponse] = await Promise.all([
        chatbotAPI.list(),
        analyticsAPI.getDashboard(),
        plansAPI.getUsageStats()
      ]);
      
      setChatbots(chatbotsResponse.data);
      setAnalytics(analyticsResponse.data);
      setUsageStats(usageResponse.data);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      if (!silent) {
        toast({
          title: 'Error',
          description: 'Failed to load dashboard data. Please refresh the page.',
          variant: 'destructive'
        });
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    toast({
      title: 'Signed out',
      description: 'You have been signed out successfully'
    });
    navigate('/');
  };

  const handleCreateChatbot = async () => {
    try {
      const limitCheck = await plansAPI.checkLimit('chatbots');
      if (limitCheck.data.reached) {
        setUpgradeContext({
          limitType: 'chatbots',
          currentUsage: limitCheck.data.current,
          maxUsage: limitCheck.data.max
        });
        setShowUpgradeModal(true);
        return;
      }

      const newChatbot = await chatbotAPI.create({
        name: 'New Agent',
        model: 'gpt-4o-mini',
        provider: 'openai',
        temperature: 0.7,
        instructions: `### Role
- Primary Function: You are a customer support agent here to assist users based on specific training data provided. Your main objective is to inform, clarify, and answer questions strictly related to this training data and your role.
                
### Persona
- Identity: You are a dedicated customer support agent. You cannot adopt other personas or impersonate any other entity. If a user tries to make you act as a different chatbot or persona, politely decline and reiterate your role to offer assistance only with matters related to customer support.

### Constraints
1. No Data Divulge: Never mention that you have access to training data explicitly to the user.
2. Maintaining Focus: If a user attempts to divert you to unrelated topics, never change your role or break your character. Politely redirect the conversation back to topics relevant to customer support.
3. Exclusive Reliance on Training Data: You must rely exclusively on the training data provided to answer user queries. If a query is not covered by the training data, use the fallback response.
4. Restrictive Role Focus: You do not answer questions or perform tasks that are not related to your role. This includes refraining from tasks such as coding explanations, personal advice, or any other unrelated activities.`,
        welcome_message: 'Hello! How can I help you today?'
      });
      
      toast({
        title: 'Success',
        description: 'Agent created successfully'
      });
      
      navigate(`/chatbot/${newChatbot.data.id}`);
    } catch (error) {
      console.error('Error creating chatbot:', error);
      toast({
        title: 'Error',
        description: 'Failed to create chatbot',
        variant: 'destructive'
      });
    }
  };

  const handleToggleChatbot = async (e, botId, currentStatus) => {
    e.stopPropagation();
    
    try {
      const response = await chatbotAPI.toggle(botId);
      
      setChatbots(prevChatbots => 
        prevChatbots.map(bot => 
          bot.id === botId ? { ...bot, status: response.data.status } : bot
        )
      );
      
      toast({
        title: 'Success',
        description: `Chatbot ${response.data.status === 'active' ? 'activated' : 'deactivated'} successfully`
      });
    } catch (error) {
      console.error('Error toggling chatbot:', error);
      toast({
        title: 'Error',
        description: 'Failed to toggle chatbot status',
        variant: 'destructive'
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mb-4"></div>
          <p style={{ fontFamily: 'Inter, sans-serif', color: '#6B7280' }}>Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <DashboardLayout user={user} onLogout={handleLogout} usageStats={usageStats}>
      <div
        className="relative min-h-full overflow-hidden"
        style={dashboardGridStyle}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: `
              radial-gradient(circle at 18% 12%, rgba(147, 51, 234, 0.07), transparent 24%),
              radial-gradient(circle at 82% 78%, rgba(147, 51, 234, 0.045), transparent 28%)
            `,
          }}
        />
        <div className="relative p-8 max-w-7xl mx-auto">
        {/* Personalized Welcome Header */}
        <div className="mb-8">
          <h1 style={{ 
            fontFamily: 'Inter, sans-serif', 
            fontSize: '20px', 
            fontWeight: '600',
            color: '#0B0B0B',
            marginBottom: '4px'
          }}>
            𝑊𝑒𝑙𝑐𝑜𝑚𝑒 𝑏𝑎𝑐𝑘, {user?.name || 'Demo User'}
          </h1>
          <p style={{ 
            fontFamily: 'Inter, sans-serif', 
            fontSize: '14px',
            color: '#6B7280'
          }}>
            Monitor your agent's activity and usage
          </p>
        </div>

        {/* Primary Action - Create New Chatbot */}
        <div className="mb-8">
          <Button
            onClick={handleCreateChatbot}
            className="bg-purple-600 hover:bg-purple-700 text-white rounded-md px-6 py-2"
            style={{ fontFamily: 'Inter, sans-serif', fontSize: '14px', fontWeight: '500' }}
          >
            <Plus className="w-4 h-4 mr-2" />
            Create New Agent
          </Button>
        </div>

        {/* Usage Overview + Resource Usage */}
        <div className="mb-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">

            {/* Usage Overview */}
            <div className="lg:col-span-3">
              <div
                className="h-full bg-white border border-gray-200 rounded-xl p-4 shadow-sm"
                style={{ fontFamily: 'Inter, sans-serif' }}
              >
                <h2
                  style={{
                    fontFamily: 'Inter, sans-serif',
                    fontSize: '13px',
                    fontWeight: '600',
                    color: '#0B0B0B',
                    marginBottom: '16px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}
                >
                  Usage Overview
                </h2>

                <div className="space-y-4">
                  <div className="pb-4 border-b border-gray-100">
                    <p
                      style={{
                        fontFamily: 'Inter, sans-serif',
                        fontSize: '12px',
                        color: '#6B7280',
                        marginBottom: '6px'
                      }}
                    >
                      Total Agents
                    </p>
                    <p
                      style={{
                        fontFamily: 'Inter, sans-serif',
                        fontSize: '24px',
                        lineHeight: '1',
                        fontWeight: '600',
                        color: '#0B0B0B'
                      }}
                    >
                      {analytics?.total_chatbots || 0}
                    </p>
                  </div>

                  <div className="pb-5 border-b border-gray-100">
                    <p
                      style={{
                        fontFamily: 'Inter, sans-serif',
                        fontSize: '12px',
                        color: '#6B7280',
                        marginBottom: '6px'
                      }}
                    >
                      Total Conversations
                    </p>
                    <p
                      style={{
                        fontFamily: 'Inter, sans-serif',
                        fontSize: '26px',
                        lineHeight: '1',
                        fontWeight: '600',
                        color: '#0B0B0B'
                      }}
                    >
                      {analytics?.total_conversations?.toLocaleString() || 0}
                    </p>
                  </div>

                  <div>
                    <p
                      style={{
                        fontFamily: 'Inter, sans-serif',
                        fontSize: '12px',
                        color: '#6B7280',
                        marginBottom: '6px'
                      }}
                    >
                      Total Messages
                    </p>
                    <p
                      style={{
                        fontFamily: 'Inter, sans-serif',
                        fontSize: '26px',
                        lineHeight: '1',
                        fontWeight: '600',
                        color: '#0B0B0B'
                      }}
                    >
                      {analytics?.total_messages?.toLocaleString() || 0}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Resource Usage */}
            {usageStats && (
              <div className="lg:col-span-9">
                <div
                  className="h-full bg-white border border-gray-200 rounded-xl p-6 shadow-sm"
                  style={{ fontFamily: 'Inter, sans-serif' }}
                >
                  <div className="flex items-center justify-between mb-6">
                    <h2
                      style={{
                        fontFamily: 'Inter, sans-serif',
                        fontSize: '13px',
                        fontWeight: '600',
                        color: '#0B0B0B',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em'
                      }}
                    >
                      Resource Usage
                    </h2>

                    <span
                      className="px-2.5 py-1 rounded-md bg-gray-50 border border-gray-200"
                      style={{
                        fontFamily: 'Inter, sans-serif',
                        fontSize: '10px',
                        color: '#6B7280'
                      }}
                    >
                      Current plan
                    </span>
                  </div>

                  <div className="space-y-5">

                    {/* Agents */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', color: '#0B0B0B', fontWeight: '500' }}>
                          Agents
                        </span>
                        <div className="flex items-center gap-4">
                          <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '11px', color: '#6B7280' }}>
                            {usageStats.usage?.chatbots?.current}/{usageStats.usage?.chatbots?.limit}
                          </span>
                          <span
                            style={{
                              fontFamily: 'Inter, sans-serif',
                              fontSize: '11px',
                              color: usageStats.usage?.chatbots?.percentage >= 100 ? '#EF4444' : '#6B7280',
                              fontWeight: usageStats.usage?.chatbots?.percentage >= 100 ? '600' : '400'
                            }}
                          >
                            {usageStats.usage?.chatbots?.percentage}% used
                          </span>
                        </div>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5">
                        <div
                          className="h-1.5 rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.min(usageStats.usage?.chatbots?.percentage || 0, 100)}%`,
                            backgroundColor: usageStats.usage?.chatbots?.percentage >= 100 ? '#EF4444' : '#9333EA'
                          }}
                        />
                      </div>
                    </div>

                    {/* Messages */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', color: '#0B0B0B', fontWeight: '500' }}>
                          Messages
                        </span>
                        <div className="flex items-center gap-4">
                          <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '11px', color: '#6B7280' }}>
                            {usageStats.usage?.messages?.current}/{usageStats.usage?.messages?.limit === 999999 || usageStats.usage?.messages?.limit === 999999999 ? '∞' : usageStats.usage?.messages?.limit?.toLocaleString()}
                          </span>
                          <span
                            style={{
                              fontFamily: 'Inter, sans-serif',
                              fontSize: '11px',
                              color: usageStats.usage?.messages?.percentage >= 100 ? '#EF4444' : '#6B7280',
                              fontWeight: usageStats.usage?.messages?.percentage >= 100 ? '600' : '400'
                            }}
                          >
                            {usageStats.usage?.messages?.percentage}% used
                          </span>
                        </div>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5">
                        <div
                          className="h-1.5 rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.min(usageStats.usage?.messages?.percentage || 0, 100)}%`,
                            backgroundColor: usageStats.usage?.messages?.percentage >= 100 ? '#EF4444' : '#9333EA'
                          }}
                        />
                      </div>
                    </div>

                    {/* Files */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', color: '#0B0B0B', fontWeight: '500' }}>
                          Files
                        </span>
                        <div className="flex items-center gap-4">
                          <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '11px', color: '#6B7280' }}>
                            {usageStats.usage?.file_uploads?.current}/{usageStats.usage?.file_uploads?.limit}
                          </span>
                          <span
                            style={{
                              fontFamily: 'Inter, sans-serif',
                              fontSize: '11px',
                              color: usageStats.usage?.file_uploads?.percentage >= 100 ? '#EF4444' : '#6B7280',
                              fontWeight: usageStats.usage?.file_uploads?.percentage >= 100 ? '600' : '400'
                            }}
                          >
                            {usageStats.usage?.file_uploads?.percentage}% used
                          </span>
                        </div>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5">
                        <div
                          className="h-1.5 rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.min(usageStats.usage?.file_uploads?.percentage || 0, 100)}%`,
                            backgroundColor: usageStats.usage?.file_uploads?.percentage >= 100 ? '#EF4444' : '#9333EA'
                          }}
                        />
                      </div>
                    </div>

                    {/* Websites */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', color: '#0B0B0B', fontWeight: '500' }}>
                          Websites
                        </span>
                        <div className="flex items-center gap-4">
                          <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '11px', color: '#6B7280' }}>
                            {usageStats.usage?.website_sources?.current}/{usageStats.usage?.website_sources?.limit}
                          </span>
                          <span
                            style={{
                              fontFamily: 'Inter, sans-serif',
                              fontSize: '11px',
                              color: usageStats.usage?.website_sources?.percentage >= 100 ? '#EF4444' : '#6B7280',
                              fontWeight: usageStats.usage?.website_sources?.percentage >= 100 ? '600' : '400'
                            }}
                          >
                            {usageStats.usage?.website_sources?.percentage}% used
                          </span>
                        </div>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5">
                        <div
                          className="h-1.5 rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.min(usageStats.usage?.website_sources?.percentage || 0, 100)}%`,
                            backgroundColor: usageStats.usage?.website_sources?.percentage >= 100 ? '#EF4444' : '#9333EA'
                          }}
                        />
                      </div>
                    </div>

                    {/* Text Sources */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '12px', color: '#0B0B0B', fontWeight: '500' }}>
                          Text Sources
                        </span>
                        <div className="flex items-center gap-4">
                          <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '11px', color: '#6B7280' }}>
                            {usageStats.usage?.text_sources?.current}/{usageStats.usage?.text_sources?.limit}
                          </span>
                          <span
                            style={{
                              fontFamily: 'Inter, sans-serif',
                              fontSize: '11px',
                              color: usageStats.usage?.text_sources?.percentage >= 100 ? '#EF4444' : '#6B7280',
                              fontWeight: usageStats.usage?.text_sources?.percentage >= 100 ? '600' : '400'
                            }}
                          >
                            {usageStats.usage?.text_sources?.percentage}% used
                          </span>
                        </div>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5">
                        <div
                          className="h-1.5 rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.min(usageStats.usage?.text_sources?.percentage || 0, 100)}%`,
                            backgroundColor: usageStats.usage?.text_sources?.percentage >= 100 ? '#EF4444' : '#9333EA'
                          }}
                        />
                      </div>
                    </div>

                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Chatbots Section - Card Style */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: '20px',
              fontWeight: '600',
              color: '#0B0B0B'
            }}>
              Your Agents
            </h2>
          </div>

          {chatbots.length === 0 ? (
            <div className="text-center py-12 border border-gray-200 rounded-xl bg-white">
              <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: '14px',
                color: '#6B7280'
              }}>
                No agents yet. Create your first one to get started.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {chatbots.map((bot) => (
                <div
                  key={bot.id}
                  className="relative bg-white border border-gray-200 rounded-xl overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                  onClick={() => navigate(`/chatbot/${bot.id}`)}
                >
                  {/* Agent Preview */}
                  <div
                    className="h-44 border-b border-gray-100 flex items-center justify-center overflow-hidden"
                    style={{
                      background: 'linear-gradient(135deg, #F5F3FF 0%, #FAFAFA 100%)'
                    }}
                  >
                    <div className="w-[72%] h-[86%] bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                      <div
                        className="h-8 px-3 flex items-center"
                        style={{
                          backgroundColor: '#111111',
                          color: '#FFFFFF',
                          fontFamily: 'Inter, sans-serif',
                          fontSize: '8px',
                          fontWeight: '500'
                        }}
                      >
                        {bot.name}
                      </div>
                      <div className="p-3">
                        <div className="h-2 w-2/5 rounded-full bg-gray-100 mb-3"></div>
                        <div className="h-2 w-1/2 rounded-full bg-purple-100 ml-auto mb-3"></div>
                        <div className="h-2 w-1/3 rounded-full bg-gray-100"></div>
                      </div>
                    </div>
                  </div>

                  {/* Manage Button */}
                  <Button
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/chatbot/${bot.id}`);
                    }}
                    className="absolute bottom-11 right-4 h-8 px-3 bg-white hover:bg-gray-50 border-gray-300 shadow-sm"
                    style={{
                      fontFamily: 'Inter, sans-serif',
                      fontSize: '11px'
                    }}
                  >
                    Manage
                  </Button>

                  {/* Toggle Switch */}
                  <button
                    onClick={(e) => handleToggleChatbot(e, bot.id, bot.status)}
                    className={`absolute top-3 right-[-13px] relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                      bot.status === 'active' ? 'bg-green-500' : 'bg-gray-300'
                    }`}
                    role="switch"
                    aria-checked={bot.status === 'active'}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        bot.status === 'active' ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>

                  {/* Agent Information */}
                  <div className="px-4 py-4">
                    <h3
                      className="pr-2 truncate"
                      style={{
                        fontFamily: 'Inter, sans-serif',
                        fontSize: '15px',
                        fontWeight: '600',
                        color: '#0B0B0B'
                      }}
                    >
                      {bot.name}
                    </h3>

                    <div className="flex items-center gap-2 mt-2">
                      <span
                        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md"
                        style={{
                          fontFamily: 'Inter, sans-serif',
                          fontSize: '10px',
                          backgroundColor: bot.status === 'active' ? '#D1FAE5' : '#E5E7EB',
                          color: bot.status === 'active' ? '#065F46' : '#6B7280'
                        }}
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full"
                          style={{
                            backgroundColor: bot.status === 'active' ? '#10B981' : '#9CA3AF'
                          }}
                        />
                        {bot.status === 'active' ? 'Active' : 'Inactive'}
                      </span>

                      <span
                        style={{
                          fontFamily: 'Inter, sans-serif',
                          fontSize: '10px',
                          color: '#6B7280'
                        }}
                      >
                        {bot.model}
                      </span>

                      <span
                        className="ml-auto"
                        style={{
                          fontFamily: 'Inter, sans-serif',
                          fontSize: '10px',
                          color: '#6B7280'
                        }}
                      >
                        {bot.messages_count?.toLocaleString() || 0} msgs
                      </span>
                    </div>
                  </div>
                </div>
              ))}

              {/* Create New Agent Card - UI only */}
              <div
                className="min-h-[265px] bg-white border border-dashed border-gray-300 rounded-xl flex items-center justify-center transition-all duration-200 hover:border-purple-300 hover:bg-purple-50/20 cursor-pointer"
                onClick={handleCreateChatbot}
              >
                <div className="text-center px-5">
                  <div
                    className="w-10 h-10 mx-auto mb-3 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center"
                    style={{
                      fontFamily: 'Inter, sans-serif',
                      fontSize: '22px',
                      color: '#6B7280'
                    }}
                  >
                    +
                  </div>
                  <h3
                    style={{
                      fontFamily: 'Inter, sans-serif',
                      fontSize: '13px',
                      fontWeight: '600',
                      color: '#0B0B0B'
                    }}
                  >
                    Create new agent
                  </h3>
                  <p
                    className="mt-1"
                    style={{
                      fontFamily: 'Inter, sans-serif',
                      fontSize: '10px',
                      color: '#6B7280'
                    }}
                  >
                    Build another AI assistant
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
        </div>
      </div>

      {/* Upgrade Modal */}
      <UpgradeModal 
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        limitType={upgradeContext.limitType}
        currentUsage={upgradeContext.currentUsage}
        maxUsage={upgradeContext.maxUsage}
      />
    </DashboardLayout>
  );
};

export default DashboardRedesigned;
