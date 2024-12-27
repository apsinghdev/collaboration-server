import express from "express";
import cors from "cors";
import * as http from "http";
import { Server } from "socket.io";
import dotenv from "dotenv";
import morgan from "morgan";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

// Log the middleware
app.use(morgan("combined"));

app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(",")
      : "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  })
);

// Simple test endpoint
app.get("/test", (req, res) => {
  res.json({ ok: true });
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});
const rooms = new Map();

const handleJoinRoom = (socket, { room_id, name }) => {
  socket.join(room_id);

  if (!rooms.has(room_id)) {
    rooms.set(room_id, new Map());
  }

  const room = rooms.get(room_id);
  room.set(socket.id, name);

  socket.emit(
    "add-existing-names",
    Array.from(room).map(([id, name]) => ({ id, name }))
  );

  socket.to(room_id).emit("add-new-name", { id: socket.id, name });

  socket.emit(
    "existing-cursor",
    Array.from(room).map((id) => ({ id }))
  );

  socket.to(room_id).emit("new-cursor", { id: socket.id });

  console.log(`User ${socket.id} joined room ${room_id}`);
};

const handleDisconnect = (socket) => {
  rooms.forEach((room, room_id) => {
    if (room.has(socket.id)) {
      room.delete(socket.id);
      io.to(room_id).emit("remove-cursor", socket.id);
      if (room.size === 0) {
        rooms.delete(room_id);
        console.log(`Room ${room_id} has been removed`);
      }
    }
  });
  console.log(`User disconnected: ${socket.id}`);
};

io.on("connection", (socket) => {
  console.log(`[connection] connected with user: ${socket.id}`);

  socket.on("joinRoom", (data) => handleJoinRoom(socket, data));

  socket.on("mouse-move", (data) => {
    const { room_id, x, y, scrollx, scrolly } = data;
    socket
      .to(room_id)
      .emit("mouse-move", { socket_id: socket.id, x, y, scrollx, scrolly });
  });

  socket.on("new-block-added", (data) => {
    const { room_id, update } = data;
    socket.to(room_id).emit("new-block-added", update);
    console.log(`User ${socket.id} sent the changes in room ${room_id}`);
  });

  socket.on("new-block-deleted", (data) => {
    const { room_id, update } = data;
    socket.to(room_id).emit("new-block-deleted", update);
    console.log(`User ${socket.id} deleted the block in room ${room_id}`);
  });

  socket.on("block-moved/connected/disconnected", (data) => {
    const { room_id, update } = data;
    socket.to(room_id).emit("block-moved/connected/disconnected", update);
    console.log(`User ${socket.id} changed the block in room ${room_id}`);
  });

  socket.on("block-value-updated", (data) => {
    const { room_id, update } = data;
    socket.to(room_id).emit("block-value-updated", update);
    console.log(
      `User ${socket.id} changed the value of a block in room ${room_id}`
    );
  });

  socket.on("exit-collaboration", ({ room_id }) => {
    if (rooms.has(room_id)) {
      const room = rooms.get(room_id);
      const usersArray = Array.from(room).map(([id, name]) => id);
      socket.emit("exit-collaboration", usersArray);
      console.log(`User ${socket.id} exited the collaboration`);
    }
  });

  socket.on("disconnect", () => handleDisconnect(socket));
});

server.listen(PORT, () => {
  console.log(`Server's up and running on port ${PORT} `);
});
