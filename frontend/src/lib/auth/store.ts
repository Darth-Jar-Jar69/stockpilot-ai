import { randomInt } from "crypto";

import { prisma } from "@/lib/db";

/** Generate a 6-digit email verification code. */
export function createVerificationCode(): string {
  return String(randomInt(100000, 999999));
}

export async function getUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email: email.toLowerCase() } });
}

export async function getUserById(id: string) {
  return prisma.user.findUnique({ where: { id } });
}

export async function saveUser(data: {
  email: string;
  passwordHash: string;
  firstName?: string;
  verified?: boolean;
}) {
  return prisma.user.create({
    data: {
      email: data.email.toLowerCase(),
      passwordHash: data.passwordHash,
      firstName: data.firstName,
      verified: data.verified ?? true,
    },
  });
}

export async function setPendingVerification(entry: {
  email: string;
  passwordHash: string;
  firstName?: string;
  code: string;
  expiresAt: number;
}) {
  const email = entry.email.toLowerCase();
  await prisma.pendingVerification.upsert({
    where: { email },
    create: {
      email,
      passwordHash: entry.passwordHash,
      firstName: entry.firstName,
      code: entry.code,
      expiresAt: new Date(entry.expiresAt),
    },
    update: {
      passwordHash: entry.passwordHash,
      firstName: entry.firstName,
      code: entry.code,
      expiresAt: new Date(entry.expiresAt),
    },
  });
}

export async function getPendingVerification(email: string) {
  const entry = await prisma.pendingVerification.findUnique({
    where: { email: email.toLowerCase() },
  });
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt.getTime()) {
    await prisma.pendingVerification.delete({ where: { email: entry.email } });
    return undefined;
  }
  return {
    email: entry.email,
    passwordHash: entry.passwordHash,
    firstName: entry.firstName ?? undefined,
    code: entry.code,
    expiresAt: entry.expiresAt.getTime(),
  };
}

export async function clearPendingVerification(email: string) {
  await prisma.pendingVerification.deleteMany({ where: { email: email.toLowerCase() } });
}

export async function getOrCreateChatThread(userId: string) {
  const existing = await prisma.chatThread.findFirst({
    where: { userId },
    orderBy: { updatedAt: "desc" },
  });
  if (existing) return existing;
  return prisma.chatThread.create({ data: { userId } });
}

export async function getChatMessages(threadId: string, limit = 20) {
  const messages = await prisma.chatMessage.findMany({
    where: { threadId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return messages.reverse();
}

export async function addChatMessage(threadId: string, role: "user" | "assistant", content: string) {
  const message = await prisma.chatMessage.create({
    data: { threadId, role, content },
  });
  await prisma.chatThread.update({
    where: { id: threadId },
    data: { updatedAt: new Date() },
  });
  return message;
}
