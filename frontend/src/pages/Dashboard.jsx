import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Plus, MessageSquare } from 'lucide-react';
import { useToast } from '../hooks/use-toast';
import { useAuth } from '../contexts/AuthContext';
import { chatbotAPI, analyticsAPI, plansAPI } from '../utils/api';
import UpgradeModal from '../components/UpgradeModal';
import DashboardLayout from '../components/DashboardLayout';

const Dashboard = () => {
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
        name: 'New Chatbot',
        model: 'gpt-4o-mini',
        provider: 'openai',
        temperature: 0.7,
        instructions: 'You are a helpful assistant.',
        welcome_message: 'Hello! How can I help you today?'
      });
      
      toast({
        title: 'Success',
        description: 'Chatbot created successfully'
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
      <div className="p-8 max-w-7xl mx-auto">
        {/* Personalized Welcome Header */}
        <div className="mb-8">
          <h1 style={{ 
            fontFamily: 'Inter, sans-serif', 
            fontSize: '20px', 
            fontWeight: '600',
            color: '#0B0B0B',
            marginBottom: '4px'
          }}>
            Welcome back, {user?.name || 'Demo User'}
          </h1>
          <p style={{ 
            fontFamily: 'Inter, sans-serif', 
            fontSize: '14px',
            color: '#6B7280'
          }}>
            Monitor your chatbot activity and usage
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
            Create New Chatbot
          </Button>
        </div>

        {/* Usage Overview - Subtle Color Accents */}
        <div className="mb-8">
          <h2 style={{ 
            fontFamily: 'Inter, sans-serif', 
            fontSize: '13px', 
            fontWeight: '600',
            color: '#0B0B0B',
            marginBottom: '16px',
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}>
            Usage Overview
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Total Chatbots */}
            <div className="border-l-2 border-purple-600 pl-4">
              <p style={{ 
                fontFamily: 'Inter, sans-serif', 
                fontSize: '13px',
                color: '#6B7280',
                marginBottom: '4px'
              }}>
                Total Chatbots
              </p>
              <p style={{ 
                fontFamily: 'Inter, sans-serif', 
                fontSize: '18px',
                fontWeight: '600',
                color: '#0B0B0B'
              }}>
                {analytics?.total_chatbots || 0}
              </p>
            </div>

            {/* Total Conversations */}
            <div className="border-l-2 border-purple-600 pl-4">
              <p style={{ 
                fontFamily: 'Inter, sans-serif', 
                fontSize: '13px',
                color: '#6B7280',
                marginBottom: '4px'
              }}>
                Total Conversations
              </p>
              <p style={{ 
                fontFamily: 'Inter, sans-serif', 
                fontSize: '18px',
                fontWeight: '600',
                color: '#0B0B0B'
              }}>
                {analytics?.total_conversations?.toLocaleString() || 0}
              </p>
            </div>

            {/* Total Messages */}
            <div className="border-l-2 border-purple-600 pl-4">
              <p style={{ 
                fontFamily: 'Inter, sans-serif', 
                fontSize: '13px',
                color: '#6B7280',
                marginBottom: '4px'
              }}>
                Total Messages
              </p>
              <p style={{ 
                fontFamily: 'Inter, sans-serif', 
                fontSize: '18px',
                fontWeight: '600',
                color: '#0B0B0B'
              }}>
                {analytics?.total_messages?.toLocaleString() || 0}
              </p>
            </div>
          </div>
        </div>

        {/* Resource Usage / Plan Limits */}
        {usageStats && (
          <div className="mb-8">
            <h2 style={{ 
              fontFamily: 'Inter, sans-serif', 
              fontSize: '13px', 
              fontWeight: '600',
              color: '#0B0B0B',
              marginBottom: '16px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              Resource Usage
            </h2>
            <div className="space-y-4">
              {/* Chatbots */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', color: '#0B0B0B' }}>
                    Chatbots
                  </span>
                  <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', color: '#6B7280' }}>
                    {usageStats.usage?.chatbots?.current}/{usageStats.usage?.chatbots?.limit} used
                  </span>
                  <span style={{ 
                    fontFamily: 'Inter, sans-serif', 
                    fontSize: '13px', 
                    color: usageStats.usage?.chatbots?.percentage >= 100 ? '#EF4444' : '#6B7280',
                    fontWeight: usageStats.usage?.chatbots?.percentage >= 100 ? '600' : '400'
                  }}>
                    {usageStats.usage?.chatbots?.percentage}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="h-2 rounded-full transition-all duration-500"
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
                  <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', color: '#0B0B0B' }}>
                    Messages
                  </span>
                  <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', color: '#6B7280' }}>
                    {usageStats.usage?.messages?.current}/{usageStats.usage?.messages?.limit >= 999999 ? '∞' : usageStats.usage?.messages?.limit?.toLocaleString()} used
                  </span>
                  <span style={{ 
                    fontFamily: 'Inter, sans-serif', 
                    fontSize: '13px', 
                    color: usageStats.usage?.messages?.percentage >= 100 ? '#EF4444' : '#6B7280',
                    fontWeight: usageStats.usage?.messages?.percentage >= 100 ? '600' : '400'
                  }}>
                    {usageStats.usage?.messages?.percentage}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="h-2 rounded-full transition-all duration-500"
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
                  <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', color: '#0B0B0B' }}>
                    Files
                  </span>
                  <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', color: '#6B7280' }}>
                    {usageStats.usage?.file_uploads?.current}/{usageStats.usage?.file_uploads?.limit} used
                  </span>
                  <span style={{ 
                    fontFamily: 'Inter, sans-serif', 
                    fontSize: '13px', 
                    color: usageStats.usage?.file_uploads?.percentage >= 100 ? '#EF4444' : '#6B7280',
                    fontWeight: usageStats.usage?.file_uploads?.percentage >= 100 ? '600' : '400'
                  }}>
                    {usageStats.usage?.file_uploads?.percentage}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="h-2 rounded-full transition-all duration-500"
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
                  <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', color: '#0B0B0B' }}>
                    Websites
                  </span>
                  <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', color: '#6B7280' }}>
                    {usageStats.usage?.website_sources?.current}/{usageStats.usage?.website_sources?.limit} used
                  </span>
                  <span style={{ 
                    fontFamily: 'Inter, sans-serif', 
                    fontSize: '13px', 
                    color: usageStats.usage?.website_sources?.percentage >= 100 ? '#EF4444' : '#6B7280',
                    fontWeight: usageStats.usage?.website_sources?.percentage >= 100 ? '600' : '400'
                  }}>
                    {usageStats.usage?.website_sources?.percentage}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="h-2 rounded-full transition-all duration-500"
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
                  <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', color: '#0B0B0B' }}>
                    Text Sources
                  </span>
                  <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px', color: '#6B7280' }}>
                    {usageStats.usage?.text_sources?.current}/{usageStats.usage?.text_sources?.limit} used
                  </span>
                  <span style={{ 
                    fontFamily: 'Inter, sans-serif', 
                    fontSize: '13px', 
                    color: usageStats.usage?.text_sources?.percentage >= 100 ? '#EF4444' : '#6B7280',
                    fontWeight: usageStats.usage?.text_sources?.percentage >= 100 ? '600' : '400'
                  }}>
                    {usageStats.usage?.text_sources?.percentage}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="h-2 rounded-full transition-all duration-500"
                    style={{ 
                      width: `${Math.min(usageStats.usage?.text_sources?.percentage || 0, 100)}%`,
                      backgroundColor: usageStats.usage?.text_sources?.percentage >= 100 ? '#EF4444' : '#9333EA'
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Chatbots Section - Table Style */}
        <div className="mb-8">
          <h2 style={{ 
            fontFamily: 'Inter, sans-serif', 
            fontSize: '20px', 
            fontWeight: '600',
            color: '#0B0B0B',
            marginBottom: '16px'
          }}>
            Your Chatbots
          </h2>
          
          {chatbots.length === 0 ? (
            <div className="text-center py-12 border border-gray-200 rounded-lg">
              <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '14px', color: '#6B7280' }}>
                No chatbots yet. Create your first one to get started.
              </p>
            </div>
          ) : (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th style={{ 
                      fontFamily: 'Inter, sans-serif', 
                      fontSize: '12px', 
                      fontWeight: '500',
                      color: '#6B7280',
                      textAlign: 'left',
                      padding: '12px 16px'
                    }}>
                      Chatbot Name
                    </th>
                    <th style={{ 
                      fontFamily: 'Inter, sans-serif', 
                      fontSize: '12px', 
                      fontWeight: '500',
                      color: '#6B7280',
                      textAlign: 'left',
                      padding: '12px 16px'
                    }}>
                      Status
                    </th>
                    <th style={{ 
                      fontFamily: 'Inter, sans-serif', 
                      fontSize: '12px', 
                      fontWeight: '500',
                      color: '#6B7280',
                      textAlign: 'left',
                      padding: '12px 16px'
                    }}>
                      Model
                    </th>
                    <th style={{ 
                      fontFamily: 'Inter, sans-serif', 
                      fontSize: '12px', 
                      fontWeight: '500',
                      color: '#6B7280',
                      textAlign: 'left',
                      padding: '12px 16px'
                    }}>
                      Messages
                    </th>
                    <th style={{ 
                      fontFamily: 'Inter, sans-serif', 
                      fontSize: '12px', 
                      fontWeight: '500',
                      color: '#6B7280',
                      textAlign: 'right',
                      padding: '12px 16px'
                    }}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {chatbots.map((bot) => (
                    <tr 
                      key={bot.id}
                      className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => navigate(`/chatbot/${bot.id}`)}
                    >
                      <td style={{ 
                        fontFamily: 'Inter, sans-serif', 
                        fontSize: '13px',
                        color: '#0B0B0B',
                        padding: '16px'
                      }}>
                        {bot.name}
                      </td>
                      <td style={{ padding: '16px' }}>
                        <span 
                          className="inline-block px-2 py-1 rounded-md text-xs"
                          style={{ 
                            fontFamily: 'Inter, sans-serif',
                            backgroundColor: bot.status === 'active' ? '#D1FAE5' : '#E5E7EB',
                            color: bot.status === 'active' ? '#065F46' : '#6B7280'
                          }}
                        >
                          {bot.status === 'active' ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td style={{ 
                        fontFamily: 'Inter, sans-serif', 
                        fontSize: '13px',
                        color: '#6B7280',
                        padding: '16px'
                      }}>
                        {bot.model}
                      </td>
                      <td style={{ 
                        fontFamily: 'Inter, sans-serif', 
                        fontSize: '13px',
                        color: '#0B0B0B',
                        padding: '16px'
                      }}>
                        {bot.messages_count?.toLocaleString() || 0}
                      </td>
                      <td style={{ padding: '16px', textAlign: 'right' }}>
                        <div className="flex items-center justify-end gap-3">
                          {/* Toggle Switch */}
                          <button
                            onClick={(e) => handleToggleChatbot(e, bot.id, bot.status)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
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
                          
                          <Button 
                            variant="outline" 
                            onClick={(e) => { e.stopPropagation(); navigate(`/chatbot/${bot.id}`); }}
                            className="border border-gray-300 hover:bg-gray-100 transition-all"
                            style={{ fontFamily: 'Inter, sans-serif', fontSize: '13px' }}
                          >
                            Manage
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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

export default Dashboard;
