export default function DutyPage() {
  if (typeof window !== "undefined") {
    window.location.replace("/people");
  }
  return null;
}


