// ─────────────────────────────────────────────────────────
// Pattern Database giả lập cho một tổ chức Enterprise
// Mỗi pattern có `requiredAnatomy` và `antiPatterns` rõ ràng
// để hàm `auditDesign()` có thể đối chiếu và tạo kết quả
// Pass / Fail / Warning chính xác khi so với CONTEXT_EXTRACTED.
// ─────────────────────────────────────────────────────────

export const mockPatterns = [
  // ═══════════════════ ATOMS ═══════════════════
  {
    patternId: "org/atoms/color/brand-cyan",
    name: "Brand Cyan",
    version: "2.1.0",
    componentKey: "mock-key-cyan",
    componentId: "mock-id-cyan",
    description: "Core brand accent color — #00F0FF. Used for primary interactive elements.",
    requiredAnatomy: ["Fill"],
    antiPatterns: ["Using as background text color"],
    signals: ["color", "brand", "cyan", "accent"]
  },
  {
    patternId: "org/atoms/color/neutral-surface",
    name: "Neutral Surface",
    version: "1.0.0",
    componentKey: "mock-key-neutral",
    componentId: "mock-id-neutral",
    description: "Dark surface color (#0F0F11) used for card backgrounds and input fields.",
    requiredAnatomy: ["Surface Fill", "Border Token"],
    antiPatterns: ["Using pure black (#000)"],
    signals: ["surface", "neutral", "background", "dark"]
  },
  {
    patternId: "org/atoms/typography/heading-xl",
    name: "Heading XL",
    version: "1.2.0",
    componentKey: "mock-key-heading",
    componentId: "mock-id-heading",
    description: "Primary heading style — 24px Bricolage Grotesque SemiBold.",
    requiredAnatomy: ["Font Family", "Font Size", "Line Height"],
    antiPatterns: ["Using system font instead of brand font"],
    signals: ["heading", "title", "h1", "typography"]
  },
  {
    patternId: "org/atoms/icon/shield-check",
    name: "Shield Check Icon",
    version: "1.0.0",
    componentKey: "mock-key-shield",
    componentId: "mock-id-shield",
    description: "Security verification icon, used in trust indicators and SSO flows.",
    requiredAnatomy: ["SVG Path", "16px Bounding Box"],
    antiPatterns: ["Scaling beyond 24px", "Changing stroke color to non-brand"],
    signals: ["icon", "shield", "check", "security", "verified"]
  },

  // ═══════════════════ MOLECULES ═══════════════════
  {
    patternId: "org/molecules/button/primary",
    name: "Primary Button",
    version: "3.0.0",
    componentKey: "mock-key-btn",
    componentId: "mock-id-btn",
    description: "Main call-to-action button. Cyan fill, black text, 40px height.",
    requiredAnatomy: ["Label Text", "Container Fill", "Min Width 120px", "Border Radius"],
    antiPatterns: ["Multiple primary buttons on one screen", "Using as a link substitute"],
    signals: ["button", "primary", "cta", "click", "submit"]
  },
  {
    patternId: "org/molecules/input/text-field",
    name: "Text Input Field",
    version: "2.1.0",
    componentKey: "mock-key-input",
    componentId: "mock-id-input",
    description: "Standard single-line text input with label and optional helper text.",
    requiredAnatomy: ["Label", "Input Container", "Placeholder Text", "Focus Ring"],
    antiPatterns: ["Missing label (accessibility)", "Placeholder as label replacement"],
    signals: ["input", "text", "field", "form", "email", "name"]
  },
  {
    patternId: "org/molecules/badge/status",
    name: "Status Badge",
    version: "1.3.0",
    componentKey: "mock-key-badge",
    componentId: "mock-id-badge",
    description: "Small pill-shaped badge for status indicators (Active, Pending, Error).",
    requiredAnatomy: ["Label", "Background Fill", "Border Radius (Full)"],
    antiPatterns: ["Using more than 2 words in label"],
    signals: ["badge", "status", "tag", "pill", "indicator", "active"]
  },
  {
    patternId: "org/molecules/avatar/user",
    name: "User Avatar",
    version: "1.0.0",
    componentKey: "mock-key-avatar",
    componentId: "mock-id-avatar",
    description: "Circular avatar with initials fallback. Supports 32/40/48px sizes.",
    requiredAnatomy: ["Image or Initials", "Circle Mask", "Border"],
    antiPatterns: ["Square shape without border-radius", "Missing alt text"],
    signals: ["avatar", "user", "profile", "photo", "initials"]
  },

  // ═══════════════════ ORGANISMS ═══════════════════
  {
    patternId: "org/organisms/auth/login-form",
    name: "Login Form",
    version: "2.0.0",
    componentKey: "mock-key-login",
    componentId: "mock-id-login",
    description: "Standard SSO authentication form for internal enterprise tools.",
    requiredAnatomy: ["Email Input", "Password Input", "SAML/SSO Button", "Forgot Password Link", "Error Message Area"],
    antiPatterns: ["Adding unnecessary fields", "Removing SSO option", "No error feedback"],
    signals: ["login", "auth", "signin", "password", "email", "sso"]
  },
  {
    patternId: "org/organisms/data/pricing-tier",
    name: "Pricing Tier Card",
    version: "1.5.0",
    componentKey: "mock-key-pricing",
    componentId: "mock-id-pricing",
    description: "Card displaying plan details, pricing, and feature comparison list.",
    requiredAnatomy: ["Plan Name", "Price Display", "Feature List", "CTA Button", "Billing Period Toggle"],
    antiPatterns: ["Too many features listed (>8)", "Hidden price behind interaction"],
    signals: ["pricing", "plan", "subscription", "tier", "card"]
  },
  {
    patternId: "org/organisms/nav/top-navbar",
    name: "Top Navigation Bar",
    version: "3.1.0",
    componentKey: "mock-key-navbar",
    componentId: "mock-id-navbar",
    description: "Global navigation header with logo, nav links, search, and user menu.",
    requiredAnatomy: ["Logo", "Nav Links", "Search Bar", "User Avatar", "Notification Bell"],
    antiPatterns: ["More than 7 top-level nav items", "Missing mobile hamburger menu"],
    signals: ["navbar", "navigation", "header", "menu", "topbar"]
  },
  {
    patternId: "org/organisms/data/data-table",
    name: "Data Table",
    version: "2.3.0",
    componentKey: "mock-key-table",
    componentId: "mock-id-table",
    description: "Sortable, filterable data table for admin dashboards and analytics views.",
    requiredAnatomy: ["Column Headers", "Row Data", "Pagination Controls", "Sort Indicators", "Checkbox Selection"],
    antiPatterns: ["No horizontal scroll for many columns", "Missing empty state"],
    signals: ["table", "data", "grid", "rows", "columns", "list", "admin"]
  },
  {
    patternId: "org/organisms/feedback/modal-dialog",
    name: "Modal Dialog",
    version: "2.0.0",
    componentKey: "mock-key-modal",
    componentId: "mock-id-modal",
    description: "Confirmation or form modal with overlay backdrop and focus trap.",
    requiredAnatomy: ["Overlay Backdrop", "Title", "Body Content", "Action Buttons", "Close Button"],
    antiPatterns: ["No close mechanism (trap user)", "Nested modals", "Scrollable body without indicator"],
    signals: ["modal", "dialog", "popup", "confirm", "alert", "overlay"]
  },
  {
    patternId: "org/organisms/feedback/toast-notification",
    name: "Toast Notification",
    version: "1.1.0",
    componentKey: "mock-key-toast",
    componentId: "mock-id-toast",
    description: "Non-blocking notification appearing at the top-right corner. Auto-dismisses after 5s.",
    requiredAnatomy: ["Icon", "Message Text", "Dismiss Button", "Progress Bar"],
    antiPatterns: ["Blocking user interaction", "No auto-dismiss timeout"],
    signals: ["toast", "notification", "alert", "snackbar", "message"]
  },

  // ═══════════════════ TEMPLATES ═══════════════════
  {
    patternId: "org/templates/page/dashboard",
    name: "Dashboard Layout",
    version: "1.0.0",
    componentKey: "mock-key-dashboard",
    componentId: "mock-id-dashboard",
    description: "Standard admin dashboard with sidebar navigation, KPI cards, and chart area.",
    requiredAnatomy: ["Sidebar Nav", "KPI Card Row", "Chart Area", "Data Table Section", "Page Header"],
    antiPatterns: ["No responsive breakpoint", "Missing skeleton loading state"],
    signals: ["dashboard", "admin", "analytics", "overview", "kpi", "chart"]
  },
  {
    patternId: "org/templates/page/settings",
    name: "Settings Page",
    version: "1.0.0",
    componentKey: "mock-key-settings",
    componentId: "mock-id-settings",
    description: "Vertical-tab settings page with section navigation and save/cancel actions.",
    requiredAnatomy: ["Section Nav", "Form Fields", "Save Button", "Cancel Button", "Section Title"],
    antiPatterns: ["No unsaved changes warning", "Saving without confirmation"],
    signals: ["settings", "preferences", "config", "profile", "account"]
  }
];
