#!/usr/bin/env node
/*
 * Simple MCP stdio <-> WebSocket bridge for RooCode.
 *
 * Usage:
 *   node scripts/mcp-stdio-bridge.js --url ws://localhost:3001
 *
 * Roo will launch this as a command-based MCP server (stdio). The bridge
 * forwards JSON-RPC messages between stdio and the upstream WebSocket MCP server.
 */

const WebSocket = require('ws');

function parseArgs(argv) {
  const args = { url: 'ws://localhost:3001' };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if ((a === '--url' || a === '-u') && argv[i + 1]) {
      args.url = argv[++i];
    }
  }
  return args;
}

const { url } = parseArgs(process.argv);

let ws;
let stdinBuffer = Buffer.alloc(0);
let isClosed = false;
const pendingOutbound = [];
let reconnectTimer = null;
let clientInitializedRequested = false;

function writeFramed(jsonText) {
  try {
    const text = typeof jsonText === 'string' ? jsonText : JSON.stringify(jsonText);
    const len = Buffer.byteLength(text, 'utf8');
    process.stdout.write(`Content-Length: ${len}\r\nContent-Type: application/json; charset=utf-8\r\n\r\n`);
    process.stdout.write(text);
  } catch (_) {
    // ignore
  }
}

function frameAndWriteMaybeMany(rawText) {
  // Some servers batch newline-delimited; try to split safe
  const parts = rawText
    .split(/\r?\n/) // split on newlines
    .map(s => s.trim())
    .filter(Boolean);
  if (parts.length <= 1) {
    writeFramed(rawText);
    return;
  }
  for (const p of parts) {
    writeFramed(p);
  }
}

function connect() {
  // Accept common JSON-RPC/MCP subprotocols if required by upstream
  const subprotocols = ['jsonrpc', 'mcp', 'mcp-jsonrpc', 'vscode-jsonrpc'];
  ws = new WebSocket(url, subprotocols);

  ws.on('open', () => {
    // Flush any queued messages
    while (pendingOutbound.length > 0 && ws.readyState === WebSocket.OPEN) {
      const msg = pendingOutbound.shift();
      try { ws.send(msg); } catch (_) {}
    }
  });

  ws.on('message', (data) => {
    try {
      const text = Buffer.isBuffer(data) ? data.toString('utf8') : String(data);
      // Suppress unsolicited pre-initialize notifications from upstream
      try {
        const obj = JSON.parse(text);
        const isNotification = obj && typeof obj === 'object' && obj.method && obj.id === undefined;
        if (!clientInitializedRequested && isNotification) {
          // Drop until client sends initialize
          return;
        }
      } catch (_) {
        // If it's not valid JSON, forward as-is
      }
      frameAndWriteMaybeMany(text);
    } catch (_) {
      // ignore
    }
  });

  ws.on('close', (code, reason) => {
    if (isClosed) return;
    process.stderr.write(`WebSocket closed: ${code} ${reason || ''}\n`);
    scheduleReconnect();
  });

  ws.on('error', (err) => {
    process.stderr.write(`WebSocket error: ${err.message}\n`);
    // let close handler trigger reconnect
  });
}

function scheduleReconnect() {
  if (reconnectTimer || isClosed) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    try { if (ws && ws.readyState !== WebSocket.OPEN) ws.terminate(); } catch (_) {}
    connect();
  }, 1000);
}

// Read stdio JSON-RPC lines and forward to WS
process.stdin.on('data', (chunk) => {
  const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk), 'utf8');
  stdinBuffer = Buffer.concat([stdinBuffer, buf]);
  parseAndForwardFromBuffer();
});
process.stdin.resume();

function parseAndForwardFromBuffer() {
  while (true) {
    // Find header separator as bytes
    let sepIndex = indexOfBuffer(stdinBuffer, Buffer.from('\r\n\r\n'));
    let sepLen = 4;
    if (sepIndex === -1) {
      sepIndex = indexOfBuffer(stdinBuffer, Buffer.from('\n\n'));
      sepLen = 2;
    }
    if (sepIndex === -1) return; // need more

    const headerBuf = stdinBuffer.subarray(0, sepIndex);
    const remaining = stdinBuffer.subarray(sepIndex + sepLen);

    // Parse headers
    const headerText = headerBuf.toString('utf8');
    let contentLength = null;
    for (const line of headerText.split(/\r?\n/)) {
      const m = /Content-Length:\s*(\d+)/i.exec(line);
      if (m) { contentLength = parseInt(m[1], 10); break; }
    }
    if (contentLength == null) {
      // Malformed; drop header and continue
      stdinBuffer = remaining;
      continue;
    }

    if (remaining.length < contentLength) return; // wait for more body

    const body = remaining.subarray(0, contentLength);
    stdinBuffer = remaining.subarray(contentLength);
    forwardToWS(body.toString('utf8'));
  }
}

function indexOfBuffer(buf, search) {
  if (typeof buf.indexOf === 'function') return buf.indexOf(search);
  // Fallback simple scan
  for (let i = 0; i <= buf.length - search.length; i++) {
    let match = true;
    for (let j = 0; j < search.length; j++) {
      if (buf[i + j] !== search[j]) { match = false; break; }
    }
    if (match) return i;
  }
  return -1;
}

function forwardToWS(bodyText) {
  try {
    // Detect client initialize request to allow upstream notifications after
    try {
      const obj = JSON.parse(typeof bodyText === 'string' ? bodyText : String(bodyText));
      if (obj && obj.method === 'initialize') {
        clientInitializedRequested = true;
      }
    } catch (_) {}

    if (ws && ws.readyState === WebSocket.OPEN) {
      // Ensure it is a string
      const text = typeof bodyText === 'string' ? bodyText : String(bodyText);
      ws.send(text);
    } else {
      const text = typeof bodyText === 'string' ? bodyText : String(bodyText);
      pendingOutbound.push(text);
    }
  } catch (_) {
    // ignore
  }
}

process.stdin.on('end', () => {
  isClosed = true;
  try { ws && ws.close(); } catch (_) {}
  process.exit(0);
});

process.on('SIGINT', () => {
  isClosed = true;
  try { ws && ws.close(); } catch (_) {}
  process.exit(0);
});

// Start
connect();


