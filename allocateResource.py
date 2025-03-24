import os

target_ip = "192.168.1.5" # my kali machine VM (bridged network)

os.system("docker context create arenpc --docker 'host=tcp://{target_ip}:2375'")
os.system("docker context use arenpc")
os.system("docker run -it ubuntu sh")
