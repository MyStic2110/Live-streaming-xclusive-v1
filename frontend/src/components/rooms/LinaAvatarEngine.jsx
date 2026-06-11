import React from "react";

export default function LinaAvatarEngine({
  audioTrack,
  isSpeaking,
  activeTranscription = "",
  avatarImageUrl = "/reels/lina_avatar.png",
}) {
  return (
    <div style={{
      position: "relative",
      width: "100%",
      height: "100%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "rgba(10, 15, 30, 0.4)",
      borderRadius: "24px",
      overflow: "hidden"
    }}>
      <img
        src={avatarImageUrl}
        alt="Lina Avatar"
        style={{
          width: "100%",
          height: "100%",
          maxWidth: "100%",
          maxHeight: "100%",
          objectFit: "contain",
          borderRadius: "24px",
          display: "block"
        }}
      />
    </div>
  );
}
