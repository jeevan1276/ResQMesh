# Architecture: From Simulator to Mobile Phones

## Comparison: Simulator vs. React Native App

| Component | Python Simulator | React Native App |
|-----------|-----------------|------------------|
| **Transport** | TCP sockets | BLE advertising |
| **Packet Encoding** | `struct.pack()` | `DataView` |
| **Relay Logic** | Same relay loop | Same relay logic |
| **Deduplication** | `seen` dict | `seen` map |
| **TTL Check** | `hop_count < 5` | `hop_count < 5` |
| **Demo Platform** | Desktop (4 processes) | Mobile phones (3+ devices) |

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────┐
│                  DisasterMesh Project               │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Phase 1: Simulator (DONE ✓)                        │
│  ────────────────────────────                       │
│  • Python TCP nodes                                 │
│  • Packet encode/decode                             │
│  • Relay logic proven                               │
│  • 4-node network                                   │
│                                                     │
│  Phase 2: Mobile BLE (CURRENT)                      │
│  ────────────────────────────                       │
│  • React Native + Expo                              │
│  • Same packet.ts (ported from Python)              │
│  • Same relay logic (MeshBleManager)                │
│  • 3+ phone network                                 │
│                                                     │
│  Phase 3: Integration (FUTURE)                      │
│  ────────────────────────────                       │
│  • Person 2 queue integration                       │
│  • Tier 1 urgency model                             │
│  • Server backend connection                        │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## Code Reusability

### packet.py → packet.ts

**Python version:**
```python
def encode_packet(msg: Dict) -> bytes:
    packet = struct.pack("<HHBBIB", 
        msg["msg_id"],
        msg["origin_id"],
        msg["msg_type"],
        msg["hop_count"],
        msg["timestamp"],
        urgent_byte
    ) + payload
    return packet
```

**TypeScript version:**
```typescript
export function encodePacket(msg: Message): ArrayBuffer {
    const view = new DataView(buffer);
    view.setUint16(0, msg.msg_id, true);     // little-endian
    view.setUint16(2, msg.origin_id, true);
    // ... same structure
}
```

**Why?** Same 20-byte packet structure means:
- Python simulator can decode React Native packets
- Both use identical field offsets and types
- Can debug by comparing hex output

---

### node.py → MeshBleManager.ts

**Python relay logic:**
```python
async def on_receive(msg):
    if msg_id in seen:
        return
    if msg["hop_count"] >= 5:
        return
    
    await asyncio.sleep(random.uniform(0.05, 0.15))
    await broadcast({...msg, "hop_count": msg["hop_count"] + 1})
```

**TypeScript relay logic:**
```typescript
async receiveMessage(packetBuffer) {
    if (this.seenMessages.has(msgId)) return;
    if (msg.hop_count >= 5) return;
    
    const jitter = Math.random() * 100 + 50;
    await new Promise(r => setTimeout(r, jitter));
    await broadcast({...msg, hop_count: msg.hop_count + 1});
}
```

**Same algorithm, different language.**

---

## Data Flow on 3 Phones

```
┌──────────────────┐       ┌──────────────────┐       ┌──────────────────┐
│    Phone 1       │       │    Phone 2       │       │    Phone 3       │
│   Node 12345     │       │   Node 54321     │       │   Node 99999     │
├──────────────────┤       ├──────────────────┤       ├──────────────────┤
│                  │       │                  │       │                  │
│  User types:     │       │                  │       │                  │
│  "HELP!"         │       │                  │       │                  │
│       ↓          │       │                  │       │                  │
│  createMessage() │       │                  │       │                  │
│  msg_id=39363    │       │                  │       │                  │
│  hop_count=0     │       │                  │       │                  │
│       ↓          │       │                  │       │                  │
│  encodePacket()  │       │                  │       │                  │
│  20 bytes        │       │                  │       │                  │
│       ↓          │       │                  │       │                  │
│ BLE.advertise()  ├──────→ BLE Scanner       │       │                  │
│  broadcasts      │       │     ↓            │       │                  │
│                  │       │ decodePacket()   │       │                  │
│                  │       │     ↓            │       │                  │
│                  │       │ seen? NO ✓       │       │                  │
│                  │       │ hop<5? YES ✓     │       │                  │
│                  │       │     ↓            │       │                  │
│                  │       │  store msg       │       │                  │
│                  │       │  update UI       │       │                  │
│                  │       │     ↓            │       │                  │
│                  │       │  sleep(random)   │       │                  │
│                  │       │     ↓            │       │                  │
│                  │       │  hop_count++ ✓   │       │                  │
│                  │       │     ↓            │       │                  │
│                  │       │ BLE.advertise()  ├──────→ BLE Scanner       │
│                  │       │ hop=1 now        │       │     ↓            │
│                  │       │                  │       │ (repeat process) │
│                  │       │                  │       │                  │
│                  │       │                  │       │ Message stored   │
│                  │       │                  │       │ in Phone 3 list! │
│                  │       │                  │       │                  │
└──────────────────┘       └──────────────────┘       └──────────────────┘

RESULT: All 3 phones show the same message ✓
```

