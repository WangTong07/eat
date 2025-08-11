import Shell from "../dashboard/Shell";
import WishForm from "../components/WishForm";

export default function PreferencesPage() {
  return (
    <Shell>
      <div className="relative mb-8">
        <img 
          src="https://images.unsplash.com/photo-1615937722923-67f6deaf2cc9?ixlib=rb-4.0.3&q=85&fm=jpg&crop=entropy&cs=srgb&w=4800"
          alt="偏好提交装饰图片" 
          className="w-full h-48 object-cover rounded-lg shadow-md"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/50 to-transparent flex items-center">
          <div className="text-white px-6">
            <h2 className="text-3xl font-bold">偏好提交</h2>
          </div>
        </div>
      </div>
      <WishForm />
    </Shell>
  );
}

