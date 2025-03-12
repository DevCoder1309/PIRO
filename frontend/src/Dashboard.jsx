import { useState, useEffect } from "react";
import axios from "axios";

function Dashboard() {
  const [nodes, setNodes] = useState([]);

  useEffect(() => {
    axios.get("http://localhost:3001/peers").then((res) => setNodes(res.data));
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold">Peer Network</h1>
      <ul className="mt-4">
        {nodes.map((n, i) => (
          <a href="http://localhost:5173/details"><li key={i} className="p-2 border">{n.name} - {n.ip}</li></a>
        ))}
      </ul>
    </div>
  );
}

export default Dashboard;
