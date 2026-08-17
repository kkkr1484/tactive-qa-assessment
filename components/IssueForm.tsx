'use client';

import { useState } from 'react';

interface Book {
  id: string;
  title: string;
  author: string;
  isbn: string;
  totalCopies: number;
  available: number;
}

interface Member {
  id: string;
  name: string;
  email: string;
  membershipEnd: string;
  maxBooks: number;
  isActive: boolean;
}

interface Props {
  books: Book[];
  members: Member[];
}

interface IssuanceResult {
  message?: string;
  error?: string;
  issuance?: {
    id: string;
    dueDate: string;
    book: { title: string };
    member: { name: string };
  };
}

export default function IssueForm({ books, members }: Props) {
  const [selectedMember, setSelectedMember] = useState('');
  const [selectedBook, setSelectedBook] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<IssuanceResult | null>(null);

  const availableBooks = books.filter((b) => b.available > 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/books/issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId: selectedMember, bookId: selectedBook }),
      });

      const data = await response.json();
      setResult(data);

      if (response.ok) {
        setSelectedMember('');
        setSelectedBook('');
      }
    } catch {
      setResult({ error: 'Network error. Please try again.' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="form-card">
      <h2>Issue a Book to a Member</h2>
      <p className="form-description">
        Select a member and an available book to issue. The loan period is 14 days.
      </p>

      <form onSubmit={handleSubmit} id="issue-form">
        <div className="form-group">
          <label htmlFor="issue-member">Select Member</label>
          <select
            id="issue-member"
            value={selectedMember}
            onChange={(e) => setSelectedMember(e.target.value)}
            required
          >
            <option value="">-- Choose a member --</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.email})
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="issue-book">Select Book</label>
          <select
            id="issue-book"
            value={selectedBook}
            onChange={(e) => setSelectedBook(e.target.value)}
            required
          >
            <option value="">-- Choose a book --</option>
            {availableBooks.map((b) => (
              <option key={b.id} value={b.id}>
                {b.title} by {b.author} ({b.available} available)
              </option>
            ))}
          </select>
          {availableBooks.length === 0 && (
            <p className="field-hint">No books currently available.</p>
          )}
        </div>

        {result && (
          <div
            id="issue-result"
            className={result.error ? 'error-alert' : 'success-alert'}
          >
            {result.error ?? result.message}
            {result.issuance && (
              <div className="result-detail">
                <strong>Book:</strong> {result.issuance.book.title}<br />
                <strong>Member:</strong> {result.issuance.member.name}<br />
                <strong>Due Date:</strong> {new Date(result.issuance.dueDate).toLocaleDateString()}
              </div>
            )}
          </div>
        )}

        <button
          id="issue-submit"
          type="submit"
          className="btn-primary"
          disabled={loading || !selectedMember || !selectedBook}
        >
          {loading ? 'Issuing...' : 'Issue Book'}
        </button>
      </form>
    </div>
  );
}
