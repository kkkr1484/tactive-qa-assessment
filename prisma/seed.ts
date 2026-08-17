import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import * as bcrypt from 'bcryptjs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

const dbUrl = process.env.DATABASE_URL ?? 'file:./library.db';
const dbPath = dbUrl.startsWith('file:')
  ? path.resolve(dbUrl.slice('file:'.length))
  : dbUrl;

const adapter = new PrismaBetterSqlite3({ url: dbPath });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = new (PrismaClient as any)({ adapter });


async function main() {
  console.log('🌱 Seeding database...');

  // Clean up
  await prisma.hold.deleteMany();
  await prisma.issuance.deleteMany();
  await prisma.book.deleteMany();
  await prisma.member.deleteMany();
  await prisma.user.deleteMany();

  // Create librarian user
  const hashedPassword = await bcrypt.hash('librarian123', 10);
  await prisma.user.create({
    data: {
      email: 'admin@library.com',
      password: hashedPassword,
      name: 'Head Librarian',
      role: 'LIBRARIAN',
    },
  });
  console.log('✅ Created librarian: admin@library.com / librarian123');

  // Create members
  const activeExpiry = new Date();
  activeExpiry.setFullYear(activeExpiry.getFullYear() + 1);

  const expiredExpiry = new Date();
  expiredExpiry.setDate(expiredExpiry.getDate() - 30);

  const alice = await prisma.member.create({
    data: {
      name: 'Alice Johnson',
      email: 'alice@example.com',
      phone: '9876543210',
      membershipEnd: activeExpiry,
      maxBooks: 3,
      isActive: true,
    },
  });

  const bob = await prisma.member.create({
    data: {
      name: 'Bob Smith',
      email: 'bob@example.com',
      phone: '9876543211',
      membershipEnd: activeExpiry,
      maxBooks: 3,
      isActive: true,
    },
  });

  // Member who is at their limit (will have 3 books already issued)
  const charlie = await prisma.member.create({
    data: {
      name: 'Charlie Brown',
      email: 'charlie@example.com',
      phone: '9876543212',
      membershipEnd: activeExpiry,
      maxBooks: 3,
      isActive: true,
    },
  });

  // Member with expired membership
  const diana = await prisma.member.create({
    data: {
      name: 'Diana Prince',
      email: 'diana@example.com',
      phone: '9876543213',
      membershipEnd: expiredExpiry,
      maxBooks: 3,
      isActive: true,
    },
  });

  console.log('✅ Created 4 members (alice, bob, charlie, diana)');

  // Create books
  const book1 = await prisma.book.create({
    data: {
      title: 'Clean Code',
      author: 'Robert C. Martin',
      isbn: '978-0132350884',
      totalCopies: 3,
      available: 3,
    },
  });

  const book2 = await prisma.book.create({
    data: {
      title: 'The Pragmatic Programmer',
      author: 'David Thomas',
      isbn: '978-0135957059',
      totalCopies: 2,
      available: 2,
    },
  });

  const book3 = await prisma.book.create({
    data: {
      title: 'Design Patterns',
      author: 'Gang of Four',
      isbn: '978-0201633610',
      totalCopies: 1,
      available: 0, // Already fully issued
    },
  });

  const book4 = await prisma.book.create({
    data: {
      title: 'Introduction to Algorithms',
      author: 'Cormen et al.',
      isbn: '978-0262033848',
      totalCopies: 2,
      available: 2,
    },
  });

  const book5 = await prisma.book.create({
    data: {
      title: 'Structure and Interpretation',
      author: 'Harold Abelson',
      isbn: '978-0262510875',
      totalCopies: 2,
      available: 2,
    },
  });

  console.log('✅ Created 5 books');

  // Issue 3 books to Charlie (at limit)
  const pastDue = new Date();
  pastDue.setDate(pastDue.getDate() - 20); // issued 20 days ago, due in -6 days (overdue)

  const dueDate1 = new Date();
  dueDate1.setDate(dueDate1.getDate() + 14);

  await prisma.issuance.create({
    data: {
      bookId: book1.id,
      memberId: charlie.id,
      dueDate: dueDate1,
      status: 'ACTIVE',
    },
  });
  await prisma.book.update({ where: { id: book1.id }, data: { available: { decrement: 1 } } });

  await prisma.issuance.create({
    data: {
      bookId: book2.id,
      memberId: charlie.id,
      dueDate: dueDate1,
      status: 'ACTIVE',
    },
  });
  await prisma.book.update({ where: { id: book2.id }, data: { available: { decrement: 1 } } });

  await prisma.issuance.create({
    data: {
      bookId: book4.id,
      memberId: charlie.id,
      dueDate: dueDate1,
      status: 'ACTIVE',
    },
  });
  await prisma.book.update({ where: { id: book4.id }, data: { available: { decrement: 1 } } });

  console.log('✅ Issued 3 books to charlie (at limit)');

  // Create an overdue issuance for bob (to test fine calculation)
  const overdueDate = new Date();
  overdueDate.setDate(overdueDate.getDate() - 7); // Due 7 days ago

  const overdueIssuance = await prisma.issuance.create({
    data: {
      bookId: book5.id,
      memberId: bob.id,
      issuedAt: new Date(overdueDate.getTime() - 14 * 24 * 60 * 60 * 1000), // issued 21 days ago
      dueDate: overdueDate, // due 7 days ago → overdue by 7 days
      status: 'OVERDUE',
    },
  });
  await prisma.book.update({ where: { id: book5.id }, data: { available: { decrement: 1 } } });

  console.log('✅ Created overdue issuance for bob (overdue by 7 days → fine should be ₹14)');

  // Issue the only copy of Design Patterns (available = 0 already set)
  await prisma.issuance.create({
    data: {
      bookId: book3.id,
      memberId: alice.id,
      dueDate: dueDate1,
      status: 'ACTIVE',
    },
  });

  console.log('✅ Issued the only copy of Design Patterns to alice (book fully unavailable)');
  console.log('\n📚 Database seeded successfully!');
  console.log('\nTest Accounts:');
  console.log('  Librarian: admin@library.com / librarian123');
  console.log('  Members: alice, bob (active), charlie (at limit), diana (expired membership)');
  console.log('\nTest Books:');
  console.log('  Clean Code (2 available), Pragmatic Programmer (1 available)');
  console.log('  Design Patterns (0 available), Algorithms (1 available)');
  console.log('  SICP (1 available, 1 issued overdue to bob)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
