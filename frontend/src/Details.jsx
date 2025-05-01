import { useState, useEffect } from "react";
import axios from "axios";
import { useLocation } from "react-router-dom";
import PeerForm from "./PeerForm";
import "./Details.css";

export default function Details() {
  const [nodeDetails, setNodeDetails] = useState(null);
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const peerIP = params.get("ip");

  useEffect(() => {
    if (!peerIP) return;

    axios
      .get(`http://localhost:3001/details?ip=${encodeURIComponent(peerIP)}`)
      .then((res) => setNodeDetails(res.data))
      .catch((err) => console.error("Error fetching peer info:", err));
  }, [peerIP]);

  if (!nodeDetails) return <div className="p-6 text-white">Loading...</div>;

  return (
    <div className="details-container">
      <div className="left-panel">
        <h1 className="section-title">Peer Node Details</h1>
        <ul className="details-list">
          {Object.entries(nodeDetails).map(([key, value]) => (
            <li key={key}>
              <strong>{key}:</strong> {value}
            </li>
          ))}
        </ul>
      </div>
      <div className="right-panel">
        <PeerForm IP={peerIP} />
      </div>
    </div>
  );
}
