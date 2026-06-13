/**
 * Packet encoding/decoding for DisasterMesh in React Native
 * 
 * Schema (20 bytes):
 * - msg_id: uint16 (bytes 0-1)
 * - origin_id: uint16 (bytes 2-3)
 * - msg_type: uint8 (byte 4) - 0=DISTRESS, 1=STATUS, 2=RESOURCE, 3=GPS
 * - hop_count: uint8 (byte 5)
 * - timestamp: uint32 (bytes 6-9)
 * - urgent: uint1 (bit 0 of byte 10)
 * - payload: char[10] (bytes 10-19)
 */

export const MSG_TYPE = {
  DISTRESS: 0,
  STATUS: 1,
  RESOURCE: 2,
  GPS: 3,
};

export interface Message {
  msg_id: number;
  origin_id: number;
  msg_type: number;
  hop_count: number;
  timestamp: number;
  urgent: boolean;
  payload: string;
}

/**
 * Encode a message into a 20-byte packet
 */
export function encodePacket(msg: Message): ArrayBuffer {
  const buffer = new ArrayBuffer(20);
  const view = new DataView(buffer);
  const encoder = new TextEncoder();

  // msg_id (uint16, little-endian)
  view.setUint16(0, msg.msg_id, true);

  // origin_id (uint16, little-endian)
  view.setUint16(2, msg.origin_id, true);

  // msg_type (uint8)
  view.setUint8(4, msg.msg_type);

  // hop_count (uint8)
  view.setUint8(5, msg.hop_count);

  // timestamp (uint32, little-endian)
  view.setUint32(6, msg.timestamp, true);

  // urgent flag (in first bit of byte 10)
  view.setUint8(10, msg.urgent ? 0x80 : 0x00);

  // payload (max 10 chars, padded with zeros)
  const payloadBytes = encoder.encode(msg.payload.substring(0, 10));
  for (let i = 0; i < payloadBytes.length && i < 10; i++) {
    view.setUint8(10 + i, payloadBytes[i]);
  }

  return buffer;
}

/**
 * Decode a 20-byte packet into a message
 */
export function decodePacket(buffer: ArrayBuffer): Message {
  const view = new DataView(buffer);
  const decoder = new TextDecoder();

  // msg_id (uint16, little-endian)
  const msg_id = view.getUint16(0, true);

  // origin_id (uint16, little-endian)
  const origin_id = view.getUint16(2, true);

  // msg_type (uint8)
  const msg_type = view.getUint8(4);

  // hop_count (uint8)
  const hop_count = view.getUint8(5);

  // timestamp (uint32, little-endian)
  const timestamp = view.getUint32(6, true);

  // urgent flag
  const urgent_byte = view.getUint8(10);
  const urgent = (urgent_byte & 0x80) !== 0;

  // payload
  const payloadBuffer = buffer.slice(10, 20);
  const payloadStr = decoder.decode(payloadBuffer).replace(/\0/g, "");

  return {
    msg_id,
    origin_id,
    msg_type,
    hop_count,
    timestamp,
    urgent,
    payload: payloadStr,
  };
}

/**
 * Create a new message with current timestamp
 */
export function createMessage(
  origin_id: number,
  msg_type: number,
  payload: string,
  urgent: boolean = false
): Message {
  return {
    msg_id: Math.floor(Date.now() * Math.random()) & 0xffff,
    origin_id,
    msg_type,
    hop_count: 0,
    timestamp: Math.floor(Date.now() / 1000),
    urgent,
    payload,
  };
}
