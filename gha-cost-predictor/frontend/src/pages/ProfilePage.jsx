import React, { useState } from "react";
import { User, Mail, Key, Shield, LogOut, Loader2, Check } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);

  function handleLogout() {
    logout();
    navigate("/");
    toast.success("Signed out");
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center h-48 text-gh-muted text-sm">
        Please sign in to view your profile.
      </div>
    );
  }

  const initial = user.full_name?.charAt(0).toUpperCase() || "U";

  return (
    <div className="max-w-2xl mx-auto space-y-6 fade-in">
      {/* Header */}
      <div>
        <h1 className="page-title">Profile</h1>
        <p className="text-sm text-gh-muted mt-1">Manage your account details and preferences.</p>
      </div>

      {/* Avatar + name card */}
      <div className="card flex items-center gap-5">
        <div className="w-16 h-16 rounded-full bg-gh-teal/20 border-2 border-gh-teal/40 flex items-center justify-center text-gh-teal text-2xl font-bold flex-shrink-0">
          {initial}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-base font-semibold text-gh-text">{user.full_name}</div>
          <div className="text-sm text-gh-muted">{user.email}</div>
          <div className="mt-1">
            <span className="badge-teal">Active account</span>
          </div>
        </div>
      </div>

      {/* Account details */}
      <div className="card space-y-4">
        <div className="section-title flex items-center gap-2">
          <User size={15} className="text-gh-muted" /> Account Information
        </div>
        <div className="gh-divider" />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gh-muted mb-1.5">Full name</label>
            <input
              type="text"
              defaultValue={user.full_name}
              className="input-field"
              readOnly
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gh-muted mb-1.5">Email address</label>
            <div className="relative">
              <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gh-muted" />
              <input
                type="email"
                defaultValue={user.email}
                className="input-field pl-9"
                readOnly
              />
            </div>
          </div>
        </div>

        <p className="text-xs text-gh-muted">
          Profile editing is not yet available. Contact support to update your details.
        </p>
      </div>

      {/* Security */}
      <div className="card space-y-4">
        <div className="section-title flex items-center gap-2">
          <Shield size={15} className="text-gh-muted" /> Security
        </div>
        <div className="gh-divider" />

        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-gh-text">Password</div>
            <div className="text-xs text-gh-muted mt-0.5">Change your account password</div>
          </div>
          <button
            onClick={() => navigate("/forgot-password")}
            className="btn-secondary text-xs px-3 py-1.5"
          >
            <Key size={13} /> Change password
          </button>
        </div>
      </div>

      {/* Danger zone */}
      <div className="card border-gh-red/20 space-y-4">
        <div className="section-title flex items-center gap-2 text-gh-red">
          <LogOut size={15} /> Session
        </div>
        <div className="gh-divider" />
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-gh-text">Sign out</div>
            <div className="text-xs text-gh-muted mt-0.5">End your current session</div>
          </div>
          <button onClick={handleLogout} className="btn-danger text-xs px-3 py-1.5">
            <LogOut size={13} /> Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
