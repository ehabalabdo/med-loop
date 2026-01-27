
import { useState } from "react";
import { api } from "../api";

export default function AddPatient({ onPatientAdded }) {
  const [form, setForm] = useState({
    name: "",
    phone: "",
    notes: ""
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = e => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api.post("/patients", form);
      alert("Patient added successfully");
      setForm({ name: "", phone: "", notes: "" });
      if (onPatientAdded) onPatientAdded(); // trigger parent to re-fetch
    } catch (err) {
      setError(err.message || "Failed to add patient");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>Add Patient</h2>
      <form onSubmit={handleSubmit}>
        <input name="name" placeholder="Name" value={form.name} onChange={handleChange} required />
        <br />
        <input name="phone" placeholder="Phone" value={form.phone} onChange={handleChange} required />
        <br />
        <textarea name="notes" placeholder="Notes" value={form.notes} onChange={handleChange} />
        <br />
        <button type="submit" disabled={loading}>Add Patient</button>
        {error && <div style={{color:'red'}}>{error}</div>}
      </form>
    </div>
  );
}
