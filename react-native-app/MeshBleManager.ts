/**
 * BLE Mesh Manager
 * 
 * Handles:
 * - BLE advertising (broadcast our messages)
 * - BLE scanning (receive messages from nearby phones)
 * - Message relay logic
 */

import { BleManager } from "react-native-ble-plx";
import { Platform, NativeModules, PermissionsAndroid } from "react-native";
import { Message, encodePacket, decodePacket } from "./packet";

const MESH_SERVICE_UUID = "180A"; // Using Device Information service for demo
const MESH_CHARACTERISTIC_UUID = "2A29"; // Manufacturer name string
const ADVERTISING_NAME = "DisasterMesh";

export class MeshBleManager {
  private bleManager: BleManager;
  private nodeId: number;
  private seenMessages: Map<number, number> = new Map(); // msg_id -> timestamp
  private messageDatabase: Map<number, Message> = new Map(); // msg_id -> message

  private onMessageReceived?: (msg: Message) => void;

  constructor(nodeId: number) {
    this.bleManager = new BleManager();
    this.nodeId = nodeId;
  }

  /**
   * Initialize BLE and request permissions
   */
  async initialize(): Promise<void> {
    if (Platform.OS === "android") {
      const permissions = [
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      ];

      try {
        const granted = await PermissionsAndroid.requestMultiple(permissions);
        console.log("Permissions granted:", granted);
      } catch (err) {
        console.error("Permission error:", err);
      }
    }

    // Test BLE availability
    const state = await this.bleManager.state();
    console.log("BLE State:", state);
  }

  /**
   * Start advertising our messages (broadcast)
   */
  async startAdvertising(): Promise<void> {
    try {
      console.log(`[Node ${this.nodeId}] Starting BLE advertising...`);

      // Android-specific advertising
      if (Platform.OS === "android") {
        // Use native module for advertising
        const { BleModule } = NativeModules;
        if (BleModule?.startAdvertising) {
          await BleModule.startAdvertising(
            ADVERTISING_NAME,
            MESH_SERVICE_UUID
          );
        }
      }
    } catch (err) {
      console.error("Error starting advertising:", err);
    }
  }

  /**
   * Start scanning for nearby nodes
   */
  async startScanning(onDeviceFound: (deviceData: string) => void): Promise<void> {
    try {
      console.log(`[Node ${this.nodeId}] Starting BLE scan...`);

      this.bleManager.startDeviceScan(null, null, (error, device) => {
        if (error) {
          console.error("Scan error:", error);
          return;
        }

        // Look for our DisasterMesh devices
        if (
          device &&
          device.name &&
          device.name.includes(ADVERTISING_NAME)
        ) {
          console.log(`[Node ${this.nodeId}] Found peer:`, device.name);

          // Extract and process payload from advertisement data
          if (device.manufacturerData) {
            try {
              onDeviceFound(device.manufacturerData);
            } catch (err) {
              console.error("Error processing device data:", err);
            }
          }
        }
      });
    } catch (err) {
      console.error("Error starting scan:", err);
    }
  }

  /**
   * Send a message (advertise it to nearby nodes)
   */
  async sendMessage(msg: Message): Promise<void> {
    console.log(`[Node ${this.nodeId}] Originating message:`, msg);

    // Store locally
    this.seenMessages.set(msg.msg_id, Date.now());
    this.messageDatabase.set(msg.msg_id, msg);

    // Notify callback
    if (this.onMessageReceived) {
      this.onMessageReceived(msg);
    }

    // Advertise via BLE
    const packet = encodePacket(msg);
    console.log(`[Node ${this.nodeId}] Broadcasting packet (${packet.byteLength} bytes)`);

    // In real app, this would use the BLE advertising mechanism
    // to include the packet data
  }

  /**
   * Receive and relay a message
   */
  async receiveMessage(packetBuffer: ArrayBuffer): Promise<void> {
    try {
      const msg = decodePacket(packetBuffer);
      const msgId = msg.msg_id;

      // Already seen?
      if (this.seenMessages.has(msgId)) {
        console.log(`[Node ${this.nodeId}] Duplicate msg ${msgId}, ignoring`);
        return;
      }

      // TTL exceeded?
      const MAX_HOPS = 5;
      if (msg.hop_count >= MAX_HOPS) {
        console.log(`[Node ${this.nodeId}] TTL exceeded for msg ${msgId}`);
        return;
      }

      // Record as seen
      this.seenMessages.set(msgId, Date.now());
      this.messageDatabase.set(msgId, msg);

      console.log(
        `[Node ${this.nodeId}] Received msg ${msgId} from ${msg.origin_id} (hop ${msg.hop_count})`
      );

      // Notify callback
      if (this.onMessageReceived) {
        this.onMessageReceived(msg);
      }

      // Relay after random jitter (50-150ms)
      const jitter = Math.random() * 100 + 50;
      await new Promise((resolve) => setTimeout(resolve, jitter));

      const relayMsg: Message = {
        ...msg,
        hop_count: msg.hop_count + 1,
      };

      // Re-advertise
      const relayPacket = encodePacket(relayMsg);
      console.log(`[Node ${this.nodeId}] Relaying msg ${msgId} with hop_count ${relayMsg.hop_count}`);

      // Broadcast relay packet
      // (same mechanism as sendMessage)
    } catch (err) {
      console.error("Error receiving message:", err);
    }
  }

  /**
   * Set callback for when messages are received
   */
  setMessageCallback(callback: (msg: Message) => void) {
    this.onMessageReceived = callback;
  }

  /**
   * Get all messages stored on this node
   */
  getMessages(): Message[] {
    return Array.from(this.messageDatabase.values());
  }

  /**
   * Get node statistics
   */
  getStats() {
    return {
      nodeId: this.nodeId,
      messagesStored: this.messageDatabase.size,
      uniqueOrigins: new Set(
        Array.from(this.messageDatabase.values()).map((m) => m.origin_id)
      ).size,
    };
  }

  /**
   * Cleanup
   */
  async destroy(): Promise<void> {
    await this.bleManager.stopDeviceScan();
  }
}
