import { UserAvatar, PrimaryButton } from './Molecules';

export function DashboardLayout() {
  return (
    <div className="flex flex-col w-[1000px] h-[600px] bg-[#050505] border border-[#222] rounded-xl overflow-hidden shadow-2xl relative">
      {/* Top Navbar Area */}
      <div className="w-full h-14 bg-[#0F0F11] border-b border-[#222] flex items-center px-6 gap-4">
        <div className="w-6 h-6 bg-[#00F0FF] rounded-sm"></div>
        <div className="text-white font-bold tracking-tight">Admin Portal</div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar Nav */}
        <div className="w-60 bg-[#0A0A0A] border-r border-[#222] p-4 flex flex-col gap-2">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Main Menu</div>
          <div className="text-sm text-brand-400 bg-brand-500/10 px-3 py-2 rounded-md font-medium">Overview</div>
          <div className="text-sm text-gray-400 px-3 py-2 hover:text-white">Analytics</div>
          <div className="text-sm text-gray-400 px-3 py-2 hover:text-white">Users</div>
          <div className="text-sm text-gray-400 px-3 py-2 hover:text-white">Settings</div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 p-8 overflow-hidden flex flex-col gap-6">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-semibold text-white">Dashboard Overview</h1>
            <PrimaryButton />
          </div>

          {/* KPI Cards */}
          <div className="flex gap-4">
            <div className="flex-1 bg-[#0F0F11] border border-[#222] rounded-lg p-4">
              <div className="text-sm text-gray-400 mb-1">Total Users</div>
              <div className="text-2xl font-bold text-white">12,450</div>
            </div>
            <div className="flex-1 bg-[#0F0F11] border border-[#222] rounded-lg p-4">
              <div className="text-sm text-gray-400 mb-1">Revenue</div>
              <div className="text-2xl font-bold text-white">$45,200</div>
            </div>
            <div className="flex-1 bg-[#0F0F11] border border-[#222] rounded-lg p-4">
              <div className="text-sm text-gray-400 mb-1">Active Sessions</div>
              <div className="text-2xl font-bold text-white">1,204</div>
            </div>
          </div>

          {/* Chart Area Mock */}
          <div className="h-48 bg-[#0F0F11] border border-[#222] rounded-lg p-4 flex items-center justify-center">
            <div className="text-gray-500 text-sm">[Chart Visualization Area]</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function SettingsPage() {
  return (
    <div className="flex flex-col w-[800px] h-[500px] bg-[#050505] border border-[#222] rounded-xl shadow-2xl p-8">
      <div className="text-2xl font-semibold text-white mb-6">Account Settings</div>
      
      <div className="flex gap-8 h-full">
        {/* Section Nav */}
        <div className="w-48 flex flex-col gap-1 border-r border-[#222] pr-4">
          <div className="text-sm text-brand-400 font-medium py-2">Profile</div>
          <div className="text-sm text-gray-400 hover:text-white py-2">Security</div>
          <div className="text-sm text-gray-400 hover:text-white py-2">Notifications</div>
          <div className="text-sm text-gray-400 hover:text-white py-2">Billing</div>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col gap-6">
          <div className="flex items-center gap-4">
            <UserAvatar />
            <button className="text-sm text-brand-400 hover:underline">Change Avatar</button>
          </div>

          <div className="flex gap-4">
            <div className="flex-1 flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-300">First Name</label>
              <input type="text" defaultValue="John" className="h-10 px-3 bg-[#0F0F11] border border-[#333] rounded-md text-white outline-none focus:border-brand-500" />
            </div>
            <div className="flex-1 flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-300">Last Name</label>
              <input type="text" defaultValue="Doe" className="h-10 px-3 bg-[#0F0F11] border border-[#333] rounded-md text-white outline-none focus:border-brand-500" />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-300">Email Address</label>
            <input type="email" defaultValue="john.doe@company.com" className="h-10 px-3 bg-[#0F0F11] border border-[#333] rounded-md text-white outline-none focus:border-brand-500" />
          </div>

          <div className="mt-auto pt-4 border-t border-[#222] flex justify-end gap-3">
            <button className="px-4 py-2 bg-[#1A1A1E] border border-[#333] text-white rounded-md text-sm font-medium hover:bg-[#222]">
              Cancel
            </button>
            <PrimaryButton />
          </div>
        </div>
      </div>
    </div>
  );
}
