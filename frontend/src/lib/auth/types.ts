/** In-memory user record — replaced by Prisma in Milestone 3. */
export type AuthUser = {
  id: string;
  email: string;
  passwordHash: string;
  firstName?: string;
  verified: boolean;
  createdAt: string;
};

export type PendingVerification = {
  email: string;
  passwordHash: string;
  firstName?: string;
  code: string;
  expiresAt: number;
};

export type SessionPayload = {
  userId: string;
  email: string;
  firstName?: string;
};
