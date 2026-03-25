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
    <div className="min-h-[60vh] flex items-center justify-center fade-in">
      <div className="card w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-brand-100 dark:bg-brand-900/40 flex items-center justify-center mx-auto mb-4">
            <LogIn size={24} className="text-brand-600 dark:text-brand-400" />
          </div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Sign in</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Access your prediction history and account
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-600 dark:text-zinc-300 mb-1.5">Email</label>
            <div className="relative">
              <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com" required className="input-field pl-10" />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium text-zinc-600 dark:text-zinc-300">Password</label>
              <Link to="/forgot-password" className="text-xs text-brand-600 dark:text-brand-400 hover:underline">
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="Your password" required minLength={6} className="input-field pl-10" />
            </div>
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full py-3 mt-2">
            {loading ? <Loader2 size={18} className="animate-spin" /> : <LogIn size={18} />}
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <p className="text-center text-sm text-zinc-500 dark:text-zinc-400 mt-6">
          Don't have an account?{" "}
          <Link to="/register" className="text-brand-600 dark:text-brand-400 font-medium hover:underline">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
