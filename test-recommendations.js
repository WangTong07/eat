// 测试 recommendations API
async function testRecommendationsAPI() {
  try {
    console.log('测试 recommendations API...');
    
    // 直接调用本地 API
    const response = await fetch('http://localhost:3201/api/recommendations');
    
    if (!response.ok) {
      console.error('API 请求失败:', response.status, response.statusText);
      const errorText = await response.text();
      console.error('错误详情:', errorText);
    } else {
      const data = await response.json();
      console.log('API 响应:', JSON.stringify(data, null, 2));
      
      if (data.items && data.items.length > 0) {
        console.log('成功获取到推荐菜数据！');
        console.log('推荐菜数量:', data.items.length);
        console.log('第一个推荐菜:', data.items[0].dish);
        console.log('食材列表:', data.items[0].ingredients);
      } else {
        console.log('API 返回了空数据');
      }
    }
  } catch (error) {
    console.error('测试 API 时出错:', error);
  }
}

testRecommendationsAPI();