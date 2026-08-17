'use client';

import { useState } from 'react';
import { signOut } from 'next-auth/react';
import IssueForm from '@/components/IssueForm';
import ReturnForm from '@/components/ReturnForm';

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

interface Issuance {
  id: string;
  issuedAt: string;
  dueDate: string;
  returnedAt: string | null;
  fine: number | null;
  status: string;
  book: { title: string };
  member: { name: string };
}

interface Stats {
  totalBooks: number;
  booksAvailable: number;
  totalMembers: number;
  activeIssuances: number;
  overdueCount: number;
}

interface Props {
  books: Book[];
  members: Member[];
  recentIssuances: Issuance[];
  stats: Stats;
  userName: string;
}

export default function DashboardClient({ books, members, recentIssuances, stats, userName }: Props) {
  const [activeTab, setActiveTab] = useState<'overview' | 'issue' | 'return' | 'books' | 'members'>('overview');

  return (
    <div className="app">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <span className="logo-icon">📚</span>
          <span className="logo-text">LibraryOS</span>
        </div>

        <nav className="sidebar-nav">
          {[
            { key: 'overview', icon: '📊', label: 'Overview' },
            { key: 'issue', icon: '📤', label: 'Issue Book' },
            { key: 'return', icon: '📥', label: 'Return Book' },
            { key: 'books', icon: '📖', label: 'Books' },
            { key: 'members', icon: '👥', label: 'Members' },
          ].map(({ key, icon, label }) => (
            <button
              key={key}
              id={`nav-${key}`}
              className={`nav-item ${activeTab === key ? 'active' : ''}`}
              onClick={() => setActiveTab(key as typeof activeTab)}
            >
              <span>{icon}</span>
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-info">
            <span className="user-avatar">👤</span>
            <div>
              <div className="user-name">{userName}</div>
              <div className="user-role">Librarian</div>
            </div>
          </div>
          <button id="logout-btn" className="logout-btn" onClick={() => signOut({ callbackUrl: '/login' })}>
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        {/* Header */}
        <header className="page-header">
          <h1 className="page-title">
            {activeTab === 'overview' && 'Dashboard Overview'}
            {activeTab === 'issue' && 'Issue a Book'}
            {activeTab === 'return' && 'Return a Book'}
            {activeTab === 'books' && 'Book Catalog'}
            {activeTab === 'members' && 'Members'}
          </h1>
        </header>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="tab-content">
            <div className="stats-grid">
              <div className="stat-card" id="stat-total-books">
                <div className="stat-icon">📚</div>
                <div className="stat-value">{stats.totalBooks}</div>
                <div className="stat-label">Total Books</div>
              </div>
              <div className="stat-card" id="stat-available">
                <div className="stat-icon">✅</div>
                <div className="stat-value">{stats.booksAvailable}</div>
                <div className="stat-label">Available Copies</div>
              </div>
              <div className="stat-card" id="stat-members">
                <div className="stat-icon">👥</div>
                <div className="stat-value">{stats.totalMembers}</div>
                <div className="stat-label">Total Members</div>
              </div>
              <div className="stat-card" id="stat-active-issuances">
                <div className="stat-icon">📤</div>
                <div className="stat-value">{stats.activeIssuances}</div>
                <div className="stat-label">Active Issuances</div>
              </div>
              {stats.overdueCount > 0 && (
                <div className="stat-card overdue" id="stat-overdue">
                  <div className="stat-icon">⚠️</div>
                  <div className="stat-value">{stats.overdueCount}</div>
                  <div className="stat-label">Overdue Books</div>
                </div>
              )}
            </div>

            <div className="recent-section">
              <h2>Recent Activity</h2>
              <div className="issuance-table-wrap">
                <table className="issuance-table" id="recent-issuances-table">
                  <thead>
                    <tr>
                      <th>Book</th>
                      <th>Member</th>
                      <th>Issued</th>
                      <th>Due</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentIssuances.map((iss) => (
                      <tr key={iss.id}>
                        <td>{iss.book.title}</td>
                        <td>{iss.member.name}</td>
                        <td>{new Date(iss.issuedAt).toLocaleDateString()}</td>
                        <td>{new Date(iss.dueDate).toLocaleDateString()}</td>
                        <td>
                          <span className={`badge badge-${iss.status.toLowerCase()}`}>
                            {iss.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Issue Tab */}
        {activeTab === 'issue' && (
          <div className="tab-content">
            <IssueForm books={books} members={members} />
          </div>
        )}

        {/* Return Tab */}
        {activeTab === 'return' && (
          <div className="tab-content">
            <ReturnForm members={members} />
          </div>
        )}

        {/* Books Tab */}
        {activeTab === 'books' && (
          <div className="tab-content">
            <div className="issuance-table-wrap">
              <table className="issuance-table" id="books-table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Author</th>
                    <th>ISBN</th>
                    <th>Total</th>
                    <th>Available</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {books.map((book) => (
                    <tr key={book.id} id={`book-row-${book.id}`}>
                      <td>{book.title}</td>
                      <td>{book.author}</td>
                      <td><code>{book.isbn}</code></td>
                      <td>{book.totalCopies}</td>
                      <td>{book.available}</td>
                      <td>
                        <span className={`badge ${book.available > 0 ? 'badge-active' : 'badge-overdue'}`}>
                          {book.available > 0 ? 'Available' : 'Unavailable'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Members Tab */}
        {activeTab === 'members' && (
          <div className="tab-content">
            <div className="issuance-table-wrap">
              <table className="issuance-table" id="members-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Membership Expiry</th>
                    <th>Max Books</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((member) => {
                    const expired = new Date(member.membershipEnd) < new Date();
                    return (
                      <tr key={member.id} id={`member-row-${member.id}`}>
                        <td>{member.name}</td>
                        <td>{member.email}</td>
                        <td>{new Date(member.membershipEnd).toLocaleDateString()}</td>
                        <td>{member.maxBooks}</td>
                        <td>
                          <span className={`badge ${!member.isActive || expired ? 'badge-overdue' : 'badge-active'}`}>
                            {!member.isActive ? 'Inactive' : expired ? 'Expired' : 'Active'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