---

## BLE Mechanics (Simplified)

### Advertise (Broadcast)

```
Phone 1: "Listen everyone, here's my message..."
  │
  BLE Advertisement Packet:
  ├─ Service UUID: 180A
  ├─ Data: [39363, 12345, 0, 0, 1781337856, 0x80, "HELP!"]
  └─ Power: ~10-20 meters range

Phone 2 & 3 receive this broadcast automatically
```

### Scan (Listen)

```
Phone 2: "Is anyone broadcasting?"
  │
  BLE Scanner (running in background):
  ├─ Listens on all BLE channels
  ├─ Detects "DisasterMesh" broadcasts
  ├─ Calls callback with advertisement data
  └─ Our app decodes the packet

Same for Phone 3
```

---

## Why This Works

1. **Same Packet Schema**
   - Python simulator and React Native both use the exact 20-byte format
   - Field offsets match (msg_id at bytes 0-1, etc.)
   - Easy to debug

2. **Same Relay Algorithm**
   - Deduplication (seen messages)
   - TTL checking (hop_count < 5)
   - Random jitter before relay
   - Flood-fill propagation

3. **Different Transport**
   - Simulator: TCP (wired)
   - Mobile: BLE (wireless)
   - But the **logic above transport is identical**

4. **Proof of Concept**
   - Simulator proves the algorithm works (no BLE complexity)
   - React Native proves it works on real phones (with BLE)
   - Same business logic, different layers

---

## Testing Strategy

### Week 1: Simulator Phase
- ✅ 4-node TCP network
- ✅ Messages propagate 100%
- ✅ Deduplication works
- ✅ Hop count increments correctly

### Week 2: Mobile Phase (NOW)
- ⏳ 3 phones with BLE
- ⏳ Same packet format
- ⏳ Same relay logic
- ⏳ Verify propagation on physical devices

### Week 3: Integration Phase
- ⏳ Connect to server backend
- ⏳ Add Tier 1 model
- ⏳ Add Person 2 queue
- ⏳ Production hardening

---

## Key Files

| File | Purpose | Reusable |
|------|---------|----------|
| `packet.ts` | 20-byte codec | YES (ported from Python) |
| `MeshBleManager.ts` | BLE + relay | YES (logic same as `node.py`) |
| `App.tsx` | UI demo | Mobile-specific |
| `sim_network.py` | TCP simulator | Desktop-only (reference) |

---

## Next Phase: Gossip Sync

After message relay works on 3 phones, add:

```typescript
// When Phone 2 meets Phone 1:
const myIds = this.messageDatabase.keys();     // [39363, 41379, 43385]
const theirIds = await phone1.requestIds();    // [39363, 41379]

// They're missing 43385!
const missing = [43385];
const missingMessages = missing.map(id => this.messageDatabase.get(id));

await phone1.receiveMessages(missingMessages);
// Phone 1 now has the message it missed!
```

This is **Gossip Sync** - phones exchange what they know and catch up.

---

## Questions?

1. **"Why TCP in simulator, BLE in mobile?"**
   - Simulator = Desktop, no BLE hardware
   - Mobile = Natural wireless medium, BLE is standard
   - Transport doesn't matter for testing relay logic

2. **"Can I run mobile app on simulator?"**
   - Yes, use Android emulator
   - But BLE won't work in emulator (no hardware)
   - Real phones are better for demo

3. **"How do I add new features?"**
   - Test algorithm in simulator first
   - Port to React Native once proven
   - Deploy to phones

This is the winning strategy for hackathons! 🎯
