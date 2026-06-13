# DisasterMesh — Hackathon Build

BLE mesh network for disaster response messaging | Person 1: Mesh & Nodes

**Status: Phase 1 COMPLETE ✅ | Phase 2 IN PROGRESS ⏳**

## Quick Start

### Phase 1: Simulator (✅ WORKING)

```bash
cd simulator
python sim_network.py
```

**Output:** 4-node network, 3 messages, 100% propagation, all dups eliminated ✓

### Phase 2: Mobile BLE (⏳ READY TO TEST)

```bash
cd react-native-app
npm install
npm start
```

**Then:** Scan QR code on 3 phones with Expo Go app. See messages propagate real-time! 

[→ SETUP.md for detailed instructions](react-native-app/SETUP.md)

### Phase 3: Integration (⏳ NEXT)

```bash
# Later: Add Tier 1 model, server integration, Person 2 queue
```

---

## Architecture

**Key insight:** Same relay logic, different transport

```
Simulator (TCP)  →  Mobile Phones (BLE)  →  Server Backend (HTTP/WebSocket)
  ✅ Working        ⏳ Ready to test         ⏳ Next sprint
```

[→ ARCHITECTURE.md for deep dive](ARCHITECTURE.md)

---

## Project Structure

```
DisasterMesh/
├── simulator/              # Phase 1: Python TCP simulator ✓
│   ├── sim_network.py      # 4-node demo (working)
│   ├── node.py             # Core relay + dedup logic
│   ├── packet.py           # 20-byte codec
│   └── requirements.txt
│
├── react-native-app/       # Phase 2: Mobile BLE app ⏳
│   ├── App.tsx             # Main UI (message list + controls)
│   ├── MeshBleManager.ts   # BLE scanning/advertising + relay
│   ├── packet.ts           # Same 20-byte codec (ported from Python)
│   ├── package.json        # Dependencies
│   ├── app.json            # Expo config
│   ├── SETUP.md            # Detailed 3-phone demo instructions
│   └── .gitignore
│
├── tier1-model/            # Phase 3: Urgency classifier (WIP)
│
├── ARCHITECTURE.md         # How simulator bridges to mobile
└── README.md               # This file
```

## Packet Schema (AGREED)

```
msg_id     : uint16   (2 bytes)  - unique message identifier
origin_id  : uint16   (2 bytes)  - originating node
msg_type   : uint8    (1 byte)   - 0=DISTRESS | 1=STATUS | 2=RESOURCE | 3=GPS
hop_count  : uint8    (1 byte)   - increment per relay, drop after 5
timestamp  : uint32   (4 bytes)  - unix epoch seconds
urgent     : uint1    (1 bit)    - set by Tier 1 model
payload    : char[10] (10 bytes) - compressed text
---
Total: 20 bytes minimum
```

## Timeline

- **Hour 0-1:** Setup + finalize schema
- **Hour 1-6:** Simulator (relay, dedup, TTL, gossip)
- **Hour 6-8:** Stress testing
- **Hour 8-16:** React Native BLE
- **Hour 16-22:** Integration + Tier 1 model
- **Hour 22-24:** Bug fixes + demo

## Key Contacts

- **Person 2:** Receives decoded messages via local queue
- **Server:** Receives messages from originating phone

---

**Build strategy:** Simulator first = faster validation, lower BLE risk.
