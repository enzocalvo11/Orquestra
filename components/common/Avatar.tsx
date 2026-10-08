import { getPerson } from "../../lib/planning";

interface AvatarProps {
  personId: string;
  small?: boolean;
}

export function Avatar({ personId, small = false }: AvatarProps) {
  const person = getPerson(personId);

  if (!person) return null;

  const initials = person.name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("");

  return (
    <span
      className={`avatar ${small ? "avatar-small" : ""}`}
      style={{ background: person.color }}
      title={person.name}
      aria-label={person.name}
    >
      {initials}
    </span>
  );
}
