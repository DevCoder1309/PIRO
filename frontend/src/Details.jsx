import { useState, useEffect } from "react";
import axios from "axios";
import { useLocation } from "react-router-dom";

export default function Details() {
  const [nodeDetails, setNodeDetails] = useState(null);
  const location = useLocation();
  const params = new URLSearchParams(location.search);

  const peerIP = params.get("ip"); 
  const currentNode = "http://localhost:3001"; 

  useEffect(() => {
    if (!peerIP) return;

    axios
      .get(`${currentNode}/fetch-peer-info?ip=${peerIP}`)
      .then((res) => setNodeDetails(res.data))
      .catch((err) => console.error("Error fetching peer info:", err));
  }, [peerIP]);

  if (!nodeDetails) return <div className="p-6">Loading...</div>;

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold">Peer Node Details</h1>
      <ul className="mt-4 space-y-2">
        {Object.entries(nodeDetails).map(([key, value]) => (
          <li key={key} className="bg-gray-200 p-2 rounded">
            <strong>{key}:</strong> {value}
          </li>
        ))}
      </ul>
    </div>
  );
}
