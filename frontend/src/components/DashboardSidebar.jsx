import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { MessageSquare, BarChart3, CreditCard, Settings, LogOut, BookOpen } from 'lucide-react';
import BotSmithLogo from './BotSmithLogo';
import { Button } from './ui/button';

const DashboardSidebar = ({ user, onLogout, usageStats }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { icon: MessageSquare, label: 'Chatbots', path: '/dashboard' },
    { icon: BarChart3, label: 'Analytics', path: '/analytics' },
    { icon: CreditCard, label: 'Subscription', path: '/subscription' },
    { icon: Settings, label: 'Settings', path: '/account-settings' },
    { icon: BookOpen, label: 'Documentation', path: '/resources/documentation' },
  ];

  const isActive = (path) => location.pathname === path;

  const daysRemaining = usageStats?.subscription?.days_remaining || 0;
  const planName = usageStats?.plan?.name || 'Free';
  const expiresAt = usageStats?.subscription?.expires_at;
  
  // Format expiry date
  const formatExpiryDate = (dateString) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  return (
    <div className="w-64 h-screen bg-gray-50 border-r border-gray-200 flex flex-col">
      {/* Logo Section - Enhanced Branding */}
      <div className="p-6 border-b border-gray-200">
        <div className="cursor-pointer" onClick={() => navigate('/')}>
          <div className="flex items-center gap-2 mb-1">
            <BotSmithLogo className="w-8 h-8" />
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-black tracking-tight bg-gradient-to-r from-purple-700 via-fuchsia-600 to-pink-600 bg-clip-text text-transparent transition-all duration-300" style={{ fontFamily: 'Inter, sans-serif' }}>
                BotSmith
              </span>
              <span className="text-[8px] font-bold text-purple-600 bg-purple-100 px-1 py-0.5 rounded-md">AI</span>
            </div>
          </div>
          <span className="text-[9px] font-semibold text-gray-400 tracking-wider uppercase block ml-10">
            Powered by Jyosha Solutions
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                active
                  ? 'bg-purple-50 border-l-4 border-purple-600'
                  : 'hover:bg-gray-100 text-gray-600'
              }`}
              style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: '14px',
                fontWeight: active ? '500' : '400',
                color: active ? '#0B0B0B' : '#6B7280',
              }}
            >
              <Icon className={`w-5 h-5 ${
                active ? 'text-purple-600' : 'text-gray-400'
              }`} />
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Bottom Section */}
      <div className="p-4 border-t border-gray-200 space-y-3">
        {/* Plan Info - Enhanced Display for ALL users */}
        <div className="p-3 bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg border border-purple-100">
          <p className="text-xs font-semibold text-purple-600 mb-1" style={{ fontFamily: 'Inter, sans-serif' }}>Current Plan</p>
          <p className="text-base font-bold text-gray-900 mb-2" style={{ fontFamily: 'Inter, sans-serif' }}>
            {planName}
          </p>
          
          {/* For Paid Plans - Show Expiry Details */}
          {expiresAt && planName !== 'Free' && (
            <div className="text-xs text-gray-600 space-y-0.5" style={{ fontFamily: 'Inter, sans-serif' }}>
              <p className="font-medium">Expires: {formatExpiryDate(expiresAt)}</p>
              <p className="text-purple-600 font-semibold">{daysRemaining} days remaining</p>
            </div>
          )}
          
          {/* For Free Plan - Show Usage Details */}
          {planName === 'Free' && (
            <div className="text-xs text-gray-600 space-y-1" style={{ fontFamily: 'Inter, sans-serif' }}>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Chatbots:</span>
                <span className="font-semibold text-gray-700">
                  {usageStats?.usage?.chatbots?.current ?? 0} / {usageStats?.usage?.chatbots?.limit ?? 2}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Messages:</span>
                <span className="font-semibold text-gray-700">
                  {usageStats?.usage?.messages?.current ?? 0} / {usageStats?.usage?.messages?.limit ?? 50}
                </span>
              </div>
              <div className="mt-2 pt-2 border-t border-purple-100">
                <p className="text-purple-600 font-medium text-[10px]">
                  ✨ Upgrade for unlimited features
                </p>
              </div>
            </div>
          )}
        </div>
        
        {/* Upgrade Button - Show for Free users */}
        {planName === 'Free' && (
          <Button
            onClick={() => navigate('/subscription')}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white rounded-lg py-2"
            style={{ fontFamily: 'Inter, sans-serif', fontSize: '14px', fontWeight: '500' }}
          >
            Upgrade
          </Button>
        )}

        {/* Logout */}
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-100 transition-all duration-200 text-gray-600"
          style={{ fontFamily: 'Inter, sans-serif', fontSize: '14px' }}
        >
          <LogOut className="w-5 h-5 text-gray-400" />
          Logout
        </button>
      </div>
    </div>
  );
};

export default DashboardSidebar;