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

    // Get the receiver's socket ID (assuming the message has a receiverId)
    const message = await Message.findById(messageId);  // You might need to import the Message model if not imported already
    const receiverSocketId = getReceiverSocketId(message.receiverId);

    if (receiverSocketId) {
      // Emit the reaction update to the receiver
      io.to(receiverSocketId).emit("messageReactionUpdated", { messageId, emoji, userId });
    }

    // Optionally, you can also notify the sender
    const senderSocketId = getReceiverSocketId(message.senderId);
    if (senderSocketId && senderSocketId !== receiverSocketId) {
      // Emit reaction update to the sender as well
      io.to(senderSocketId).emit("messageReactionUpdated", { messageId, emoji, userId });
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
