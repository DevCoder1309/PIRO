# Resource Provisioning using Docker Contexts and HTTP Connect

## Overview
This guide provides a step-by-step approach to provisioning and managing Docker resources on a remote machine using **Docker contexts** and **HTTP connection**.

## Steps to Enable Remote Docker Provisioning

### Step 1: Configure Docker Daemon
Edit the Docker daemon configuration file to enable remote access:

```sh
sudo nano /etc/docker/daemon.json
```

Add the following configuration:

```json
{
    "hosts": [
        "tcp://0.0.0.0:2375",
        "fd://"
    ]
}
```

Save and exit the file.

### Step 2: Modify Docker Service File
Edit the existing `dockerd` systemd service file:

```sh
sudo nano /lib/systemd/system/docker.service
```

Locate the `[Service]` section and remove the following line:

```sh
-H fd://
```

### Step 3: Restart Docker Services
After making the changes, restart the necessary services:

```sh
sudo systemctl daemon-reload
sudo systemctl restart docker
```

### Step 4: Create a Docker Context
On your local machine, create a Docker context pointing to the remote host:

```sh
docker context create <context_name> --docker "host=tcp://<remote_ip>:2375"
```

### Step 5: Use the Remote Context
Switch to the newly created Docker context to interact with the remote Docker engine:

```sh
docker context use <context_name>
```

### Step 6: Provision Docker Resources Remotely
Once the context is set, you can perform Docker operations on the remote machine as if they were local:

- **Build a Docker Image Remotely**
  ```sh
  docker build -t my_image .
  ```

- **Run a Container on the Remote Machine**
  ```sh
  docker run -d --name my_container my_image
  ```
