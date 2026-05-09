export const emptyMenuForm = {
  name: '',
  slug: '',
  location: 'header',
  alignment: 'left',
  isActive: true,
  sortOrder: 0,
};


export const emptyItemForm = {
  parentId: '',
  label: '',
  targetType: 'none',
  targetId: '',
  url: '',
  placement: 'center',
  sortOrder: 0,
  isVisible: true,
  openInNewTab: false,
};

export const locationHelp = {
  header: 'Shows in the desktop storefront header.',
  footer: 'Shows in the storefront footer Quick Links column.',
  mobile: 'Shows in the mobile hamburger menu. If empty, mobile uses the Header menu.',
  sidebar: 'Shows on the products page sidebar above filters.',
};

export const placementByLocation = {
  header: [
    { value: 'left', label: 'Header Left' },
    { value: 'center', label: 'Header Center' },
    { value: 'right', label: 'Header Right' },
  ],
  footer: [
    { value: 'quick_links', label: 'Footer Quick Links' },
    { value: 'footer_column', label: 'Footer Column' },
  ],
  mobile: [
    { value: 'mobile', label: 'Mobile Menu' },
  ],
  sidebar: [
    { value: 'sidebar', label: 'Sidebar' },
  ],
};

export const getDefaultPlacement = (location) => {
  if (location === 'footer') return 'quick_links';
  if (location === 'mobile') return 'mobile';
  if (location === 'sidebar') return 'sidebar';
  return 'center';
};

export const needsTarget = (targetType) => ['page', 'category', 'collection', 'product'].includes(targetType);
export const needsUrl = (targetType) => ['custom_url', 'system_route'].includes(targetType);
