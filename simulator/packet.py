"""
Packet encoding/decoding for DisasterMesh

Packet Schema (20 bytes):
- msg_id     : uint16   (bytes 0-1)
- origin_id  : uint16   (bytes 2-3)
- msg_type   : uint8    (byte 4)   0=DISTRESS, 1=STATUS, 2=RESOURCE, 3=GPS
- hop_count  : uint8    (byte 5)   max 5
- timestamp  : uint32   (bytes 6-9)
- urgent     : uint1    (bit 0 of byte 10)
- payload    : char[10] (bytes 10-19)
"""

import struct
import time
from typing import Dict, Tuple

# Message type constants
MSG_TYPE_DISTRESS = 0
MSG_TYPE_STATUS = 1
MSG_TYPE_RESOURCE = 2
MSG_TYPE_GPS = 3

MSG_TYPES = {
    "DISTRESS": MSG_TYPE_DISTRESS,
    "STATUS": MSG_TYPE_STATUS,
    "RESOURCE": MSG_TYPE_RESOURCE,
    "GPS": MSG_TYPE_GPS,
}

MSG_TYPE_NAMES = {v: k for k, v in MSG_TYPES.items()}


def encode_packet(msg: Dict) -> bytes:
    """
    Encode a message dict into a 20-byte packet.
    
    Args:
        msg: {
            msg_id: int,
            origin_id: int,
            msg_type: int (0-3),
            hop_count: int (0-5),
            timestamp: int (unix seconds),
            urgent: bool,
            payload: str (max 10 chars)
        }
    
    Returns:
        20-byte packet
    """
    # Validate inputs
    assert 0 <= msg["msg_id"] < 65536, "msg_id must be uint16"
    assert 0 <= msg["origin_id"] < 65536, "origin_id must be uint16"
    assert msg["msg_type"] in (0, 1, 2, 3), "msg_type must be 0-3"
    assert 0 <= msg["hop_count"] <= 5, "hop_count must be 0-5"
    
    # Truncate payload to 10 bytes
    payload = msg["payload"][:10].encode("utf-8")
    payload = payload.ljust(10, b"\x00")  # pad with nulls
    
    # Pack the packet
    urgent_byte = (1 << 7) if msg.get("urgent", False) else 0
    
    packet = struct.pack(
        "<HHBBIB",  # little-endian format
        msg["msg_id"],
        msg["origin_id"],
        msg["msg_type"],
        msg["hop_count"],
        msg["timestamp"],
        urgent_byte,
    ) + payload
    
    return packet


def decode_packet(packet: bytes) -> Dict:
    """
    Decode a 20-byte packet into a message dict.
    
    Args:
        packet: 20-byte packet
    
    Returns:
        Message dict
    """
    assert len(packet) == 20, f"Packet must be 20 bytes, got {len(packet)}"
    
    msg_id, origin_id, msg_type, hop_count, timestamp, urgent_byte = struct.unpack(
        "<HHBBIB", packet[:10]
    )
    
    payload = packet[10:20].decode("utf-8").rstrip("\x00")
    urgent = bool(urgent_byte & 0x80)
    
    return {
        "msg_id": msg_id,
        "origin_id": origin_id,
        "msg_type": msg_type,
        "hop_count": hop_count,
        "timestamp": timestamp,
        "urgent": urgent,
        "payload": payload,
    }


def create_message(origin_id: int, msg_type: int, payload: str, urgent: bool = False) -> Dict:
    """Create a new message with current timestamp."""
    return {
        "msg_id": int(time.time() * 1000) & 0xFFFF,  # pseudo-random 16-bit ID
        "origin_id": origin_id,
        "msg_type": msg_type,
        "hop_count": 0,
        "timestamp": int(time.time()),
        "urgent": urgent,
        "payload": payload,
    }


# Test
if __name__ == "__main__":
    msg = create_message(origin_id=1, msg_type=MSG_TYPE_DISTRESS, payload="HELP!", urgent=True)
    print(f"Original: {msg}")
    
    packet = encode_packet(msg)
    print(f"Packet length: {len(packet)} bytes")
    print(f"Packet hex: {packet.hex()}")
    
    decoded = decode_packet(packet)
    print(f"Decoded: {decoded}")
    
    assert msg["msg_id"] == decoded["msg_id"]
    assert msg["urgent"] == decoded["urgent"]
    print("✓ Encoding/decoding works!")
