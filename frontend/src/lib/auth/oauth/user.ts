import { prisma } from "@/lib/db";
import type { OAuthProfile } from "@/lib/auth/oauth/types";

/** Find or create a user from an OAuth provider profile. Links by email when possible. */
export async function findOrCreateOAuthUser(profile: OAuthProfile) {
  const email = profile.email.toLowerCase();

  const existingAccount = await prisma.oAuthAccount.findUnique({
    where: {
      provider_providerAccountId: {
        provider: profile.provider,
        providerAccountId: profile.providerAccountId,
      },
    },
    include: { user: true },
  });

  if (existingAccount) {
    return existingAccount.user;
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });

  if (existingUser) {
    await prisma.oAuthAccount.create({
      data: {
        userId: existingUser.id,
        provider: profile.provider,
        providerAccountId: profile.providerAccountId,
      },
    });
    return prisma.user.update({
      where: { id: existingUser.id },
      data: {
        verified: true,
        firstName: existingUser.firstName ?? profile.firstName,
        image: existingUser.image ?? profile.image,
      },
    });
  }

  return prisma.user.create({
    data: {
      email,
      firstName: profile.firstName,
      image: profile.image,
      verified: true,
      accounts: {
        create: {
          provider: profile.provider,
          providerAccountId: profile.providerAccountId,
        },
      },
    },
  });
}
