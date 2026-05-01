"use client";
import { useState, useEffect } from "react";

export default function Home() {
  const [athletes, setAthletes] = useState([]);

  useEffect(() => {
    fetch("http://127.0.0.1:8000/api/athletes")
      .then(res => res.json())
      .then(data => setAthletes(data))
      .catch(() => console.log("Backend not started yet"));
  }, []);

  return (
    <main className="min-h-screen bg-black text-white p-10 flex flex-col items-center">
      <h1 className="text-6xl font-black italic uppercase tracking-tighter">ucanjuschill</h1>
      <div className="mt-10 w-full max-w-2xl">
        {athletes.length === 0 ? (
          <p className="text-gray-500 text-center">No athletes found. Start Backend to sync.</p>
        ) : (
          athletes.map(a => (
            <div key={a.id} className="p-4 border border-blue-900 mb-4 rounded flex justify-between items-center">
              <span>{a.name}</span>
              <span className={a.is_verified ? "text-green-400" : "text-gray-600"}>
                {a.is_verified ? "VERIFIED" : "PENDING"}
              </span>
            </div>
          ))
        )}
      </div>
    </main>
  );
}
