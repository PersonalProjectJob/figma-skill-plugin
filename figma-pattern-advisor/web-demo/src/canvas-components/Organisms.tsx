import { Search, Bell, CheckCircle, X, ChevronUp } from 'lucide-react';
import { UserAvatar } from './Molecules';

export function LoginForm() {
  return (
    <div className="flex flex-col gap-5 w-[360px] bg-[#0F0F11] border border-[#222] p-8 rounded-xl shadow-2xl">
      <div className="text-2xl font-semibold font-ui text-white tracking-tight mb-2">Sign in to Enterprise</div>
      
      {/* ERROR MESSAGE AREA (Required Anatomy) */}
      <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-md text-sm">
        Invalid credentials. Please try again.
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-gray-300">Work Email</label>
        <input type="text" placeholder="name@company.com" className="h-10 px-3 bg-[#1A1A1E] border border-[#333] rounded-md text-white outline-none focus:border-[#00F0FF]" />
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="flex justify-between items-center">
          <label className="text-sm font-medium text-gray-300">Password</label>
          {/* FORGOT PASSWORD (Required Anatomy) */}
          <a href="#" className="text-xs text-[#00F0FF] hover:underline">Forgot password?</a>
        </div>
        <input type="password" placeholder="••••••••" className="h-10 px-3 bg-[#1A1A1E] border border-[#333] rounded-md text-white outline-none focus:border-[#00F0FF]" />
      </div>

      {/* SAML/SSO BUTTON (Required Anatomy) */}
      <button className="h-10 bg-[#00F0FF] text-black font-semibold rounded-md mt-2 w-full hover:bg-[#00d0dd] transition-colors">
        Continue with SAML
      </button>
      <button className="h-10 bg-[#1A1A1E] border border-[#333] text-white font-semibold rounded-md w-full hover:bg-[#222] transition-colors">
        Sign In with Email
      </button>
    </div>
  );
}

export function PricingTierCard() {
  return (
    <div className="flex flex-col gap-4 w-[320px] bg-[#0F0F11] border border-[#222] p-6 rounded-xl shadow-2xl relative">
      {/* BILLING PERIOD TOGGLE (Required Anatomy) */}
      <div className="absolute top-4 right-4 bg-brand-500/10 text-brand-400 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded border border-brand-500/20">
        Monthly
      </div>

      <div className="text-xl font-semibold font-ui text-white tracking-tight">Organization</div>
      <div className="flex items-end gap-1">
        <span className="text-4xl font-bold text-white">$45</span>
        <span className="text-gray-500 mb-1">/mo</span>
      </div>

      {/* CTA BUTTON (Required Anatomy) */}
      <button className="w-full h-10 mt-2 bg-white text-black font-semibold rounded-md hover:bg-gray-200 transition-colors">
        Upgrade Plan
      </button>

      <div className="flex flex-col gap-3 mt-4 pt-4 border-t border-[#222]">
        <div className="flex items-center gap-2 text-sm text-gray-300">
          <CheckCircle size={16} className="text-[#00F0FF]" /> Org-wide libraries
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-300">
          <CheckCircle size={16} className="text-[#00F0FF]" /> Design system analytics
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-300">
          <CheckCircle size={16} className="text-[#00F0FF]" /> SSO & Advanced security
        </div>
      </div>
    </div>
  );
}

