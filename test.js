const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const Docker = require("dockerode");
const path = require("path");
const cors = require("cors");
const bodyParser = require("body-parser");
const util = require("util");
const exec = util.promisify(require("child_process").exec);

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const docker = new Docker({ socketPath: "//./pipe/docker_engine" });

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

app.post("/start_shell", async (req, res) => {
  let {
    instanceName,
    ip,
    osImage,
    username,
    rootPassword,
    extraUsers,
    tools,
  } = req.body;
  console.log(ip);
  ip = ip.replace(/^(https?:\/\/)?/, "").split(":")[0];
  try {
    const container = await docker.createContainer({
      Image: osImage || "ubuntu",
      name: instanceName,
      Tty: true,
      OpenStdin: true,
      Cmd: ["/bin/bash"],
      Env: [
        `ROOT_PASSWORD=${rootPassword}`,
        `EXTRA_USERS=${extraUsers}`,
        `TOOLS=${tools}`,
        `USERNAME=${username}`,
      ],
    });
    async function command() {
      const { stdout, stderr } = await exec(
        `docker context create ${instanceName} --docker host=tcp://${ip}:2375`
      );
      console.log("stdout:", stdout);
      console.log("stderr:", stderr);
    }
    async function command2() {
      const { stdout, stderr } = await exec(
        `docker context use ${instanceName}`
      );
      console.log("stdout:", stdout);
      console.log("stderr:", stderr);
    }
    await command();
    await command2();

    console.log(`Container created with ID: ${container.id.substring(0, 12)}`);

    await container.start();
    res.json({ container_id: container.id.substring(0, 12) });
  } catch (err) {
    console.error("Error launching container:", err);
    res.status(500).json({ error: err.message });
  }
});

wss.on("connection", async (ws, req) => {
  const urlParts = req.url.split("/");
  const containerId = urlParts[urlParts.length - 1];

  try {
    const container = docker.getContainer(containerId);

    const exec = await container.exec({
      Cmd: ["/bin/bash"],
      AttachStdin: true,
      AttachStdout: true,
      AttachStderr: true,
      Tty: true,
    });

    const stream = await exec.start({ hijack: true, stdin: true });

    stream.on("data", (chunk) => ws.send(chunk.toString()));
    ws.on("message", (data) => stream.write(data));

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
    console.error("WebSocket error:", err.message);
    ws.send(`Error: ${err.message}`);
    ws.close();
  }
});

server.listen(5000, () => {
  console.log("Backend running at http://localhost:5000");
});
