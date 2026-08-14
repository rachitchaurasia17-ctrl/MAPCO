/*
 * Stable navigation contracts between MAPCO product surfaces.
 *
 * A property ID is the only cross-surface identity. Geographic coordinates
 * stay inside Property.location and map coordinates stay inside mapPlacement;
 * neither is serialized into product navigation URLs.
 */

const withProperty = (path: string, propertyId?: string | null): string => {
  const id = propertyId?.trim();
  return id ? `${path}?property=${encodeURIComponent(id)}` : path;
};

const withContext = (path: string, key: string, value?: string | null): string => {
  const normalized = value?.trim();
  return normalized ? `${path}?${key}=${encodeURIComponent(normalized)}` : path;
};

export const productRoutes = {
  home: '/admin/owner.html',
  properties: (propertyId?: string | null) => withProperty('/admin/properties.html', propertyId),
  /** My Plots pre-filtered to one city (Dealer Home's demand legend and attention cards). */
  propertiesInCity: (city?: string | null) => withContext('/admin/properties.html', 'city', city),
  customers: (customerId?: string | null) => withContext('/admin/clients.html', 'customer', customerId),
  deals: (dealId?: string | null) => withContext('/admin/deals.html', 'deal', dealId),
  /** Marketing is its own screen in the current design, not a dashboard section. */
  marketing: () => '/admin/marketing.html',
  presentation: (propertyId?: string | null) => withProperty('/app/plotmap/index.html', propertyId),
  earth: (propertyId?: string | null) => withProperty('/app/earth/index.html', propertyId),
  privateLink: (propertyId?: string | null) => {
    const base = withProperty('/admin/owner.html', propertyId);
    return `${base}#links`;
  },
  recordSale: (propertyId?: string | null) => {
    const id = propertyId?.trim();
    const params = new URLSearchParams({ record: '1' });
    if (id) params.set('property', id);
    return `/admin/deals.html?${params.toString()}`;
  },
} as const;

export function requestedPropertyId(
  search: string = typeof window === 'undefined' ? '' : window.location.search,
): string | null {
  return requestedContextId(search, 'property');
}

export function requestedContextId(search: string, key: string): string | null {
  const value = new URLSearchParams(search).get(key)?.trim();
  return value || null;
}

export function requestedAction(search: string, action: string): boolean {
  return new URLSearchParams(search).get(action) === '1';
}