export function TopNavbar() {
  return (
    <div className="flex items-center justify-between w-[800px] h-14 bg-[#0F0F11] border border-[#222] px-6 rounded-xl shadow-lg">
      <div className="flex items-center gap-6">
        <div className="text-white font-bold tracking-tight flex items-center gap-2">
          <div className="w-6 h-6 bg-[#00F0FF] rounded-sm"></div>
          Acme Corp
        </div>
        <nav className="flex gap-4">
          <a href="#" className="text-sm font-medium text-white">Dashboard</a>
          <a href="#" className="text-sm font-medium text-gray-400 hover:text-white">Projects</a>
          <a href="#" className="text-sm font-medium text-gray-400 hover:text-white">Team</a>
        </nav>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Search..." className="h-8 pl-9 pr-3 bg-[#1A1A1E] border border-[#333] rounded-md text-sm text-white w-48 outline-none focus:border-[#00F0FF]" />
        </div>
        <button className="relative text-gray-400 hover:text-white">
          <Bell size={18} />
          <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full"></span>
        </button>
        <UserAvatar />
      </div>
    </div>
  );
}

export function DataTable() {
  return (
    <div className="flex flex-col bg-[#0F0F11] border border-[#222] rounded-xl overflow-hidden w-[600px] shadow-lg">
      <table className="w-full text-left">
        <thead className="bg-[#1A1A1E] border-b border-[#333]">
          <tr>
            {/* Checkbox Selection (Required) */}
            <th className="px-4 py-3 w-10"><input type="checkbox" className="rounded bg-[#222] border-[#444]" /></th>
            <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider w-1/3">
              Name <ChevronUp className="inline-block w-3 h-3 ml-1" />
            </th>
            <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
            <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Role</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#222]">
          <tr>
            <td className="px-4 py-3"><input type="checkbox" className="rounded bg-[#222] border-[#444]" /></td>
            <td className="px-4 py-3 text-sm text-white font-medium">John Doe</td>
            <td className="px-4 py-3"><span className="text-xs text-green-400 bg-green-400/10 px-2 py-1 rounded-full">Active</span></td>
            <td className="px-4 py-3 text-sm text-gray-400">Admin</td>
          </tr>
          <tr>
            <td className="px-4 py-3"><input type="checkbox" className="rounded bg-[#222] border-[#444]" /></td>
            <td className="px-4 py-3 text-sm text-white font-medium">Jane Smith</td>
            <td className="px-4 py-3"><span className="text-xs text-yellow-400 bg-yellow-400/10 px-2 py-1 rounded-full">Pending</span></td>
            <td className="px-4 py-3 text-sm text-gray-400">Editor</td>
          </tr>
        </tbody>
      </table>
      {/* Pagination (Required) */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#1A1A1E] border-t border-[#333]">
        <div className="text-xs text-gray-400">Showing 1 to 2 of 24 results</div>
        <div className="flex gap-1">
          <button className="px-2 py-1 text-xs text-gray-400 border border-[#444] rounded hover:bg-[#333]">Prev</button>
          <button className="px-2 py-1 text-xs text-gray-400 border border-[#444] rounded hover:bg-[#333]">Next</button>
        </div>
      </div>
    </div>
  );
}

export function ModalDialog() {
  return (
    <div className="flex flex-col bg-[#0F0F11] border border-[#222] p-6 rounded-xl shadow-2xl w-[400px] relative">
      {/* Close Button (Required) */}
      <button className="absolute top-4 right-4 text-gray-500 hover:text-white">
        <X size={18} />
      </button>

      <div className="text-xl font-semibold font-ui text-white tracking-tight mb-2">Delete Project</div>
      <p className="text-sm text-gray-400 leading-relaxed mb-6">
        Are you sure you want to delete this project? This action cannot be undone and will permanently remove all data.
      </p>

      <div className="flex gap-3 justify-end mt-2">
        <button className="px-4 py-2 bg-[#1A1A1E] border border-[#333] text-gray-300 rounded text-sm font-medium hover:bg-[#222]">
          Cancel
        </button>
        <button className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded text-sm font-medium">
          Confirm
        </button>
      </div>
    </div>
  );
}

export function ToastNotification() {
  return (
    <div className="flex items-center gap-3 bg-[#0F0F11] border border-green-500/30 p-4 rounded-lg shadow-lg w-[320px] relative overflow-hidden">
      <CheckCircle className="w-5 h-5 text-green-400 shrink-0" />
      <div className="flex-1">
        <div className="text-sm font-medium text-white">Project saved successfully</div>
        <div className="text-xs text-gray-400">Your changes have been deployed.</div>
      </div>
      <button className="text-gray-500 hover:text-white shrink-0">
        <X size={16} />
      </button>
      
      {/* Progress Bar (Required) */}
      <div className="absolute bottom-0 left-0 h-0.5 bg-green-500 w-3/4"></div>
    </div>
  );
}
