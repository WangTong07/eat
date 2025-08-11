import Shell from "../dashboard/Shell";
import ShoppingListView from "../components/ShoppingListView";

export default function ShoppingPage() {
  return (
    <Shell>
      <div className="relative mb-8">
        <img 
          src="https://cdn.pixabay.com/photo/2018/03/04/18/23/vegetables-3198801_1280.jpg"
          alt="采购清单装饰图片" 
          className="w-full h-48 object-cover rounded-lg shadow-md"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/50 to-transparent flex items-center">
          <div className="text-white px-6">
            <h2 className="text-3xl font-bold">采购清单</h2>
          </div>
        </div>
      </div>
      <ShoppingListView />
    </Shell>
  );
}

