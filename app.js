// RPG MV 翻译器 - 主应用逻辑 (NW.js 兼容)
const fs = require('fs');
const path = require('path');

// 从现有插件导入或内联实现 (假设插件导出；否则内联)
let TranslationCache, Translator, defaultConfig;
try {
  const plugin = require('./rpg-mv-translator-plugin.js');
  TranslationCache = plugin.TranslationCache;
  Translator = plugin.Translator;
  defaultConfig = plugin.config;
} catch (e) {
  console.warn('插件未导出，使用内联实现');
  // 内联 TranslationCache
  class TranslationCache {
    constructor(cachePath = './cache/translations.json') {
      this.cachePath = cachePath;
      this.cache = {};
      this.load();
    }

    load() {
      try {
        if (fs.existsSync(this.cachePath)) {
          const data = fs.readFileSync(this.cachePath, 'utf8');
          this.cache = JSON.parse(data || '{}');
        }
      } catch (error) {
        console.warn('加载缓存失败:', error);
      }
    }

    save() {
      try {
        fs.writeFileSync(this.cachePath, JSON.stringify(this.cache, null, 2), 'utf8');
      } catch (error) {
        console.warn('保存缓存失败:', error);
      }
    }

    get(text) {
      return this.cache[text] || null;
    }

    set(text, translated) {
      this.cache[text] = translated;
      this.save();
    }

    has(text) {
      return this.cache.hasOwnProperty(text);
    }

    getStats() {
      return { total: Object.keys(this.cache).length };
    }

    exportJSON() {
      return JSON.stringify(this.cache, null, 2);
    }

    importJSON(data) {
      try {
        this.cache = JSON.parse(data);
        this.save();
        return true;
      } catch (e) {
        return false;
      }
    }
  }

  // 内联 Translator
  class Translator {
    constructor(config = {}) {
      this.config = config;
    }

    async translate(text, from = 'ja', to = 'zh-CN') {
      const service = this.config.service || 'ollama';
      switch (service) {
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
      const url = this.config.ollamaUrl || 'http://localhost:11434';
      const model = this.config.ollamaModel || 'llama2';
      try {
        const response = await fetch(`${url}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model,
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
      const url = this.config.lmStudioUrl || 'http://localhost:1234';
      try {
        const response = await fetch(`${url}/v1/chat/completions`, {
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
      // 占位：可集成Google Translate API等
      console.warn('在线翻译需API密钥');
      return text;
    }
  }

  defaultConfig = {
    service: 'ollama',
    ollamaUrl: 'http://localhost:11434',
    ollamaModel: 'llama2',
    lmStudioUrl: 'http://localhost:1234',
    sourceLang: 'ja',
    targetLang: 'zh-CN',
    enabled: true,
    cacheFile: './cache/translations.json'
  };
}

// 全局实例
const cache = new TranslationCache(defaultConfig.cacheFile);
const translator = new Translator(defaultConfig);
let config = { ...defaultConfig };
let translationLog = [];

// DOM 元素
const elements = {
  gamePath: null,
  injectStatus: null,
  serviceSelect: null,
  ollamaUrl: null,
  modelSelect: null,
  sourceLang: null,
  targetLang: null,
  enabled: null,
  translationLog: null,
  cacheStats: null,
  cacheList: null,
  importFile: null
};

document.addEventListener('DOMContentLoaded', () => {
  // 初始化元素
  elements.gamePath = document.getElementById('game-path');
  elements.injectStatus = document.getElementById('inject-status');
  elements.serviceSelect = document.getElementById('service-select');
  elements.ollamaUrl = document.getElementById('ollama-url');
  elements.modelSelect = document.getElementById('model-select');
  elements.sourceLang = document.getElementById('source-lang');
  elements.targetLang = document.getElementById('target-lang');
  elements.enabled = document.getElementById('enabled');
  elements.translationLog = document.getElementById('translation-log');
  elements.cacheStats = document.getElementById('cache-stats');
  elements.cacheList = document.getElementById('cache-list');
  elements.importFile = document.getElementById('import-file');

  // 加载配置
  loadConfig();

  // 如果Ollama服务选中，自动加载模型
  if (config.service === 'ollama') {
    loadOllamaModels();
  }

  // 服务切换事件
  elements.serviceSelect.addEventListener('change', (e) => {
    if (e.target.value === 'ollama') {
      loadOllamaModels();
    }
  });

  // 更新缓存显示
  updateCacheDisplay();

  // 拖拽事件
  const dropZone = document.getElementById('drop-zone');
  dropZone.addEventListener('dragover', handleDragOver);
  dropZone.addEventListener('drop', handleDrop);

  // 导入文件点击
  const importBtn = document.querySelector('button[onclick="importCache()"]');
  if (importBtn) importBtn.addEventListener('click', () => elements.importFile.click());

  // 实时翻译模拟 (实际需桥接游戏事件；这里测试用)
  setInterval(simulateTranslation, 10000); // 每10s模拟一次翻译
});

// 拖拽处理
function handleDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'copy';
  document.getElementById('drop-zone').classList.add('dragover');
}

function handleDrop(e) {
  e.preventDefault();
  document.getElementById('drop-zone').classList.remove('dragover');
  const files = e.dataTransfer.files;
  if (files.length > 0) {
    const filePath = files[0].path;
    const gameDir = path.dirname(filePath);
    elements.gamePath.value = gameDir;
    updateInjectStatus(`游戏路径设置: ${gameDir}`, 'success');
  }
}

// 注入插件
function injectPlugin() {
  const gamePath = elements.gamePath.value.trim();
  if (!gamePath || !fs.existsSync(gamePath)) {
    updateInjectStatus('无效游戏路径', 'error');
    return;
  }

  try {
    const pluginPath = path.join(__dirname, 'rpg-mv-translator-plugin.js');
    const targetDir = path.join(gamePath, 'js', 'plugins');
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const targetPath = path.join(targetDir, 'rpg-mv-translator-plugin.js');
    fs.copyFileSync(pluginPath, targetPath);

    // 启用插件 (修改plugins.js如果存在)
    const pluginsJsPath = path.join(gamePath, 'js', 'plugins.js');
    if (fs.existsSync(pluginsJsPath)) {
      let pluginsContent = fs.readFileSync(pluginsJsPath, 'utf8');
      if (!pluginsContent.includes('rpg-mv-translator-plugin')) {
        pluginsContent = pluginsContent.replace('// Plugin Manager', '// Plugin Manager\nPluginManager.registerCommand("rpg-mv-translator-plugin", "init", init);');
        fs.writeFileSync(pluginsJsPath, pluginsContent);
      }
    }

    updateInjectStatus('插件注入成功！重启游戏生效。', 'success');
  } catch (error) {
    updateInjectStatus(`注入失败: ${error.message}`, 'error');
  }
}

// 更新注入状态
function updateInjectStatus(message, type = '') {
  elements.injectStatus.textContent = message;
  elements.injectStatus.className = `inject-status ${type}`;
}

// 加载Ollama模型列表
async function loadOllamaModels() {
  const url = elements.ollamaUrl.value || config.ollamaUrl;
  try {
    const response = await fetch(`${url}/api/tags`);
    if (response.ok) {
      const data = await response.json();
      const select = elements.modelSelect;
      select.innerHTML = '<option value="">选择模型...</option>';
      data.models.forEach(model => {
        const option = document.createElement('option');
        option.value = model.name;
        option.textContent = model.name;
        select.appendChild(option);
      });
      // 设置当前模型
      select.value = config.ollamaModel;
      updateInjectStatus('Ollama模型列表加载成功', 'success');
    } else {
      updateInjectStatus('加载模型失败: ' + response.statusText, 'error');
    }
  } catch (error) {
    updateInjectStatus('加载模型失败: ' + error.message, 'error');
  }
}

window.loadOllamaModels = loadOllamaModels;

// 保存配置
function saveConfig() {
  config.service = elements.serviceSelect.value;
  config.ollamaUrl = elements.ollamaUrl.value;
  config.ollamaModel = elements.modelSelect.value || elements.modelSelect.options[elements.modelSelect.selectedIndex].value;
  config.sourceLang = elements.sourceLang.value;
  config.targetLang = elements.targetLang.value;
  config.enabled = elements.enabled.checked;

  // 保存到文件
  const configPath = './config.json';
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

  // 更新翻译器
  translator.config = config;

  updateInjectStatus('配置保存成功', 'success');
}

// 加载配置
function loadConfig() {
  const configPath = './config.json';
  if (fs.existsSync(configPath)) {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  }
  elements.serviceSelect.value = config.service;
  elements.ollamaUrl.value = config.ollamaUrl;
  elements.modelSelect.value = config.ollamaModel;
  elements.sourceLang.value = config.sourceLang;
  elements.targetLang.value = config.targetLang;
  elements.enabled.checked = config.enabled;
}

// 清空日志
function clearLog() {
  translationLog = [];
  elements.translationLog.textContent = '';
}

// 更新翻译日志
function addToLog(original, translated, source = 'cache') {
  const timestamp = new Date().toLocaleTimeString();
  const entry = `[${timestamp}] ${original} -> ${translated} (${source})`;
  translationLog.push(entry);
  elements.translationLog.textContent += entry + '\n';
  elements.translationLog.scrollTop = elements.translationLog.scrollHeight;
}

// 更新缓存显示
function updateCacheDisplay() {
  const stats = cache.getStats();
  elements.cacheStats.textContent = `缓存条目: ${stats.total}`;

  const list = elements.cacheList;
  list.innerHTML = '';
  const entries = Object.entries(cache.cache).slice(0, 20); // 显示前20条
  entries.forEach(([key, value]) => {
    const li = document.createElement('li');
    li.innerHTML = `<span>${key}</span><span>${value}</span>`;
    list.appendChild(li);
  });
}

// 加载缓存 (从文件)
function loadCache() {
  cache.load();
  updateCacheDisplay();
  updateInjectStatus('缓存加载成功', 'success');
}

// 导出缓存
function exportCache() {
  const data = cache.exportJSON();
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'translations.json';
  a.click();
  URL.revokeObjectURL(url);
}

// 导入缓存
function importCache() {
  // 通过文件输入
  // onchange 已绑定
}

function handleImport(e) {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (event) => {
      if (cache.importJSON(event.target.result)) {
        updateCacheDisplay();
        updateInjectStatus('缓存导入成功', 'success');
      } else {
        updateInjectStatus('导入失败: 无效JSON', 'error');
      }
    };
    reader.readAsText(file);
  }
}

// 模拟翻译 (实际替换为游戏事件监听)
async function simulateTranslation() {
  if (!config.enabled) return;

  const testTexts = ['オーブ', 'モード', 'スペル'];
  const randomText = testTexts[Math.floor(Math.random() * testTexts.length)];

  if (cache.has(randomText)) {
    const translated = cache.get(randomText);
    addToLog(randomText, translated, 'cache');
  } else {
    try {
      const translated = await translator.translate(randomText, config.sourceLang, config.targetLang);
      cache.set(randomText, translated);
      addToLog(randomText, translated, 'api');
      updateCacheDisplay();
    } catch (error) {
      addToLog(randomText, randomText, 'error');
    }
  }
}

// 暴露全局函数供HTML onclick使用
window.handleDrop = handleDrop;
window.handleDragOver = handleDragOver;
window.injectPlugin = injectPlugin;
window.saveConfig = saveConfig;
window.clearLog = clearLog;
window.loadCache = loadCache;
window.exportCache = exportCache;
window.importCache = importCache;
window.handleImport = handleImport;
window.loadOllamaModels = loadOllamaModels;