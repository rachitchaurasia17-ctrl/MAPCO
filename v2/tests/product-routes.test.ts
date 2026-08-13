import { describe, expect, it } from 'vitest';
import { productRoutes, requestedAction, requestedContextId, requestedPropertyId } from '../src/packages/ui/product-routes';

describe('property-ID product handoffs', () => {
  it('uses the property ID without serializing coordinates', () => {
    const id = 'plot 12/sector 79';
    for (const route of [
      productRoutes.properties(id),
      productRoutes.presentation(id),
      productRoutes.earth(id),
      productRoutes.privateLink(id),
      productRoutes.recordSale(id),
    ]) {
      expect(new URL(route, 'https://mapco.test').searchParams.get('property')).toBe(id);
      expect(route).not.toMatch(/(?:lat|lng|latitude|longitude)=/i);
    }
    expect(productRoutes.customers('buyer 7')).toContain('customer=buyer%207');
    expect(productRoutes.deals('sale 9')).toContain('deal=sale%209');
    expect(requestedContextId('?customer=buyer%207', 'customer')).toBe('buyer 7');
  });

  it('reads optional deep-link context safely', () => {
    expect(requestedPropertyId('?property=property-7')).toBe('property-7');
    expect(requestedPropertyId('?property=%20')).toBeNull();
    expect(requestedAction('?record=1&property=property-7', 'record')).toBe(true);
  });
});
