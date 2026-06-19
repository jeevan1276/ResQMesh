# ResQMesh (DisasterMesh) — Offline Disaster Response Mesh Network

ResQMesh is a robust, off-grid peer-to-peer messaging and triage system built for first responders and survivors during disasters. It operates under a hard, honest assumption: **the internet is completely gone, and we must communicate and triage local data without it.**

By combining a low-overhead Bluetooth Low Energy (BLE) flood-fill mesh network with localized AI classification gates, ResQMesh enables offline messaging, automated emergency triage, and centralized incident monitoring.

---

## 🚀 Project Status

*   **Phase 1: TCP/IP Network Simulator** — **COMPLETE ✅**
    *   Simulates multi-node mesh propagation, gossip sync, and deduplication using TCP/IP sockets.
*   **Phase 2: Mobile BLE Mesh Application** — **COMPLETE ✅**
    *   Full React Native & Expo mobile application implementing real BLE scanning, advertising, packet encoding, and relay.
    *   Pre-compiled stable Android package available: [app-stable.apk](file:///d:/Github/ResQMesh/app-stable.apk).
*   **Phase 3: AI-Powered Triage, MongoDB, & Unified Dashboard** — **COMPLETE ✅**
    *   **FastAPI AI Backend**: Classifies offline messages using `gemini-2.5-flash` for severity, category, and summaries.
    *   **Next.js Dispatcher Dashboard**: Features an interactive Leaflet map, emergency priority statistics, and incident resolution management.
    *   **Gateway Mock Server**: Bridges local network packets to HTTP API servers with automated duplicate checking and asynchronous AI dispatch.

---

## 📐 System Architecture

```
                                  [OFF-GRID MESH ZONE]
 ┌─────────────────┐             ┌─────────────────┐             ┌─────────────────┐
 │   Mobile Node   │   (BLE)     │   Mobile Node   │   (BLE)     │   Mobile Node   │
 │   (Node 12345)  │ <---------> │   (Node 54321)  │ <---------> │   (Node 99999)  │
 └────────┬────────┘             └────────┬────────┘             └────────┬────────┘
          │                               │                               │
          │ (TCP Sim)                     │ (TCP Sim)                     │ (TCP Sim)
          ▼                               ▼                               ▼
 ┌─────────────────────────────────────────────────────────────────────────────────┐
 │                            TCP Simulation Network                               │
 └────────────────────────┬────────────────────────────────────────────────────────┘
                          │
                          │ (Sync / API Post)
                          ▼
 ┌─────────────────────────────────────────────────────────────────────────────────┐
 │                   Gateway Mock Server / Node (Port 3000)                        │
 ├─────────────────────────────────────────────────────────────────────────────────┤
 │  • Receives local mesh packets                                                  │
 │  • Serves local Gateway Dashboard for active nodes & logs                       │
 │  • Dedups messages & forwards asynchronously to AI Triage Service               │
 └────────────────────────┬────────────────────────────────────────────────────────┘
                          │
                          │ (HTTP POST /classify)
                          ▼
 ┌─────────────────────────────────────────────────────────────────────────────────┐
 │                      FastAPI AI Triage Service (Port 8000)                       │
 ├─────────────────────────────────────────────────────────────────────────────────┤
 │  • Processes raw distress payloads using Gemini 2.5 Flash                       │
 │  • Triages messages into structured JSON (Severity, Category, Summary)          │
 │  • Stores active and resolved incidents directly in MongoDB database            │
 └────────────────────────┬───────────────────────┬────────────────────────────────┘
                          │                       │
                (Write)   │                       │ (Read / Resolve)
                          ▼                       ▼
               ┌─────────────────────┐ ┌───────────────────────────────────┐
               │  MongoDB Database   │ │     Next.js Dispatcher App        │
               │ (Incidents/Status)  │ │          (Port 3000)              │
               └─────────────────────┘ ├───────────────────────────────────┤
                                       │ • Leaflet-based Live Incident Map │
                                       │ • Real-time priority counters     │
                                       │ • Incident Triage Command Center  │
                                       └───────────────────────────────────┘
```

---

## 📁 Repository Directory Layout

*   [react-native-app/](file:///d:/Github/ResQMesh/react-native-app) — Mobile BLE mesh application.
    *   [App.tsx](file:///d:/Github/ResQMesh/react-native-app/App.tsx) — User interface displaying messaging history and controls.
    *   [MeshBleManager.ts](file:///d:/Github/ResQMesh/react-native-app/MeshBleManager.ts) — Core BLE peripheral and central advertiser/scanner.
    *   [packet.ts](file:///d:/Github/ResQMesh/react-native-app/packet.ts) — TypeScript port of the 20-byte MTU packet codec.
    *   [UrgencyClassifier.ts](file:///d:/Github/ResQMesh/react-native-app/UrgencyClassifier.ts) — Node-level keyword-based urgency gate.
*   [simulator/](file:///d:/Github/ResQMesh/simulator) — Python mesh simulator & gateway.
    *   [mock_server.py](file:///d:/Github/ResQMesh/simulator/mock_server.py) — Gateway Mock Server and dashboard (Port 3000).
    *   [node.py](file:///d:/Github/ResQMesh/simulator/node.py) — Simulated TCP socket node containing flood-fill & deduplication logic.
    *   [packet.py](file:///d:/Github/ResQMesh/simulator/packet.py) — Binary packet structures (20 bytes).
    *   [sim_network.py](file:///d:/Github/ResQMesh/simulator/sim_network.py) — Runs a 4-node simulated network linear chain.
*   [resqmesh-ai/](file:///d:/Github/ResQMesh/resqmesh-ai) — Intelligent triage & monitoring backend.
    *   [resqmesh-ai/app.py](file:///d:/Github/ResQMesh/resqmesh-ai/resqmesh-ai/app.py) — FastAPI service interfacing MongoDB and classifying incidents.
    *   [resqmesh-ai/classifier.py](file:///d:/Github/ResQMesh/resqmesh-ai/resqmesh-ai/classifier.py) — Gemini LLM connector for automated structured triage.
    *   [resqmesh-dashboard/](file:///d:/Github/ResQMesh/resqmesh-ai/resqmesh-dashboard/resqmesh-dashboard) — Next.js dispatcher dashboard.
*   [ARCHITECTURE.md](file:///d:/Github/ResQMesh/ARCHITECTURE.md) — Comprehensive technical design comparison.
*   [app-stable.apk](file:///d:/Github/ResQMesh/app-stable.apk) — Compiled stable Android APK ready for physical device testing.

---

## 🛠️ Getting Started & Launch Guide

Follow these steps to spin up the entire end-to-end ResQMesh system.

### Step 1: Configure Environment Variables
Create or verify the `.env` file at the root of the AI service `resqmesh-ai/resqmesh-ai/.env`:
```env
GEMINI_API_KEY=YOUR_GEMINI_API_KEY
MONGODB_URI=YOUR_MONGODB_URI
```

---

### Step 2: Launch the AI Triage Backend
Navigate to the AI subdirectory, install dependencies, and run the FastAPI server:
```bash
cd resqmesh-ai/resqmesh-ai
pip install -r requirements.txt
python app.py
```
*   **Running API Endpoint**: `http://127.0.0.1:8000`
*   **Documentation Docs**: `http://127.0.0.1:8000/docs`

---

### Step 3: Launch the Next.js Dispatcher Dashboard
Navigate to the Next.js app directory, install dependencies, and start the development server:
```bash
cd resqmesh-ai/resqmesh-dashboard/resqmesh-dashboard
npm install
npm run dev
```
*   **Local Web Access**: Open [http://localhost:3000](http://localhost:3000) in your browser.
*   **Features**: Displays active emergencies on the Leaflet map, logs priority counts, and provides a "Resolve" button that patches the API state.

---

### Step 4: Launch the Gateway Mock Server
The gateway server acts as a bridge between the simulator/mesh and the AI/MongoDB pipeline. It also displays a local Web Console:
```bash
cd simulator
pip install -r requirements.txt
python mock_server.py
```
*   **Web Dashboard**: Open [http://localhost:3000/](http://localhost:3000/) in your browser.
*   **API Route**: `http://localhost:3000/api/messages` for incoming mesh uploads.

---

### Step 5: Run the Simulation Network
With the Gateway and AI Backend running, start the multi-node TCP simulation:
```bash
cd simulator
python sim_network.py
```
This script launches a 4-node simulated network, sends distress, status, and resource request payloads, and outputs final propagation statistics (expecting 100% propagation with automatic deduplication).

---

### Step 6: Launch the React Native Mobile App
To demo mesh message passing on physical devices:
1.  Navigate to the React Native folder:
    ```bash
    cd react-native-app
    npm install
    npm start
    ```
2.  Install **Expo Go** on up to 3 Android/iOS devices.
3.  Ensure all devices are on the same local WiFi network.
4.  Scan the QR code printed in your console to load the application.
5.  Press **Start Scanning** and **Start Advertising** on all devices to establish the mesh. Send messages or run the built-in **Demo Replay** to watch messages sync.

---

## 🖨️ Binary Packet Schema

To fit within a single 20-byte BLE advertisement MTU, ResQMesh encodes message packets into a compact binary schema:

```
 0               1               2               3
 0 1 2 3 4 5 6 7 0 1 2 3 4 5 6 7 0 1 2 3 4 5 6 7 0 1 2 3 4 5 6 7
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|          Message ID           |           Origin ID           |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|   Msg Type    |   Hop Count   |           Timestamp           |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|   Timestamp   | Urg |                 Payload                 |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|                            Payload                            |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|            Payload            |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
```

| Field Name | Type | Size | Description |
| :--- | :--- | :--- | :--- |
| **`msg_id`** | `uint16` | 2 bytes | Unique message identifier used for deduplication keys. |
| **`origin_id`** | `uint16` | 2 bytes | Identifier of the originating mesh node (0-65535). |
| **`msg_type`** | `uint8` | 1 byte | Category: `0`=DISTRESS, `1`=STATUS, `2`=RESOURCE, `3`=GPS. |
| **`hop_count`** | `uint8` | 1 byte | Increments per relay. Packets are dropped after `5` hops. |
| **`timestamp`** | `uint32` | 4 bytes | Unix epoch seconds. |
| **`urgent`** | `uint1` (bit) | 1 bit | Set locally by Node-level classifier (`1`=Urgent, `0`=Routine). |
| **`payload`** | `char[10]` | 10 bytes | Compressed textual message payload (padded with nulls). |

**Total Size**: 20 Bytes minimum.

---

## 🧪 Testing and Verification

*   **Offline Verification**: Disable internet access on simulator terminals and observe packet propagation logs.
*   **LLM Integrity**: Hit `/classify` or `/bulk-classify` via FastAPI Swagger UI or Postman to ensure Gemini structures outputs cleanly.
*   **Resolution Cycle**: Mark incidents resolved on the Next.js Dashboard and inspect changes inside MongoDB Compass or Atlas.
