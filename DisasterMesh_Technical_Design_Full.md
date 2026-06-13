DisasterMesh

Mesh Network + Offline LLM

Disaster-Zone First Responder Communications

Technical Design Document

Hackathon Submission  |  Team Size: 3  |  Duration: 12–24 hrs

# 1.  Core Insight & Problem Statement

Most disaster-response technology is built around a degraded-connectivity assumption — slower internet, patchy cell signal, intermittent cloud access. DisasterMesh makes a harder, more honest assumption:

We do not ask for the internet back.  We build the system that works before anyone fixes the tower.

## 1.1  The Real Problem

In every major natural disaster — floods, earthquakes, cyclones — the communication infrastructure collapses in the first 30 minutes. Cell towers lose power. Fibre cables snap. Satellite uplinks are overwhelmed. First responders arrive carrying radios and smartphones that can no longer do the one thing they were designed to do: communicate over a network.

What responders need in those first hours is structured, prioritised information:

Which locations have trapped survivors, and how many?

Which roads and bridges are passable?

Which hospitals still have capacity?

Where are the other response teams?

None of this requires the internet. It requires a local network that works peer-to-peer, and an intelligence layer that can triage incoming messages without a cloud API call.

## 1.2  Why Existing Solutions Fail

# 2.  Approach

DisasterMesh is built on three design principles that work together:

## 2.1  Symmetric Peer Mesh — No Single Point of Failure

Every node in the network is a peer running the exact same software stack — a true peer-to-peer mesh. There is no "relay server", no "master node", no "coordinator", and no dedicated relay hardware. Every node simultaneously:

Originates messages (distress pings, status updates, GPS location)

Relays messages from other nodes it receives (flood-fill with deduplication)

Maintains a full local log of all messages it has ever seen

If any node dies, the mesh routes around it automatically. The network degrades gracefully — it never fails completely unless every single node is destroyed.

## 2.2  Gossip Sync — Every Node Knows Everything

A simple flood-fill relay gets messages to nearby nodes. But what about nodes that were temporarily out of range, or joined the mesh late? DisasterMesh uses a gossip synchronisation protocol to ensure all nodes eventually converge to the same complete message log.

When two nodes come within BLE range of each other, they exchange a Bloom filter digest — a compact fingerprint of which message IDs each node has seen. Each node then requests the messages the other has that it is missing. This sync completes in under 2 seconds for typical disaster-scale message volumes (hundreds, not millions, of messages).

The result: if Node A received a distress message from a survivor at Hour 1, and Node B was out of range until Hour 3, the moment Node B comes within BLE range of any node that has the message, it gets a full copy. Every node always has the complete picture.

## 2.3  Internet Breakout — Self-Healing Toward the Outside World

The mesh does not wait for a designated gateway to come online. Every node polls for internet connectivity every 30 seconds. The first node that regains a signal — any signal: 4G, WiFi, satellite — immediately becomes the breakout gateway and:

Pushes the full unsynced message log to the NDRF/SDRF API endpoint

Pushes GPS coordinates of all known nodes in the mesh

Syncs the local MongoDB store to MongoDB Atlas

Broadcasts a "synced" flag back into the mesh so other nodes don't duplicate the upload

This means the disaster response force gets the complete picture the moment connectivity is restored — not just the messages that arrived after the gateway came online, but everything that happened while the network was dark.

# 3.  Technical Architecture

## 3.1  System Layers

The system is organised into four distinct layers, each independently replaceable:

## 3.2  BLE Message Packet Format

Every BLE advertisement fits within a single 20-byte MTU packet. The schema:

msg_id     : uint16   — unique message identifier (dedup key)

origin_id  : uint16   — originating node identifier

msg_type   : uint8    — 0=DISTRESS | 1=STATUS | 2=RESOURCE | 3=GPS

hop_count  : uint8    — incremented by each relay; max 5 before drop

timestamp  : uint32   — unix epoch seconds

urgent     : uint1    — set by node-tier model; 1 = likely P1

payload    : char[10] — compressed text or structured shortcode

