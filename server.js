"use strict";

const crypto = require("crypto");
const fs = require("fs");
const http = require("http");
const net = require("net");
const path = require("path");
const { URL } = require("url");

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 8080);
const SFS_PORT = Number(process.env.SFS_PORT || 9339);
const BASE_PATH = normalizeBasePath(process.env.BASE_PATH || "");
const ENABLE_TCP = process.env.ENABLE_TCP !== "0";
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, "data");
const ACCOUNTS_FILE = path.join(DATA_DIR, "accounts.json");
const MAX_BODY_BYTES = Number(process.env.MAX_BODY_BYTES || 1024 * 1024);
const MAX_SOCKET_BUFFER_BYTES = Number(process.env.MAX_SOCKET_BUFFER_BYTES || 1024 * 1024);

const rooms = [
  { id: 1, name: "Lobby", maxUsers: 200 },
  { id: 2, name: "Tree House", maxUsers: 200 },
  { id: 3, name: "Petsylvania", maxUsers: 200 },
  { id: 4, name: "Uptown", maxUsers: 200 },
  { id: 5, name: "Game Dome", maxUsers: 200 },
  { id: 6, name: "Superopolis", maxUsers: 200 },
  { id: 7, name: "Starport", maxUsers: 200 }
];
const roomStates = new Map(rooms.map((room) => [room.id, { ...room, clients: new Set() }]));

let nextUserId = 1;
const accountStore = loadAccountStore();
nextUserId = Math.max(nextUserId, accountStore.nextAccountId);

const server = http.createServer(async (req, res) => {
  try {
    const requestURL = safeURL(req);
    const pathname = stripBasePath(decodeURIComponent(requestURL.pathname));

    if (req.method === "GET" && pathname === "/healthz") {
      sendJson(res, 200, {
        ok: true,
        rooms: Array.from(roomStates.values()).map((room) => ({
          id: room.id,
          name: room.name,
          users: room.clients.size
        }))
      });
      return;
    }

    if (!["GET", "HEAD", "POST"].includes(req.method)) {
      send(res, 405, "Method not allowed\n", {
        "allow": "GET, HEAD, POST",
        "content-type": "text/plain"
      });
      return;
    }

    if (req.method === "POST" && pathname === "/virtualworld/RemoteService") {
      const body = await readBody(req);
      const reply = handleRemoting(body);
      send(res, 200, reply, {
        "content-type": "application/x-amf",
        "cache-control": "no-store"
      });
      return;
    }

    if (pathname === "/crossdomain.xml") {
      send(res, 200, flashPolicy(), { "content-type": "application/xml" });
      return;
    }

    serveStatic(pathname, res);
  } catch (error) {
    console.error("[http:error]", error.message);
    if (!res.headersSent) {
      const status = error.statusCode || 500;
      send(res, status, `${status === 500 ? "Internal server error" : error.message}\n`, { "content-type": "text/plain" });
    } else {
      res.destroy(error);
    }
  }
});

server.on("upgrade", (req, socket) => {
  let pathname = "";
  try {
    const requestURL = safeURL(req);
    pathname = stripBasePath(decodeURIComponent(requestURL.pathname));
  } catch (error) {
    console.warn("[ws:upgrade:error]", error.message);
    socket.destroy();
    return;
  }

  if (pathname !== "/socket") {
    socket.destroy();
    return;
  }

  acceptWebSocket(req, socket);
});

server.listen(PORT, () => {
  console.log(`McWorld server listening on http://localhost:${PORT}${BASE_PATH || "/"}`);
});
server.on("error", (error) => {
  console.error("[server:error]", error.message);
  process.exitCode = 1;
});

if (ENABLE_TCP) {
  const tcpServer = net.createServer((socket) => {
    const client = new SmartFoxStub((data) => safeSocketWrite(socket, data), () => socket.destroy());
    socket.on("data", (chunk) => client.receive(chunk));
    socket.on("close", () => client.close());
    socket.on("error", (error) => console.warn("[tcp:error]", error.message));
  });

  tcpServer.listen(SFS_PORT, () => {
    console.log(`SmartFox TCP stub listening on port ${SFS_PORT}`);
  });
  tcpServer.on("error", (error) => {
    console.error("[tcp-server:error]", error.message);
  });
}

