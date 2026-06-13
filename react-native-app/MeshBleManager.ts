/**
 * BLE Mesh Manager
 * 
 * Handles:
 * - BLE advertising (broadcast our messages)
 * - BLE scanning (receive messages from nearby phones)
 * - Message relay logic
 */

import { BleManager, Device } from 'react-native-ble-plx';
// @ts-ignore
import BlePeripheral from 'react-native-ble-peripheral';
import { Buffer } from 'buffer';
import { Platform, NativeModules, PermissionsAndroid } from "react-native";
import { Message, encodePacket, decodePacket } from "./packet";

const MESH_SERVICE_UUID = "180A"; // Using Device Information service for demo
const MESH_CHARACTERISTIC_UUID = "2A29"; // Manufacturer name string
const ADVERTISING_NAME = "DisasterMesh";

export class MeshBleManager {
  private bleManager: BleManager;
  private seenMessages: Map<number, number> = new Map();
  private messageDatabase: Map<number, Message> = new Map();
  private onMessageReceived: ((msg: Message) => void) | null = null;
  private nodeId: number;
  private serviceUUID = '0000180D-0000-1000-8000-00805F9B34FB'; // Heart Rate Service UUID

  constructor(nodeId: number) {
    this.nodeId = nodeId;
    this.bleManager = new BleManager();
  }

  async requestPermissions(): Promise<boolean> {
    if (Platform.OS !== 'android') return true;

    try {
      if (Platform.Version >= 31) {
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        ]);
        return (
          granted[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] === PermissionsAndroid.RESULTS.GRANTED &&
          granted[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] === PermissionsAndroid.RESULTS.GRANTED &&
          granted[PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE] === PermissionsAndroid.RESULTS.GRANTED &&
          granted[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] === PermissionsAndroid.RESULTS.GRANTED
        );
      } else {
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        ]);
        return granted[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] === PermissionsAndroid.RESULTS.GRANTED;
      }
    } catch (err) {
      console.error("Failed to request permissions:", err);
      return false;
    }
  }

  async initialize() {
    const hasPermission = await this.requestPermissions();
    if (!hasPermission) {
      console.warn("BLE Permissions not granted!");
    }
    
    console.log("BLE Peripheral initialized (no manual init needed)");
  }

  /**
   * Start advertising our messages (broadcast)
   */
  async startAdvertising() {
    try {
      const packet = Buffer.from([this.nodeId & 0xFF, (this.nodeId >> 8) & 0xFF]); // Example packet
      await BlePeripheral.setName(ADVERTISING_NAME);
      await BlePeripheral.addService(this.serviceUUID, true);
      await BlePeripheral.setManufacturerData(65535, Array.from(packet));
      await BlePeripheral.start();
      console.log("Advertising started");
    } catch (error) {
      console.error("Advertising failed to start", error);
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
              const buffer = Buffer.from(device.manufacturerData, 'base64');
              // The first 2 bytes are the manufacturer ID. The remaining bytes are the packet.
              if (buffer.length >= 22) {
                const packetBuffer = new Uint8Array(buffer).slice(2).buffer;
                this.receiveMessage(packetBuffer);
              }
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

  private cleanSeenMessages() {
    const now = Date.now();
    const TTL = 5 * 60 * 1000; // 5 minutes TTL
    for (const [msgId, timestamp] of this.seenMessages.entries()) {
      if (now - timestamp > TTL) {
        this.seenMessages.delete(msgId);
      }
    }
  }

  /**
   * Send a message (advertise it to nearby nodes)
   */
  async sendMessage(msg: Message): Promise<void> {
    this.cleanSeenMessages();
    this.seenMessages.set(msg.msg_id, Date.now());
    this.messageDatabase.set(msg.msg_id, msg);

    // Notify callback
    if (this.onMessageReceived) {
      this.onMessageReceived(msg);
    }

    // Advertise via BLE
    const packet = encodePacket(msg);

    try {
      // Stop current advertising to update the payload
      await BlePeripheral.stop();
      
      // Create a new service with the updated manufacturer data
      await BlePeripheral.setName(ADVERTISING_NAME);
      await BlePeripheral.addService(this.serviceUUID, true);
      await BlePeripheral.setManufacturerData(65535, Array.from(new Uint8Array(packet)));

      await BlePeripheral.start();
    } catch (error) {
      console.error("Failed to send message via advertising", error);
    }
  }

  /**
   * Receive and relay a message
   */
  async receiveMessage(packetBuffer: ArrayBuffer): Promise<void> {
    try {
      this.cleanSeenMessages();
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
      try {
        await BlePeripheral.stop();
        await BlePeripheral.setName(ADVERTISING_NAME);
        await BlePeripheral.addService(this.serviceUUID, true);
        await BlePeripheral.setManufacturerData(65535, Array.from(new Uint8Array(relayPacket)));
        await BlePeripheral.start();
      } catch (error) {
        console.error("Failed to relay message via advertising", error);
      }
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
