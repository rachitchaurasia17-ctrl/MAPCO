import type { Property, PropertyLifecycle } from './types';

/** Translate legacy booleans/status text into the one canonical property state. */
export function propertyLifecycle(property: Pick<Property, 'lifecycle' | 'sold' | 'published'> & {
  internalStatus?: unknown;
}): PropertyLifecycle {
  if (property.lifecycle === 'draft' || property.lifecycle === 'on-sale'
    || property.lifecycle === 'sold' || property.lifecycle === 'archived') return property.lifecycle;
  if (property.sold || /sold/i.test(String(property.internalStatus ?? ''))) return 'sold';
  if (/archived|off[ -]?market|hidden|hold/i.test(String(property.internalStatus ?? ''))) return 'archived';
  return property.published ? 'on-sale' : 'draft';
}

/** Persist lifecycle plus compatibility flags consumed by existing product surfaces. */
export function canonicalPropertyLifecycle(property: Property): Property {
  const lifecycle = propertyLifecycle(property);
  return {
    ...property,
    lifecycle,
    sold: lifecycle === 'sold',
    published: lifecycle === 'on-sale',
    clientVisible: lifecycle === 'on-sale',
  };
}

export function isActiveProperty(property: Property): boolean {
  return propertyLifecycle(property) === 'on-sale';
}

/** Drafts may be incomplete; active inventory may not be. */
export function propertyLifecycleValidationError(property: Property): string | null {
  if (propertyLifecycle(property) !== 'on-sale') return null;
  const required: readonly [unknown, string][] = [
    [property.type, 'property type'], [property.city, 'city'], [property.area, 'area or sector'],
    [property.size, 'size'], [property.facing, 'facing'], [property.position, 'position'],
  ];
  const missing = required.filter(([value]) => !String(value ?? '').trim()).map(([, label]) => label);
  return missing.length ? `Complete ${missing.join(', ')} before putting this property on sale.` : null;
}