The urgent bit is the node-tier model's output, computed locally before the message is ever relayed. Even if a node never reaches the server, every peer that receives this message — including the originating node itself — has an immediate, zero-latency signal about its severity. The server's full triage (Section 3.4) later refines this into P1/P2/P3 with structured fields.

For longer messages (distress text > 10 chars), the node uses BLE WRITE characteristic to the server directly when in range, or fragments across multiple advertisement cycles with a sequence counter in msg_id high bits.

## 3.3  Symmetric Node Logic

Every phone runs the same event loop with no role differentiation:

seen = Map<msg_id, timestamp>          // dedup cache, TTL 60s

// ORIGINATE — on user action

sendMessage(text) {

urgent = nodeModel.classify(text)      // ≤600M model, on-device

msg = { msg_id: uuid8(), hop: 0, type: DISTRESS, urgent, payload: text }

advertise(msg)

seen.set(msg.msg_id, now())

}

// RELAY — on receiving any BLE advertisement

onReceive(msg) {

if seen.has(msg.msg_id) return          // already relayed

if msg.hop >= MAX_HOPS return           // TTL expired

seen.set(msg.msg_id, now())

writeToLocalDB(msg)                    // persist immediately

advertise({ ...msg, hop: msg.hop + 1 }) // relay forward

}

// GOSSIP SYNC — on BLE connection with new peer

onPeerConnect(peer) {

myBloom = buildBloomFilter(seen.keys())

theirBloom = peer.requestBloom()

missing = seen.keys().filter(id => !theirBloom.has(id))

peer.sendBatch(missing.map(id => localDB.get(id)))

}

## 3.4  Three-Tier Intelligence Architecture

Rather than running one model everywhere, DisasterMesh assigns each tier of hardware a model appropriate to its compute budget. This is a deliberate systems-design choice, not a compromise: a phone running continuous BLE scan/advertise has little headroom for a 2GB model, while the server node has none of those constraints.

3.4.1  Tier 1 — Node-Level Urgency Gate

Every node runs a tiny classifier locally the moment a message is composed or relayed through it. This is intentionally narrow: a single binary decision, not structured extraction.

SYSTEM: Classify if this message describes an immediate life-

threatening emergency. Respond with exactly one word: URGENT

or ROUTINE. No other output.

Even a sub-600M model handles this binary task reliably, because it requires no structured output and no domain reasoning — just urgency-language pattern matching. The result propagates with the message through every hop, so a node that never reaches the server still sees a rough priority signal across its entire local log.

3.4.2  Tier 2 — Server-Side Structured Triage (Phi-3 Mini)

The server node runs one additional service on top of the standard mesh peer logic: a triage pipeline that classifies every incoming distress message using Phi-3 Mini, producing the full structured output.

The system prompt is deliberately constrained to prevent hallucination and force structured output:

SYSTEM: You are a disaster triage assistant. Given a distress

message, output ONLY a JSON object — no preamble, no markdown:

{

"priority": "P1" | "P2" | "P3",

"location_hint": string | null,

"people_count": number | null,

"resource_need": string | null,

"summary": string  // max 15 words

}

P1 = immediate life threat. P2 = urgent but stable. P3 = info only.

Never output anything outside the JSON object.

The Tier 1 urgent bit acts as a pre-filter: messages marked urgent are processed first and never deprioritised behind a backlog of routine status updates. The 15-word summary cap is a hard constraint that forces the model to be useful on a small responder screen under pressure. All output is validated against a JSON schema before writing to MongoDB; parse failures fall back to P2 classification with raw payload preserved.

3.4.3  Tier 3 — Online Enrichment (Gemini API)

Once the breakout gateway (Section 3.5) successfully syncs the message log to MongoDB Atlas and the NDRF API, the server node can optionally make a single batched call to the Gemini API over the now-available connection. This is strictly additive:

Cross-references location_hint fields across messages to build a consolidated incident map

Generates a natural-language situation report summarising P1 clusters by area for NDRF officials

Identifies resource-need patterns (e.g., multiple messages requesting the same hospital, suggesting a capacity issue)

Because this tier only runs after a successful sync, it can never block, delay, or degrade the offline triage pipeline. If Gemini is unreachable or the call fails, the synced data is already safely in NDRF's hands — Tier 3 is pure upside.

