import React, { useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';

const Terminal = () => {
  const { containerId } = useParams();
  const terminalRef = useRef(null);
  const termInstance = useRef(null);
  const socketRef = useRef(null);
  const fitAddonRef = useRef(null);

  useEffect(() => {
    // Initialize the terminal
    const term = new XTerm({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'monospace, courier-new, courier, monospace',
      theme: {
        background: '#000000',
        foreground: '#ffffff',
        cursor: '#ffffff',
        cursorAccent: '#000000',
        selectionBackground: '#4d4d4d'
      },
      convertEol: true,
      scrollback: 1000,
      rows: 24,
      cols: 80
    });
    
    termInstance.current = term;
    
    // Create fit addon
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    fitAddonRef.current = fitAddon;
    
    // Open terminal
    term.open(terminalRef.current);
    
    // Connect to WebSocket
    const ws = new WebSocket(`ws://${window.location.hostname}:8765/${containerId}`);
    socketRef.current = ws;
    
    // Handle incoming data
    ws.onmessage = (event) => {
      term.write(event.data);
    };
    
    // Handle connection open
    ws.onopen = () => {
      // Write data to the terminal
      term.clear();
      term.writeln('Connected to container terminal...');
      term.writeln('------------------------------------------');
      
      // Fit terminal to container
      setTimeout(() => {
        fitAddon.fit();
      }, 100);
    };
    
    // Handle WebSocket errors
    ws.onerror = (error) => {
      console.error('WebSocket connection error:', error);
      term.writeln('\r\n\x1b[31mError connecting to terminal. Please try again.\x1b[0m');
    };
    
    // Handle WebSocket close
    ws.onclose = () => {
      term.writeln('\r\n\x1b[31mTerminal connection closed.\x1b[0m');
      term.writeln('\r\nReconnect by refreshing the page.');
    };
    
    // Handle user input
    term.onData(data => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    });
    
    // Handle window resize
    const handleResize = () => {
      if (fitAddonRef.current) {
        fitAddonRef.current.fit();
      }
    };
    
    window.addEventListener('resize', handleResize);
    
    // Clean up on unmount
    return () => {
      window.removeEventListener('resize', handleResize);
      
      if (socketRef.current) {
        socketRef.current.close();
      }
      
      if (termInstance.current) {
        termInstance.current.dispose();
      }
    };
  }, [containerId]);
  
  return (
    <div className="terminal-container">
      <div className="terminal-header">
        <h3>Container Terminal: {containerId}</h3>
      </div>
      <div
        ref={terminalRef}
        style={{
          width: '100%',
          height: 'calc(100vh - 80px)',
          backgroundColor: '#000',
          borderRadius: '4px',
          padding: '10px',
          overflow: 'hidden'
        }}
      />
    </div>
  );
};

export default Terminal;