process.on("unhandledRejection", (error) => {
  console.error("[process:unhandledRejection]", error?.stack || error);
});

process.on("uncaughtException", (error) => {
  console.error("[process:uncaughtException]", error?.stack || error);
  process.exitCode = 1;
});

function safeURL(req) {
  try {
    return new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  } catch {
    const error = new Error("Bad request URL");
    error.statusCode = 400;
    throw error;
  }
}

function normalizeBasePath(value) {
  if (!value || value === "/") return "";
  return `/${value.replace(/^\/+|\/+$/g, "")}`;
}

function stripBasePath(pathname) {
  if (BASE_PATH && pathname.startsWith(`${BASE_PATH}/`)) {
    return pathname.slice(BASE_PATH.length) || "/";
  }
  if (BASE_PATH && pathname === BASE_PATH) return "/";
  return pathname;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    let rejected = false;

    req.on("data", (chunk) => {
      if (rejected) return;
      total += chunk.length;
      if (total > MAX_BODY_BYTES) {
        rejected = true;
        const error = new Error("Request body too large");
        error.statusCode = 413;
        req.pause();
        reject(error);
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (!rejected) resolve(Buffer.concat(chunks));
    });
    req.on("error", (error) => {
      if (!rejected) reject(error);
    });
  });
}

function serveStatic(pathname, res) {
  let filePath = pathname === "/" ? "/index.html" : pathname;
  filePath = path.normalize(filePath).replace(/^(\.\.[/\\])+/, "");
  const absolute = path.join(ROOT, filePath);

  if (!absolute.startsWith(ROOT)) {
    send(res, 403, "Forbidden\n", { "content-type": "text/plain" });
    return;
  }

  fs.stat(absolute, (statError, stat) => {
    if (statError || !stat.isFile()) {
      send(res, 404, "Not found\n", { "content-type": "text/plain" });
      return;
    }

    res.writeHead(200, {
      "content-type": contentType(absolute),
      "content-length": stat.size,
      "cache-control": "no-cache"
    });
    const stream = fs.createReadStream(absolute);
    stream.on("error", (error) => {
      console.warn("[static:error]", error.message);
      if (!res.headersSent) send(res, 500, "Internal server error\n", { "content-type": "text/plain" });
      else res.destroy(error);
    });
    stream.pipe(res);
  });
}

function send(res, status, body, headers) {
  const buffer = Buffer.isBuffer(body) ? body : Buffer.from(String(body));
  if (res.headersSent || res.destroyed) return;
  res.writeHead(status, {
    "content-length": buffer.length,
    ...headers
  });
  res.end(buffer);
}

function sendJson(res, status, value) {
  send(res, status, `${JSON.stringify(value)}\n`, { "content-type": "application/json; charset=utf-8" });
}

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return {
    ".html": "text/html; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".xml": "application/xml; charset=utf-8",
    ".swf": "application/vnd.adobe.flash.movie",
    ".mp3": "audio/mpeg",
    ".json": "application/json; charset=utf-8",
    ".md": "text/markdown; charset=utf-8"
  }[ext] || "application/octet-stream";
}

function flashPolicy() {
  return [
    '<?xml version="1.0"?>',
    '<cross-domain-policy>',
    '  <allow-access-from domain="*" to-ports="*" />',
    '</cross-domain-policy>'
  ].join("\n");
}

class SmartFoxStub {
  constructor(sendBytes, closeConnection = () => {}) {
    this.id = nextUserId++;
    this.name = `Guest${this.id}`;
    this.buffer = "";
    this.sendBytes = sendBytes;
    this.closeConnection = closeConnection;
    this.roomId = null;
    this.userVars = {};
    this.closed = false;
  }

  receive(chunk) {
    if (this.closed) return;
    this.buffer += chunk.toString("utf8");

    if (this.buffer.length > MAX_SOCKET_BUFFER_BYTES) {
      console.warn("[sfs:error] closing oversized socket buffer", this.id);
      this.close();
      this.closeConnection();
      return;
    }

    while (this.buffer.includes("\0")) {
      const index = this.buffer.indexOf("\0");
      const packet = this.buffer.slice(0, index);
      this.buffer = this.buffer.slice(index + 1);
      try {
        this.handle(packet.trim());
      } catch (error) {
        console.warn("[sfs:packet:error]", error.message);
        this.send(errorMessage(this.roomId || 0, error.message));
      }
    }
  }

