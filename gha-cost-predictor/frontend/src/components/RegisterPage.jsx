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
    <div className="min-h-[60vh] flex items-center justify-center fade-in">
      <div className="card w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center mx-auto mb-4">
            <UserPlus size={24} className="text-emerald-600 dark:text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Create account</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Save predictions and track costs across projects
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-600 dark:text-zinc-300 mb-1.5">Full name</label>
            <div className="relative">
              <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)}
                placeholder="Jane Doe" required className="input-field pl-10" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-600 dark:text-zinc-300 mb-1.5">Email</label>
            <div className="relative">
              <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com" required className="input-field pl-10" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-600 dark:text-zinc-300 mb-1.5">Password</label>
            <div className="relative">
              <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters" required minLength={6} className="input-field pl-10" />
            </div>
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full py-3 mt-2">
            {loading ? <Loader2 size={18} className="animate-spin" /> : <UserPlus size={18} />}
            {loading ? "Creating..." : "Create account"}
          </button>
        </form>

        <p className="text-center text-sm text-zinc-500 dark:text-zinc-400 mt-6">
          Already have an account?{" "}
          <Link to="/login" className="text-brand-600 dark:text-brand-400 font-medium hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
