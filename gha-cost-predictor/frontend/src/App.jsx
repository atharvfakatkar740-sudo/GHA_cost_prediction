import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import Layout from "./components/Layout";
import Dashboard from "./components/Dashboard";
import PredictForm from "./components/PredictForm";
import PredictionHistory from "./components/PredictionHistory";
import PricingInfo from "./components/PricingInfo";
import LoginPage from "./components/LoginPage";
import RegisterPage from "./components/RegisterPage";
import ForgotPasswordPage from "./components/ForgotPasswordPage";
import ResetPasswordPage from "./components/ResetPasswordPage";

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <Toaster
            position="top-right"
            toastOptions={{
              className: "!bg-white !text-zinc-800 !border !border-surface-200 dark:!bg-surface-800 dark:!text-zinc-200 dark:!border-zinc-700",
            }}
          />
          <Layout>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/predict" element={<PredictForm />} />
              <Route path="/history" element={<PredictionHistory />} />
              <Route path="/pricing" element={<PricingInfo />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
            </Routes>
          </Layout>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