  handle(packet) {
    if (!packet) return;

    console.log("[sfs:in]", packet);

    if (packet.includes("<policy-file-request")) {
      this.send(flashPolicy());
      return;
    }

    const action = attr(packet, "action");
    const room = Number(attr(packet, "r") || 0);

    if (!action && !packet.includes("<policy-file-request")) {
      this.send(errorMessage(room || this.roomId || 0, "Unknown or malformed packet"));
      return;
    }

    if (action === "verChk") {
      this.send("<msg t='sys'><body action='apiOK' r='0'></body></msg>");
      return;
    }

    if (action === "login") {
      this.name = cdata(packet, "nick") || this.name;
      this.send(`<msg t='sys'><body action='logOK' r='0'><login id='${this.id}' mod='0' n='${escapeXml(this.name)}'/></body></msg>`);
      this.send(roomListMessage());
      this.send("<msg t='sys'><body action='bList' r='0'><bList></bList></body></msg>");
      return;
    }

    if (action === "getRmList") {
      this.send(roomListMessage());
      return;
    }

    if (action === "joinRoom") {
      const roomId = Number(attr(packet, "id") || room || 1);
      if (!roomStates.has(roomId)) {
        this.send(joinKoMessage(roomId, "Requested room does not exist"));
        return;
      }
      this.joinRoom(roomId);
      return;
    }

    if (action === "leaveRoom") {
      this.leaveRoom();
      return;
    }

    if (action === "createRoom") {
      this.send(`<msg t='sys'><body action='createRoom' r='${room || this.roomId || 1}'><room id='${this.roomId || 1}' /></body></msg>`);
      return;
    }

    if (action === "setUvars") {
      const vars = parseVars(packet);
      this.userVars = { ...this.userVars, ...vars };
      const roomId = this.roomId || room || 1;
      this.broadcastToRoom(userVarsUpdateMessage(roomId, this), { includeSelf: true });
      return;
    }

    if (action === "pubMsg") {
      const roomId = this.roomId || room || 1;
      this.broadcastToRoom(publicMessage(roomId, this.id, cdata(packet, "txt")), { includeSelf: true });
      return;
    }

    if (action === "xtReq") {
      const roomId = this.roomId || room || 1;
      this.broadcastToRoom(extensionEchoMessage(roomId, packet, this.id), { includeSelf: true });
      return;
    }

    console.log("[sfs:unhandled]", action || packet.slice(0, 80));
    this.send(errorMessage(room || this.roomId || 0, `Unhandled action: ${action || "unknown"}`));
  }

  send(xml) {
    if (this.closed) return;
    console.log("[sfs:out]", xml);
    try {
      this.sendBytes(Buffer.from(`${xml}\0`, "utf8"));
    } catch (error) {
      console.warn("[sfs:send:error]", error.message);
      this.close();
    }
  }

  joinRoom(roomId) {
    const state = roomStates.get(roomId) || roomStates.get(1);
    if (!state) return;

    this.leaveRoom(false);
    this.roomId = state.id;
    state.clients.add(this);
    this.send(joinOkMessage(state.id, this));
    this.broadcastToRoom(userEnterRoomMessage(state.id, this), { includeSelf: false });
    this.broadcastUserCount(state.id);
  }

  leaveRoom(sendOwnLeave = true) {
    if (!this.roomId) return;

    const oldRoomId = this.roomId;
    const state = roomStates.get(oldRoomId);
    this.roomId = null;

    if (state) {
      state.clients.delete(this);
      this.broadcastToRoom(userGoneMessage(oldRoomId, this.id), { roomId: oldRoomId, includeSelf: false });
      this.broadcastUserCount(oldRoomId);
    }

    if (sendOwnLeave) {
      this.send(`<msg t='sys'><body action='leaveRoom' r='${oldRoomId}'></body></msg>`);
    }
  }

  close() {
    if (this.closed) return;
    this.leaveRoom(false);
    this.closed = true;
  }

