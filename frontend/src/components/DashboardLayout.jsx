import React from 'react';
import DashboardSidebar from './DashboardSidebar';
import ResponsiveNav from './ResponsiveNav';

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

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto bg-white">
          {children}
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;