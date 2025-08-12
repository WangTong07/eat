// 环境变量验证脚本
console.log('=== 环境变量检查 ===');

const requiredEnvs = [
  'AI_API_KEY',
  'AI_API_BASE', 
  'AI_MODEL',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY'
];

console.log('检查必需的环境变量...\n');

let allPresent = true;

requiredEnvs.forEach(env => {
  const value = process.env[env];
  const status = value ? '✅ 已配置' : '❌ 缺失';
  const displayValue = value ? 
    (env.includes('KEY') ? `${value.substring(0, 10)}...` : value) : 
    '未设置';
  
  console.log(`${env}: ${status}`);
  console.log(`  值: ${displayValue}\n`);
  
  if (!value) allPresent = false;
});

console.log('=== 测试AI API连接 ===');

async function testAIAPI() {
  try {
    const response = await fetch(process.env.AI_API_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.AI_API_KEY}`
      },
      body: JSON.stringify({
        model: process.env.AI_MODEL || 'qwen-turbo',
        messages: [
          {
            role: 'user',
            content: '测试连接'
          }
        ],
        max_tokens: 10
      })
    });

    if (response.ok) {
      console.log('✅ AI API连接成功');
      const data = await response.json();
      console.log('响应示例:', data.choices?.[0]?.message?.content || '无内容');
    } else {
      console.log('❌ AI API连接失败');
      console.log('状态码:', response.status);
      console.log('错误信息:', await response.text());
    }
  } catch (error) {
    console.log('❌ AI API连接异常');
    console.log('错误:', error.message);
  }
}

if (allPresent) {
  console.log('✅ 所有环境变量已配置，测试API连接...\n');
  testAIAPI();
} else {
  console.log('❌ 部分环境变量缺失，请在Vercel中配置后重新部署');
}