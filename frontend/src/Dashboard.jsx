import { useState, useEffect } from "react";
import axios from "axios";
import Container from "./components/Container";

function Dashboard() {
  const [nodes, setNodes] = useState([]);

  useEffect(() => {
    axios.get("http://localhost:3001/peers").then((res) => setNodes(res.data));
  }, []);

  return (
    <Container className="flex justify-center items-center">
      <div className=" ">
        <h1 className="text-xl font-bold">Peer Network</h1>
        <ul className="mt-4">
          {nodes.map((n, i) => (
            <a key={i} href={`/details?ip=${encodeURIComponent(n.ip)}`}>
              <li key={i} className="p-2 border">
                {n.name} - {n.ip}
              </li>
            </a>
          ))}
        </ul>
      </div>
    </Container>
  );
}

export default Dashboard;
