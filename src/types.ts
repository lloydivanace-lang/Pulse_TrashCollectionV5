export type WasteStatus = 'PENDING' | 'DISPATCHED' | 'RESOLVED' | 'CANCELLED';
export type SeverityLevel = 'MILD' | 'MODERATE' | 'OVERFLOWING' | 'EMERGENCY';

export interface WasteReport {
  id: string;
  ticketNumber: string;
  residentName: string;
  residentPhone?: string;
  isElderly: boolean; // Senior Citizen Priority Flag
  severityLevel: SeverityLevel; // Gaano kalala ang basura
  purok: string; // Cavite City Barangay Zone / Purok
  barangay?: string; // 'Barangay 40' | 'Barangay 41'
  streetAddress?: string;
  houseNumber?: string;
  landmark?: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  autoGpsAccurate?: boolean;
  realtimeGpsAddress?: string; // Tunay na address base sa real-time GPS
  isWithinBrgy41?: boolean;
  isWithinJurisdiction?: boolean; // Tag kung nasa sakop ng Barangay 40 o 41
  needsAssistanceOutside?: boolean; // Para sa mga nasa labas ng Brgy 40 & 41 pero residente
  wasteTypes: string[];
  urgency: 'NORMAL' | 'HIGH' | 'URGENT_ELDERLY' | 'OVERFLOWING';
  estimatedBags?: string;
  photos: string[]; // Resident's uploaded photos (1 to 15)
  notes?: string;
  extraMessage?: string; // Option 4 extra message at the bottom
  status: WasteStatus;
  createdAt: string;
  dispatchedAt?: string;
  resolvedAt?: string;
  resolvedBy?: string;
  resolutionNotes?: string;

  // REQUIRED Kagawad Proof of Collection (Proeba na naipadala pabalik sa residente)
  proofPhotos: string[]; // Litrato ng proeba / katibayan na nakolekta na
  proofSubmittedAt?: string;
  proofKagawadName?: string;
  cancellationReason?: string;
  cancelledAt?: string;

  sourceStorage: 'Raspberry Pi 4B (Local Cloud)' | 'Cloud Server' | string;
  storageUsedMb: number; // Kabuuang kinakain sa Raspberry Pi 4 storage
  residentPhotosSizeMb: number; // Kinakain ng litrato ng residente sa Pi
  proofPhotosSizeMb: number; // Kinakain ng proof photo ng Kagawad sa Pi
  retentionDays: number;
  expiresAt: string;
  remindersSent: number;
  lastReminderAt?: string;

  // Auto-Purge Rules: 3 days for unresolved, 1 day for resolved (always kept in permanent logbook)
  isPurgedFromFeed?: boolean;
  purgeRemainingMs?: number;
  feedExpiresAt?: string;
  purgeCountdownText?: string;
  purgeTtlRule?: '3_DAYS_UNRESOLVED' | '1_DAY_RESOLVED';
}

export interface PiStatus {
  hardware: string;
  ram: string;
  storageCapacityGb?: number;
  storageUsedMb: number;
  storageFreeGb?: number;
  disk_total?: string;
  disk_used?: string;
  disk_free?: string;
  pulseFolderMb?: number;
  pulseFolderKb?: number;
  pulseStorageSummary?: string;
  storage_folder?: string;
  residentPhotosCount: number;
  residentPhotosMb: number;
  proofPhotosCount: number;
  proofPhotosMb: number;
  cachedImagesCount: number;
  activeTicketsCount: number;
  pendingTicketsCount: number;
  brgy40Count?: number;
  brgy41Count?: number;
  autoPurgeTtlDays: number;
  cpuTempCelsius: number;
  cpu_temp?: string;
  ramUsagePercent?: number;
  ipAddress: string;
  localHostname: string;
  online: boolean;
  lastPurgeRun: string;
  savedLogbooksCount: number;
  latencyMs?: number;
  lastPingAt?: string;
  configuredUrl?: string;
  connectionMethod?: string;
}

export interface SavedLogBook {
  id: string;
  filename: string;
  savedAt: string;
  savedAtPhilippineTime: string;
  totalRecords: number;
  pendingRecords: number;
  dispatchedRecords: number;
  resolvedRecords: number;
  cancelledRecords: number;
  brgy40Count: number;
  brgy41Count: number;
  storageUsedMb: number;
  savedBy: string;
  destination: 'Raspberry Pi 4B Cloud Server' | 'Local Browser Archive' | string;
  syncStatus: 'SYNCED' | 'LOCAL_ONLY' | 'PENDING_UPLOAD';
  recordsSummary: string;
  recordsSnapshot?: WasteReport[];
}

export interface TelegramBotStatus {
  online: boolean;
  status: 'ONLINE' | 'OFFLINE' | 'RECONNECTING' | 'NOT_CONFIGURED';
  botConfigured: boolean;
  chatId: string;
  botUsername?: string;
  botFirstName?: string;
  autoRestartCount: number;
  reconnectAttempts: number;
  lastCheckedAt: string;
  lastSeenOnline?: string;
  lastError?: string;
  watchdogActive: boolean;
  lastBroadcastMessage?: string;
  lastBroadcastTime?: string;
  philippineTime?: string;
  pendingCount?: number;
  activeUnfinishedCount?: number;
}
