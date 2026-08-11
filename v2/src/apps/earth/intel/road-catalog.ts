/* Optional metadata for MAPCO-owned road geometry.
   A GeoJSON filename is sufficient for ingestion; add an entry here only when
   MAPCO should know more about a road's importance or connectivity story. */

export type RoadRole = 'access' | 'arterial' | 'airport' | 'city' | 'regional' | 'connector';
export type RoadClass =
  | 'major-arterial'
  | 'regional-corridor'
  | 'city-connector'
  | 'sector-access'
  | 'ordinary-connector';

export interface RoadCatalogEntry {
  id?: string;
  name?: string;
  aliases?: string[];
  role?: RoadRole;
  roadClass?: RoadClass;
  /** 0..1: buyer-facing significance independent of proximity. */
  importance?: number;
  /** 0..1: how much distinct network reach this corridor contributes. */
  connectivity?: number;
  connects?: string;
  /** Stable concepts used to avoid repeating the same connectivity story. */
  stories?: string[];
}

export const ROAD_CATALOG: Record<string, RoadCatalogEntry> = {
  '51-and-52-deviding-roaad': {
    name: 'Sector 51-52 Dividing Road', role: 'access', roadClass: 'sector-access',
    importance: 0.58, connectivity: 0.5, stories: ['sector-51-52-access'],
  },
  'airport-road': {
    name: 'Airport Road',
    aliases: ['chandigarh airport road', 'mohali airport road'],
    role: 'airport',
    roadClass: 'regional-corridor',
    importance: 0.95,
    connectivity: 0.95,
    connects: 'Chandigarh and Mohali to the international airport',
    stories: ['airport-access', 'chandigarh-mohali-corridor', 'regional-connectivity'],
  },
  'chandi-path': {
    name: 'Chandi Path', role: 'city', roadClass: 'city-connector',
    importance: 0.68, connectivity: 0.68, stories: ['chandigarh-city-access'],
  },
  'dakshin-marg-hd': {
    name: 'Dakshin Marg', aliases: ['dakshin marg chandigarh'], role: 'city', roadClass: 'city-connector',
    importance: 0.8, connectivity: 0.82, stories: ['south-chandigarh-corridor', 'city-east-west'],
  },
  'himalya-marg': {
    name: 'Himalaya Marg', aliases: ['himalya marg'], role: 'city', roadClass: 'city-connector',
    importance: 0.72, connectivity: 0.72, stories: ['central-chandigarh-corridor'],
  },
  'it-city-kurali-bypass': {
    name: 'IT City Kurali Bypass', aliases: ['it city kurali bypass'], role: 'arterial', roadClass: 'regional-corridor',
    importance: 0.92, connectivity: 0.94, stories: ['it-city-access', 'kurali-regional-access', 'bypass-connectivity'],
  },
  'jan-marg': {
    name: 'Jan Marg', role: 'city', roadClass: 'city-connector',
    importance: 0.76, connectivity: 0.78, stories: ['chandigarh-civic-corridor', 'city-north-south'],
  },
  'kharar-banur-road': {
    name: 'Kharar-Banur Road', role: 'regional', roadClass: 'regional-corridor',
    importance: 0.86, connectivity: 0.9, stories: ['kharar-banur-corridor', 'south-mohali-regional-access'],
  },
  'madhya-marg': {
    name: 'Madhya Marg', role: 'city', roadClass: 'major-arterial',
    importance: 0.88, connectivity: 0.9, stories: ['central-chandigarh-corridor', 'city-east-west'],
  },
  'new-chd-dhanas-road': {
    name: 'New Chandigarh-Dhanas Road', aliases: ['new chd dhanas road'], role: 'connector', roadClass: 'city-connector',
    importance: 0.7, connectivity: 0.74, stories: ['new-chandigarh-dhanas-access'],
  },
  'new-chd-internal-road': {
    name: 'New Chandigarh Internal Road', aliases: ['new chd internal road'], role: 'access', roadClass: 'sector-access',
    importance: 0.62, connectivity: 0.58, stories: ['new-chandigarh-local-access'],
  },
  'new-chd-khuda-lohra-road': {
    name: 'New Chandigarh-Khuda Lahora Road', aliases: ['new chd khuda lohra road'], role: 'connector', roadClass: 'city-connector',
    importance: 0.74, connectivity: 0.78, stories: ['new-chandigarh-city-access', 'khuda-lahora-connection'],
  },
  'nh-5': {
    name: 'NH-5', aliases: ['chandigarh kharar highway'], role: 'regional', roadClass: 'major-arterial',
    importance: 0.96, connectivity: 0.98, stories: ['chandigarh-kharar-corridor', 'regional-highway-access'],
  },
  'nh-7': {
    name: 'NH-7', aliases: ['chandigarh ambala highway'], role: 'regional', roadClass: 'major-arterial',
    importance: 0.96, connectivity: 0.98, stories: ['chandigarh-ambala-corridor', 'regional-highway-access'],
  },
  'pashcim-marg': {
    name: 'Paschim Marg', aliases: ['pashcim marg'], role: 'city', roadClass: 'city-connector',
    importance: 0.78, connectivity: 0.8, stories: ['west-chandigarh-corridor', 'city-north-south'],
  },
  'phase-3b1-phase-5-deviding-road': {
    name: 'Phase 3B1-Phase 5 Dividing Road', role: 'access', roadClass: 'sector-access',
    importance: 0.6, connectivity: 0.56, stories: ['mohali-phase-3b1-5-access'],
  },
  'phase-5-phase-7-deviding-road': {
    name: 'Phase 5-Phase 7 Dividing Road', role: 'access', roadClass: 'sector-access',
    importance: 0.6, connectivity: 0.56, stories: ['mohali-phase-5-7-access'],
  },
  'purav-marg': {
    name: 'Purav Marg', role: 'city', roadClass: 'city-connector',
    importance: 0.78, connectivity: 0.8, stories: ['east-chandigarh-corridor', 'city-north-south'],
  },
  'sarover-path': {
    name: 'Sarover Path', role: 'connector', roadClass: 'city-connector',
    importance: 0.66, connectivity: 0.66, stories: ['sukhna-lake-access'],
  },
  'sector-98-and-86-between-road': {
    name: 'Sector 98-86 Dividing Road', role: 'access', roadClass: 'sector-access',
    importance: 0.6, connectivity: 0.56, stories: ['sector-86-98-access'],
  },
  'sh-12a': {
    name: 'SH-12A', role: 'regional', roadClass: 'regional-corridor',
    importance: 0.86, connectivity: 0.9, stories: ['state-highway-access', 'regional-connectivity'],
  },
  'shanti-path': {
    name: 'Shanti Path', role: 'city', roadClass: 'city-connector',
    importance: 0.7, connectivity: 0.7, stories: ['south-chandigarh-corridor'],
  },
  'sukhna-path': {
    name: 'Sukhna Path', role: 'connector', roadClass: 'city-connector',
    importance: 0.68, connectivity: 0.68, stories: ['sukhna-lake-access', 'east-chandigarh-access'],
  },
  'udyan-marg': {
    name: 'Udyan Marg', role: 'city', roadClass: 'city-connector',
    importance: 0.72, connectivity: 0.72, stories: ['chandigarh-leisure-corridor'],
  },
  'udyog-path': {
    name: 'Udyog Path', role: 'connector', roadClass: 'city-connector',
    importance: 0.7, connectivity: 0.74, stories: ['industrial-employment-access'],
  },
  'uttar-marg': {
    name: 'Uttar Marg', role: 'city', roadClass: 'city-connector',
    importance: 0.76, connectivity: 0.78, stories: ['north-chandigarh-corridor', 'city-east-west'],
  },
  'vidya-marg': {
    name: 'Vidya Marg', role: 'connector', roadClass: 'city-connector',
    importance: 0.68, connectivity: 0.68, stories: ['education-access'],
  },
  'vigyan-path': {
    name: 'Vigyan Path', role: 'connector', roadClass: 'city-connector',
    importance: 0.68, connectivity: 0.7, stories: ['institutional-access'],
  },
  'vikas-marg': {
    name: 'Vikas Marg', role: 'city', roadClass: 'city-connector',
    importance: 0.72, connectivity: 0.74, stories: ['chandigarh-development-corridor'],
  },
};
