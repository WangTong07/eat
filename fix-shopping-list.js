// 这个脚本将修改 ShoppingListView.tsx 文件，使其使用本地存储而不是 API
import fs from 'fs';

try {
  // 读取 ShoppingListView.tsx 文件
  const filePath = 'app/components/ShoppingListView.tsx';
  let content = fs.readFileSync(filePath, 'utf8');
  
  // 修改文件内容，使其使用本地存储而不是 API
  content = content.replace(
    /const addItem = async \(\) => {[\s\S]*?try {[\s\S]*?const response = await fetch\('\/api\/shopping-list'/,
    `const addItem = () => {
    if (!newName.trim()) return;
    
    // 创建新物品
    const item = { 
      id: \`\${Date.now()}-\${newName.trim()}\`, 
      name: newName.trim(), 
      category: newCat,
      checked: false
    };
    
    // 更新本地状态
    const newList = [...list, item];
    setList(newList);
    setNewName("");
    
    // 保存到本地存储
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('shopping_list_latest', JSON.stringify(newList));
    }`
  );
  
  // 修改 loadShoppingList 函数，使其只使用本地存储
  content = content.replace(
    /const loadShoppingList = async \(\) => {[\s\S]*?try {[\s\S]*?const response = await fetch\('\/api\/shopping-list'\);/,
    `const loadShoppingList = () => {
    try {
      // 从本地存储加载数据
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem('shopping_list_latest') : null;`
  );
  
  // 修改 loadShoppingList 函数的后续部分
  content = content.replace(
    /if \(response\.ok\) {[\s\S]*?const data = await response\.json\(\);[\s\S]*?if \(data\.items && data\.items\.length > 0\) {/,
    `if (raw) {
        const saved = JSON.parse(raw);
        if (Array.isArray(saved) && saved.length > 0) {`
  );
  
  // 修改 loadShoppingList 函数的后续部分
  content = content.replace(
    /const items: Item\[\] = data\.items\.map\(\(item: any\) => \({/,
    `const items = saved.map(item => ({`
  );
  
  // 修改 generateInitialList 函数，使其只使用本地存储
  content = content.replace(
    /const generateInitialList = \(\) => {[\s\S]*?fetch\('\/api\/shopping-list'/,
    `const generateInitialList = () => {
    const base = {};
    recs.forEach(r => {
      r.ingredients.forEach(n => {
        const key = n.trim();
        if (!key) return;
        if (!base[key]) base[key] = { id: \`\${Date.now()}-\${key}\`, name: key, category: classify(key) };
      });
    });
    const arr = Object.values(base);
    setList(arr);
    
    // 保存到本地存储
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('shopping_list_latest', JSON.stringify(arr));
    }`
  );
  
  // 修改复选框状态变更函数
  content = content.replace(
    /<input[\s\S]*?type="checkbox"[\s\S]*?onChange={async \(\)=> {[\s\S]*?const newList = list\.map\(p => p\.id === it\.id \? \{\.\.\.p, checked: !p\.checked\} : p\);[\s\S]*?try {[\s\S]*?const response = await fetch\('\/api\/shopping-list'/,
    `<input 
                      type="checkbox" 
                      checked={!!it.checked} 
                      onChange={() => {
                        // 更新本地状态
                        const newList = list.map(p => p.id === it.id ? {...p, checked: !p.checked} : p);
                        setList(newList);
                        
                        // 保存到本地存储
                        if (typeof window !== 'undefined') {
                          window.localStorage.setItem('shopping_list_latest', JSON.stringify(newList));
                        }`
  );
  
  // 修改删除按钮函数
  content = content.replace(
    /<button className="btn-link" onClick={async \(\)=> {[\s\S]*?const newList = list\.filter\(p => p\.id !== it\.id\);[\s\S]*?try {[\s\S]*?const response = await fetch\('\/api\/shopping-list'/,
    `<button className="btn-link" onClick={() => {
                      // 更新本地状态
                      const newList = list.filter(p => p.id !== it.id);
                      setList(newList);
                      
                      // 保存到本地存储
                      if (typeof window !== 'undefined') {
                        window.localStorage.setItem('shopping_list_latest', JSON.stringify(newList));
                      }`
  );
  
  // 移除 saveToDatabase 函数
  content = content.replace(
    /\/\/ 保存到数据库[\s\S]*?const saveToDatabase = async \(items: Item\[\]\) => {[\s\S]*?};/,
    `// 保存到本地存储
  const saveToLocalStorage = (items) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('shopping_list_latest', JSON.stringify(items));
    }
  };`
  );
  
  // 修改 useEffect 中的 saveToDatabase 调用
  content = content.replace(
    /useEffect\(\(\) => {[\s\S]*?if \(list\.length > 0\) {[\s\S]*?saveToDatabase\(list\);[\s\S]*?}\s*}, \[list\]\);/,
    `useEffect(() => {
    // 避免初始空列表触发保存
    if (list.length > 0) {
      saveToLocalStorage(list);
    }
  }, [list]);`
  );
  
  // 移除 useRealtimeSubscription
  content = content.replace(
    /\/\/ 添加实时订阅[\s\S]*?useRealtimeSubscription\({[\s\S]*?}\);/,
    `// 移除实时订阅，使用本地存储`
  );
  
  // 写入修改后的文件
  fs.writeFileSync(filePath, content);
  
  console.log('成功修改 ShoppingListView.tsx 文件，现在它将使用本地存储而不是 API');
} catch (error) {
  console.error('修改文件时出错:', error);
}