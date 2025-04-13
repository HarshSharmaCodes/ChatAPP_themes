import express from "express";
import http from "http";
import { Server } from "socket.io";
import Message from "../models/message.model.js";

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: ["http://localhost:5173"],
  },
});

export function getReceiverSocketId(userId) {
  return userSocketMap[userId];
}

// used to store online users
const userSocketMap = {}; // {userId: socketId}

io.on("connection", (socket) => {
  console.log("A user connected", socket.id);

  const userId = socket.handshake.query.userId;
  if (userId) userSocketMap[userId] = socket.id;

  // Emit online users to all connected clients
  io.emit("getOnlineUsers", Object.keys(userSocketMap));

  // Listen for the "reactToMessage" event, triggered when a user reacts to a message
  socket.on("reactToMessage", async ({ messageId, emoji, userId }) => {
    console.log(`User ${userId} reacted to message ${messageId} with ${emoji}`);
  
    const message = await Message.findById(messageId);
  
    if (!message) return;
  
    const receiverId = message.receiverId?.toString();
    const senderId = message.senderId?.toString();
  
    const receiverSocketId = getReceiverSocketId(receiverId);
    const senderSocketId = getReceiverSocketId(senderId);
  
    const payload = { messageId, emoji, userId };
  
    // Emit to sender if online
    if (senderSocketId) {
      io.to(senderSocketId).emit("messageReactionUpdated", payload);
    }
  
    // Emit to receiver if online (but avoid emitting twice to same socket)
    if (receiverSocketId && receiverSocketId !== senderSocketId) {
      io.to(receiverSocketId).emit("messageReactionUpdated", payload);
    }
  });
  

  // Handle disconnection
  socket.on("disconnect", () => {
    console.log("A user disconnected", socket.id);
    delete userSocketMap[userId];
    io.emit("getOnlineUsers", Object.keys(userSocketMap));
  });
});

export { app, io, server };
