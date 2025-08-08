import Shell from "../dashboard/Shell";
import ShoppingListView from "../components/ShoppingListView";

export default function ShoppingPage() {
  return (
    <Shell>
      <h2 className="text-[clamp(1.5rem,3vw,2rem)] font-bold text-neutral-800 mb-4">采购清单</h2>
      <ShoppingListView />
    </Shell>
  );
}


