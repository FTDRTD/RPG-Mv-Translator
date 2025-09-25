// 测试翻译功能
const path = require('path');
const { TranslationCache, Translator, config } = require('./rpg-mv-translator-plugin.js');

async function testTranslator() {
  console.log('测试翻译器功能...');

  const cache = new TranslationCache();
  const translator = new Translator(config);

  // 测试基本翻译
  const testText = 'こんにちは、世界！';
  console.log(`原文: ${testText}`);

  if (cache.hasTranslation(testText)) {
    console.log(`缓存翻译: ${cache.getTranslation(testText)}`);
  } else {
    console.log('缓存中未找到，开始翻译...');
    const translated = await translator.translate(testText, 'ja', 'zh-CN');
    console.log(`翻译结果: ${translated}`);
    cache.setTranslation(testText, translated);
  }

  // 批量测试
  const batchTexts = ['オーブ', 'モード', 'スペル', 'アイテム', 'スキル'];
  console.log('批量测试:');
  for (const text of batchTexts) {
    if (cache.hasTranslation(text)) {
      console.log(`  "${text}" -> 缓存: "${cache.getTranslation(text)}"`);
    } else {
      const translation = await translator.translate(text, 'ja', 'zh-CN');
      cache.setTranslation(text, translation);
      console.log(`  "${text}" -> 新翻译: "${translation}"`);
    }
  }

  // 统计
  const stats = cache.getStats();
  console.log(`缓存统计: 总条目 ${stats.total}`);

  console.log('测试完成');
}

// 运行测试
testTranslator().catch(console.error);