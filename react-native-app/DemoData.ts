// DemoData.ts
import { Message } from './packet';

// Pre-defined sequence of messages for the demo replay
export const DEMO_MESSAGES: Partial<Message>[] = [
  {
    origin_id: 54321,
    payload: "Bridge Dn",
    hop_count: 1,
  },
  {
    origin_id: 11223,
    payload: "Need H2O",
    hop_count: 2,
  },
  {
    origin_id: 98765,
    payload: "HELP! Trap",
    hop_count: 0,
  },
];
