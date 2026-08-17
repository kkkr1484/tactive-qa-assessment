import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import DashboardClient from './DashboardClient';

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');

  const [books, members, recentIssuances] = await Promise.all([
    prisma.book.findMany({ orderBy: { title: 'asc' } }),
    prisma.member.findMany({ orderBy: { name: 'asc' } }),
    prisma.issuance.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        book: { select: { title: true } },
        member: { select: { name: true } },
      },
    }),
  ]);

  const stats = {
    totalBooks: books.length,
    booksAvailable: books.reduce((sum, b) => sum + b.available, 0),
    totalMembers: members.length,
    activeIssuances: await prisma.issuance.count({
      where: { status: { in: ['ACTIVE', 'OVERDUE'] } },
    }),
    overdueCount: await prisma.issuance.count({
      where: { status: 'OVERDUE' },
    }),
  };

  return (
    <DashboardClient
      books={books}
      members={members}
      recentIssuances={recentIssuances}
      stats={stats}
      userName={session.user?.name ?? 'Librarian'}
    />
  );
}
