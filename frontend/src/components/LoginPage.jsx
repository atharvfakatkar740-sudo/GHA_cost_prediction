import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LogIn, Loader2, Mail, Lock } from "lucide-react";
import toast from "react-hot-toast";
import { loginUser } from "../services/api";
import { useAuth } from "../context/AuthContext";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await loginUser(email, password);
      login(data);
      toast.success("Welcome back!");
      navigate("/");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 fade-in">
      <div className="w-full max-w-sm">
        {/* Logo mark */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-gh-teal/15 border border-gh-teal/30 flex items-center justify-center mx-auto mb-4">
            <LogIn size={22} className="text-gh-teal" />
          </div>
          <h1 className="text-xl font-bold text-gh-text">Sign in to GHA Predictor</h1>
          <p className="text-sm text-gh-muted mt-1">Access your predictions and cost analytics</p>
        </div>

        <div className="glow-card-blue">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gh-muted mb-1.5">Email address</label>
              <div className="relative">
                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gh-muted" />
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com" required className="input-field pl-9" />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-gh-muted">Password</label>
                <Link to="/forgot-password" className="text-xs text-gh-blue hover:underline">Forgot password?</Link>
              </div>
              <div className="relative">
                <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gh-muted" />
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="Your password" required minLength={6} className="input-field pl-9" />
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full py-2 mt-1">
              {loading ? <Loader2 size={15} className="animate-spin" /> : <LogIn size={15} />}
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-gh-muted mt-5">
          New to GHA Predictor?{" "}
          <Link to="/register" className="text-gh-blue font-medium hover:underline">Create an account</Link>
        </p>
      </div>
    </div>
  );
}
