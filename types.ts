
export enum MedicationStatus {
  PENDING = 'PENDING',
  TAKEN = 'TAKEN',
  MISSED = 'MISSED', // Late/Forgot
}

export interface Medication {
  id: string;
  name: string;
  dosage: string;
  time: string; // HH:mm format
  notes?: string;
  status: MedicationStatus; // Status for TODAY
  lastTaken?: string; // ISO Date string
  customAudio?: string; // Base64 Data URL for custom voice/music
}

export interface SeniorProfile {
  id: string;
  name: string;
  photoUrl?: string;
  medications: Medication[];
  emergencyContact: string;
  logs: LogEntry[];
}

export interface LogEntry {
  id: string;
  medicationName: string;
  scheduledTime: string;
  actionTime: string; // When button was clicked
  status: MedicationStatus;
  date: string; // YYYY-MM-DD
}

export interface GeoLocation {
  lat: number;
  lng: number;
}