  broadcastToRoom(xml, options = {}) {
    const roomId = options.roomId || this.roomId;
    const state = roomStates.get(roomId);
    if (!state) return;

    for (const client of state.clients) {
      if (!options.includeSelf && client === this) continue;
      client.send(xml);
    }
  }

  broadcastUserCount(roomId) {
    const state = roomStates.get(roomId);
    if (!state) return;
    const xml = userCountMessage(roomId, state.clients.size);
    for (const client of state.clients) client.send(xml);
  }
}

function safeSocketWrite(socket, data) {
  if (socket.destroyed || !socket.writable) return;
  socket.write(data, (error) => {
    if (error) console.warn("[socket:write:error]", error.message);
  });
}

function roomListMessage() {
  const body = rooms.map((room) => {
    const state = roomStates.get(room.id);
    const userCount = state ? state.clients.size : 0;
    return [
      `<rm id='${room.id}' priv='0' temp='0' game='0' ucnt='${userCount}' maxu='${room.maxUsers}' spec='0' maxs='0'>`,
      `<name><![CDATA[${room.name}]]></name>`,
      "<vars></vars>",
      "</rm>"
    ].join("");
  }).join("");

  return `<msg t='sys'><body action='rmList' r='-1'><rmList>${body}</rmList></body></msg>`;
}

function joinOkMessage(roomId, currentClient) {
  const state = roomStates.get(roomId);
  const users = Array.from(state?.clients || [currentClient]).map(userXml).join("");

  return [
    `<msg t='sys'><body action='joinOK' r='${roomId}'>`,
    `<rm id='${roomId}' priv='0' temp='0' game='0' ucnt='${state?.clients.size || 1}' maxu='200' spec='0' maxs='0'>`,
    `<name><![CDATA[${roomName(roomId)}]]></name>`,
    "<vars></vars>",
    "<uLs>",
    users,
    "</uLs>",
    "</rm>",
    `<pid id='${currentClient.id}'/>`,
    "</body></msg>"
  ].join("");
}

function userXml(client) {
  return `<u i='${client.id}' m='0' s='0' p='0'><n><![CDATA[${client.name}]]></n>${varsXml(client.userVars)}</u>`;
}

function userEnterRoomMessage(roomId, client) {
  return `<msg t='sys'><body action='uER' r='${roomId}'>${userXml(client)}</body></msg>`;
}

function userGoneMessage(roomId, userId) {
  return `<msg t='sys'><body action='userGone' r='${roomId}'><user id='${userId}' /></body></msg>`;
}

function userCountMessage(roomId, count) {
  return `<msg t='sys'><body action='uCount' r='${roomId}'><uCnt r='${roomId}' u='${count}' s='0' /></body></msg>`;
}

function joinKoMessage(roomId, reason) {
  return `<msg t='sys'><body action='joinKO' r='${roomId || 0}'><error><![CDATA[${safeCdata(reason)}]]></error></body></msg>`;
}

function errorMessage(roomId, reason) {
  return `<msg t='sys'><body action='error' r='${roomId || 0}'><txt><![CDATA[${safeCdata(reason)}]]></txt></body></msg>`;
}

function userVarsUpdateMessage(roomId, client) {
  return `<msg t='sys'><body action='uVarsUpdate' r='${roomId}'><user id='${client.id}' />${varsXml(client.userVars)}</body></msg>`;
}

function publicMessage(roomId, userId, text) {
  return `<msg t='sys'><body action='pubMsg' r='${roomId}'><user id='${userId}' /><txt><![CDATA[${safeCdata(text)}]]></txt></body></msg>`;
}

function extensionEchoMessage(roomId, packet, userId) {
  const command = cdata(packet, "cmd") || "xt";
  const params = cdata(packet, "param") || "";
  return [
    `<msg t='xt'><body action='xtRes' r='${roomId}'>`,
    `<dataObj><var n='userId' t='n'>${userId}</var><var n='cmd' t='s'><![CDATA[${safeCdata(command)}]]></var>`,
    `<var n='param' t='s'><![CDATA[${safeCdata(params || packet)}]]></var></dataObj>`,
    "</body></msg>"
  ].join("");
}

