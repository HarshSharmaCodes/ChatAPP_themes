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

  const { authUser } = useAuthStore();
  const messageEndRef = useRef(null);
  const [showEmojiPopoverFor, setShowEmojiPopoverFor] = useState(null);
  const [popoverPosition, setPopoverPosition] = useState({ x: 0, y: 0 });

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

  const handleReaction = async (messageId, emoji) => {
    try {
      await sendReaction(messageId, emoji);
      toast.success("Reaction updated!");
      setShowEmojiPopoverFor(null); 
    } catch (error) {
      toast.error("Failed to update reaction");
    }
  };
  

  const handleLongPress = (event, messageId) => {
    event.preventDefault();
    const x = event.clientX || event.touches?.[0]?.clientX || 100;
    const y = event.clientY || event.touches?.[0]?.clientY || 100;
    setPopoverPosition({ x, y });
    setShowEmojiPopoverFor(messageId);
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

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message._id}
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
                <img
                  src={message.image}
                  alt="Attachment"
                  className="sm:max-w-[200px] rounded-md mb-2"
                />
              )}
              {message.text && <p>{message.text}</p>}

              {message.reactions && message.reactions.length > 0 && (
                <div className="flex space-x-1 mt-2">
                  {message.reactions.map((reaction, index) => (
                    <span key={index} className="text-sm">
                      {reaction.emoji}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {showEmojiPopoverFor && (
        <div
          className="absolute z-50 bg-white p-2 rounded-xl shadow-lg flex space-x-2"
          style={{ top: popoverPosition.y, left: popoverPosition.x }}
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
