const http = require("http");
const express = require("express");
const socketio = require("socket.io");
const cors = require("cors");
require("dotenv").config();

const app = express();

// Use dynamic frontend URL
const allowedOrigins = [process.env.FRONTEND_URL || "*"];
app.use(cors({
  origin: allowedOrigins,
  methods: ["GET", "POST"]
}));

const server = http.createServer(app);

const io = socketio(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"]
  }
});

let users = [];
const rooms = {};

io.on("connection", (socket) => {
  console.log(`🔌 [${socket.id.slice(0,8)}] connected`);

  socket.on("join", (name) => {
    users.push({ id: socket.id, name });
    io.emit("users", users);
    io.emit("message", { user: "admin", text: `${name} joined the chat 👋` });
    console.log("🟢 Current users:", users.map(u => u.name));
  });

  socket.on("message", (data) => io.emit("message", data));
  socket.on("fileMessage", (data) => io.emit("fileMessage", data));

  socket.on("deleteForEveryone", ({ socketMsgId }) => {
    io.emit("deleteForEveryone", { socketMsgId });
    console.log(`🗑️  [${socket.id.slice(0,8)}] deleted msg ${socketMsgId} for everyone`);
  });

  socket.on("disconnect", () => {
    console.log(`🔌 [${socket.id.slice(0,8)}] disconnected`);
    const user = users.find(u => u.id === socket.id);
    if (user) {
      users = users.filter(u => u.id !== socket.id);
      io.emit("users", users);
      io.emit("message", { user: "Admin", text: `${user.name} left the chat` });
    }

    for (const roomId in rooms) {
      const idx = rooms[roomId].indexOf(socket.id);
      if (idx !== -1) {
        rooms[roomId].splice(idx, 1);
        rooms[roomId].forEach(peerId => io.to(peerId).emit("peerLeft"));
        if (rooms[roomId].length === 0) delete rooms[roomId];
      }
    }
  });

  socket.on("joinRoom", (roomId) => {
    if (!rooms[roomId]) rooms[roomId] = [];
    if (!rooms[roomId].includes(socket.id)) {
      rooms[roomId].push(socket.id);
      socket.join(roomId);
    }
    if (rooms[roomId].length === 2) io.to(rooms[roomId][0]).emit("roomReady");
  });

  socket.on("offer",         ({ roomId, offer })     => socket.to(roomId).emit("offer",         { offer }));
  socket.on("answer",        ({ roomId, answer })    => socket.to(roomId).emit("answer",        { answer }));
  socket.on("ice-candidate", ({ roomId, candidate }) => socket.to(roomId).emit("ice-candidate", { candidate }));

  socket.on("leaveRoom", (roomId) => {
    const idx = rooms[roomId]?.indexOf(socket.id);
    if (idx > -1) { rooms[roomId].splice(idx, 1); socket.leave(roomId); }
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});