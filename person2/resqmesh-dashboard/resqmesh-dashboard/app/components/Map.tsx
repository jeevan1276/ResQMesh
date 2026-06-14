"use client";
import { useMap } from "react-leaflet";
import { useEffect } from "react";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";


delete (L.Icon.Default.prototype as any)._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const redIcon = new L.Icon({
  iconUrl:
    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png",
  shadowUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});


const orangeIcon = new L.Icon({
  iconUrl:
    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-orange.png",
  shadowUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});


const yellowIcon = new L.Icon({
  iconUrl:
    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-yellow.png",
  shadowUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const greenIcon = new L.Icon({
  iconUrl:
    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png",
  shadowUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});


const blueIcon = new L.Icon({
  iconUrl:
    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png",
  shadowUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});



function FlyToLocation({
  selectedLocation,
}: {
  selectedLocation: any;
}) {
  const map = useMap();

  useEffect(() => {
    if (selectedLocation) {
      map.flyTo(
        [selectedLocation.lat, selectedLocation.lng],
        16,
        {
          duration: 2,
        }
      );
    }
  }, [selectedLocation, map]);

  return null;
}


function getMarkerIcon(severity: string) {
  if (severity === "CRITICAL") {
    return redIcon;
  }

  if (severity === "HIGH") {
    return orangeIcon;
  }

  if (severity === "MEDIUM") {
    return yellowIcon;
  }

  return greenIcon;
}

export default function RescueMap({
  locations,
  selectedLocation,
  rescueLocation,
}: {
  locations: any[];
  selectedLocation: any;
  rescueLocation: any;
}) {
    console.log(selectedLocation);
    console.log("locations count:", locations.length);
    console.log(locations);
  return (
    <MapContainer
      center={[17.385, 78.4867]}
      zoom={12}
      style={{ height: "600px", width: "100%" }}
    >
      <TileLayer
        attribution="&copy; OpenStreetMap contributors"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <FlyToLocation
        selectedLocation={selectedLocation}
        />
        
      {locations.map((loc) => (
        <Marker
            key={loc.id}
            position={[loc.lat, loc.lng]}
            icon={getMarkerIcon(loc.severity)}
            >
          <Popup>
        <strong>{loc.id}</strong>
        <br />
        {loc.summary}
        </Popup>
        </Marker>
      ))}
      {rescueLocation && (
  <Marker
    position={[
      rescueLocation.lat,
      rescueLocation.lng,
    ]}
    icon={blueIcon}
  >
    <Popup>
      🚑 Rescue Team Location
    </Popup>
  </Marker>
)}
    </MapContainer>
  );
}