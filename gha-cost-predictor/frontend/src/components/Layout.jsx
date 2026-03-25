import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Wand2,
  History,
  DollarSign,
  Github,
  Menu,
  X,
} from "lucide-react";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/predict", label: "Predict", icon: Wand2 },
  { to: "/history", label: "History", icon: History },
  { to: "/pricing", label: "Pricing", icon: DollarSign },
];

export default function Layout({ children }) {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col">
      {/* ── Top Navigation ──────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-github-gray/80 backdrop-blur-md border-b border-github-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-3 group">
              <div className="w-9 h-9 rounded-lg bg-brand-600 flex items-center justify-center group-hover:bg-brand-500 transition-colors">
                <Github size={20} className="text-white" />
              </div>
              <div>
                <span className="text-lg font-bold text-white tracking-tight">
                  GHA Cost Predictor
                </span>
                <span className="hidden sm:block text-xs text-gray-500 -mt-0.5">
                  Pre-run workflow cost estimation
                </span>
              </div>
            </Link>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map(({ to, label, icon: Icon }) => {
                const active = location.pathname === to;
                return (
                  <Link
                    key={to}
                    to={to}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150
                      ${
                        active
                          ? "bg-brand-600/15 text-brand-400"
                          : "text-gray-400 hover:text-white hover:bg-white/5"
                      }`}
                  >
                    <Icon size={16} />
                    {label}
                  </Link>
                );
              })}
            </nav>

            {/* Mobile menu button */}
            <button
              className="md:hidden p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile Nav */}
        {mobileOpen && (
          <div className="md:hidden border-t border-github-border bg-github-gray">
            <nav className="px-4 py-3 space-y-1">
              {navItems.map(({ to, label, icon: Icon }) => {
                const active = location.pathname === to;
                return (
                  <Link
                    key={to}
                    to={to}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                      ${
                        active
                          ? "bg-brand-600/15 text-brand-400"
                          : "text-gray-400 hover:text-white hover:bg-white/5"
                      }`}
                  >
                    <Icon size={18} />
                    {label}
                  </Link>
                );
              })}
            </nav>
          </div>
        )}
      </header>

      {/* ── Main Content ────────────────────────────────────────── */}
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </div>
      </main>

      {/* ── Footer ──────────────────────────────────────────────── */}
      <footer className="border-t border-github-border py-6 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-500">
            <span>GHA Cost Predictor — ML-powered workflow cost estimation</span>
            <div className="flex items-center gap-4">
              <a
                href="https://docs.github.com/en/billing/reference/actions-runner-pricing"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-gray-300 transition-colors"
              >
                GitHub Pricing
              </a>
              <a
                href="https://docs.github.com/en/actions"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-gray-300 transition-colors"
              >
                Actions Docs
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
