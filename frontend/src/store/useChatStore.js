import toast from "react-hot-toast";
import { create } from "zustand";
import { axiosInstance } from "../lib/axios";
import { useAuthStore } from "./useAuthStore";

function updateReactions(reactions, emoji, userId) {
  const userReacted = reactions.find(r => r.userId === userId);

  if (userReacted) {
    if (userReacted.emoji === emoji) {
      // Remove reaction
      return reactions.filter(r => !(r.userId === userId && r.emoji === emoji));
    } else {
      // Change reaction
      return reactions.map(r =>
        r.userId === userId ? { ...r, emoji } : r
      );
    }
  } else {
    // New reaction
    return [...reactions, { emoji, userId }];
  }
}

export const useChatStore = create((set, get) => ({
  messages: [],
  users: [],
  selectedUser: null,
  isUsersLoading: false,
  isMessagesLoading: false,

  getUsers: async () => {
    set({ isUsersLoading: true });
    try {
      const res = await axiosInstance.get("/messages/users");
      set({ users: res.data });
    } catch (error) {
      toast.error(error.response.data.message);
    } finally {
      set({ isUsersLoading: false });
    }
  },

  getMessages: async (userId) => {
    set({ isMessagesLoading: true });
    try {
      const res = await axiosInstance.get(`/messages/${userId}`);
      set({ messages: res.data });
    } catch (error) {
      toast.error(error.response.data.message);
    } finally {
      set({ isMessagesLoading: false });
    }
  },
  sendMessage: async (messageData) => {
    const { selectedUser, messages } = get();
    try {
      const res = await axiosInstance.post(`/messages/send/${selectedUser._id}`, messageData);
      set({ messages: [...messages, res.data] });
    } catch (error) {
      toast.error(error.response.data.message);
    }
  },

  sendReaction: async (messageId, emoji) => {
    const { messages } = get();

    // Find the message being reacted to
    const message = messages.find((msg) => msg._id === messageId);

    if (!message) {
      toast.error("Message not found");
      return;
    }

    // Check if the user has already reacted with this emoji
    const authUser = useAuthStore.getState().authUser;
    if (!authUser) {
      toast.error("User not found");
      return;
    }

    const existingReaction = message.reactions.find(
      (reaction) => reaction.userId.toString() === authUser._id && reaction.emoji === emoji
    );

    try {
      const res = await axiosInstance.post(`/messages/react/${messageId}`, { emoji });

      const updatedMessages = get().messages.map((msg) =>
        msg._id === messageId ? { ...msg, reactions: res.data.reactions } : msg
      );
      set({ messages: updatedMessages });
    } catch (error) {
      console.error("Send reaction error:", error.response?.data || error.message);
      toast.error(error?.response?.data?.error || error.message || "Failed to send reaction");
    }
  },

  subscribeToMessages: () => {
    const { selectedUser } = get();
    if (!selectedUser) return;

    const socket = useAuthStore.getState().socket;

    socket.on("newMessage", (newMessage) => {
      const isMessageSentFromSelectedUser = newMessage.senderId === selectedUser._id;
      if (!isMessageSentFromSelectedUser) return;

      set({
        messages: [...get().messages, newMessage],
      });
    });

    socket.on("messageStatusUpdated", ({ messageId, status }) => {
      set((state) => ({
        messages: state.messages.map((msg) =>
          msg._id === messageId ? { ...msg, status } : msg
        ),
      }
    ));
    });    

    // ✅ Listen for reaction updates
    socket.on("messageReactionUpdated", ({ messageId, emoji, userId }) => {
      const updatedMessages = get().messages.map((msg) =>
        msg._id === messageId
          ? {
            ...msg,
            reactions: updateReactions(msg.reactions, emoji, userId),
          }
          : msg
      );

      set({ messages: updatedMessages });
    });
  },

  unsubscribeFromMessages: () => {
    const socket = useAuthStore.getState().socket;
    socket.off("newMessage");
    socket.off("messageReactionUpdated");
    socket.off("messageStatusUpdated");
  },

  setSelectedUser: (selectedUser) => set({ selectedUser }),
}));
