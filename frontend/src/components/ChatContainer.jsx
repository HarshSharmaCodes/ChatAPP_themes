import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { formatMessageTime } from "../lib/utils";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";
import ChatHeader from "./ChatHeader";
import MessageInput from "./MessageInput";
import MessageSkeleton from "./skeletons/MessageSkeleton";

const emojiOptions = ["❤️", "😂", "👍", "🎉", "😮", "😢", "🔥"];

const ChatContainer = () => {
  const {
    messages,
    getMessages,
    isMessagesLoading,
    selectedUser,
    subscribeToMessages,
    unsubscribeFromMessages,
    sendReaction,
  } = useChatStore();

  const { authUser, socket } = useAuthStore();
  const messageEndRef = useRef(null);
  const popoverRef = useRef(null);
  const prevMessageIdsRef = useRef([]);
  const [showEmojiPopoverFor, setShowEmojiPopoverFor] = useState(null);
  const [popoverPosition, setPopoverPosition] = useState({ x: 0, y: 0 });

  // Create a new Audio object for the notification sound
  const notificationSound = new Audio("/sounds/notification.mp3");

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target)) {
        setShowEmojiPopoverFor(null);
      }
    };

    if (showEmojiPopoverFor) {
      document.addEventListener("mousedown", handleClickOutside);
    } else {
      document.removeEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showEmojiPopoverFor]);

  useEffect(() => {
    getMessages(selectedUser._id);
    subscribeToMessages();
    return () => unsubscribeFromMessages();
  }, [selectedUser._id]);

  useEffect(() => {
    if (messageEndRef.current && messages) {
      messageEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  useEffect(() => {
    if (!socket || !authUser || !selectedUser || messages.length === 0) return;

    const prevMessageIds = prevMessageIdsRef.current;
    const currentMessageIds = messages.map((msg) => msg._id);

    const newMessages = messages.filter(
      (msg) =>
        !prevMessageIds.includes(msg._id) &&
        msg.receiverId === authUser._id &&
        msg.senderId === selectedUser._id
    );

    const undelivered = newMessages.filter((msg) => msg.status === "sent");
    const unread = newMessages.filter((msg) => msg.status !== "read");

    if (undelivered.length > 0) {
      socket.emit("messageDelivered", {
        messageIds: undelivered.map((msg) => msg._id),
      });
    }

    if (unread.length > 0) {
      socket.emit("messageRead", {
        messageIds: unread.map((msg) => msg._id),
      });

      // ✅ Play sound ONLY for new messages, not reactions
      notificationSound.play();
    }

    // Update the ref with current message IDs
    prevMessageIdsRef.current = currentMessageIds;
  }, [messages, selectedUser, socket, authUser]);

  const handleReaction = async (messageId, emoji) => {
    const message = messages.find((msg) => msg._id === messageId);
    const existingReaction = message.reactions?.find(
      (reaction) => reaction.userId === authUser._id
    );
    const isSameEmoji = existingReaction?.emoji === emoji;
    try {
      await sendReaction(messageId, isSameEmoji ? null : emoji);
      toast.success("Reaction updated!");
      setShowEmojiPopoverFor(null);
    } catch (error) {
      toast.error("Failed to update reaction");
    }
  };

  const handleLongPress = (event, messageId) => {
    event.preventDefault();

    const messageEl = document.getElementById(`message-${messageId}`);
    const chatContainer = document.querySelector(".chat-scroll-container");

    if (messageEl && chatContainer) {
      const messageRect = messageEl.getBoundingClientRect();
      const containerRect = chatContainer.getBoundingClientRect();

      const x = messageRect.left - containerRect.left + messageRect.width / 2;
      const y = messageRect.top;

      setPopoverPosition({ x, y });
      setShowEmojiPopoverFor(messageId);
    }
  };

  if (isMessagesLoading) {
    return (
      <div className="flex-1 flex flex-col overflow-auto">
        <ChatHeader />
        <MessageSkeleton />
        <MessageInput />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-auto relative">
      <ChatHeader />

      <div className="flex-1 overflow-y-auto p-4 space-y-4 relative chat-scroll-container">
        {messages.map((message) => (
          <div
            key={message._id}
            id={`message-${message._id}`}
            className={`chat ${
              message.senderId === authUser._id ? "chat-end" : "chat-start"
            }`}
            ref={messageEndRef}
            onContextMenu={(e) => handleLongPress(e, message._id)}
            onTouchStart={(e) => {
              const timeout = setTimeout(
                () => handleLongPress(e, message._id),
                500
              );
              e.target.addEventListener(
                "touchend",
                () => clearTimeout(timeout),
                { once: true }
              );
            }}
          >
            <div className="chat-image avatar">
              <div className="size-10 rounded-full border">
                <img
                  src={
                    message.senderId === authUser._id
                      ? authUser.profilePic || "/avatar.png"
                      : selectedUser.profilePic || "/avatar.png"
                  }
                  alt="profile pic"
                />
              </div>
            </div>

            <div className="chat-header mb-1">
              <time className="text-xs opacity-50 ml-1">
                {formatMessageTime(message.createdAt)}
              </time>
            </div>

            <div className="chat-bubble flex flex-col">
              {message.image && (
                <div className="relative mb-2">
                  <img
                    src={message.image}
                    alt="Attachment"
                    className="sm:max-w-[200px] rounded-md cursor-pointer"
                    onClick={() => window.open(message.image, "_blank")}
                  />
                </div>
              )}

              {message.text && <p>{message.text}</p>}
              {message.reactions &&
                message.reactions.length > 0 &&
                (() => {
                  const uniqueReactions = Object.values(
                    message.reactions.reduce((acc, curr) => {
                      acc[curr.userId] = curr; // One reaction per user
                      return acc;
                    }, {})
                  );

                  return (
                    <div className="flex space-x-1 mt-2">
                      {uniqueReactions.map((reaction) => (
                        <span key={reaction.userId} className="text-sm">
                          {reaction.emoji}
                        </span>
                      ))}
                    </div>
                  );
                })()}
              {message.senderId === authUser._id && (
                <div className="text-[10px] text-gray-500 mt-1 flex items-center justify-end">
                  {message.status === "sent" && <span>✓</span>}
                  {message.status === "delivered" && <span>✓✓</span>}
                  {message.status === "read" && (
                    <span className="text-blue-500">✓✓</span>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {showEmojiPopoverFor && (
        <div
          ref={popoverRef}
          className="absolute z-50 bg-white p-1 rounded-xl shadow-lg flex space-x-2"
          style={{
            top: popoverPosition.y,
            left: popoverPosition.x,
            transform: "translateX(-50%)",
          }}
        >
          {emojiOptions.map((emoji) => (
            <button
              key={emoji}
              className="text-xl hover:scale-125 transition-transform"
              onClick={() => handleReaction(showEmojiPopoverFor, emoji)}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      <MessageInput />
    </div>
  );
};

export default ChatContainer;
