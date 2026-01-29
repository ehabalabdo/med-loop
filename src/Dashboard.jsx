import { useEffect, useState } from "react";
import { api } from "./api";

import AdminView from "../views/AdminView";
import ReceptionView from "../views/ReceptionView";
import DoctorView from "../views/DoctorView";
import DentalLabView from "../views/DentalLabView";
import PatientProfileView from "../views/PatientProfileView";

export default function Dashboard() {

  const [user, setUser] = useState(() => {
    // Try to get user from localStorage first
    const stored = localStorage.getItem('user');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return null;
      }
    }
    return null;
  });
  const [loading, setLoading] = useState(!user);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) {
      api.get("/me")
        .then((u) => { setUser(u); setLoading(false); })
        .catch((err) => {
          setError(err.message || "Failed to load user");
          setLoading(false);
          setTimeout(() => { window.location.href = "/login"; }, 1200);
        });
    } else {
      setLoading(false);
    }
  }, []);

  if (loading) return <div>Loading...</div>;
  if (error) return <div style={{color:'red'}}>{error}</div>;
  if (!user) {
    window.location.href = "/login";
    return null;
  }

  // Connection test: show id, role, type
  return (
    <div style={{padding:20}}>
      <div style={{marginBottom:16}}>
        <strong>Connection Test:</strong><br/>
        <span>ID: {user.id || user._id || user.uid || 'N/A'}</span><br/>
        <span>Role: {user.role || 'N/A'}</span><br/>
        <span>Type: {user.type || 'N/A'}</span>
      </div>
      {/* Render the correct view */}
      {(() => {
        switch (user.role) {
          case "admin":
            return <AdminView user={user} />;
          case "receptionist":
            return <ReceptionView user={user} />;
          case "doctor":
            return <DoctorView user={user} />;
          case "lab_doctor":
            return <DentalLabView user={user} />;
          case "patient":
            return <PatientProfileView user={user} />;
          default:
            return <div>Access denied</div>;
        }
      })()}
    </div>
  );
}
