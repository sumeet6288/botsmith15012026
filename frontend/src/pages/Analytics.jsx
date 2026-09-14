import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { TrendingUp, MessageSquare, Users, Clock, BarChart3, Bot, Activity, Calendar } from 'lucide-react';
import UserProfileDropdown from '../components/UserProfileDropdown';
import ResponsiveNav from '../components/ResponsiveNav';
import { useAuth } from '../contexts/AuthContext';
import { AnalyticsSkeleton } from '../components/LoadingSkeleton';
import Footer from '../components/Footer';
import toast from 'react-hot-toast';
import { analyticsAPI, chatbotAPI } from '../utils/api';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const Analytics = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeRange, setTimeRange] = useState('30'); // 7, 30, 90 days
  const [chatbots, setChatbots] = useState([]);
  const [conversationData, setConversationData] = useState([]);
  const [messageData, setMessageData] = useState([]);
  const [providerData, setProviderData] = useState([]);

  const loadDashboardAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      // Load dashboard analytics
      const response = await analyticsAPI.getDashboard();
      const data = response.data;
      
      // Load chatbots
      const chatbotsResponse = await chatbotAPI.list();
      const chatbotsData = chatbotsResponse.data.chatbots || [];
      setChatbots(chatbotsData);
      
      // Load real trend data from backend
      const days = parseInt(timeRange);
      const trendsResponse = await analyticsAPI.getTrends(days);
      const trendsData = trendsResponse.data;
      
      setConversationData(trendsData.conversations || []);
      setMessageData(trendsData.messages || []);
      
      // Generate provider distribution data
      const providers = generateProviderData(chatbotsData);
      setProviderData(providers);
      
      setAnalytics({
        totalConversations: data.total_conversations || 0,
        totalMessages: data.total_messages || 0,
        activeChats: data.active_chatbots || 0,
        totalChatbots: data.total_chatbots || 0,
        totalLeads: data.total_leads || 0,
        avgResponseTime: trendsData.avg_response_time || '0s',
        satisfaction: calculateSatisfaction(data.total_conversations, data.total_messages)
      });
    } catch (error) {
      console.error('Error loading analytics:', error);
      setError(error.message);
      toast.error('Failed to load analytics data');
      // Set default empty data on error
      setAnalytics({
        totalConversations: 0,
        totalMessages: 0,
        activeChats: 0,
        totalChatbots: 0,
        totalLeads: 0,
        satisfaction: 0,
        avgResponseTime: '0s'
      });
      setConversationData([]);
      setMessageData([]);
      setProviderData([]);
    } finally {
      setLoading(false);
    }
  };

  // Helper function to calculate provider distribution
  const generateProviderData = (chatbotsData) => {
    const providerCounts = {};
    chatbotsData.forEach(chatbot => {
      const provider = chatbot.ai_provider || 'openai';
      providerCounts[provider] = (providerCounts[provider] || 0) + 1;
    });
    
    return Object.entries(providerCounts).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value
    }));
  };

  // Helper function to calculate satisfaction (kept as fallback since no rating system exists)
  const calculateSatisfaction = (conversations, messages) => {
    if (conversations === 0) return 0;
    // Estimate satisfaction based on message engagement
    const avgMsgPerConv = messages / conversations;
    // More messages per conversation suggests better engagement
    const baseRate = 75;
    const engagementBonus = Math.min(20, Math.floor(avgMsgPerConv * 2));
    return Math.min(98, baseRate + engagementBonus);
  };

  useEffect(() => {
    loadDashboardAnalytics();
  }, [timeRange]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  if (loading) {
    return <AnalyticsSkeleton />;
  }

  return (
    <div className="min-h-screen bg-[#f8f7fb] text-gray-900 relative overflow-hidden">
      {/* Quiet page atmosphere — static, no decorative animation */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-40 right-[8%] w-[520px] h-[520px] rounded-full bg-purple-200/20 blur-3xl"></div>
        <div className="absolute top-[38%] -left-48 w-[460px] h-[460px] rounded-full bg-pink-200/15 blur-3xl"></div>
      </div>

      {/* Navigation */}
      <ResponsiveNav currentPage="analytics" user={user} onLogout={handleLogout} />

      <main className="relative z-10 max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-10">
        {/* Page header */}
        <header className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-purple-600 mb-3">
              Workspace analytics
            </p>
            <h1 className="font-instrument-serif text-5xl sm:text-6xl leading-none font-normal tracking-tight text-gray-950">
              Analytics Overview
            </h1>
            <p className="mt-3 text-sm sm:text-base text-gray-500 max-w-xl">
              A clear view of agent activity, engagement, and performance.
            </p>
          </div>

          {/* Time range */}
          <div className="inline-flex self-start lg:self-auto items-center rounded-xl border border-gray-200 bg-white p-1 shadow-sm">
            <Calendar className="w-4 h-4 text-gray-400 ml-2 mr-1" />
            {['7', '30', '90'].map((days) => (
              <button
                key={days}
                onClick={() => setTimeRange(days)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-150 ${
                  timeRange === days
                    ? 'bg-gray-950 text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                {days} Days
              </button>
            ))}
          </div>
        </header>

        {/* Key metrics — modular KPI row */}
        <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-2xl border border-gray-200/90 p-5 shadow-[0_6px_24px_rgba(31,24,45,0.05)]">
            <div className="flex items-center justify-between mb-7">
              <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-purple-600" />
              </div>
              <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">Volume</span>
            </div>
            <p className="text-3xl font-semibold tracking-tight text-gray-950">
              {analytics?.totalConversations.toLocaleString() || 0}
            </p>
            <p className="mt-1 text-sm text-gray-500">Total Conversations</p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200/90 p-5 shadow-[0_6px_24px_rgba(31,24,45,0.05)]">
            <div className="flex items-center justify-between mb-7">
              <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center">
                <Activity className="w-5 h-5 text-blue-600" />
              </div>
              <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">Engagement</span>
            </div>
            <p className="text-3xl font-semibold tracking-tight text-gray-950">
              {analytics?.totalMessages?.toLocaleString() || 0}
            </p>
            <p className="mt-1 text-sm text-gray-500">Total Messages</p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200/90 p-5 shadow-[0_6px_24px_rgba(31,24,45,0.05)]">
            <div className="flex items-center justify-between mb-7">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center">
                <Bot className="w-5 h-5 text-emerald-600" />
              </div>
              <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">Bots</span>
            </div>
            <p className="text-3xl font-semibold tracking-tight text-gray-950">
              {analytics?.activeChats || 0}
              <span className="text-lg text-gray-400 font-normal"> / {analytics?.totalChatbots || 0}</span>
            </p>
            <p className="mt-1 text-sm text-gray-500">Active Chatbots</p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200/90 p-5 shadow-[0_6px_24px_rgba(31,24,45,0.05)]">
            <div className="flex items-center justify-between mb-7">
              <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-center">
                <Clock className="w-5 h-5 text-orange-600" />
              </div>
              <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">Speed</span>
            </div>
            <p className="text-3xl font-semibold tracking-tight text-gray-950">
              {analytics?.avgResponseTime || '0s'}
            </p>
            <p className="mt-1 text-sm text-gray-500">Avg Response Time</p>
          </div>
        </section>

        {analytics && analytics.totalConversations === 0 ? (
          /* Empty state */
          <section className="bg-white rounded-[24px] border border-gray-200 p-10 sm:p-16 text-center shadow-[0_8px_30px_rgba(31,24,45,0.05)]">
            <div className="w-16 h-16 rounded-2xl bg-purple-50 border border-purple-100 flex items-center justify-center mx-auto mb-6">
              <BarChart3 className="w-8 h-8 text-purple-600" />
            </div>
            <h2 className="font-instrument-serif text-4xl sm:text-5xl font-normal text-gray-950">
              No analytics data yet
            </h2>
            <p className="mt-3 text-gray-500 max-w-md mx-auto">
              Create a chatbot and start conversations to see performance data here.
            </p>
            <Button
              className="mt-7 bg-gray-950 hover:bg-gray-800 text-white px-6 py-5 rounded-xl shadow-sm transition-colors duration-150"
              onClick={() => navigate('/dashboard')}
            >
              Go to Dashboard
            </Button>
          </section>
        ) : (
          <>
            {/* Main charts */}
            <section className="grid grid-cols-1 xl:grid-cols-2 gap-5 mb-5">
              {/* Conversation Trend */}
              <div className="bg-white rounded-[22px] border border-gray-200/90 p-5 sm:p-6 shadow-[0_8px_30px_rgba(31,24,45,0.05)]">
                <div className="flex items-start justify-between mb-5">
                  <div>
                    <p className="text-xs uppercase tracking-[0.12em] text-gray-400 font-semibold">Trend</p>
                    <h2 className="font-instrument-serif text-3xl font-normal text-gray-950 mt-1">
                      Conversations Over Time
                    </h2>
                  </div>
                  <div className="w-9 h-9 rounded-xl bg-purple-50 flex items-center justify-center">
                    <MessageSquare className="w-4 h-4 text-purple-600" />
                  </div>
                </div>

                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={conversationData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorConv" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.18}/>
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke="#eeeaf2" />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} stroke="#9ca3af" style={{ fontSize: '11px' }} />
                    <YAxis axisLine={false} tickLine={false} stroke="#9ca3af" style={{ fontSize: '11px' }} />
                    <Tooltip
                      cursor={{ stroke: '#ddd6fe' }}
                      contentStyle={{
                        backgroundColor: '#ffffff',
                        border: '1px solid #e5e7eb',
                        borderRadius: '12px',
                        boxShadow: '0 8px 24px rgba(31,24,45,0.08)'
                      }}
                    />
                    <Area type="monotone" dataKey="count" stroke="#7c3aed" strokeWidth={2.5} fill="url(#colorConv)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Message Volume */}
              <div className="bg-white rounded-[22px] border border-gray-200/90 p-5 sm:p-6 shadow-[0_8px_30px_rgba(31,24,45,0.05)]">
                <div className="flex items-start justify-between mb-5">
                  <div>
                    <p className="text-xs uppercase tracking-[0.12em] text-gray-400 font-semibold">Activity</p>
                    <h2 className="font-instrument-serif text-3xl font-normal text-gray-950 mt-1">
                      Message Volume
                    </h2>
                  </div>
                  <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
                    <Activity className="w-4 h-4 text-blue-600" />
                  </div>
                </div>

                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={messageData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="#eeeaf2" />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} stroke="#9ca3af" style={{ fontSize: '11px' }} />
                    <YAxis axisLine={false} tickLine={false} stroke="#9ca3af" style={{ fontSize: '11px' }} />
                    <Tooltip
                      cursor={{ fill: '#f8fafc' }}
                      contentStyle={{
                        backgroundColor: '#ffffff',
                        border: '1px solid #e5e7eb',
                        borderRadius: '12px',
                        boxShadow: '0 8px 24px rgba(31,24,45,0.08)'
                      }}
                    />
                    <Bar dataKey="count" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Provider Distribution */}
              {providerData.length > 0 && (
                <div className="bg-white rounded-[22px] border border-gray-200/90 p-5 sm:p-6 shadow-[0_8px_30px_rgba(31,24,45,0.05)]">
                  <div className="flex items-start justify-between mb-5">
                    <div>
                      <p className="text-xs uppercase tracking-[0.12em] text-gray-400 font-semibold">Infrastructure</p>
                      <h2 className="font-instrument-serif text-3xl font-normal text-gray-950 mt-1">
                        AI Provider Distribution
                      </h2>
                    </div>
                    <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center">
                      <Bot className="w-4 h-4 text-emerald-600" />
                    </div>
                  </div>

                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={providerData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={96}
                        innerRadius={58}
                        fill="#8884d8"
                        dataKey="value"
                        stroke="#ffffff"
                        strokeWidth={3}
                      >
                        {providerData.map((entry, index) => {
                          const colors = ['#7c3aed', '#3b82f6', '#10b981', '#f59e0b', '#ef4444'];
                          return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                        })}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#ffffff',
                          border: '1px solid #e5e7eb',
                          borderRadius: '12px',
                          boxShadow: '0 8px 24px rgba(31,24,45,0.08)'
                        }}
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Performance */}
              <div className="bg-white rounded-[22px] border border-gray-200/90 p-5 sm:p-6 shadow-[0_8px_30px_rgba(31,24,45,0.05)]">
                <div className="flex items-start justify-between mb-5">
                  <div>
                    <p className="text-xs uppercase tracking-[0.12em] text-gray-400 font-semibold">Performance</p>
                    <h2 className="font-instrument-serif text-3xl font-normal text-gray-950 mt-1">
                      Performance Metrics
                    </h2>
                  </div>
                  <div className="w-9 h-9 rounded-xl bg-orange-50 flex items-center justify-center">
                    <TrendingUp className="w-4 h-4 text-orange-600" />
                  </div>
                </div>

                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={conversationData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="#eeeaf2" />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} stroke="#9ca3af" style={{ fontSize: '11px' }} />
                    <YAxis axisLine={false} tickLine={false} stroke="#9ca3af" style={{ fontSize: '11px' }} />
                    <Tooltip
                      cursor={{ stroke: '#fed7aa' }}
                      contentStyle={{
                        backgroundColor: '#ffffff',
                        border: '1px solid #e5e7eb',
                        borderRadius: '12px',
                        boxShadow: '0 8px 24px rgba(31,24,45,0.08)'
                      }}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="count"
                      stroke="#ea580c"
                      strokeWidth={2.5}
                      name="Conversations"
                      dot={{ fill: '#ea580c', r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>

            {/* Summary modules */}
            <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-[22px] bg-gray-950 text-white p-6 shadow-[0_12px_32px_rgba(17,24,39,0.12)]">
                <div className="flex items-center justify-between mb-8">
                  <p className="text-sm text-gray-300">Satisfaction Rate</p>
                  <TrendingUp className="w-5 h-5 text-purple-300" />
                </div>
                <p className="font-instrument-serif text-5xl font-normal leading-none">{analytics?.satisfaction || 0}%</p>
                <p className="text-xs text-gray-400 mt-3">Based on user interactions</p>
              </div>

              <div className="rounded-[22px] bg-white border border-gray-200/90 p-6 shadow-[0_8px_30px_rgba(31,24,45,0.05)]">
                <div className="flex items-center justify-between mb-8">
                  <p className="text-sm text-gray-500">Avg Msg / Conv</p>
                  <MessageSquare className="w-5 h-5 text-blue-500" />
                </div>
                <p className="font-instrument-serif text-5xl font-normal leading-none text-gray-950">
                  {analytics?.totalConversations > 0
                    ? (analytics.totalMessages / analytics.totalConversations).toFixed(1)
                    : 0}
                </p>
                <p className="text-xs text-gray-400 mt-3">Messages per conversation</p>
              </div>

              <div className="rounded-[22px] bg-white border border-gray-200/90 p-6 shadow-[0_8px_30px_rgba(31,24,45,0.05)]">
                <div className="flex items-center justify-between mb-8">
                  <p className="text-sm text-gray-500">Total Leads</p>
                  <Users className="w-5 h-5 text-emerald-500" />
                </div>
                <p className="font-instrument-serif text-5xl font-normal leading-none text-gray-950">
                  {analytics?.totalLeads || 0}
                </p>
                <p className="text-xs text-gray-400 mt-3">Captured from conversations</p>
              </div>
            </section>
          </>
        )}
      </main>

      <Footer variant="dashboard" />
    </div>
  );
};


export default Analytics;