import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, MessageSquare, BarChart3, CreditCard, Settings, LogOut } from 'lucide-react';
import BotSmithLogo from './BotSmithLogo';
import { Button } from './ui/button';

const DashboardSidebar = ({ user, onLogout, usageStats }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
    { icon: MessageSquare, label: 'Chatbots', path: '/dashboard' },
    { icon: BarChart3, label: 'Analytics', path: '/analytics' },
    { icon: CreditCard, label: 'Subscription', path: '/subscription' },
    { icon: Settings, label: 'Settings', path: '/account-settings' },
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
        {/* Plan Expiry Info */}
        {planName !== 'Free' && (
          <div className="p-3 bg-gray-100 rounded-lg">
            <p className="text-xs text-gray-600" style={{ fontFamily: 'Inter, sans-serif' }}>Plan expires in</p>
            <p className="text-lg font-semibold mt-1" style={{ color: '#0B0B0B', fontFamily: 'Inter, sans-serif' }}>
              {daysRemaining} days
            </p>
          </div>
        )}
        
        {/* Upgrade Button */}
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