function parseVars(xml) {
  const vars = {};
  const pattern = /<var\s+([^>]*)>(?:<!\[CDATA\[([\s\S]*?)\]\]>|([\s\S]*?))<\/var>/g;
  let match;

  while ((match = pattern.exec(xml))) {
    const attrs = match[1];
    const name = attr(attrs, "n") || attr(attrs, "name");
    if (!name) continue;
    vars[name] = {
      type: attr(attrs, "t") || "s",
      value: match[2] ?? match[3] ?? ""
    };
  }

  return vars;
}

function varsXml(vars) {
  const body = Object.entries(vars || {}).map(([name, item]) => {
    const value = typeof item === "object" && item !== null ? item.value : item;
    const type = typeof item === "object" && item !== null ? item.type || "s" : "s";
    return `<var n='${escapeXml(name)}' t='${escapeXml(type)}'><![CDATA[${safeCdata(value)}]]></var>`;
  }).join("");

  return `<vars>${body}</vars>`;
}

function safeCdata(value) {
  return String(value ?? "").replace(/\]\]>/g, "]]]]><![CDATA[>");
}

function roomName(id) {
  return (rooms.find((room) => room.id === id) || rooms[0]).name;
}

function attr(xml, name) {
  const match = xml.match(new RegExp(`${name}=['"]([^'"]*)['"]`));
  return match ? match[1] : "";
}

