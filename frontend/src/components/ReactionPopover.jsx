import { useEffect, useRef } from "react";

const emojis = ["❤️", "😂", "😮", "😢", "😡"];

const ReactionPopover = ({ onSelect, onClose, position }) => {
  const popoverRef = useRef();

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  return (
    <div
      ref={popoverRef}
      className="absolute bg-white border rounded-lg shadow-md p-2 flex gap-2 z-50"
      style={{ top: position.top, left: position.left }}
    >
      {emojis.map((emoji) => (
        <button
          key={emoji}
          className="text-2xl hover:scale-110 transition"
          onClick={() => onSelect(emoji)}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
};

export default ReactionPopover;
