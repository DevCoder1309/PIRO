const express = require('express')
const axios = require('axios')
const cors = require('cors')
const os = require("os");
const app = express();
app.use(express.json());
app.use(cors()); 

const PORT = process.env.PORT || 3001;
const NODE_ID =
  process.env.NODE_ID || `Node_${Math.floor(Math.random() * 1000)}`;
const SELF_IP = `http://localhost:${PORT}`;
let knownPeers = new Set();
let bootstrapNodes = process.env.BOOTSTRAP_NODES
  ? process.env.BOOTSTRAP_NODES.split(",")
  : [];

async function register() {
  for (let i = 0; i < 2; i++) {
    if (bootstrapNodes.length > 0) {
      let randomNode =
        bootstrapNodes[Math.floor(Math.random() * bootstrapNodes.length)];
      try {
        await axios.post(`${randomNode}/register`, {
          name: NODE_ID,
          ip: SELF_IP,
        });
      } catch {}
    }
  }
}

app.post("/register", (req, res) => {
  let { name, ip } = req.body;
   console.log(`Registered: ${name} at ${ip}`);
  knownPeers.add(JSON.stringify({ name, ip }));
  res.json({ message: "Registered" });
});

app.get("/details", (req, res) => {
  const osType = os.platform();
  const freeMemory = (os.freemem() / 1024 / 1024 / 1024).toFixed(2); 
  const totalMemory = (os.totalmem() / 1024 / 1024 / 1024).toFixed(2);
  const cpuCores = os.cpus().length;
  const cpuModel = os.cpus()[0].model;
  const uptime = os.uptime(); 

  res.json({
    os: osType,
    freeMemoryGB: freeMemory,
    totalMemoryGB: totalMemory,
    cpuCores,
    cpuModel,
    uptimeSeconds: uptime,
  });
});

app.get("/peers", async (req, res) => {
  let allPeers = new Set(knownPeers);
  for (let peer of [...knownPeers]) {
    let { ip } = JSON.parse(peer);
    try {
      let { data } = await axios.get(`${ip}/peers`);
      data.forEach((p) => allPeers.add(JSON.stringify(p)));
    } catch {}
  }
  res.json([...allPeers].map((p) => JSON.parse(p)));
});

app.listen(PORT, async () => {
  console.log(`Node ${NODE_ID} running on port ${PORT}`);
  await register();
});
