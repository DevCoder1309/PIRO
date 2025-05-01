const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const Docker = require("dockerode");
const cors = require("cors");
const bodyParser = require("body-parser");
const shell = require('shelljs')

const app = express();
  shell.exec(
    `docker context create arenpc --docker 'host=tcp://192.168.1.5:2375'`
  );
  shell.exec(`docker context use arenpc`);
const docker = new Docker({ socketPath: "/var/run/docker.sock" });
const containers = new Map(); 

app.use(cors());
app.use(bodyParser.json());

app.post("/start_shell", async (req, res) => {
  const {
    instanceName,
    osImage,
    username,
    rootPassword,
    confirmRootPassword,
    extraUsers,
    tools,
    peerIP,
  } = req.body;
  try {
    const container = await docker.createContainer({
      Image: osImage.toLowerCase(), 
      name: instanceName,
      Tty: true,
      OpenStdin: true,
      HostConfig: {
        AutoRemove: true,
      },
      Cmd: ["/bin/sh"],
    });

    await container.start();
    containers.set(container.id, container);

    res.json({ container_id: container.id });
  } catch (err) {
    console.error("Error launching container:", err);
    res.status(500).json({ error: "Failed to launch container" });
  }
});


const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

wss.on("connection", (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const containerId = url.searchParams.get("id");
  const container = containers.get(containerId);

  if (!container) {
    ws.send("Container not found");
    ws.close();
    return;
  }

  container.exec(
    {
      Cmd: ["/bin/sh"],
      AttachStdin: true,
      AttachStdout: true,
      AttachStderr: true,
      Tty: true,
    },
    (err, exec) => {
      if (err) {
        ws.send("Error starting shell");
        ws.close();
        return;
      }

      exec.start({ hijack: true, stdin: true }, (err, stream) => {
        if (err) {
          ws.send("Failed to start exec stream");
          ws.close();
          return;
        }

        stream.on("data", (chunk) => {
          ws.send(chunk.toString());
        });

        ws.on("message", (msg) => {
          stream.write(msg);
        });

        ws.on("close", () => {
          stream.end();
        });
      });
    }
  );
});

server.listen(5001, () => {
  console.log("Server running on http://localhost:5001");
});
