import express from "express";
import http from "http";
import { Server } from "socket.io";
import Message from "../models/message.model.js";

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: ["https://haptalk.netlify.app", "http://localhost:5173" ],
  },
});

export function getReceiverSocketId(userId) {
  return userSocketMap[userId];
}

// used to store online users
const userSocketMap = {};

io.on("connection", (socket) => {
  const userId = socket.handshake.query.userId;
  if (userId) userSocketMap[userId] = socket.id;

  // Emit online users to all connected clients
  io.emit("getOnlineUsers", Object.keys(userSocketMap));

  // Listen for the "reactToMessage" event, triggered when a user reacts to a message
  socket.on("reactToMessage", async ({ messageId, emoji, userId }) => {
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

  // 🔥 Message Delivered Event
  socket.on("messageDelivered", async ({ messageIds }) => {
    // Ensure message status is updated in DB before emitting
    for (const messageId of messageIds) {
      const message = await Message.findById(messageId);
      if (message && message.status === "sent") {
        message.status = "delivered";
        await message.save();

        const senderSocketId = getReceiverSocketId(message.senderId.toString());
        if (senderSocketId) {
          io.to(senderSocketId).emit("messageStatusUpdated", {
            messageId,
            status: "delivered",
          });
        }
      }
    }
  });


  // 🔥 Message Read Event
  socket.on("messageRead", async ({ messageIds }) => {
    if (!Array.isArray(messageIds)) return;

    for (const messageId of messageIds) {
      const message = await Message.findById(messageId);
      if (message && message.status !== "read") {
        message.status = "read";
        await message.save();

        const senderSocketId = getReceiverSocketId(message.senderId.toString());
        if (senderSocketId) {
          io.to(senderSocketId).emit("messageStatusUpdated", {
            messageId,
            status: "read",
          });
        }
      }
    }
  });

  // Handle disconnection
  socket.on("disconnect", () => {
    delete userSocketMap[userId];
    io.emit("getOnlineUsers", Object.keys(userSocketMap));
  });
});

export { app, io, server };
