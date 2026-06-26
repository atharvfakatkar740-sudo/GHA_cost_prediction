import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { UserPlus, Loader2, Mail, Lock, User } from "lucide-react";
import toast from "react-hot-toast";
import { registerUser } from "../services/api";
import { useAuth } from "../context/AuthContext";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await registerUser(email, fullName, password);
      login(data);
      toast.success("Account created!");
      navigate("/");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 fade-in">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-gh-green/15 border border-gh-green/30 flex items-center justify-center mx-auto mb-4">
            <UserPlus size={22} className="text-gh-green" />
          </div>
          <h1 className="text-xl font-bold text-gh-text">Create your account</h1>
          <p className="text-sm text-gh-muted mt-1">Track predictions and costs across all your repos</p>
        </div>

        <div className="glow-card-green">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gh-muted mb-1.5">Full name</label>
              <div className="relative">
                <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gh-muted" />
                <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)}
                  placeholder="Jane Doe" required className="input-field pl-9" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gh-muted mb-1.5">Email address</label>
              <div className="relative">
                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gh-muted" />
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com" required className="input-field pl-9" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gh-muted mb-1.5">Password</label>
              <div className="relative">
                <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gh-muted" />
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters" required minLength={6} className="input-field pl-9" />
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full py-2 mt-1">
              {loading ? <Loader2 size={15} className="animate-spin" /> : <UserPlus size={15} />}
              {loading ? "Creating…" : "Create account"}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-gh-muted mt-5">
          Already have an account?{" "}
          <Link to="/login" className="text-gh-blue font-medium hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