function cdata(xml, tag) {
  const match = xml.match(new RegExp(`<${tag}>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*</${tag}>`));
  return match ? match[1] : "";
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function acceptWebSocket(req, socket) {
  const key = req.headers["sec-websocket-key"];
  if (!key) {
    socket.destroy();
    return;
  }

  const accept = crypto
    .createHash("sha1")
    .update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
    .digest("base64");

  socket.write([
    "HTTP/1.1 101 Switching Protocols",
    "Upgrade: websocket",
    "Connection: Upgrade",
    `Sec-WebSocket-Accept: ${accept}`,
    "\r\n"
  ].join("\r\n"));

  const client = new SmartFoxStub((data) => writeWebSocketFrame(socket, data), () => socket.destroy());
  let buffer = Buffer.alloc(0);

  socket.on("data", (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    if (buffer.length > MAX_SOCKET_BUFFER_BYTES) {
      console.warn("[ws:error] closing oversized frame buffer");
      socket.destroy();
      return;
    }

    let parsed;

    try {
      while ((parsed = readWebSocketFrame(buffer))) {
      buffer = buffer.slice(parsed.bytesRead);

      if (parsed.opcode === 8) {
        socket.end();
        return;
      }

      if (parsed.opcode === 1 || parsed.opcode === 2) {
        client.receive(parsed.payload);
      }
      }
    } catch (error) {
      console.warn("[ws:frame:error]", error.message);
      socket.destroy();
    }
  });

  socket.on("error", (error) => console.warn("[ws:error]", error.message));
  socket.on("close", () => client.close());
}

function readWebSocketFrame(buffer) {
  if (buffer.length < 2) return null;

  const opcode = buffer[0] & 0x0f;
  const masked = (buffer[1] & 0x80) !== 0;
  let length = buffer[1] & 0x7f;
  let offset = 2;

  if (length === 126) {
    if (buffer.length < offset + 2) return null;
    length = buffer.readUInt16BE(offset);
    offset += 2;
  } else if (length === 127) {
    if (buffer.length < offset + 8) return null;
    const high = buffer.readUInt32BE(offset);
    const low = buffer.readUInt32BE(offset + 4);
    length = high * 2 ** 32 + low;
    offset += 8;
  }

  const maskLength = masked ? 4 : 0;
  if (buffer.length < offset + maskLength + length) return null;
  if (!masked) throw new Error("Client WebSocket frame was not masked");

  let mask;
  if (masked) {
    mask = buffer.subarray(offset, offset + 4);
    offset += 4;
  }

  const payload = Buffer.from(buffer.subarray(offset, offset + length));
  if (masked) {
    for (let index = 0; index < payload.length; index++) {
      payload[index] ^= mask[index % 4];
    }
  }

  return { opcode, payload, bytesRead: offset + length };
}

function writeWebSocketFrame(socket, payload) {
  if (socket.destroyed || !socket.writable) return;
  const length = payload.length;
  let header;

  if (length < 126) {
    header = Buffer.from([0x82, length]);
  } else if (length < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x82;
    header[1] = 126;
    header.writeUInt16BE(length, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x82;
    header[1] = 127;
    header.writeUInt32BE(0, 2);
    header.writeUInt32BE(length, 6);
  }

  socket.write(Buffer.concat([header, payload]), (error) => {
    if (error) console.warn("[ws:write:error]", error.message);
  });
}

function handleRemoting(body) {
  if (!body || body.length < 6) {
    return encodeAmfEnvelope([{ response: "/1/onResult", value: accountResponse("Success", ensureDefaultAccount("Guest"), "Guest") }]);
  }

  try {
    const request = decodeAmfEnvelope(body);
    console.log("[amf:in]", request.bodies.map((item) => ({
      target: item.target,
      response: item.response,
      command: summarizeCommand(item.value)
    })));
    return encodeAmfEnvelope(request.bodies.map((item) => ({
      response: `${item.response || ""}/onResult`,
      value: handleRemotingCommand(item.value)
    })));
  } catch (error) {
    console.warn("[amf:error]", error.message);
    return encodeAmfEnvelope([{ response: "/1/onResult", value: accountResponse("Success", ensureDefaultAccount("Guest"), "Guest") }]);
  }
}

function summarizeCommand(value) {
  if (!value) return null;
  if (Array.isArray(value)) return value.map(summarizeCommand);
  if (typeof value === "object") {
    return value.className || value.command || value.name || Object.keys(value).slice(0, 8).join(",");
  }
  return value;
}

function handleRemotingCommand(command) {
  const commandName = getCommandName(command);
  const username = normalizeUsername(
    findValue(command, "username") ||
    findValue(command, "oldUsername") ||
    findValue(command, "userName") ||
    findValue(command, "screenName")
  );
  const password = String(findValue(command, "password") || findValue(command, "oldPassword") || "");

  console.log("[account:command]", commandName || "UnknownCommand", username || "(no username)");

  if (commandName.endsWith("UsernameValidationCommand")) {
    return accountResponse(username && !findAccount(username) ? "Success" : "Duplicate_Visitor", findAccount(username), username);
  }

  if (commandName.endsWith("LoginValidationCommand") || commandName.endsWith("LoginCommand")) {
    const account = findAccount(username);
    if (!account) return accountResponse("AccountNotFound", null, username);
    if (!verifyPassword(account, password)) return accountResponse("LoginFailed", account, username);
    account.lastLogin = new Date().toISOString();
    saveAccountStore(accountStore);
    return accountResponse("Success", account, username);
  }

  if (commandName.endsWith("RegisterCommand") || commandName.endsWith("UpdateUsernamePasswordCommand")) {
    const newUsername = normalizeUsername(findValue(command, "newUsername") || username);
    const newPassword = String(findValue(command, "newPassword") || password || "password");
    const created = createAccount(newUsername, newPassword);
    return accountResponse(created.created ? "Success" : "Duplicate_Visitor", created.account, newUsername);
  }

  if (commandName.endsWith("RegisterAnonymousCommand")) {
    const created = createAccount(`Guest${accountStore.nextAccountId}`, randomToken(8));
    return accountResponse("Success", created.account, created.account.username);
  }

  if (commandName.endsWith("UpdatePasswordCommand")) {
    const account = findAccount(username);
    if (!account) return accountResponse("AccountNotFound", null, username);
    if (password && !verifyPassword(account, password)) return accountResponse("LoginFailed", account, username);
    setPassword(account, String(findValue(command, "newPassword") || "password"));
    account.lastUpdate = new Date().toISOString();
    saveAccountStore(accountStore);
    return accountResponse("Success", account, username);
  }

  if (commandName.endsWith("UpdateUsernameCommand")) {
    const account = findAccount(username);
    const newUsername = normalizeUsername(findValue(command, "newUsername"));
    if (!account) return accountResponse("AccountNotFound", null, username);
    if (!newUsername || findAccount(newUsername)) return accountResponse("Duplicate_Visitor", account, username);
    delete accountStore.accounts[account.username.toLowerCase()];
    account.username = newUsername;
    account.lastUpdate = new Date().toISOString();
    accountStore.accounts[account.username.toLowerCase()] = account;
    saveAccountStore(accountStore);
    return accountResponse("Success", account, newUsername);
  }

  const account = findAccount(username) || ensureDefaultAccount(username || "Guest");
  return accountResponse("Success", account, account.username);
}

function getCommandName(value) {
  if (!value || typeof value !== "object") return "";
  if (typeof value.className === "string") return value.className;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = getCommandName(item);
      if (found) return found;
    }
  } else {
    for (const item of Object.values(value)) {
      const found = getCommandName(item);
      if (found) return found;
    }
  }
  return "";
}

