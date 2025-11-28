
export enum EncounterStatus {
  PENDING = 'PENDING',
  LIKED_BY_ME = 'LIKED_BY_ME', // I accepted/liked them
  LIKED_BY_THEM = 'LIKED_BY_THEM', // They accepted/liked me (notification state)
  MATCHED = 'MATCHED', // Both accepted
  HIDDEN = 'HIDDEN' // Rejected or hidden
}

export type EncounterTag = 'Flechazo' | 'Cruzamos miradas' | 'Interés' | 'Curiosidad' | 'Me atraes' | 'Me gustas';

export const AVAILABLE_TAGS: EncounterTag[] = [
  'Flechazo', 
  'Cruzamos miradas', 
  'Interés', 
  'Curiosidad', 
  'Me atraes', 
  'Me gustas'
];

export interface Location {
  lat: number;
  lng: number;
}

export interface UserProfile {
  id: string;
  name: string;
  age?: number;
  gender?: 'male' | 'female' | 'other';
  bio: string;
  quickMessage?: string; // Custom message for quick publish
  images: string[];
  coverImage?: string; // Fallback for posts without specific image
  isCurrentUser: boolean;
}

export interface Encounter {
  id: string;
  userId: string;
  userProfile: UserProfile; // Snapshot of the user who posted it
  title: string;
  description: string;
  location: Location;
  timestamp: number;
  image?: string; // Optional image of the place/moment
  status: EncounterStatus;
  distance?: number; // Calculated distance from current user
  tags: EncounterTag[];
}

export interface ChatMessage {
  id: string;
  senderId: string;
  text: string;
  timestamp: number;
}

export interface Chat {
  encounterId: string;
  partnerName: string;
  partnerImage: string;
  messages: ChatMessage[];
  unreadCount: number;
}
