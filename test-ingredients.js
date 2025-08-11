// 测试食材提取函数
function guessIngredients(dish) {
  const items = [];
  const add = (arr) => arr.forEach((i) => items.includes(i) ? null : items.push(i));
  const d = dish || "";
  // 只保留主要食材，不列出盐/酱油/醋等基础调味
  if (/(红烧肉|东坡肉)/.test(d)) add(["五花肉", "葱", "姜", "蒜"]);
  else if (/排骨/.test(d)) add(["排骨", "葱", "姜", "蒜"]);
  else if (/鸡翅/.test(d)) add(["鸡翅", "葱", "姜", "蒜"]);
  else if (/宫保鸡丁/.test(d)) add(["鸡胸肉", "花生米", "干辣椒", "花椒", "葱", "姜", "蒜"]);
  else if (/鱼香肉丝/.test(d)) add(["猪里脊", "木耳", "笋", "葱", "姜", "蒜"]);
  else if (/鱼香茄子|红烧茄子|茄子/.test(d)) add(["茄子", "葱", "姜", "蒜"]);
  else if (/麻婆豆腐/.test(d)) add(["豆腐", "牛/猪肉末", "豆瓣酱", "花椒"]);
  else if (/豆腐/.test(d)) add(["豆腐", "葱", "姜", "蒜"]);
  else if (/西红柿|番茄/.test(d) && /鸡蛋/.test(d)) add(["西红柿", "鸡蛋", "葱"]);
  else if (/西红柿|番茄/.test(d)) add(["西红柿", "葱"]);
  else if (/西兰花/.test(d)) add(["西兰花", "蒜"]);
  else if (/空心菜|青菜|油麦/.test(d)) add(["青菜/空心菜", "蒜"]);
  else if (/火锅|涮锅/.test(d)) add(["牛/羊肉卷", "午餐肉", "虾滑/鱼丸", "蟹棒", "金针菇", "香菇", "娃娃菜", "油麦菜", "土豆片", "藕片", "海带结", "豆皮", "冻豆腐", "宽粉", "火锅底料", "火锅蘸料"]);
  else if (/鸡/.test(d) && !/鸡蛋/.test(d)) add(["鸡肉", "葱", "姜", "蒜"]);
  else if (/牛肉/.test(d)) add(["牛肉", "葱", "姜", "蒜"]);
  else if (/猪肉/.test(d)) add(["猪肉", "葱", "姜", "蒜"]);
  else add([d]);
  return items;
}

function classify(name) {
  // 肉类
  if (/(猪|牛|羊|鸡(?!蛋)|鸭|鹅|肉|排骨|里脊|五花|腊肉|培根)/.test(name)) return "肉类";
  // 海鲜类
  if (/(虾|蟹|鱼|贝|海参|鱿|蛤|鲍|蛎|龙虾|扇贝)/.test(name)) return "海鲜类";
  // 蔬菜/豆制品/水果等（先于调料判断，避免"油麦菜"被油命中）
  if (/(菜|葱|姜|蒜|椒|瓜|豆腐|豆皮|豆芽|土豆|马铃薯|藕|金针菇|香菇|蘑菇|菌|茄子|番茄|西红柿|青菜|油麦菜|娃娃菜|生菜|菠菜|西兰花|花菜|空心菜|豆角|四季豆|芹菜|黄瓜|冬瓜|南瓜|苦瓜|海带|木耳|莴笋|莴苣|莲藕|韭菜|蒜薹|香菜|西瓜|苹果|香蕉|橙子|梨|桃|葡萄|草莓|樱桃|芒果|菠萝|柚子|柠檬|猕猴桃|火龙果)/.test(name))
    return "蔬果类";
  // 调料类（只匹配具体词，避免"油麦菜"的"油"被误判）
  if (/(食用油|花生油|调和油|菜籽油|生抽|老抽|耗油|蚝油|鸡精|味精|白糖|冰糖|食盐|白醋|陈醋|料酒|胡椒|花椒|孜然|八角|桂皮|香叶|豆瓣|豆瓣酱|辣椒粉|辣椒面|淀粉)/.test(name))
    return "调料类";
  // 饮品类
  if (/(牛奶|豆奶|酸奶|可乐|雪碧|汽水|苏打水|矿泉水|纯净水|果汁|橙汁|苹果汁|椰汁|椰汁|椰奶|茶饮|奶茶|咖啡|啤酒|葡萄酒|黄酒|清酒|饮料|运动饮料)/.test(name))
    return "饮品类";
  // 日杂
  if (/(纸|袋|保鲜|餐巾|洗洁|日杂|一次性|牙膏|纸巾)/.test(name)) return "日杂类";
  return "蔬果类";
}

console.log('测试"西瓜"的食材提取:');
const ingredients = guessIngredients('西瓜');
console.log('提取的食材:', ingredients);

console.log('\n测试"西瓜"的分类:');
ingredients.forEach(ingredient => {
  console.log(`${ingredient} -> ${classify(ingredient)}`);
});

console.log('\n测试其他菜品:');
const testDishes = ['红烧肉', '可乐鸡翅', '麻婆豆腐', '苹果', '香蕉'];
testDishes.forEach(dish => {
  const dishIngredients = guessIngredients(dish);
  console.log(`${dish} -> ${dishIngredients.join(', ')}`);
});