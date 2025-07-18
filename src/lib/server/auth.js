import { PrismaAdapter } from '@next-auth/prisma-adapter';
import EmailProvider from 'next-auth/providers/email';
import prisma from '@/prisma/index';
import { sendMail } from '@/lib/server/mail';
import { html, text } from '@/config/email-templates/signin';

import { getPayment, createPaymentAccount } from '@/prisma/services/customer';

export const authOptions = {
  adapter: PrismaAdapter(prisma),

  callbacks: {
    session: async ({ session, user }) => {
      if (session.user) {
        const customerPayment = await getPayment(user.email);
        session.user.userId = user.id;

        if (customerPayment) {
          session.user.subscription = customerPayment.subscriptionType;
        }
      }
      return session;
    },
  },

  debug: process.env.NODE_ENV !== 'production',

  events: {
    signIn: async ({ user, isNewUser }) => {
      const customerPayment = await getPayment(user.email);
      if (isNewUser || customerPayment === null || user.createdAt === null) {
        await createPaymentAccount(user.email, user.id);
      }
    },
  },

  providers: [
    EmailProvider({
      from: process.env.EMAIL_FROM,
      server: {
        host: process.env.EMAIL_SERVER,
        port: Number(process.env.EMAIL_SERVER_PORT),
        secure: Number(process.env.EMAIL_SERVER_PORT) === 465, // true if port is 465
        auth: {
          user: process.env.EMAIL_SERVER_USER,
          pass: process.env.EMAIL_SERVER_PASSWORD,
        },
      },
      sendVerificationRequest: async ({ identifier: email, url }) => {
        const { host } = new URL(url);

        await sendMail({
          from: process.env.EMAIL_FROM,
          to: email,
          subject: `[AI Toolbox] Sign in to ${host}`,
          text: text({ email, url }),
          html: html({ email, url }),
        });
      },
    }),
  ],

  secret: process.env.NEXTAUTH_SECRET,

  session: {
    strategy: 'jwt',
  },
};
