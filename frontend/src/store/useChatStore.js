import toast from "react-hot-toast";
import { create } from "zustand";
import { axiosInstance } from "../lib/axios";
import { useAuthStore } from "./useAuthStore";

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
    const existingReaction = message.reactions.find(
      (reaction) => reaction.userId.toString() === useAuthStore.getState().user._id && reaction.emoji === emoji
    );

    if (existingReaction) {
      toast.error("You have already reacted with this emoji");
      return;
    }

    try {
      const res = await axiosInstance.post(`/messages/react/${messageId}`, { emoji });

      // Optionally update local message state with new reactions
      const updatedMessages = get().messages.map((msg) =>
        msg._id === messageId ? { ...msg, reactions: res.data.reactions } : msg
      );

      set({ messages: updatedMessages });

      // Optionally, emit socket events if needed
      // socket.emit("reactionAdded", { messageId, emoji });

    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to send reaction");
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
  },

  unsubscribeFromMessages: () => {
    const socket = useAuthStore.getState().socket;
    socket.off("newMessage");
  },

  setSelectedUser: (selectedUser) => set({ selectedUser }),
}));
