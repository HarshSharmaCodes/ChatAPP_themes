import Message from "../models/message.model.js";
import User from "../models/user.model.js";

import cloudinary from "../lib/cloudinary.js";
import { getReceiverSocketId, io } from "../lib/socket.js";

export const getUsersForSidebar = async (req, res) => {
  try {
    const loggedInUserId = req.user._id;
    const filteredUsers = await User.find({ _id: { $ne: loggedInUserId } }).select("-password");

    res.status(200).json(filteredUsers);
  } catch (error) {
    console.error("Error in getUsersForSidebar: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getMessages = async (req, res) => {
  try {
    const { id: userToChatId } = req.params;
    const myId = req.user._id;

    const messages = await Message.find({
      $or: [
        { senderId: myId, receiverId: userToChatId },
        { senderId: userToChatId, receiverId: myId },
      ],
    });

    res.status(200).json(messages);
  } catch (error) {
    console.log("Error in getMessages controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const sendMessage = async (req, res) => {
  try {
    const { text, image } = req.body;
    const { id: receiverId } = req.params;
    const senderId = req.user._id;

    let imageUrl;
    if (image) {
      // Upload base64 image to cloudinary
      const uploadResponse = await cloudinary.uploader.upload(image);
      imageUrl = uploadResponse.secure_url;
    }

    const newMessage = new Message({
      senderId,
      receiverId,
      text,
      image: imageUrl,
    });

    await newMessage.save();

    const receiverSocketId = getReceiverSocketId(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("newMessage", newMessage);
    }

    res.status(201).json(newMessage);
  } catch (error) {
    console.log("Error in sendMessage controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Add reaction to message
export const addReaction = async (req, res) => {
  try {
    const { messageId } = req.params; // The message being reacted to
    const { emoji } = req.body; // The emoji being used in the reaction
    const userId = req.user._id; // Get the logged-in user (who is reacting)

    // Find the message to which the reaction is being added
    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }

    // Check if the user has already reacted with the same emoji
    const existingReaction = message.reactions.find(
      (reaction) => reaction.userId.toString() === userId && reaction.emoji === emoji
    );

    if (existingReaction) {
      return res.status(400).json({ message: "You have already reacted with this emoji" });
    }

    // If the user has previously reacted with a different emoji, remove the old reaction
    message.reactions = message.reactions.filter(
      (reaction) => reaction.userId.toString() !== userId
    );

    // Add the new reaction to the message
    message.reactions.push({ emoji, userId });

    // Save the updated message
    await message.save();

    // Emit updated message with reaction to all connected users
    const receiverSocketId = getReceiverSocketId(message.receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("messageReactionUpdated", { messageId, emoji, userId });
    }

    // Respond with the updated message data
    res.status(200).json(message);
  } catch (error) {
    console.error("Error in addReaction controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};
