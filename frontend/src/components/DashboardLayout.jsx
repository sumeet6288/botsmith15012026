
import React from 'react';
import DashboardSidebar from './DashboardSidebar';
import ResponsiveNav from './ResponsiveNav';
import UserProfileDropdown from './UserProfileDropdown';
import NotificationBell from './NotificationBell';

const DashboardLayout = ({ children, user, onLogout, usageStats }) => {
  return (
    <div className="flex h-screen bg-white overflow-hidden">
      {/* Sidebar - Desktop Only */}
      <div className="hidden lg:block">
        <DashboardSidebar user={user} onLogout={onLogout} usageStats={usageStats} />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Navigation - Mobile Only */}
        <div className="lg:hidden">
          <ResponsiveNav user={user} onLogout={onLogout} />
        </div>

        {/* Top Navigation - Desktop Only */}
        <div className="hidden lg:block bg-white border-b border-gray-200">
          <div className="flex items-center justify-between px-6 py-3">
            <div className="flex-1">
              <h1
                style={{
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '20px',
                  fontWeight: '600',
                  color: '#0B0B0B',
                  marginBottom: '2px'
                }}
              >
                𝑊𝑒𝑙𝑐𝑜𝑚𝑒 𝑏𝑎𝑐𝑘, {user?.name || 'Demo User'}
              </h1>
              <p
                style={{
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '14px',
                  color: '#6B7280'
                }}
              >
                Monitor your agent's activity and usage
              </p>
            </div>
            <div className="flex items-center gap-4">
              <NotificationBell />
              <UserProfileDropdown user={user} onLogout={onLogout} />
            </div>
          </div>
        </div>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto bg-white">
          {children}
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;