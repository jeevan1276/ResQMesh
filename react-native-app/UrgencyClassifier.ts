// UrgencyClassifier.ts

// A simple keyword-based classifier to simulate the Tier 1 AI model for the hackathon demo.
const URGENT_KEYWORDS = [
  "help", "trapped", "injured", "collapse", "fire", "flood",
  "emergency", "urgent", "critical", "down", "stuck", "bleeding"
];

export function classifyUrgency(text: string): boolean {
  const lowerCaseText = text.toLowerCase();
  return URGENT_KEYWORDS.some(keyword => lowerCaseText.includes(keyword));
}
