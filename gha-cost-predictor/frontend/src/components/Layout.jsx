import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Wand2,
  History,
  DollarSign,
  Github,
  Menu,
  X,
  Sun,
  Moon,
  LogIn,
  LogOut,
  User,
} from "lucide-react";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/predict", label: "Predict", icon: Wand2 },
  { to: "/history", label: "History", icon: History },
  { to: "/pricing", label: "Pricing", icon: DollarSign },
];

export default function Layout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { dark, toggle } = useTheme();
  const { user, isAuthenticated, logout } = useAuth();

  function handleLogout() {
    logout();
    navigate("/");
  }

  return (
    <div className="min-h-screen flex flex-col bg-surface-50 dark:bg-surface-900 transition-colors duration-200">
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-surface-800/80 backdrop-blur-md border-b border-surface-200 dark:border-zinc-700/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-3 group">
              <div className="w-9 h-9 rounded-xl bg-brand-500 flex items-center justify-center">
                <Github size={20} className="text-white" />
              </div>
              <div>
                <span className="text-lg font-bold text-zinc-900 dark:text-white tracking-tight">
                  GHA Cost Predictor
                </span>
                <span className="hidden sm:block text-xs text-zinc-400 dark:text-zinc-500 -mt-0.5">
                  Pre-run workflow cost estimation
                </span>
              </div>
            </Link>

            <nav className="hidden md:flex items-center gap-1">
              {navItems.map(({ to, label, icon: Icon }) => {
                const active = location.pathname === to;
                return (
                  <Link
                    key={to}
                    to={to}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors duration-150
                      ${active
                        ? "bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300"
                        : "text-zinc-500 hover:text-zinc-800 hover:bg-surface-100 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-zinc-700/50"
                      }`}
                  >
                    <Icon size={16} />
                    {label}
                  </Link>
                );
              })}
            </nav>

            <div className="flex items-center gap-2">
              <button
                onClick={toggle}
                className="p-2 rounded-xl text-zinc-500 hover:text-zinc-800 hover:bg-surface-100 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-zinc-700/50 transition-colors"
                title={dark ? "Switch to light mode" : "Switch to dark mode"}
              >
                {dark ? <Sun size={18} /> : <Moon size={18} />}
              </button>

              {isAuthenticated ? (
                <div className="flex items-center gap-2">
                  <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-brand-50 dark:bg-brand-900/30 text-sm">
                    <div className="w-6 h-6 rounded-full bg-brand-500 text-white text-xs font-bold flex items-center justify-center">
                      {user.full_name?.charAt(0).toUpperCase() || "U"}
                    </div>
                    <span className="text-zinc-700 dark:text-zinc-300 font-medium truncate max-w-[120px]">
                      {user.full_name}
                    </span>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="p-2 rounded-xl text-zinc-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
                    title="Sign out"
                  >
                    <LogOut size={18} />
                  </button>
                </div>
              ) : (
                <Link
                  to="/login"
                  className="btn-primary text-sm px-4 py-2"
                >
                  <LogIn size={16} />
                  Sign in
                </Link>
              )}

              <button
                className="md:hidden p-2 rounded-xl text-zinc-500 hover:text-zinc-800 hover:bg-surface-100 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-zinc-700/50"
                onClick={() => setMobileOpen(!mobileOpen)}
              >
                {mobileOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            </div>
          </div>
        </div>

        {mobileOpen && (
          <div className="md:hidden border-t border-surface-200 dark:border-zinc-700 bg-white dark:bg-surface-800">
            <nav className="px-4 py-3 space-y-1">
              {navItems.map(({ to, label, icon: Icon }) => {
                const active = location.pathname === to;
                return (
                  <Link
                    key={to}
                    to={to}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors
                      ${active
                        ? "bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300"
                        : "text-zinc-500 hover:text-zinc-800 hover:bg-surface-100 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-zinc-700/50"
                      }`}
                  >
                    <Icon size={18} />
                    {label}
                  </Link>
                );
              })}
              {!isAuthenticated && (
                <Link to="/login" onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-brand-600 dark:text-brand-400">
                  <LogIn size={18} /> Sign in
                </Link>
              )}
            </nav>
          </div>
        )}
      </header>

      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </div>
      </main>

      <footer className="border-t border-surface-200 dark:border-zinc-700/60 py-6 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-400 dark:text-zinc-500">
            <span>GHA Cost Predictor — ML-powered workflow cost estimation</span>
            <div className="flex items-center gap-4">
              <a href="https://docs.github.com/en/billing/reference/actions-runner-pricing"
                target="_blank" rel="noopener noreferrer"
                className="hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors">
                GitHub Pricing
              </a>
              <a href="https://docs.github.com/en/actions"
                target="_blank" rel="noopener noreferrer"
                className="hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors">
                Actions Docs
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
