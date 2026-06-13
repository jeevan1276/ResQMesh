# ResQMesh Task Checklist

This document outlines the development tasks for each team member, based on the project's technical design.

---

### Person 1: BLE Mesh & Transport Layer (Python)

*   [ ] **Environment Setup:**
    *   [ ] Set up a Python environment.
    *   [ ] Install `bleak` and any other necessary BLE libraries.
*   [ ] **Core BLE Communication:**
    *   [ ] Implement a function to broadcast (advertise) messages in the correct packet format.
    *   [ ] Implement a function to scan for and receive messages from other nodes.
    *   [ ] Implement the `hop_count` logic to prevent infinite relays.
*   [ ] **Message Logic:**
    *   [ ] Implement the `sendMessage` function to create and broadcast a new message.
    *   [ ] Implement the `onReceive` function to handle incoming messages.
    *   [ ] Add deduplication logic using a `seen` cache to avoid processing the same message twice.
*   [ ] **Gossip Sync Protocol:**
    *   [ ] Implement the `onPeerConnect` function.
    *   [ ] Create a Bloom filter of known message IDs.
    *   [ ] Add logic to exchange Bloom filters with a new peer and request missing messages.
*   [ ] **Interface:**
    *   [ ] Create a shared `asyncio.Queue`.
    *   [ ] Place newly received and decoded messages onto the queue for Person 2.

---

### Person 2: Triage, DB & Server Logic (Python)

*   [ ] **Environment Setup:**
    *   [ ] Set up a Python environment.
    *   [ ] Install `pymongo`, `websockets`, and a library for running the Phi-3 model.
*   [ ] **Triage Pipeline:**
    *   [ ] Read messages from the shared `asyncio.Queue`.
    *   [ ] Load the Phi-3 Mini model.
    *   [ ] Implement the triage function that calls the model with the correct prompt.
    *   [ ] Add validation to ensure the model's output is a valid JSON object.
*   [ ] **Database Management:**
    *   [ ] Set up and connect to a local MongoDB instance.
    *   [ ] Write the structured JSON output from the model to the database.
    *   [ ] Include a `synced` flag (defaulting to `false`) in each database record.
*   [ ] **Internet Breakout:**
    *   [ ] Create a background service to poll for internet connectivity.
    *   [ ] When connectivity is found, POST all unsynced data to the NDRF API.
    *   [ ] Implement the sync to MongoDB Atlas.
    *   [ ] Update the `synced` flag to `true` for all uploaded records in the local DB.
*   [ ] **Interface:**
    *   [ ] Create a WebSocket server.
    *   [ ] When a new message is triaged, broadcast the structured data to all connected frontend clients.

---

### Person 3: Dashboard & Frontend (React/Svelte/Vue)

*   [ ] **Project Setup:**
    *   [ ] Initialize a new frontend project using your chosen framework (e.g., `create-react-app`).
    *   [ ] Install a WebSocket client library and a mapping library (e.g., Leaflet).
*   [ ] **UI Components:**
    *   [ ] Build the main dashboard layout.
    *   [ ] Create a reusable component to display a single triaged alert, showing priority, summary, and location hint.
    *   [ ] Create a simple form for sending a new message.
*   [ ] **Real-Time Functionality:**
    *   [ ] Implement the client-side code to connect to the backend WebSocket server.
    *   [ ] Write the logic to handle incoming messages and dynamically add them to the alert list.
*   [ ] **Map Visualization:**
    *   [ ] Integrate the mapping library into a map component.
    *   [ ] Add functionality to display and update GPS coordinates of mesh nodes on the map.
*   [ ] **Interactivity:**
    *   [ ] Hook up the message input form to send data back through the WebSocket or a simple HTTP request.
