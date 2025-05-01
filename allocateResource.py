import os
import subprocess
import asyncio
import websockets
from flask import Flask, jsonify, request
import threading
import platform
import time
from flask_cors import CORS
import select
import signal
import sys

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

# Store active container information
active_containers = {}

# Check if we're on Windows
IS_WINDOWS = platform.system() == "Windows"

# Global variables for WebSocket server
websocket_server_thread = None
websocket_server_running = False
container_processes = {}

@app.route('/start_shell', methods=['POST'])
def start_shell():
    data = request.json
    instance_name = data.get("instanceName")
    target_ip = data.get("ip")
    os_image = data.get("osImage", "ubuntu")
    username = data.get("username")
    root_password = data.get("rootPassword")
    extra_users = data.get("extraUsers")
    tools = data.get("tools")
    
    # Sanitize instance name
    instance_name = ''.join(c if c.isalnum() or c in ['-', '_'] else '-' for c in instance_name)

    try:
        # Create Docker context if it doesn't exist
        try:
            subprocess.run(
                f"docker context create arenpc --docker host=tcp://{target_ip}:2375",
                shell=True, check=False
            )
        except Exception as e:
            print(f"Context creation note: {e}")
        
        # Use the context
        subprocess.run("docker context use arenpc", shell=True, check=True)
        
        # Check if container with this name already exists
        try:
            check_cmd = f"docker ps -a --filter name=^/{instance_name}$ --format \"{{{{.ID}}}}\""
            existing_container = subprocess.check_output(check_cmd, shell=True).decode('utf-8').strip()
            
            if existing_container:
                print(f"Container {instance_name} already exists with ID {existing_container}")
                
                # Check if the container is running
                status_cmd = f"docker inspect --format='{{{{.State.Running}}}}' {existing_container}"
                is_running = subprocess.check_output(status_cmd, shell=True).decode('utf-8').strip()
                
                if is_running.lower() != "true":
                    # Start the container if it's not running
                    start_cmd = f"docker start {existing_container}"
                    subprocess.run(start_cmd, shell=True, check=True)
                    print(f"Started existing container {instance_name}")
                
                container_id = existing_container
            else:
                # Create a new container with the provided name
                command = f"docker run -d -it --name {instance_name} {os_image.lower()} /bin/bash -c 'while true; do sleep 1; done'"
                container_id = subprocess.check_output(command, shell=True).decode('utf-8').strip()
                print(f"Created new container with name {instance_name}, ID: {container_id}")
        except Exception as container_error:
            print(f"Error checking/creating container: {container_error}")
            # Fallback to a truly unique name
            timestamp = int(time.time())
            fallback_name = f"{instance_name}-{timestamp}"
            command = f"docker run -d -it --name {fallback_name} {os_image.lower()} /bin/bash -c 'while true; do sleep 1; done'"
            container_id = subprocess.check_output(command, shell=True).decode('utf-8').strip()
            print(f"Created fallback container with name {fallback_name}, ID: {container_id}")
        
        # Store container information
        active_containers[container_id] = {
            "name": instance_name,
            "image": os_image,
            "ip": target_ip
        }

        # Set up users if specified
        if extra_users and not IS_WINDOWS:
            extra_users_list = extra_users.split(',')
            for user in extra_users_list:
                user = user.strip()
                if user:
                    try:
                        subprocess.run(
                            f"docker exec {container_id} useradd -m {user}",
                            shell=True, check=False
                        )
                        subprocess.run(
                            f"docker exec {container_id} sh -c \"echo {user}:{root_password} | chpasswd\"",
                            shell=True, check=False
                        )
                    except Exception as user_error:
                        print(f"Error adding user {user}: {user_error}")

        # Install tools if specified
        if tools and not IS_WINDOWS:
            tools_list = tools.split(',')
            combined_tools = " ".join(tool.strip() for tool in tools_list if tool.strip())
            if combined_tools:
                try:
                    subprocess.run(
                        f"docker exec {container_id} sh -c \"apt-get update && apt-get install -y {combined_tools}\"",
                        shell=True, check=False
                    )
                except Exception as tools_error:
                    print(f"Error installing tools: {tools_error}")

        # Start WebSocket server for this container if not already running
        start_websocket_server()

        return jsonify({
            "container_id": container_id, 
            "message": "Docker container started successfully!"
        })
    
    except Exception as e:
        print(f"Error starting container: {e}")
        return jsonify({"error": str(e)}), 500

def websocket_server_main():
    """The main function for the WebSocket server thread."""
    print("WebSocket server thread starting")
    asyncio.set_event_loop(asyncio.new_event_loop())
    loop = asyncio.get_event_loop()
    
    async def start_server():
        try:
            server = await websockets.serve(handle_websocket, "0.0.0.0", 8765)
            print("WebSocket server started successfully on port 8765")
            await asyncio.Future()  # Keep the server running until manually stopped
        except Exception as e:
            print(f"Error in WebSocket server: {e}")
    
    try:
        loop.run_until_complete(start_server())
    except Exception as e:
        print(f"Failed to start WebSocket server: {e}")
    finally:
        loop.close()
        print("WebSocket server thread terminated")

