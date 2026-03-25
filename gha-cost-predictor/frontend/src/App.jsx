import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import Layout from "./components/Layout";
import Dashboard from "./components/Dashboard";
import PredictForm from "./components/PredictForm";
import PredictionHistory from "./components/PredictionHistory";
import PricingInfo from "./components/PricingInfo";

function App() {
  return (
    <Router>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: "#161b22",
            color: "#c9d1d9",
            border: "1px solid #30363d",
          },
        }}
      />
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/predict" element={<PredictForm />} />
          <Route path="/history" element={<PredictionHistory />} />
          <Route path="/pricing" element={<PricingInfo />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;
