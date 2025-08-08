import Shell from "../dashboard/Shell";
import WishForm from "../components/WishForm";

export default function PreferencesPage() {
  return (
    <Shell>
      <h2 className="text-[clamp(1.5rem,3vw,2rem)] font-bold text-neutral-800 mb-4">偏好提交</h2>
      <WishForm />
    </Shell>
  );
}