def start_websocket_server():
    """Start the WebSocket server in a separate thread if not already running."""
    global websocket_server_thread, websocket_server_running
    
    if websocket_server_thread is None or not websocket_server_thread.is_alive():
        print("Starting new WebSocket server thread")
        websocket_server_running = False
        websocket_server_thread = threading.Thread(target=websocket_server_main, daemon=True)
        websocket_server_thread.start()
        time.sleep(1)  # Give the server time to start
        websocket_server_running = True
    else:
        print("WebSocket server already running")

async def handle_websocket(websocket):
    """Initial handler for WebSocket connections."""
    # path = websocket.request.path
    print(f"New WebSocket connection on path: {websocket.request.path}")
    
    # Extract container ID from the path
    container_id = websocket.request.path.strip('/')
    if not container_id:
        print("No container ID specified in WebSocket path")
        await websocket.close(1008, "No container ID specified")
        return
    
    # Handle the terminal session
    await handle_terminal(websocket, container_id)

async def handle_terminal(websocket, container_id):
    """Handle terminal interactions for a specific container."""
    process = None
    
    try:
        # Check if container is running
        check_cmd = f"docker inspect -f '{{{{.State.Running}}}}' {container_id}"
        is_running = subprocess.check_output(check_cmd, shell=True).decode('utf-8').strip()
        
        if is_running.lower() != "true":
            print(f"Starting container {container_id}")
            subprocess.run(f"docker start {container_id}", shell=True, check=True)
        
        # Set up interactive terminal session - use bash if available
        cmd = [
            "docker", "exec", "-it", container_id,
            "/bin/bash", "-c", "export TERM=xterm-256color; cd /; exec bash"
        ]
        
        # Create process with PTY
        process = subprocess.Popen(
            cmd,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,  # Redirect stderr to stdout for simpler handling
            bufsize=0
        )
        
        container_processes[container_id] = process
        print(f"Terminal process started for container {container_id}")
        
        # Send initial prompt 
        await websocket.send(f"\r\n[Connected to container {container_id}]\r\n")
        
        # Create tasks for handling input and output
        output_task = asyncio.create_task(forward_output(websocket, process))
        input_task = asyncio.create_task(forward_input(websocket, process))
        print(output_task)
        # Wait for any task to complete
        await asyncio.gather(output_task, input_task)
            
    except Exception as e:
        print(f"Terminal error: {e}")
        try:
            await websocket.send(f"\r\nError: {str(e)}\r\n")
        except:
            pass
    finally:
        # Clean up resources
        if process and process.poll() is None:
            try:
                process.terminate()
                process.wait(timeout=2)
            except:
                try:
                    process.kill()
                except:
                    pass
        
        if container_id in container_processes:
            del container_processes[container_id]
        
        print(f"Terminal session for container {container_id} ended")

async def forward_output(websocket, process):
    """Forward output from process to websocket."""
    try:
        while process.poll() is None:
            try:
                # Check if there's data to read without blocking
                if select.select([process.stdout], [], [], 0.1)[0]:
                    output = process.stdout.read1(4096)
                    if output:
                        # Send to websocket
                        await websocket.send(output.decode('utf-8', errors='replace'))
                else:
                    await asyncio.sleep(0.05)  # Small sleep to prevent CPU hogging
            except Exception as e:
                print(f"Output forwarding error: {e}")
                break
    except asyncio.CancelledError:
        pass
    except Exception as e:
        print(f"Output forwarding task error: {e}")

async def forward_input(websocket, process):
    """Forward input from websocket to process."""
    try:
        async for message in websocket:
            if process.poll() is None:
                try:
                    # Write the input to the process
                    process.stdin.write(message.encode('utf-8'))
                    process.stdin.flush()
                except Exception as e:
                    print(f"Input forwarding error: {e}")
                    break
            else:
                # Process has terminated
                await websocket.send("\r\n[Process terminated]\r\n")
                break
    except asyncio.CancelledError:
        pass
    except Exception as e:
        print(f"Input forwarding task error: {e}")

def signal_handler(sig, frame):
    """Handle application shutdown."""
    print("Shutting down server...")
    
    # Stop all running container processes
    for container_id, process in container_processes.items():
        try:
            if process.poll() is None:
                process.terminate()
        except:
            pass
    
    sys.exit(0)

if __name__ == '__main__':
    # Register signal handlers
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    # Start the WebSocket server
    start_websocket_server()
    
    # Start the Flask app
    app.run(debug=True, host="0.0.0.0", port=5000)