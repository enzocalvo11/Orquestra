import { UserRound } from "lucide-react";

interface UserProfileIconProps {
  small?: boolean;
  variant?: "light" | "dark";
}

export function UserProfileIcon({
  small = false,
  variant = "light",
}: UserProfileIconProps) {
  const isDark = variant === "dark";

  return (
    <span
      className={`avatar ${small ? "avatar-small" : ""}`}
      style={{
        background: isDark ? "#3d4763" : "#e9eef5",
        color: isDark ? "#d0d8e9" : "#53647d",
      }}
      title="Perfil do gestor"
      role="img"
      aria-label="Perfil do gestor"
    >
      <UserRound size={small ? 15 : 19} strokeWidth={1.8} aria-hidden="true" />
    </span>
  );
}
