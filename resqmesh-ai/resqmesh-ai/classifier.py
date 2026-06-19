import os
import json
from dotenv import load_dotenv
import google.generativeai as genai

# Load environment variables
load_dotenv()

# Configure Gemini
api_key = os.getenv("GEMINI_API_KEY")
genai.configure(api_key=api_key)

# Load model once
model = genai.GenerativeModel("gemini-2.5-flash")


def classify_emergency(message):
    prompt = f"""
You are an emergency classification system.

Return ONLY valid JSON.

Possible severities:
CRITICAL
HIGH
MEDIUM
LOW

Possible categories:
MEDICAL
FIRE
FLOOD
TRAPPED
RESOURCE
OTHER

Emergency Message:
{message}

Output Format:
{{
    "severity": "",
    "category": "",
    "summary": ""
}}
"""

    response = model.generate_content(prompt)

    try:
        cleaned = response.text.strip()

        # Remove markdown if Gemini wraps JSON in ```json
        cleaned = cleaned.replace("```json", "")
        cleaned = cleaned.replace("```", "")
        cleaned = cleaned.strip()

        return json.loads(cleaned)

    except Exception as e:
        return {
            "severity": "UNKNOWN",
            "category": "OTHER",
            "summary": f"Parsing failed: {str(e)}"
        }