// 简单测试脚本
const { TranslationCache } = require('./rpg-mv-translator-plugin.js');

async function testCache() {
  const cache = new TranslationCache();
  cache.setTranslation('オーブ', '宝珠');
  cache.setTranslation('モード', '模式');
  cache.setTranslation('スペル', '咒语');

  console.log('缓存内容:');
  Object.entries(cache.cache).forEach(([key, value]) => {
    console.log(`  "${key}": "${value}"`);
  });

  console.log(`总条目: ${cache.getStats().total}`);
}

testCache();