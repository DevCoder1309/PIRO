import os
import pty
import asyncio
import subprocess
from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import uvicorn

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory="static"), name="static")

@app.websocket("/ws/terminal")
async def terminal_endpoint(websocket: WebSocket):
    await websocket.accept()

    container_name = "ubuntu_term"

    # Start the container if not running
    subprocess.run(["docker", "run", "-dit", "--name", container_name, "ubuntu", "bash"], stdout=subprocess.DEVNULL)

    master_fd, slave_fd = pty.openpty()

    proc = subprocess.Popen(
        ["docker", "exec", "-it", container_name, "bash"],
        stdin=slave_fd, stdout=slave_fd, stderr=slave_fd
    )
    os.close(slave_fd)

    async def read_from_pty():
        while True:
            try:
                data = os.read(master_fd, 1024).decode(errors="ignore")
                await websocket.send_text(data)
            except Exception:
                break

    async def write_to_pty():
        while True:
            try:
                data = await websocket.receive_text()
                os.write(master_fd, data.encode())
            except Exception:
                break

    await asyncio.gather(read_from_pty(), write_to_pty())
    proc.terminate()

if __name__ == "__main__":
    uvicorn.run("server:app", host="0.0.0.0", port=8000)
