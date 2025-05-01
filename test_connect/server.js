const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const Docker = require("dockerode");
const path = require("path");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const docker = new Docker({ socketPath: "//./pipe/docker_engine" });

app.use(express.static(path.join(__dirname, "public")));

wss.on("connection", async function connection(ws) {
  try {
    const container = await docker.createContainer({
      Image: "ubuntu",
      Cmd: ["/bin/bash"],
      Tty: true,
      OpenStdin: true,
      StdinOnce: false,
    });

    await container.start();

    const exec = await container.exec({
      Cmd: ["/bin/bash"],
      AttachStdin: true,
      AttachStdout: true,
      AttachStderr: true,
      Tty: true,
    });

    const stream = await exec.start({ hijack: true, stdin: true });

    // Pipe Docker container output to WebSocket
    stream.on("data", (chunk) => {
      ws.send(chunk.toString());
    });

    // Pipe WebSocket input to container
    ws.on("message", (data) => {
      stream.write(data);
    });

    ws.on("close", async () => {
      try {
        stream.end();
        await container.stop();
        await container.remove();
      } catch (err) {
        console.error("Cleanup error:", err.message);
      }
    });
  } catch (err) {
    console.error("Error:", err.message);
    ws.send(`Error: ${err.message}`);
    ws.close();
  }
});

server.listen(3000, () => {
  console.log("Visit http://localhost:3000");
});
