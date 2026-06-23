export function PrimaryButton() {
  return (
    <button className="h-10 px-6 min-w-[120px] bg-[#00F0FF] text-black rounded-md font-semibold text-sm hover:bg-[#00d0dd] transition-colors">
      Primary Action
    </button>
  );
}

export function TextField() {
  return (
    <div className="flex flex-col gap-1.5 w-[300px]">
      <label className="text-sm font-medium text-gray-300">Email Address</label>
      <input 
        type="text" 
        placeholder="name@company.com" 
        className="h-10 px-3 bg-[#0F0F11] border border-gray-700 rounded-md text-white outline-none focus:border-[#00F0FF] transition-colors text-sm"
      />
      <div className="text-xs text-gray-500">We'll never share your email.</div>
    </div>
  );
}

export function StatusBadge() {
  return (
    <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20">
      Active
    </div>
  );
}

export function UserAvatar() {
  return (
    <div className="w-10 h-10 rounded-full border border-gray-700 bg-brand-500 flex items-center justify-center text-white font-bold text-sm">
      AD
    </div>
  );
}
