import { useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import "xterm/css/xterm.css";

export default function TerminalPage() {
  const terminalRef = useRef(null);
  const { containerId } = useParams();
  console.log(containerId)
  useEffect(() => {
    const term = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      theme: {
        background: "#1e1e1e",
        foreground: "#ffffff"
      }
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);
    fitAddon.fit();

    const socket = new WebSocket(`ws://localhost:5000/terminal/${containerId}`);

    socket.onopen = () => {
      term.focus();
    };

    socket.onmessage = (event) => {
      term.write(event.data);
    };

    socket.onerror = (err) => {
      console.error("WebSocket error:", err);
      term.writeln("Error: Could not connect to backend");
    };

    socket.onclose = () => {
      term.writeln("\r\n[Session closed]");
    };

    term.onData((data) => {
      socket.send(data);
    });

    const handleResize = () => {
      fitAddon.fit();
    };

    window.addEventListener("resize", handleResize);

    return () => {
      socket.close();
      term.dispose();
      window.removeEventListener("resize", handleResize);
    };
  }, [containerId]);

  return (
    <div
      ref={terminalRef}
      style={{ height: "100vh", width: "100%", backgroundColor: "#1e1e1e" }}
    />
  );
}