function accountResponse(resultCode, account, fallbackUsername) {
  const now = new Date().toISOString();
  const username = account?.username || fallbackUsername || "Guest";
  const accountId = account?.accountId || 0;

  return {
    resultCode,
    sessionID: account ? account.sessionId : "",
    sessionId: account ? account.sessionId : "",
    accountId,
    username,
    userVO: {
      accountId,
      username,
      lastLogin: account?.lastLogin || now,
      lastUpdate: account?.lastUpdate || now,
      parentId: 0
    },
    points: account?.points || 0,
    inventory: account?.inventory || [],
    inventories: account?.inventory || [],
    items: [],
    achievements: account?.achievements || [],
    memberBuddyList: account?.buddies || [],
    activities: account?.activities || [],
    votes: []
  };
}

function loadAccountStore() {
  try {
    const raw = fs.readFileSync(ACCOUNTS_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return {
      nextAccountId: Number(parsed.nextAccountId || 1),
      accounts: parsed.accounts || {}
    };
  } catch {
    return { nextAccountId: 1, accounts: {} };
  }
}

function saveAccountStore(store) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(ACCOUNTS_FILE, `${JSON.stringify(store, null, 2)}\n`);
}

function normalizeUsername(value) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, 24);
}

function findAccount(username) {
  if (!username) return null;
  return accountStore.accounts[username.toLowerCase()] || null;
}

function ensureDefaultAccount(username) {
  const existing = findAccount(username);
  if (existing) return existing;
  return createAccount(username, "password").account;
}

function createAccount(username, password) {
  username = normalizeUsername(username);
  if (!username) username = `Guest${accountStore.nextAccountId}`;

  const key = username.toLowerCase();
  if (accountStore.accounts[key]) {
    return { created: false, account: accountStore.accounts[key] };
  }

  const now = new Date().toISOString();
  const account = {
    accountId: accountStore.nextAccountId++,
    username,
    sessionId: randomToken(24),
    createdAt: now,
    lastLogin: now,
    lastUpdate: now,
    points: 0,
    inventory: [],
    achievements: [],
    buddies: [],
    activities: []
  };

  setPassword(account, password || "password");
  accountStore.accounts[key] = account;
  saveAccountStore(accountStore);
  nextUserId = Math.max(nextUserId, accountStore.nextAccountId);
  return { created: true, account };
}

function setPassword(account, password) {
  account.passwordSalt = randomToken(16);
  account.passwordHash = hashPassword(password, account.passwordSalt);
}

function verifyPassword(account, password) {
  if (!account) return false;
  return account.passwordHash === hashPassword(password || "", account.passwordSalt || "");
}

function hashPassword(password, salt) {
  return crypto.createHash("sha256").update(`${salt}:${password}`).digest("hex");
}

function randomToken(bytes) {
  return crypto.randomBytes(bytes).toString("hex");
}

function findValue(value, key) {
  if (!value || typeof value !== "object") return "";
  if (Object.prototype.hasOwnProperty.call(value, key)) return value[key];
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findValue(item, key);
      if (found) return found;
    }
  } else {
    for (const item of Object.values(value)) {
      const found = findValue(item, key);
      if (found) return found;
    }
  }
  return "";
}

function decodeAmfEnvelope(buffer) {
  const reader = new AmfReader(buffer);
  const version = reader.u16();
  const headers = [];
  const headerCount = reader.u16();

  for (let index = 0; index < headerCount; index++) {
    const name = reader.utf();
    const mustUnderstand = reader.u8() !== 0;
    const length = reader.u32();
    const end = length === 0xffffffff ? buffer.length : reader.offset + length;
    const value = reader.value();
    reader.offset = Math.min(end, buffer.length);
    headers.push({ name, mustUnderstand, value });
  }

  const bodies = [];
  const bodyCount = reader.u16();
  for (let index = 0; index < bodyCount; index++) {
    const target = reader.utf();
    const response = reader.utf();
    const length = reader.u32();
    const end = length === 0xffffffff ? buffer.length : reader.offset + length;
    const value = reader.value();
    reader.offset = Math.min(end, buffer.length);
    bodies.push({ target, response, value });
  }

  return { version, headers, bodies };
}

