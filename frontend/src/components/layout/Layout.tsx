import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Menu, X } from 'lucide-react';

const ZIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="4 4 20 4 8 20 20 20" />
  </svg>
);

import Sidebar, {
  hrNavSections,
  candidateNavSections,
  employeeNavSections,
  managerNavSections,
  adminNavSections
} from './Sidebar';

import TopHeader from './TopHeader';

type Role = 'hr' | 'employee' | 'manager' | 'admin' | 'candidate';

interface LayoutProps {
  role?: Role;
}

const roleConfig: Record<
  Role,
  {
    tokenKey: string;
    emailKey: string;
    nameKey: string;
    defaultEmail: string;
    defaultName: string;
    profilePath: string;
    navSections: typeof hrNavSections;
  }
> = {
  hr: {
    tokenKey: "hr_accessToken",
    emailKey: "hr_userEmail",
    nameKey: "hr_userName",
    defaultEmail: "hr@zenvora.com",
    defaultName: "HR Admin",
    profilePath: "/profile",
    navSections: hrNavSections,
  },
  employee: {
    tokenKey: "accessToken",
    emailKey: "userEmail",
    nameKey: "userName",
    defaultEmail: "employee@zenvora.com",
    defaultName: "Employee",
    profilePath: "/dashboard/profile",
    navSections: employeeNavSections,
  },
  manager: {
    tokenKey: "hr_accessToken", 
    emailKey: "hr_userEmail",
    nameKey: "hr_userName",
    defaultEmail: "manager@zenvora.com",
    defaultName: "Manager",
    profilePath: "/manager/profile",
    navSections: managerNavSections,
  },
  admin: {
    tokenKey: "hr_accessToken",
    emailKey: "hr_userEmail",
    nameKey: "hr_userName",
    defaultEmail: "admin@zenvora.com",
    defaultName: "System Admin",
    profilePath: "/admin/profile",
    navSections: adminNavSections,
  },
  candidate: {
    tokenKey: "candidate_accessToken",
    emailKey: "candidate_userEmail",
    nameKey: "candidate_userName",
    defaultEmail: "candidate@zenvora.com",
    defaultName: "Candidate",
    profilePath: "/candidatedashboard/profile",
    navSections: candidateNavSections,
  },
};

const Layout = ({ role = 'hr' }: LayoutProps) => {
  const config = roleConfig[role];
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem(config.tokenKey));
  const [userEmail, setUserEmail] = useState(localStorage.getItem(config.emailKey) || config.defaultEmail);
  const [userName, setUserName] = useState(localStorage.getItem(config.nameKey) || config.defaultName);
  const [managerName, setManagerName] = useState<string | undefined>(undefined);

  useEffect(() => {
    const handleStorageChange = () => {
      setUserName(localStorage.getItem(config.nameKey) || config.defaultName);
      setUserEmail(localStorage.getItem(config.emailKey) || config.defaultEmail);
      setIsLoggedIn(!!localStorage.getItem(config.tokenKey));
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [config]);

  useEffect(() => {
    if (role !== 'employee') return;
    const token = localStorage.getItem('accessToken');
    if (!token) return;
    fetch('/api/profile/me', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => {
        const name = data?.user?.managerName || data?.user?.manager;
        if (name) setManagerName(name);
      })
      .catch(() => {});
  }, [role]);

  return (
    <div className="app-container">
      {/* Mobile overlay */}
      {isMobileMenuOpen && (
        <div
          className="mobile-overlay active"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`sidebar ${isMobileMenuOpen ? 'open' : ''}`}
        style={{
          width: isSidebarCollapsed ? '72px' : '200px',
          transition: 'width 0.3s ease',
        }}
      >
        <Sidebar
          isCollapsed={isMobileMenuOpen ? false : isSidebarCollapsed}
          setIsCollapsed={setIsSidebarCollapsed}
          userName={userName}
          userEmail={userEmail}
          managerName={role === 'employee' ? managerName : undefined}
          isLoggedIn={isLoggedIn}
          onNavClick={() => setIsMobileMenuOpen(false)}
          navSections={config.navSections}
          profilePath={config.profilePath}
        />
      </div>

      {/* Main content */}
      <div
        className="main-wrapper"
        style={{
          marginLeft: isSidebarCollapsed ? '72px' : '200px',
          transition: 'margin-left 0.3s ease, width 0.3s ease',
          width: isSidebarCollapsed ? 'calc(100% - 72px)' : 'calc(100% - 200px)',
          minWidth: 0,
        }}
      >
        {/* Mobile top bar */}
        <div
          className="mobile-topbar"
          style={{
            display: 'none',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.75rem 1rem',
            background: 'var(--bg-secondary)',
            borderBottom: '1px solid var(--border)',
            position: 'sticky',
            top: 0,
            zIndex: 30,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <img
              src="/zenvora-logo.jpeg"
              alt="Zenvora"
              style={{ width: '1.75rem', height: '1.75rem', borderRadius: '0.375rem', objectFit: 'cover' }}
            />
            <span style={{ fontWeight: 700, fontSize: '0.9rem', letterSpacing: '0.06em', color: 'var(--text-primary)' }}>
              ZENVORA
            </span>
          </div>
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            style={{
              background: 'var(--bg-hover)', border: '1px solid var(--border)',
              borderRadius: '0.5rem', color: 'var(--text-primary)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: '36px', height: '36px',
            }}
          >
            {isMobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>

        <TopHeader
          userName={userName}
          profilePath={config.profilePath}
          navSections={config.navSections}
        />
        <main className="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;
