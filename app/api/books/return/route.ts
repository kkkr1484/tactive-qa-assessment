import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { calculateFine } from '@/lib/fine-calculator';

const returnSchema = z.object({
  issuanceId: z.string().min(1, 'Issuance ID is required'),
});

export async function POST(request: NextRequest) {
  // Auth guard
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

  const parsed = returnSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { issuanceId } = parsed.data;

  // Fetch the issuance
  const issuance = await prisma.issuance.findUnique({
    where: { id: issuanceId },
    include: {
      book: { select: { id: true, title: true, author: true, isbn: true } },
      member: { select: { id: true, name: true, email: true } },
    },
  });

  if (!issuance) {
    return NextResponse.json({ error: 'Issuance not found' }, { status: 404 });
  }

  // Validate issuance is not already returned
  if (issuance.status === 'RETURNED') {
    return NextResponse.json(
      { error: 'This book has already been returned.' },
      { status: 400 }
    );
  }

  // Calculate fine
  const returnDate = new Date();
  const fine = calculateFine(issuance.dueDate, returnDate);

  // Atomically update issuance and increment book availability
  const [updatedIssuance] = await prisma.$transaction([
    prisma.issuance.update({
      where: { id: issuanceId },
      data: {
        status: 'RETURNED',
        returnedAt: returnDate,
        fine,
      },
      include: {
        book: { select: { title: true, author: true, isbn: true } },
        member: { select: { name: true, email: true } },
      },
    }),
    prisma.book.update({
      where: { id: issuance.bookId },
      data: { available: { increment: 1 } },
    }),
  ]);

  return NextResponse.json({
    message: 'Book returned successfully',
    issuance: updatedIssuance,
    fine,
    fineMessage:
      fine > 0
        ? `A fine of ₹${fine} has been applied for ${Math.round(fine / 2)} days overdue.`
        : 'No fine — returned on time.',
  });
}
