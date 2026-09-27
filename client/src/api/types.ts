export type Role = 'REQUESTER' | 'VOLUNTEER' | 'ADMIN';
export type VerificationStatus = 'NOT_REQUIRED' | 'PENDING' | 'APPROVED' | 'REJECTED';
export type Category = 'WATER' | 'FOOD' | 'TRANSPORT' | 'SHELTER' | 'OTHER_ESSENTIALS';
export type Priority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type Status = 'OPEN' | 'ACCEPTED' | 'IN_PROGRESS' | 'FULFILLED' | 'CANCELLED';
export type RequestAction = 'accept' | 'start' | 'fulfil' | 'release' | 'cancel' | 'edit' | 'flag';

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: Role;
  city: string;
  area: string;
  lat: number | null;
  lng: number | null;
  verificationStatus: VerificationStatus;
  verificationNote: string | null;
  idProofText: string | null;
  skills: string | null;
  hasVehicle: boolean;
  verifiedAt: string | null;
  createdAt: string;
}

export interface PersonRef {
  id: string;
  name: string;
  phone?: string;
}

export interface HelpRequest {
  id: string;
  title: string;
  category: Category;
  description: string;
  quantity: number;
  peopleAffected: number;
  priority: Priority;
  status: Status;
  city: string;
  area: string;
  addressLine: string | null;
  lat: number | null;
  lng: number | null;
  contactPhone: string | null;
  requesterId: string;
  volunteerId: string | null;
  requester?: PersonRef;
  volunteer: PersonRef | null;
  createdAt: string;
  updatedAt: string;
  fulfilledAt: string | null;
  distanceKm?: number;
  contactVisible: boolean;
  allowedActions: RequestAction[];
}

export interface HistoryEntry {
  id: string;
  fromStatus: Status | null;
  toStatus: Status;
  note: string | null;
  createdAt: string;
  changedBy: { id: string; name: string; role: Role };
}

export interface RequestDetail extends HelpRequest {
  history: HistoryEntry[];
  viewerHasFlagged: boolean;
  openFlagCount?: number;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface RequestInput {
  title: string;
  category: Category;
  description: string;
  quantity: number;
  peopleAffected: number;
  priority: Priority;
  city: string;
  area: string;
  addressLine: string;
  lat?: number | null;
  lng?: number | null;
  contactPhone: string;
}

export interface Volunteer extends User {
  assignedCount: number;
}

export interface AdminStats {
  totalRequests: number;
  byStatus: Record<Status, number>;
  byPriority: Record<Priority, number>;
  byCategory: Record<Category, number>;
  byCity: Record<string, number>;
  openCritical: number;
  volunteers: { pending: number; approved: number; rejected: number };
  pendingVerifications: number;
  flaggedRequests: number;
  avgFulfilHours: number | null;
}

export interface FlaggedRequest {
  request: {
    id: string;
    title: string;
    status: Status;
    priority: Priority;
    category: Category;
    area: string;
    city: string;
    createdAt: string;
    requester: { id: string; name: string };
  };
  reports: { id: string; reason: string; createdAt: string; reportedBy: { id: string; name: string; role: Role } }[];
}

export interface Summary {
  openRequests: number;
  criticalOpen: number;
  verifiedVolunteers: number;
  fulfilled: number;
}

export interface Locations {
  cities: { city: string; areas: string[] }[];
}
