'use client';

import { useState } from 'react';

interface Member {
  id: string;
  name: string;
  email: string;
}

interface ActiveIssuance {
  id: string;
  issuedAt: string;
  dueDate: string;
  status: string;
  book: {
    title: string;
    author: string;
  };
}

interface ReturnResult {
  message?: string;
  error?: string;
  fine?: number;
  fineMessage?: string;
  issuance?: {
    book: { title: string };
    member: { name: string };
    returnedAt: string;
  };
}

interface Props {
  members: Member[];
}

export default function ReturnForm({ members }: Props) {
  const [selectedMember, setSelectedMember] = useState('');
  const [issuances, setIssuances] = useState<ActiveIssuance[]>([]);
  const [selectedIssuance, setSelectedIssuance] = useState('');
  const [loadingIssuances, setLoadingIssuances] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ReturnResult | null>(null);

  async function loadMemberIssuances(memberId: string) {
    if (!memberId) {
      setIssuances([]);
      return;
    }
    setLoadingIssuances(true);
    setSelectedIssuance('');
    setResult(null);

    try {
      const res = await fetch(`/api/members/${memberId}`);
      const data = await res.json();
      const active = (data.issuances ?? []).filter(
        (iss: ActiveIssuance) => iss.status === 'ACTIVE' || iss.status === 'OVERDUE'
      );
      setIssuances(active);
    } catch {
      setIssuances([]);
    } finally {
      setLoadingIssuances(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedIssuance) return;
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/books/return', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issuanceId: selectedIssuance }),
      });

      const data = await response.json();
      setResult(data);

      if (response.ok) {
        setSelectedMember('');
        setSelectedIssuance('');
        setIssuances([]);
      }
    } catch {
      setResult({ error: 'Network error. Please try again.' });
    } finally {
      setLoading(false);
    }
  }

  const selectedIssuanceData = issuances.find((i) => i.id === selectedIssuance);
  const isOverdue =
    selectedIssuanceData && new Date(selectedIssuanceData.dueDate) < new Date();

  return (
    <div className="form-card">
      <h2>Process a Book Return</h2>
      <p className="form-description">
        Select a member to see their currently issued books, then choose the book to return.
        Fines are calculated at ₹2 per day overdue.
      </p>

      <form onSubmit={handleSubmit} id="return-form">
        <div className="form-group">
          <label htmlFor="return-member">Select Member</label>
          <select
            id="return-member"
            value={selectedMember}
            onChange={(e) => {
              setSelectedMember(e.target.value);
              loadMemberIssuances(e.target.value);
            }}
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

        {loadingIssuances && <p className="loading-text">Loading issued books...</p>}

        {selectedMember && !loadingIssuances && (
          <div className="form-group">
            <label htmlFor="return-issuance">Select Book to Return</label>
            <select
              id="return-issuance"
              value={selectedIssuance}
              onChange={(e) => setSelectedIssuance(e.target.value)}
              required
              disabled={issuances.length === 0}
            >
              <option value="">
                {issuances.length === 0
                  ? '-- No books currently issued --'
                  : '-- Choose a book --'}
              </option>
              {issuances.map((iss) => {
                const overdue = new Date(iss.dueDate) < new Date();
                return (
                  <option key={iss.id} value={iss.id}>
                    {iss.book.title} — Due {new Date(iss.dueDate).toLocaleDateString()}
                    {overdue ? ' ⚠️ OVERDUE' : ''}
                  </option>
                );
              })}
            </select>
          </div>
        )}

        {isOverdue && selectedIssuanceData && (
          <div className="warning-alert" id="overdue-warning">
            ⚠️ This book is overdue. A fine of ₹2/day will be calculated on return.
          </div>
        )}

        {result && (
          <div
            id="return-result"
            className={result.error ? 'error-alert' : 'success-alert'}
          >
            {result.error ?? result.message}
            {result.fineMessage && (
              <div className="result-detail">
                <strong>Fine:</strong> {result.fineMessage}
                {result.issuance && (
                  <>
                    <br />
                    <strong>Book:</strong> {result.issuance.book.title}
                    <br />
                    <strong>Returned:</strong>{' '}
                    {new Date(result.issuance.returnedAt).toLocaleDateString()}
                  </>
                )}
              </div>
            )}
          </div>
        )}

        <button
          id="return-submit"
          type="submit"
          className="btn-primary"
          disabled={loading || !selectedIssuance}
        >
          {loading ? 'Processing...' : 'Process Return'}
        </button>
      </form>
    </div>
  );
}
