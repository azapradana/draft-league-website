import { PrismaAdapter } from "@next-auth/prisma-adapter";
import bcrypt from "bcryptjs";
import type { AdapterUser } from "next-auth/adapters";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { prisma } from "@/lib/prisma";
import { getSiteSettings } from "@/lib/site-settings";

const providers: NextAuthOptions["providers"] = [
  CredentialsProvider({
    name: "Username or email",
    credentials: {
      identifier: {
        label: "Username or email",
        type: "text",
        placeholder: "admin",
      },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials) {
      const identifier = credentials?.identifier?.trim();
      const password = credentials?.password;

      if (!identifier || !password) {
        return null;
      }

      const user = await prisma.user.findFirst({
        where: {
          OR: [
            { username: { equals: identifier, mode: "insensitive" } },
            { email: { equals: identifier, mode: "insensitive" } },
          ],
        },
        select: {
          id: true,
          name: true,
          email: true,
          username: true,
          passwordHash: true,
          role: true,
        },
      });

      if (!user?.passwordHash) {
        return null;
      }

      const passwordMatches = await bcrypt.compare(password, user.passwordHash);

      if (!passwordMatches) {
        return null;
      }

      return {
        id: user.id,
        name: user.name ?? user.username,
        email: user.email,
        role: user.role,
      };
    },
  }),
];

const adapter = PrismaAdapter(prisma);
adapter.createUser = async (user: Omit<AdapterUser, "id">) => {
  const settings = await getSiteSettings();
  const createdUser = await prisma.user.create({
    data: {
      ...user,
      coinsBalance: settings.initialPlayerCoins,
    },
  });
  return {
    id: createdUser.id,
    name: createdUser.name,
    email: user.email,
    emailVerified: createdUser.emailVerified,
    image: createdUser.image,
  };
};

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

if (Boolean(googleClientId) !== Boolean(googleClientSecret)) {
  throw new Error(
    "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must both be configured to enable Google sign-in.",
  );
}

if (googleClientId && googleClientSecret) {
  providers.push(
    GoogleProvider({
      clientId: googleClientId,
      clientSecret: googleClientSecret,
    }),
  );
}

export const authOptions: NextAuthOptions = {
  adapter,
  providers,
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  callbacks: {
    async jwt({ token, user }) {
      const userId = user?.id ?? token.id ?? token.sub;

      if (!userId) {
        return token;
      }

      const currentUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, role: true },
      });

      if (!currentUser) {
        delete token.id;
        delete token.role;
        delete token.sub;
        return token;
      }

      token.id = currentUser.id;
      token.sub = currentUser.id;
      token.role = currentUser.role;

      return token;
    },
    async session({ session, token }) {
      if (session.user && typeof token.id === "string") {
        session.user.id = token.id;
      }

      if (session.user && token.role) {
        session.user.role = token.role;
      }

      return session;
    },
  },
  events: {
    async signIn({ user, account, profile }) {
      if (account?.provider !== "google" || !user.id) {
        return;
      }

      const email =
        profile &&
        "email" in profile &&
        typeof profile.email === "string"
          ? profile.email
          : null;

      if (email) {
        await prisma.user.update({
          where: { id: user.id },
          data: { googleEmail: email },
        });
      }
    },
  },
};
