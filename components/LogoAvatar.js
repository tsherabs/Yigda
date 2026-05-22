"use client";

export default function LogoAvatar({ src, name, size = "md" }) {
  const initial = String(name || "Y").trim().charAt(0).toUpperCase() || "Y";
  return (
    <span className={`logoAvatar ${size === "sm" ? "small" : ""}`}>
      {src ? <img src={src} alt={`${name || "Account"} logo`} /> : <span>{initial}</span>}
    </span>
  );
}
