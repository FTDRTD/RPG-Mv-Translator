// RPG MV 翻译插件 - 完整实现
(function() {
  'use strict';

  // 配置
  const parameters = PluginManager.parameters('rpg-mv-translator-plugin');
  const config = {
    service: String(parameters['Translation Service'] || 'ollama'),
    ollamaUrl: String(parameters['Ollama URL'] || 'http://localhost:11434'),
    ollamaModel: String(parameters['Ollama Model'] || 'llama2'),
    lmStudioUrl: String(parameters['LM Studio URL'] || 'http://localhost:1234'),
    sourceLang: String(parameters['Source Language'] || 'ja'),
    targetLang: String(parameters['Target Language'] || 'zh-CN'),
    enabled: eval(parameters['Enable Translation'] || 'true'),
    cacheFile: String(parameters['Cache File'] || './cache/translations.json')
  };

  // 翻译缓存类
  class TranslationCache {
    constructor() {
      this.cache = {};
      this.loadCache();
    }

    loadCache() {
      try {
        const fs = require('fs');
        const path = require('path');
        const cachePath = path.join(process.cwd(), config.cacheFile);
        if (fs.existsSync(cachePath)) {
          const data = fs.readFileSync(cachePath, 'utf8');
          this.cache = JSON.parse(data || '{}');
        }
      } catch (error) {
        console.warn('无法加载翻译缓存:', error);
      }
    }

    saveCache() {
      try {
        const fs = require('fs');
        const path = require('path');
        const cachePath = path.join(process.cwd(), config.cacheFile);
        fs.writeFileSync(cachePath, JSON.stringify(this.cache, null, 2), 'utf8');
      } catch (error) {
        console.warn('无法保存翻译缓存:', error);
      }
    }

    getTranslation(text) {
      return this.cache[text] || null;
    }

    setTranslation(text, translated) {
      this.cache[text] = translated;
      this.saveCache();
    }

    hasTranslation(text) {
      return this.cache.hasOwnProperty(text);
    }

    getStats() {
      return { total: Object.keys(this.cache).length };
    }
  }

  // 翻译器类
  class Translator {
    constructor() {
      this.config = config;
    }

    async translate(text, from, to) {
      switch (this.config.service) {
        case 'ollama':
          return await this.translateWithOllama(text, from, to);
        case 'lmstudio':
          return await this.translateWithLMStudio(text, from, to);
        case 'online':
          return await this.translateOnline(text, from, to);
        default:
          return text;
      }
    }

    async translateWithOllama(text, from, to) {
      try {
        const response = await fetch(`${this.config.ollamaUrl}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: this.config.ollamaModel,
            prompt: `请将以下${from}文本翻译成${to}：\n\n${text}\n\n只返回翻译结果，不要其他解释。`,
            stream: false
          })
        });

        if (response.ok) {
          const data = await response.json();
          return data.response.trim();
        }
      } catch (error) {
        console.error('Ollama翻译失败:', error);
      }
      return text;
    }

    async translateWithLMStudio(text, from, to) {
      try {
        const response = await fetch(`${this.config.lmStudioUrl}/v1/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [{
              role: 'user',
              content: `请将以下${from}文本翻译成${to}：\n\n${text}\n\n只返回翻译结果，不要其他解释。`
            }],
            model: 'local-model',
            temperature: 0.1
          })
        });

        if (response.ok) {
          const data = await response.json();
          return data.choices[0].message.content.trim();
        }
      } catch (error) {
        console.error('LM Studio翻译失败:', error);
      }
      return text;
    }

    async translateOnline(text, from, to) {
      console.warn('在线翻译在插件模式下不可用');
      return text;
    }
  }

  // 插件主类
  class RpgMvTranslatorPlugin {
    constructor() {
      this.cache = new TranslationCache();
      this.translator = new Translator();
      this.isTranslating = false;
    }

    init() {
      if (!config.enabled) return;

      console.log('初始化RPG MV翻译插件...');

      // 钩住Window_Message的add方法
      const originalAdd = Window_Message.prototype.add;
      Window_Message.prototype.add = function(text) {
        if (text && text.trim()) {
          this.add = originalAdd; // 避免递归
          const plugin = new RpgMvTranslatorPlugin();
          plugin.translateText(text).then(translated => {
            originalAdd.call(this, translated);
          }).catch(() => {
            originalAdd.call(this, text);
          });
        } else {
          originalAdd.call(this, text);
        }
      };
    }

    async translateText(text) {
      if (this.cache.hasTranslation(text)) {
        return this.cache.getTranslation(text);
      }

      if (this.isTranslating) {
        await new Promise(resolve => setTimeout(resolve, 100));
        return this.translateText(text);
      }

      this.isTranslating = true;
      try {
        const translated = await this.translator.translate(text, config.sourceLang, config.targetLang);
        this.cache.setTranslation(text, translated);
        return translated;
      } finally {
        this.isTranslating = false;
      }
    }
  }

  // 插件注册
  const plugin = new RpgMvTranslatorPlugin();
  plugin.init();

  // 导出供外部使用
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      TranslationCache,
      Translator,
      config,
      RpgMvTranslatorPlugin
    };
  }

  // 测试函数 (RPG MV 环境)
  if (typeof Utils !== 'undefined') {
    Utils.translateTest = async function() {
      const testText = 'オーブ';
      const plugin = new RpgMvTranslatorPlugin();
      const translated = await plugin.translateText(testText);
      console.log(`测试翻译: ${testText} -> ${translated}`);
    };
  }

})();