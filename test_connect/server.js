const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const pty = require("node-pty");
const Docker = require("dockerode");
const path = require("path");

const docker = new Docker({ socketPath: "/var/run/docker.sock" }); // Windows Docker Desktop supports this internally

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static(path.join(__dirname, "public")));

wss.on("connection", async function connection(ws) {
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

  stream.on("data", (chunk) => {
    ws.send(chunk.toString());
  });

  ws.on("message", (data) => {
    stream.write(data);
  });

  ws.on("close", () => {
    stream.end();
    container.stop().then(() => container.remove());
  });
});

server.listen(3000, () => {
  console.log("Server started at http://localhost:3000");
});
