const express = require('express');
const axios = require('axios');
const cors = require('cors');
const os = require("os");

const app = express();
app.use(express.json());
app.use(cors());

const PORT = process.env.PORT || 3001;
const NODE_ID = process.env.NODE_ID || `Node_${Math.floor(Math.random() * 1000)}`;
const SELF_IP = `http://${getLocalIP()}:${PORT}`;

let knownPeers = new Set();
let bootstrapNodes = process.env.BOOTSTRAP_NODES
  ? process.env.BOOTSTRAP_NODES.split(",")
  : [];

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (
        iface.family === 'IPv4' &&
        !iface.internal &&
        !iface.address.startsWith('127.') &&
        !iface.address.startsWith('169.')
      ) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

async function register() {
  for (let i = 0; i < 2; i++) {
    if (bootstrapNodes.length > 0) {
      let randomNode = bootstrapNodes[Math.floor(Math.random() * bootstrapNodes.length)];
      console.log(`Trying to register with ${randomNode}`);
      try {
        await axios.post(`${randomNode}/register`, {
          name: NODE_ID,
          ip: SELF_IP,
        });
      } catch (e) {
        console.error("Failed to register with", randomNode);
      }
    }
  }
}

app.post("/register", (req, res) => {
  const { name, ip } = req.body;
  console.log(`Registered: ${name} at ${ip}`);
  knownPeers.add(JSON.stringify({ name, ip }));
  res.json({ message: "Registered" });
});

app.get("/details", async (req, res) => {
  const queryIP = req.query.ip;

  if (queryIP && queryIP !== SELF_IP) {
    try {
      const { data } = await axios.get(`${queryIP}/details`);
      return res.json(data);
    } catch (e) {
      return res
        .status(500)
        .json({ error: "Unable to fetch remote node details" });
    }
  }

  const osType = os.platform();
  const freeMemory = (os.freemem() / 1024 / 1024 / 1024).toFixed(2);
  const totalMemory = (os.totalmem() / 1024 / 1024 / 1024).toFixed(2);
  const cpuCores = os.cpus().length;
  const cpuModel = os.cpus()[0].model;
  const uptime = os.uptime();

  res.json({
    name: NODE_ID,
    ip: SELF_IP,
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
  console.log(`Node ${NODE_ID} running at ${SELF_IP}`);
  await register();
});
