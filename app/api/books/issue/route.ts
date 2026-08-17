import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import {
  calculateDueDate,
  canBorrowMore,
  isMembershipActive,
} from '@/lib/fine-calculator';

const issueSchema = z.object({
  memberId: z.string().min(1, 'Member ID is required'),
  bookId: z.string().min(1, 'Book ID is required'),
});

export async function POST(request: NextRequest) {
  // Auth guard — only authenticated librarians can issue books
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json(
      { error: 'Unauthorized. Please log in.' },
      { status: 401 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = issueSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { memberId, bookId } = parsed.data;

  // Fetch member and book in parallel
  const [member, book] = await Promise.all([
    prisma.member.findUnique({ where: { id: memberId } }),
    prisma.book.findUnique({ where: { id: bookId } }),
  ]);

  // Validate member exists
  if (!member) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 });
  }

  // Validate member is active
  if (!member.isActive) {
    return NextResponse.json(
      { error: 'Member account is deactivated' },
      { status: 400 }
    );
  }

  // Validate membership is not expired
  if (!isMembershipActive(member.membershipEnd)) {
    return NextResponse.json(
      { error: 'Member membership has expired. Please renew before borrowing.' },
      { status: 400 }
    );
  }

  // Validate book exists
  if (!book) {
    return NextResponse.json({ error: 'Book not found' }, { status: 404 });
  }

  // Validate book is available
  if (book.available <= 0) {
    return NextResponse.json(
      { error: 'No copies available. All copies are currently issued.' },
      { status: 400 }
    );
  }

  // Count active issuances for the member
  const activeIssuances = await prisma.issuance.count({
    where: {
      memberId,
      status: { in: ['ACTIVE', 'OVERDUE'] },
    },
  });

  // Validate member has not exceeded their book limit
  if (!canBorrowMore(activeIssuances, member.maxBooks)) {
    return NextResponse.json(
      {
        error: `Member has reached their maximum book limit of ${member.maxBooks}. Please return a book first.`,
      },
      { status: 400 }
    );
  }

  // Check if member already has this book issued
  const existingIssuance = await prisma.issuance.findFirst({
    where: {
      memberId,
      bookId,
      status: { in: ['ACTIVE', 'OVERDUE'] },
    },
  });

  if (existingIssuance) {
    return NextResponse.json(
      { error: 'Member already has this book issued.' },
      { status: 400 }
    );
  }

  // All validations passed — create issuance and decrement available count atomically
  const [issuance] = await prisma.$transaction([
    prisma.issuance.create({
      data: {
        bookId,
        memberId,
        dueDate: calculateDueDate(),
        status: 'ACTIVE',
      },
      include: {
        book: { select: { title: true, author: true, isbn: true } },
        member: { select: { name: true, email: true } },
      },
    }),
    prisma.book.update({
      where: { id: bookId },
      data: { available: { decrement: 1 } },
    }),
  ]);

  return NextResponse.json(
    {
      message: 'Book issued successfully',
      issuance,
    },
    { status: 201 }
  );
}
