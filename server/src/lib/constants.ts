export const ROLES = ['REQUESTER', 'VOLUNTEER', 'ADMIN'] as const;
export type Role = (typeof ROLES)[number];

export const VERIFICATION_STATUSES = ['NOT_REQUIRED', 'PENDING', 'APPROVED', 'REJECTED'] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const CATEGORIES = ['WATER', 'FOOD', 'TRANSPORT', 'SHELTER', 'OTHER_ESSENTIALS'] as const;
export type Category = (typeof CATEGORIES)[number];

export const PRIORITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const;
export type Priority = (typeof PRIORITIES)[number];

export const STATUSES = ['OPEN', 'ACCEPTED', 'IN_PROGRESS', 'FULFILLED', 'CANCELLED'] as const;
export type Status = (typeof STATUSES)[number];

/** Lower rank = more urgent. Used for the default sort. */
export const PRIORITY_RANK: Record<string, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
};