## 3.5  Internet Breakout Flow

The breakout service runs as a background coroutine on every node:

Poll connectivity every 30 seconds (attempt DNS resolution of known endpoint)

On connectivity detected: acquire distributed mutex via BLE broadcast ("I am the gateway")

Pull all records from local MongoDB where synced = false

POST to NDRF API: { messages[], node_gps_map{}, triage_summary{} }

PUT to MongoDB Atlas via Device Sync

On 200 OK: mark all records synced = true in local DB

Broadcast "sync_complete" message into mesh — all other nodes update their synced flags

The distributed mutex prevents duplicate uploads when multiple nodes regain connectivity simultaneously. The first to acquire it completes the upload; others see the "sync_complete" broadcast and skip.

# 4.  Architecture Overview

The system operates in two phases: the offline mesh phase (which is the steady state in a disaster), and the breakout phase (when any node regains connectivity).

## 4.1  Offline Mesh Phase

## 4.2  Breakout Phase

# 5.  24-Hour Build Plan

## 5.1  Team Role Split

Three people, three clean boundaries with one shared interface:

The shared interface between Person 1 and Person 2 is a Python asyncio queue: Person 1 writes decoded message strings to it; Person 2 reads from it. Define the interface shape in Hour 1 and both can work fully in parallel.

## 5.2  Hour-by-Hour Timeline

## 5.3  MVP Feature Checklist

Non-negotiable — demo fails without these:

BLE relay working across 3+ phones with flood-fill dedup

Phi-3 Mini triage running visibly (show terminal inference) with P1/P2/P3 output

Live dashboard updating via WebSocket with triage queue

GPS node pins on map (fake coordinates acceptable)

Atlas sync moment: "connectivity restored" triggers upload

Cuttable without losing the story:

Physical LoRa hardware (TCP simulator is sufficient)

Real GPS coordinates

Authentication layer

Voice input (can be added post-hackathon)

Standout feature — highest ROI for demo impact:

Replay mode: load real historical distress data (2013 Uttarakhand floods Twitter archive) and replay it through the triage engine live. 200 real messages auto-sorted into P1/P2/P3 in 90 seconds, entirely offline.

# 6.  Known Problems & Mitigations

## 6.1  Technical Challenges

## 6.2  Scope Risks for 24-Hour Build

## 6.3  Production Considerations (Post-Hackathon)

Replace BLE with LoRa (Meshtastic) for 5km range. Architecture is identical — only the transport layer changes.

Scale coverage by adding more peer nodes (phones or LoRa-capable handhelds) — every additional node is a full peer, not a dumb relay, so the mesh gets smarter and more resilient as it grows.

Add end-to-end encryption (Curve25519 key exchange on node pairing, AES-256 payload encryption).

Integrate with NDRF's existing GIS systems (ESRI ArcGIS, QGIS) via standard GeoJSON output.

Voice input via Sarvam AI (regional Indian languages) for non-literate field responders.

Battery management: power-bank-assisted phone nodes for extended deployment; BLE duty-cycling (scan/advertise windows) to conserve battery during long operations.

# 7.  Demo Script & Pitch Notes

## 7.1  The Three-Sentence Pitch

In every major disaster, the internet dies in the first 30 minutes. Every existing tool assumes it comes back. DisasterMesh works on the assumption that it never does.

## 7.2  Demo Arc (5 minutes)

Start with all internet off. WiFi off. Mobile data off. State this clearly.

Phone A sends: "3 people trapped, 4th floor, Sector 7 building." Show it arrive on dashboard as P1.

Phone B sends: "NH-44 bridge damaged, avoid." Show P3 classification.

Phone C (out of range) joins the mesh. Watch gossip sync fill its local log in real time.

Replay mode: load 50 real distress messages. Watch them sort into P1/P2/P3 in under 60 seconds, offline.

Restore internet on one phone. Watch Atlas sync trigger. Dashboard shows "Synced to NDRF — 47 events uploaded." Done.

## 7.3  Why This Wins on Every Judging Axis

— End of Document —