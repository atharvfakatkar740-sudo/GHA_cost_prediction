import React, { useState, useRef, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Wand2,
  History,
  DollarSign,
  Github,
  Menu,
  X,
  LogIn,
  LogOut,
  User,
  BarChart2,
  ChevronDown,
  Zap,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

const NAV_MAIN = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/predict", label: "Predict", icon: Wand2 },
  { to: "/history", label: "History", icon: History },
];

const NAV_ACCOUNT = [
  { to: "/analytics", label: "Analytics", icon: BarChart2, authOnly: true },
  { to: "/profile", label: "Profile", icon: User, authOnly: true },
  { to: "/pricing", label: "Pricing", icon: DollarSign },
];

function NavItem({ to, label, icon: Icon, active, onClick }) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className={active ? "nav-item-active" : "nav-item"}
      style={active ? { borderLeftWidth: "2px", paddingLeft: "10px" } : {}}
    >
      <Icon size={16} />
      <span>{label}</span>
    </Link>
  );
}

function UserMenu({ user, onLogout }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const initial = user.full_name?.charAt(0).toUpperCase() || "U";

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-gh-surface2 transition-colors"
      >
        <div className="w-7 h-7 rounded-full bg-gh-teal/20 border border-gh-teal/40 flex items-center justify-center text-gh-teal text-xs font-bold">
          {initial}
        </div>
        <span className="hidden sm:block text-sm text-gh-text font-medium max-w-[110px] truncate">
          {user.full_name}
        </span>
        <ChevronDown size={14} className="text-gh-muted" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-52 bg-gh-surface border border-gh-border rounded-xl shadow-card-hover z-50 overflow-hidden fade-in">
          <div className="px-4 py-3 border-b border-gh-border">
            <div className="text-sm font-semibold text-gh-text truncate">{user.full_name}</div>
            <div className="text-xs text-gh-muted truncate">{user.email}</div>
          </div>
          <div className="py-1">
            <Link
              to="/profile"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-4 py-2 text-sm text-gh-text hover:bg-gh-surface2 transition-colors"
            >
              <User size={14} className="text-gh-muted" /> Profile
            </Link>
            <Link
              to="/analytics"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-4 py-2 text-sm text-gh-text hover:bg-gh-surface2 transition-colors"
            >
              <BarChart2 size={14} className="text-gh-muted" /> Analytics
            </Link>
          </div>
          <div className="border-t border-gh-border py-1">
            <button
              onClick={() => { setOpen(false); onLogout(); }}
              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gh-red hover:bg-gh-red/10 transition-colors"
            >
              <LogOut size={14} /> Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Layout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, isAuthenticated, logout } = useAuth();

  function handleLogout() {
    logout();
    navigate("/");
  }

  const allNavItems = [
    ...NAV_MAIN,
    ...NAV_ACCOUNT.filter(item => !item.authOnly || isAuthenticated),
  ];

  const Sidebar = ({ mobile = false }) => (
    <aside
      className={`
        flex flex-col bg-gh-surface border-r border-gh-border
        ${mobile
          ? "fixed inset-y-0 left-0 z-50 w-64 shadow-card-hover slide-in"
          : "hidden md:flex sticky top-0 h-screen w-56 flex-shrink-0"
        }
      `}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 h-14 border-b border-gh-border flex-shrink-0">
        <div className="w-8 h-8 rounded-lg bg-gh-teal/15 border border-gh-teal/30 flex items-center justify-center">
          <Github size={16} className="text-gh-teal" />
        </div>
        <div>
          <div className="text-sm font-bold text-gh-text leading-tight">GHA Predictor</div>
          <div className="text-[10px] text-gh-muted leading-tight">Cost estimation</div>
        </div>
        {mobile && (
          <button
            className="ml-auto p-1 text-gh-muted hover:text-gh-text"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
        <div className="nav-section-label">Main</div>
        {NAV_MAIN.map(item => (
          <NavItem
            key={item.to}
            {...item}
            active={location.pathname === item.to}
            onClick={() => setSidebarOpen(false)}
          />
        ))}

        {(isAuthenticated || NAV_ACCOUNT.some(i => !i.authOnly)) && (
          <>
            <div className="nav-section-label mt-3">Tools</div>
            {NAV_ACCOUNT.filter(item => !item.authOnly || isAuthenticated).map(item => (
              <NavItem
                key={item.to}
                {...item}
                active={location.pathname === item.to}
                onClick={() => setSidebarOpen(false)}
              />
            ))}
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="border-t border-gh-border px-3 py-3 flex-shrink-0">
        {isAuthenticated ? (
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-gh-teal/20 border border-gh-teal/40 flex items-center justify-center text-gh-teal text-xs font-bold flex-shrink-0">
              {user.full_name?.charAt(0).toUpperCase() || "U"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-gh-text truncate">{user.full_name}</div>
              <div className="text-[10px] text-gh-muted truncate">{user.email}</div>
            </div>
            <button
              onClick={handleLogout}
              title="Sign out"
              className="p-1.5 text-gh-muted hover:text-gh-red transition-colors rounded"
            >
              <LogOut size={14} />
            </button>
          </div>
        ) : (
          <Link to="/login" className="btn-primary w-full text-xs py-1.5">
            <LogIn size={13} /> Sign in
          </Link>
        )}
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen flex bg-gh-canvas">
      {/* Desktop Sidebar */}
      <Sidebar />

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/60 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
          <Sidebar mobile />
        </>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top header */}
        <header className="sticky top-0 z-30 h-14 flex items-center gap-3 px-4 bg-gh-surface/95 backdrop-blur border-b border-gh-border flex-shrink-0">
          <button
            className="md:hidden p-1.5 text-gh-muted hover:text-gh-text rounded-md hover:bg-gh-surface2 transition-colors"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={20} />
          </button>

          {/* Breadcrumb / page title */}
          <div className="flex-1 flex items-center gap-2 min-w-0">
            <span className="text-sm text-gh-muted hidden sm:block">
              {allNavItems.find(n => n.to === location.pathname)?.label ?? "GHA Cost Predictor"}
            </span>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-2">
            <Link
              to="/predict"
              className="btn-primary text-xs px-3 py-1.5 hidden sm:inline-flex"
            >
              <Zap size={13} /> New Prediction
            </Link>

            {isAuthenticated ? (
              <UserMenu user={user} onLogout={handleLogout} />
            ) : (
              <Link to="/login" className="btn-secondary text-xs px-3 py-1.5">
                <LogIn size={13} /> Sign in
              </Link>
            )}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-6 overflow-auto">
          {children}
        </main>

        {/* Footer */}
        <footer className="border-t border-gh-border px-6 py-4 flex-shrink-0">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gh-muted">
            <span>GHA Cost Predictor — ML-powered workflow cost estimation</span>
            <div className="flex items-center gap-4">
              <a href="https://docs.github.com/en/billing/reference/actions-runner-pricing"
                target="_blank" rel="noopener noreferrer"
                className="hover:text-gh-text transition-colors">
                GitHub Pricing
              </a>
              <a href="https://docs.github.com/en/actions"
                target="_blank" rel="noopener noreferrer"
                className="hover:text-gh-text transition-colors">
                Actions Docs
              </a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
