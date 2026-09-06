import { ALL_PROPERTY_SPEC_KEYS, propertyKindOf } from '../../packages/data/property-specs';
import { DETAIL_SCHEMAS, DETAIL_TITLES, detailVisible, detailCompletion } from '../../packages/data/property-details-schema';

/** Drafts live inside one form session and never enter the canonical payload. */
export function switchDetailType(form: Record<string, any>, type: string): Record<string, any> {
  if (type === form.type) return form;
  const drafts = { ...form._detailDrafts };
  const keys = new Set([...ALL_PROPERTY_SPEC_KEYS, 'size', 'unit', 'rate']);
  drafts[propertyKindOf(form.type)] = Object.fromEntries([...keys].filter(k => Object.hasOwn(form, k)).map(k => [k, form[k]]));
  const shared = Object.fromEntries(Object.entries(form).filter(([k]) => !keys.has(k)));
  return { ...shared, size: '', unit: 'sq yd', ...drafts[propertyKindOf(type)], type, _detailDrafts: drafts };
}
const escape = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]!));
export function detailView(form: Record<string, any>, set: (patch: Record<string, unknown>) => void, expanded: Record<string, boolean> = {}, toggle: (group: string) => void = () => {}) {
  const kind = propertyKindOf(form.type);
  const score = detailCompletion(kind, form);
  const groups = ['Essentials', 'Features', 'More details', 'Legal / ownership', 'Commercial / occupancy'];
  return {
    pDetailsTitle: DETAIL_TITLES[kind],
    pDetailPrivateNote: escape(form.notes),
    pDetailsCompletion: `${score.complete} of ${score.total} essentials complete`,
    pDetailSections: groups.map(group => ({ title: group, open: group === 'Essentials' || !!expanded[group], toggle: () => toggle(group), essential: group === 'Essentials',
      fields: DETAIL_SCHEMAS[kind].filter(f => f.group === group && detailVisible(f, form)).map(f => {
        const value = form[f.key];
        const options: readonly (string | boolean)[] = f.control === 'boolean' ? [true, false] : f.options ?? [];
        const isSelect = f.control === 'choice' && options.length > 4;
        return { key: f.key, label: f.label, hint: f.key === 'facing' ? 'Required to list' : group === 'Essentials' ? 'Recommended' : 'Optional',
          isSelect, isChoice: (f.control === 'choice' && !isSelect) || f.control === 'boolean', isInput: ['number', 'text', 'date'].includes(f.control),
          inputType: f.control === 'number' ? 'number' : f.control === 'date' ? 'date' : 'text', value: escape(value),
          on: (e: { target: { value: string } }) => {
            const raw = e.target.value;
            if (f.control === 'number' && raw !== '' && (!Number.isFinite(Number(raw)) || Number(raw) < 0)) return;
            set({ [f.key]: f.control === 'number' && raw !== '' ? Number(raw) : raw });
          },
          clear: () => set({ [f.key]: '' }),
          options: [...(isSelect && value && !options.includes(value) ? [String(value)] : []), ...options].map(o => ({ label: typeof o === 'boolean' ? (o ? 'Yes' : 'No') : escape(o), value: escape(o), selected: String(value) === String(o), go: () => set({ [f.key]: value === o ? '' : o }) })) };
      }) })).filter(g => g.fields.length)
  };
}