function encodeAmfEnvelope(bodies) {
  const chunks = [u16(0), u16(0), u16(bodies.length)];

  for (const body of bodies) {
    const value = encodeAmfValue(body.value);
    chunks.push(utf(body.response || "/onResult"), utf("null"), u32(value.length), value);
  }

  return Buffer.concat(chunks);
}

class AmfReader {
  constructor(buffer) {
    this.buffer = buffer;
    this.offset = 0;
  }

  u8() {
    return this.buffer[this.offset++];
  }

  u16() {
    const value = this.buffer.readUInt16BE(this.offset);
    this.offset += 2;
    return value;
  }

  u32() {
    const value = this.buffer.readUInt32BE(this.offset);
    this.offset += 4;
    return value;
  }

  utf() {
    const length = this.u16();
    const value = this.buffer.toString("utf8", this.offset, this.offset + length);
    this.offset += length;
    return value;
  }

  longUtf() {
    const length = this.u32();
    const value = this.buffer.toString("utf8", this.offset, this.offset + length);
    this.offset += length;
    return value;
  }

  value() {
    const type = this.u8();

    if (type === 0) {
      const value = this.buffer.readDoubleBE(this.offset);
      this.offset += 8;
      return value;
    }
    if (type === 1) return this.u8() !== 0;
    if (type === 2) return this.utf();
    if (type === 3) return this.object();
    if (type === 5 || type === 6) return null;
    if (type === 8) {
      this.u32();
      return this.object();
    }
    if (type === 10) {
      const length = this.u32();
      const items = [];
      for (let index = 0; index < length; index++) items.push(this.value());
      return items;
    }
    if (type === 11) {
      const milliseconds = this.buffer.readDoubleBE(this.offset);
      this.offset += 10;
      return new Date(milliseconds).toISOString();
    }
    if (type === 12) return this.longUtf();
    if (type === 16) {
      const className = this.utf();
      const object = this.object();
      object.className = className;
      return object;
    }
    if (type === 17) {
      return null;
    }

    throw new Error(`Unsupported AMF0 type ${type} at ${this.offset - 1}`);
  }

  object() {
    const object = {};

    while (this.offset + 3 <= this.buffer.length) {
      if (this.buffer[this.offset] === 0 && this.buffer[this.offset + 1] === 0 && this.buffer[this.offset + 2] === 9) {
        this.offset += 3;
        break;
      }

      const key = this.utf();
      object[key] = this.value();
    }

    return object;
  }
}

function encodeAmfValue(value) {
  if (value === null || value === undefined) return Buffer.from([5]);
  if (typeof value === "number") {
    const buffer = Buffer.alloc(9);
    buffer[0] = 0;
    buffer.writeDoubleBE(value, 1);
    return buffer;
  }
  if (typeof value === "boolean") return Buffer.from([1, value ? 1 : 0]);
  if (typeof value === "string") return Buffer.concat([Buffer.from([2]), utf(value)]);
  if (Array.isArray(value)) {
    return Buffer.concat([Buffer.from([10]), u32(value.length), ...value.map(encodeAmfValue)]);
  }
  if (typeof value === "object") {
    const chunks = [Buffer.from([3])];
    for (const [key, item] of Object.entries(value)) {
      chunks.push(utf(key), encodeAmfValue(item));
    }
    chunks.push(Buffer.from([0, 0, 9]));
    return Buffer.concat(chunks);
  }
  return Buffer.from([5]);
}

function utf(value) {
  const body = Buffer.from(String(value), "utf8");
  return Buffer.concat([u16(body.length), body]);
}

function u16(value) {
  const buffer = Buffer.alloc(2);
  buffer.writeUInt16BE(value);
  return buffer;
}

function u32(value) {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32BE(value);
  return buffer;
}
