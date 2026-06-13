# DisasterMesh - React Native BLE Demo

## How to Run on 3 Phones

### Prerequisites

1. **3 Android phones** (Android 12+) with Bluetooth enabled
2. **Same WiFi network** (for local dev server)
3. **Expo Go app** installed on each phone ([Google Play Store](https://play.google.com/store/apps/details?id=host.exp.exponent))

---

## Setup Instructions

### Step 1: Install Dependencies

```bash
cd C:\DisasterMesh\react-native-app
npm install
# or
yarn install
```

### Step 2: Start Expo Dev Server

```bash
npm start
# or
npx expo start
```

You'll see output like:

```
✓ Built for ios
Expo Go supports: ios

Press i to open iOS simulator
Press a to open Android emulator
Press w to open web
Press j to open Debugger
Press r to reload app
Press m to toggle menu
...
```

### Step 3: Run on 3 Phones

On **Phone 1:**
- Open Expo Go app
- Tap "Scan QR code"
- Scan the QR code shown in terminal
- App loads...

Repeat for **Phone 2** and **Phone 3**

Each phone gets a **unique Node ID** automatically (0-65535).

---

## Demo Flow

### 1. Enable BLE on All Phones

On each phone in the app:

1. Tap **"Start Scanning"** button
   - Phone starts listening for nearby BLE devices
   - Shows "🔴 Scanning" status

2. Tap **"Start Advertising"** button
   - Phone broadcasts its presence as a DisasterMesh node
   - Ready to receive messages

**Do this on all 3 phones.**

---

### 2. Send a Test Message

On **Phone 1:**

1. Type in the message box: `HELP - BUILDING COLLAPSE`
2. Tap **"Send"** button
3. Message appears in your own list with blue background

**What happens next:**

- Phone 1 broadcasts the message via BLE
- Phone 2 (nearby) receives it → shows in list
- Phone 2 relays it to Phone 3
- Phone 3 receives it

**After ~1-2 seconds, all 3 phones should show the same message!**

---

### 3. Verify Propagation

Check the message details on each phone:

| Phone | View |
|-------|------|
| Phone 1 (Sender) | `Hop 0` ← Original |
| Phone 2 (Relay) | `Hop 0 or 1` ← Received |
| Phone 3 (Relay) | `Hop 1 or 2` ← Relayed further |

**Key observation:**
- `Hop count` increases as message travels phone-to-phone
- All phones store the same message (deduplication works)
- Message appears in all 3 lists = **propagation works!**

---

### 4. Send from Phone 3

Now try from **Phone 3:**

1. Type: `WATER SHORTAGE AT ZONE B`
2. Tap **"Send"**

The message should propagate **backward** to Phone 1 via Phone 2.

---

## What's Happening Under the Hood

```
Phone 1 (Node 12345)          Phone 2 (Node 54321)         Phone 3 (Node 99999)
       ↓ Send "HELP"                  ↓                            ↓
   Advertises via BLE ---------> Receives BLE ---------> Receives BLE
       ↓                            ↓                            ↓
   hop_count=0                  hop_count→1                  hop_count→2
       ↓                            ↓                            ↓
   Stored locally            Stored + Relayed           Stored + Relayed
       ↓                            ↓                            ↓
   Display in list          Display in list           Display in list
```

Each phone independently runs:

1. **BLE Scanner** - Listens for other phones broadcasting
2. **Message Receiver** - Extracts the 20-byte packet
3. **Deduplication** - "Have I seen this msg_id before?"
4. **Relay Logic** - "Is hop_count < MAX_HOPS? If yes, rebroadcast"
5. **UI Update** - Shows message in the list

---

## Troubleshooting

### "Messages not showing up on Phone 2/3"

**Likely causes:**

1. **Phones not advertising**
   - Tap "Start Advertising" on all phones
   - Check if status shows "🔴 Scanning"

2. **BLE permissions denied**
   - Android will prompt for permissions on first run
   - Tap "Allow" for all BLE permissions
   - If denied, go to Settings → Apps → DisasterMesh → Permissions → Enable Bluetooth

3. **Phones too far apart**
   - BLE range is ~10-20 meters (depending on phone)
   - Move phones closer together
   - Ensure no obstacles between phones

4. **Same phone receiving own message**
   - This is **normal** - deduplication prevents display
   - You'll see "Duplicate msg X, ignoring" in the logs

### "App crashes on startup"

- Close all Expo windows
- Run: `npm start --clear`
- Reload on phones

### "Can't connect to Expo server"

- Ensure all 3 phones are on the same WiFi network
- Try the "Local" connection option in Expo menu
- Or use a USB cable for one phone

---

## Real Hackathon Demo

For your 24-hour hackathon:

**Timeline:**
- **Hour 8-10**: Get basic React Native running (this code)
- **Hour 10-12**: Test BLE on 2 phones, verify dedup works
- **Hour 12-14**: Stress test with 3+ phones, multiple messages
- **Hour 14-16**: Integration with Person 2's server queue
- **Hour 16-18**: Add Tier 1 urgency classifier
- **Hour 18-22**: Polish UI, demo scenario (earthquake → messages flow across network)
- **Hour 22-24**: Final demo

---

## What's NOT Implemented Yet

1. **Gossip Sync** - Currently only flood-fill relay
2. **Tier 1 Model** - All messages show, no urgency classification
3. **Server Integration** - Messages aren't sent to backend yet
4. **Battery optimization** - Scanning runs continuously (normal for demo)

Add these in **Phase 2** after you verify BLE relay works.

---

## Next Steps

Once you confirm message passing on 3 phones:

1. ✅ **Add Gossip Sync** - Have phones exchange known message IDs on startup
2. ✅ **Add Tier 1 Model** - Classify messages as URGENT or ROUTINE
3. ✅ **Server Integration** - Send messages to backend via HTTP/WebSocket
4. ✅ **Polish UI** - Add message type icons, better formatting

---

## Quick Reference

**Most Important Features:**

```typescript
// Send a message (Phone 1)
const msg = createMessage(nodeId, MSG_TYPE.DISTRESS, "HELP!");
await meshManager.sendMessage(msg);

// Receive and relay (Phone 2, 3)
await meshManager.receiveMessage(ble_packet_data);
// → Automatically deduplicates, checks TTL, relays

// Track propagation
message.hop_count;  // 0 = original, 1 = relayed once, etc.
message.origin_id;  // Who created it
```

Good luck! 🚀
