import { ShieldCheck } from 'lucide-react';

export function BrandCyan() {
  return (
    <div className="flex flex-col border border-gray-700 bg-gray-900 rounded-lg overflow-hidden w-[200px]">
      <div className="h-[120px] bg-[#00F0FF] w-full"></div>
      <div className="p-3">
        <div className="font-mono text-sm text-gray-200">#00F0FF</div>
        <div className="text-xs text-gray-500 mt-1">Brand Cyan</div>
      </div>
    </div>
  );
}

export function NeutralSurface() {
  return (
    <div className="flex flex-col border border-gray-700 bg-gray-900 rounded-lg overflow-hidden w-[200px]">
      <div className="h-[120px] bg-[#0F0F11] border-b border-gray-800 w-full"></div>
      <div className="p-3">
        <div className="font-mono text-sm text-gray-200">#0F0F11</div>
        <div className="text-xs text-gray-500 mt-1">Neutral Surface</div>
      </div>
    </div>
  );
}

export function HeadingXL() {
  return (
    <div className="flex flex-col border border-gray-700 bg-gray-900 rounded-lg overflow-hidden w-[400px] p-6">
      <div className="text-2xl font-semibold text-white tracking-tight leading-tight font-ui">
        Heading XL (24px Bricolage Grotesque)
      </div>
    </div>
  );
}

export function ShieldCheckIcon() {
  return (
    <div className="flex flex-col border border-gray-700 bg-gray-900 rounded-lg overflow-hidden w-[100px] h-[100px] items-center justify-center">
      <ShieldCheck className="w-8 h-8 text-white" />
    </div>
  );
}
