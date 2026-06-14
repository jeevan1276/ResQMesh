"use client";
import dynamic from "next/dynamic";
import { useState, useEffect } from "react";



const initialMessages = [
  {
    id: "NODE-101",
    severity: "CRITICAL",
    category: "TRAPPED",
    summary: "3 people trapped under debris",
    timestamp: "18:20",
    lat: 17.385,
    lng: 78.4867,
  },
  {
    id: "NODE-202",
    severity: "MEDIUM",
    category: "RESOURCE",
    summary: "Need medicines",
    timestamp: "18:25",
    lat: 17.410,
    lng: 78.49,
  },
  {
    id: "NODE-303",
    severity: "LOW",
    category: "RESOURCE",
    summary: "Need blankets and water",
    timestamp: "18:30",
    lat: 17.36,
    lng: 78.47,
  },
];


const RescueMap = dynamic(
  () => import("./components/Map"),
  {
    ssr: false,
  }
);

export default function Home() {
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [selectedLocation, setSelectedLocation] = useState<any>(null);
  const [rescueLocation, setRescueLocation] = useState<any>(null);


  useEffect(() => {
  navigator.geolocation.watchPosition(
    (position) => {

      console.log(
        position.coords.latitude,
        position.coords.longitude
      );

      setRescueLocation({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      });
    }
  );
}, []);


useEffect(() => {

  const loadIncidents = async () => {

    const response = await fetch(
      "http://127.0.0.1:8000/incidents"
    );

    const data = await response.json();

    const formattedData = data.map(
      (incident: any) => ({
        id: incident._id,
        severity: incident.severity,
        category: incident.category,
        summary: incident.summary,
        timestamp: incident.timestamp,
        lat: incident.latitude,
        lng: incident.longitude,
      })
    );

    setMessages(formattedData);
  };

  loadIncidents();

}, []);


  
const criticalCount = messages.filter(
  (m) => m.severity === "CRITICAL"
).length;

const highCount = messages.filter(
  (m) => m.severity === "HIGH"
).length;

const mediumCount = messages.filter(
  (m) => m.severity === "MEDIUM"
).length;

const lowCount = messages.filter(
  (m) => m.severity === "LOW"
).length;

const classifyIncident = async () => {
  try {
    const response = await fetch(
      "http://127.0.0.1:8000/classify",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: newMessage,
          latitude: 17.385 + Math.random() * 0.01,
          longitude: 78.4867 + Math.random() * 0.01,
          device_id: `NODE-${Date.now()}`,
          timestamp: new Date().toISOString(),
        }),
      }
    );

    const data = await response.json();

    const newIncident = {
      id: data.device_id,
      severity: data.severity,
      category: data.category,
      summary: data.summary,
      timestamp: data.timestamp,
      lat: data.latitude,
      lng: data.longitude,
    };

    console.log(newIncident);

    setMessages((prev) => [newIncident, ...prev]);

    setNewMessage("");
      } catch (error) {
        console.error(error);
      }
};


const syncMeshQueue = async () => {

  const response = await fetch(
    "http://127.0.0.1:8000/bulk-classify",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [
          {
            message: "5 people trapped under debris",
            latitude: 17.385,
            longitude: 78.486,
            device_id: "NODE_001",
            timestamp: new Date().toISOString(),
          },
          {
            message: "Need urgent medicines",
            latitude: 17.392,
            longitude: 78.490,
            device_id: "NODE_002",
            timestamp: new Date().toISOString(),
          },
          {
            message: "Family stranded without food",
            latitude: 17.398,
            longitude: 78.495,
            device_id: "NODE_003",
            timestamp: new Date().toISOString(),
          }
        ]
      }),
    }
  );

  const data = await response.json();

  console.log(data);
};
console.log(rescueLocation);

