import NextAuth, { NextAuthOptions, User, Session, DefaultSession } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';

import { prisma } from '@/lib/prisma';
import bcrypt from 'bcrypt';
import { JWT } from 'next-auth/jwt';
import { PrismaAdapter } from '@auth/prisma-adapter';

// Extend the default User type to include role
interface CustomUser extends User {
  role: string; // Matches your Prisma Role enum
}

// Extend the default Session type to include id and role
declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      name: string;
      role: string;
    } & DefaultSession['user'];
  }
}

// Extend the JWT type to include id and role
declare module 'next-auth/jwt' {
  interface JWT {
    id?: string;
    role?: string;
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials, req): Promise<CustomUser | null> {
        if (!credentials?.username || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { username: credentials.username },
        });

        if (!user || !user.password) return null;

        // Check if expiresAt is not null and compare with current date
        if (user.expiresAt && user.expiresAt < new Date()) return null;

        const isValid = await bcrypt.compare(credentials.password, user.password);
        if (!isValid) return null;

        // Return user object with id as string to match NextAuth's User type
        return {
          id: user.id.toString(), // Convert number to string
          name: user.username,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({
      token,
      user,
      account,
      profile,
      trigger,
      isNewUser,
      session,
    }: {
      token: JWT;
      user: User | null;
      account: any | null; // Use `any` for account to avoid strict typing issues
      profile?: any; // Use `any` for profile to avoid strict typing issues
      trigger?: 'signIn' | 'signUp' | 'update';
      isNewUser?: boolean;
      session?: any;
    }): Promise<JWT> {
      if (user) {
        token.id = user.id;
        token.role = (user as CustomUser).role; // Cast user to CustomUser to access role
      }
      return token;
    },
    async session({
      session,
      token,
      user,
    }: {
      session: Session;
      token: JWT;
      user: any; // Use `any` for user to avoid AdapterUser type issues
    }): Promise<Session> {
      if (session.user) {
        session.user.id = token.id!;
        session.user.role = token.role!;
      }
      return session;
    },
  },
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: 'jwt' as const, // Explicitly type as SessionStrategy
  },
};

// Initialize NextAuth
const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };