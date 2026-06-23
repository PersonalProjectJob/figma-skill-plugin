
import { BrandCyan, NeutralSurface, HeadingXL, ShieldCheckIcon } from './Atoms';
import { PrimaryButton, TextField, StatusBadge, UserAvatar } from './Molecules';
import { LoginForm, PricingTierCard, TopNavbar, DataTable, ModalDialog, ToastNotification } from './Organisms';
import { DashboardLayout, SettingsPage } from './Templates';

interface PatternRendererProps {
  patternId: string;
}

export function PatternRenderer({ patternId }: PatternRendererProps) {
  switch (patternId) {
    // ATOMS
    case 'org/atoms/color/brand-cyan': return <BrandCyan />;
    case 'org/atoms/color/neutral-surface': return <NeutralSurface />;
    case 'org/atoms/typography/heading-xl': return <HeadingXL />;
    case 'org/atoms/icon/shield-check': return <ShieldCheckIcon />;
    
    // MOLECULES
    case 'org/molecules/button/primary': return <PrimaryButton />;
    case 'org/molecules/input/text-field': return <TextField />;
    case 'org/molecules/badge/status': return <StatusBadge />;
    case 'org/molecules/avatar/user': return <UserAvatar />;
    
    // ORGANISMS
    case 'org/organisms/auth/login-form': return <LoginForm />;
    case 'org/organisms/data/pricing-tier': return <PricingTierCard />;
    case 'org/organisms/nav/top-navbar': return <TopNavbar />;
    case 'org/organisms/data/data-table': return <DataTable />;
    case 'org/organisms/feedback/modal-dialog': return <ModalDialog />;
    case 'org/organisms/feedback/toast-notification': return <ToastNotification />;
    
    // TEMPLATES
    case 'org/templates/page/dashboard': return <DashboardLayout />;
    case 'org/templates/page/settings': return <SettingsPage />;

    default:
      return (
        <div className="p-4 border border-red-500 bg-red-500/10 text-red-400 rounded-md">
          Unknown pattern ID: {patternId}
        </div>
      );
  }
}
