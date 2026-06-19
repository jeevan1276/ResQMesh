from fastapi import FastAPI
from bson import ObjectId
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from pymongo import MongoClient
from classifier import classify_emergency
from os import getenv

client = MongoClient(getenv("MONGODB_URI"))

db = client["resqmesh"]

incidents_collection = db["incidents"]


app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class EmergencyRequest(BaseModel):
    message: str
    latitude: float
    longitude: float
    device_id: str
    timestamp: str
    

class BulkEmergencyRequest(BaseModel):
    messages: list[EmergencyRequest]



@app.get("/")
def home():
    return {"message": "ResQMesh AI Service Running"}



@app.patch("/incident/{incident_id}/resolve")
def resolve_incident(incident_id: str):

    incidents_collection.update_one(
        {"_id": ObjectId(incident_id)},
        {
            "$set": {
                "status": "RESOLVED"
            }
        }
    )

    return {
        "message": "Incident resolved"
    }



@app.get("/incidents")
def get_incidents():

    incidents = []

    for incident in incidents_collection.find(
        {"status": "ACTIVE"}
    ):

        incident["_id"] = str(incident["_id"])

        incidents.append(incident)

    return incidents


@app.post("/classify")
def classify(request: EmergencyRequest):
    result = classify_emergency(request.message)
    result["latitude"] = request.latitude
    result["longitude"] = request.longitude
    result["device_id"] = request.device_id
    result["timestamp"] = request.timestamp
    result["status"] = "ACTIVE"
    incidents_collection.insert_one(result.copy())
    return result


@app.post("/bulk-classify")
def bulk_classify(request: BulkEmergencyRequest):

    results = []

    for emergency in request.messages:

        result = classify_emergency(emergency.message)

        result["latitude"] = emergency.latitude
        result["longitude"] = emergency.longitude
        result["device_id"] = emergency.device_id
        result["timestamp"] = emergency.timestamp

        results.append(result)

    return results


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="127.0.0.1", port=8000, reload=True)