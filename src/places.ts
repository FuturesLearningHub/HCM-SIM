import { people } from './content';

/** Places you can jump to. The 3D office and the Places bar share this list, so neither can offer something the other lacks. */
export interface Place {
  id: string;
  label: string;
  /** Shown in the Places bar only while something is waiting there. */
  quiet?: boolean;
}

function officeLabel(id: string): string {
  const p = people.find((x) => x.desk === id);
  if (!p) return 'Office';
  return p.role === 'director' ? "Director's office" : `${p.name.replace(/^Dr\.\s*/, '').split(' ')[0]}'s office`;
}

export const PLACES: Place[] = [
  { id: 'terminal', label: 'Your desk' },
  { id: 'board', label: 'Bulletin board' },
  { id: 'office_a', label: officeLabel('office_a') },
  { id: 'office_b', label: officeLabel('office_b') },
  { id: 'office_c', label: officeLabel('office_c') },
  { id: 'break', label: 'Break room', quiet: true },
  { id: 'reception', label: 'Front door', quiet: true },
];

export const placeLabel = (id: string) => PLACES.find((p) => p.id === id)?.label ?? '';