const resolveIncident = async (
  incidentId: string
) => {

  const confirmed = window.confirm(
    "Are you sure you want to resolve this incident?"
  );

  if (!confirmed) return;

  await fetch(
    `http://127.0.0.1:8000/incident/${incidentId}/resolve`,
    {
      method: "PATCH",
    }
  );

  setMessages((prev) =>
    prev.filter(
      (msg) => msg.id !== incidentId
    )
  );
};
  return (
    <main className="min-h-screen bg-slate-100 p-6 text-slate-900">
      <h1 className="text-4xl font-bold mb-6">
        RESQMESH DISASTER RESPONSE DASHBOARD
      </h1>

      <div className="bg-white rounded-xl p-4 shadow mb-6">
  <h2 className="text-xl font-semibold mb-3">
    Create Emergency Report
  </h2>

  <textarea
    value={newMessage}
    onChange={(e) => setNewMessage(e.target.value)}
    placeholder="Describe the emergency..."
    className="w-full border rounded p-3"
    rows={4}
  />

  <button
  onClick={classifyIncident}
  className="mt-3 bg-blue-600 text-white px-4 py-2 rounded"
>
    Classify Incident
  </button>


  <button
  onClick={syncMeshQueue}
  className="bg-green-600 text-white px-4 py-2 rounded ml-2"
>
  Sync Mesh Queue
</button>


</div>

        <div className="grid grid-cols-5 gap-4 mb-6">

        <div className="bg-red-100 rounded-xl p-4 shadow">
          <div className="text-3xl font-bold">
            {criticalCount}
          </div>
          <div>🔴 Critical</div>
        </div>

        <div className="bg-orange-100 rounded-xl p-4 shadow">
        <div className="text-3xl font-bold">
          {highCount}
        </div>
        <div>🟠 High</div>
      </div>

        <div className="bg-yellow-100 rounded-xl p-4 shadow">
          <div className="text-3xl font-bold">
            {mediumCount}
          </div>
          <div>🟡 Medium</div>
        </div>

        <div className="bg-green-100 rounded-xl p-4 shadow">
          <div className="text-3xl font-bold">
            {lowCount}
          </div>
          <div>🟢 Low</div>
        </div>

        <div className="bg-blue-100 rounded-xl p-4 shadow">
          <div className="text-3xl font-bold">
            {messages.length}
          </div>
          <div>📍 Total Incidents</div>
        </div>

  </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-4 shadow">
          <h2 className="text-2xl font-semibold mb-4">
            Emergency Reports
          </h2>

          <div className="space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                onClick={() => setSelectedLocation(msg)}
                className={`rounded-lg p-4 border-l-4 ${
                  msg.severity === "CRITICAL"
                    ? "bg-red-50 border-red-500"
                    : msg.severity === "MEDIUM"
                    ? "bg-yellow-50 border-yellow-500"
                    : "bg-green-50 border-green-500"
                }`}
              >
                <div className="font-bold">
                  {msg.severity} • {msg.category}
                </div>

                <div className="mt-2">
                  {msg.summary}
                </div>

                <div className="mt-2 text-sm text-gray-500">
                  {msg.id} • {msg.timestamp}
                </div>
                <button
                    onClick={(e) => {
                      e.stopPropagation();
                      resolveIncident(msg.id);
                    }}
                    className="mt-2 bg-green-600 text-white px-3 py-1 rounded"
                  >
                    Resolve
                  </button>
              </div>
            ))}
          </div>
        </div>

        <div className="col-span-2 bg-white rounded-xl p-4 shadow">
          <h2 className="text-2xl font-semibold mb-4">
            Rescue Map
          </h2>

          {selectedLocation && (
            <div className="mb-4 p-2 bg-blue-100 rounded">
              Selected: {selectedLocation.id}
            </div>
          )}

          <div className="h-[600px] rounded overflow-hidden">
          <div className="h-[600px] rounded overflow-hidden">
          
            <RescueMap
              locations={messages}
              selectedLocation={selectedLocation}
              rescueLocation={rescueLocation}
            />
          
        </div>
</div>
        </div>
      </div>
    </main>
  );
}