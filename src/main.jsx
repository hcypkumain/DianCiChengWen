import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import {
  EXPAND_OPTIONS,
  HSK_LEVELS,
  LANGUAGE_OPTIONS,
  LOGIC_OPTIONS,
  MODEL_OPTIONS,
  PURPOSE_OPTIONS,
  REGISTER_OPTIONS,
  WORD_COUNT_OPTIONS,
} from './lib/config.js';
import { countChineseChars, parseWords } from './lib/prompt.js';
import { lookupWords } from './lib/hskVocab.js';
import './styles.css';

const AUTH_STORAGE_KEY = 'diancichengwen_auth';

const defaultState = {
  inputWords: '',
  selectedRegister: { value: '', label: '' },
  selectedHSK: { value: '', label: '' },
  selectedWordCount: { value: 200, label: '200字' },
  selectedPurpose: { value: '', label: '' },
  selectedLogic: { value: 'only_input', label: '仅使用输入的词汇', subValue: '', subLabel: '' },
  selectedLanguage: { value: '', label: '' },
  selectedModel: { value: 'gpt-5.4', label: '平衡版' },
  customWordCount: '',
};

function optionLabel(options, value) {
  return options.find((item) => String(item.value) === String(value))?.label || '';
}

function App() {
  const [auth, setAuth] = useState(() => readStoredAuth());
  const [state, setState] = useState(defaultState);
  const [sheet, setSheet] = useState({ visible: false, showSub: false, showCustom: false, custom: '' });
  const [loading, setLoading] = useState({ active: false, progress: 0, tip: '正在思考文本结构……' });
  const [result, setResult] = useState({ text: '', charCount: 0 });
  const [showInfo, setShowInfo] = useState(false);
  const [toast, setToast] = useState('');
  const resultRef = useRef(null);
  const progressRef = useRef(null);
  const generationRef = useRef(0);

  const wordLevels = lookupWords(parseWords(state.inputWords));
  const showCustomWordInput = state.selectedWordCount.value === 'custom';

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 2200);
    return () => clearTimeout(timer);
  }, [toast]);

  function saveAuth(nextAuth) {
    setAuth(nextAuth);
    if (nextAuth) {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextAuth));
    } else {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    }
  }

  function logout() {
    saveAuth(null);
    setResult({ text: '', charCount: 0 });
    setToast('已退出登录');
  }

  function openSheet(selectorId, label, options, subOptions, currentValue) {
    setSheet({ visible: true, selectorId, label, options, subOptions, currentValue: String(currentValue || ''), subValue: '', showSub: false, showCustom: false, custom: '' });
  }

  function closeSheet() {
    setSheet((prev) => ({ ...prev, visible: false, showSub: false, showCustom: false, custom: '' }));
  }

  function applySelection(item, subValue = '', subLabel = '') {
    const update = { value: item.value, label: item.label };
    setState((prev) => {
      if (sheet.selectorId === 'register') return { ...prev, selectedRegister: update };
      if (sheet.selectorId === 'hsk') return { ...prev, selectedHSK: update };
      if (sheet.selectorId === 'wordcount') return { ...prev, selectedWordCount: update, customWordCount: item.value === 'custom' ? '' : prev.customWordCount };
      if (sheet.selectorId === 'purpose') return { ...prev, selectedPurpose: update };
      if (sheet.selectorId === 'logic') return { ...prev, selectedLogic: { ...update, subValue, subLabel } };
      if (sheet.selectorId === 'language') return { ...prev, selectedLanguage: update };
      if (sheet.selectorId === 'model') return { ...prev, selectedModel: update };
      return prev;
    });
  }

  function onSheetItem(item) {
    if (item.value === 'custom') {
      setSheet((prev) => ({ ...prev, showCustom: true }));
      return;
    }
    if (sheet.selectorId === 'logic' && item.value === 'smart_add') {
      applySelection(item);
      setSheet((prev) => ({ ...prev, currentValue: item.value, showSub: true }));
      return;
    }
    applySelection(item);
    closeSheet();
  }

  function confirmCustom() {
    const value = sheet.custom.trim();
    if (!value) return;
    applySelection({ value: 'custom', label: value });
    closeSheet();
  }

  function startProgress() {
    clearInterval(progressRef.current);
    const tips = ['正在分析词汇语义网络……', '正在构建文本语境框架……', '正在生成语言材料……', '正在优化文本质量……', '即将完成……'];
    setLoading({ active: true, progress: 5, tip: '正在分析词汇……' });
    progressRef.current = setInterval(() => {
      setLoading((cur) => {
        if (cur.progress >= 85) return cur;
        const inc = cur.progress < 30 ? 8 : cur.progress < 60 ? 5 : 2;
        const step = Math.min(Math.floor(cur.progress / 20), tips.length - 1);
        return { active: true, progress: cur.progress + inc, tip: tips[step] };
      });
    }, 400);
  }

  async function generate() {
    if (loading.active) return;
    if (!state.inputWords.trim()) return setToast('请先输入词汇');
    if (!state.selectedRegister.value) return setToast('请选择语体');
    const generationId = generationRef.current + 1;
    generationRef.current = generationId;
    const targetCount = state.selectedWordCount.value === 'custom' ? parseInt(state.customWordCount, 10) || 200 : state.selectedWordCount.value || 200;
    const options = {
      words: state.inputWords,
      register: state.selectedRegister.value,
      hskLevel: state.selectedHSK.value || 'none',
      wordCount: targetCount,
      purpose: state.selectedPurpose.value || 'memorize',
      logic: state.selectedLogic.value || 'only_input',
      expandType: state.selectedLogic.subValue || 'auto',
      language: state.selectedLanguage.value || 'en',
      model: state.selectedModel.value || 'gpt-5.4',
      customWordCount: targetCount,
    };

    startProgress();
    setResult({ text: '', charCount: 0 });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 70000);
    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth?.token || ''}` },
        body: JSON.stringify(options),
        signal: controller.signal,
      });
      const data = await response.json();
      if (generationRef.current !== generationId) return;
      if (response.status === 401) {
        saveAuth(null);
        throw new Error('登录已过期，请重新登录');
      }
      if (!response.ok || !data.text) throw new Error(data.error || '生成失败，请重试');
      const cleanText = sanitizeOutputText(data.text);
      clearInterval(progressRef.current);
      setLoading({ active: true, progress: 100, tip: '生成完成！' });
      setTimeout(() => {
        if (generationRef.current !== generationId) return;
        setLoading({ active: false, progress: 0, tip: '正在思考文本结构……' });
        setResult({ text: cleanText, charCount: countChineseChars(cleanText) });
        setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
      }, 500);
    } catch (error) {
      if (generationRef.current !== generationId) return;
      clearInterval(progressRef.current);
      setLoading({ active: false, progress: 0, tip: '正在思考文本结构……' });
      setToast(error.name === 'AbortError' ? '生成超时，请重试' : error.message || '生成失败，请重试');
    } finally {
      clearTimeout(timeout);
    }
  }

  if (!auth?.token) {
    return <LoginPage onAuthenticated={saveAuth} toast={toast} setToast={setToast} />;
  }

  return (
    <main className="page-bg">
      {toast && <div className="toast">{toast}</div>}
      {loading.active && <LoadingCake progress={loading.progress} tip={loading.tip} />}
      <div className="user-bar">
        <span>{auth.user?.phone}</span>
        <button onClick={logout}>退出</button>
      </div>
      <section className="header-section">
        <span className="app-name">点词成文</span>
        <span className="app-subtitle">智能生成专业文本，适用汉语词汇教学</span>
        <h1 className="big-title">点词成文</h1>
      </section>

      <section className="input-section">
        <div className="input-label-row">
          <span className="input-label-text">输入词汇</span>
          <span className="input-hint">换行、空格、逗号、分号、顿号均可</span>
        </div>
        <div className="input-box-wrap">
          <textarea className="word-input" value={state.inputWords} maxLength={2000} placeholder="例如：消防车 轮胎 加速 刹车 停车场 或直接粘贴词汇列表……词汇未必需要展现直接相关性，可随意输入" onChange={(event) => setState((prev) => ({ ...prev, inputWords: event.target.value }))} />
          {state.inputWords && <button className="clear-btn" onClick={() => setState((prev) => ({ ...prev, inputWords: '' }))}>×</button>}
        </div>
      </section>

      {wordLevels.length > 0 && <div className="word-levels-wrap">{wordLevels.map((item) => <div className="word-chip" key={item.word}><span className="word-chip-text">{item.word}</span><span className={`word-chip-badge ${item.levelCss}`}>{item.levelLabel}</span></div>)}</div>}

      <div className="options-row">
        <OptionSelector id="register" label="语体" value={state.selectedRegister.value} options={REGISTER_OPTIONS} onOpen={openSheet} />
        <OptionSelector id="hsk" label="HSK等级" value={state.selectedHSK.value} options={HSK_LEVELS} onOpen={openSheet} />
        <OptionSelector id="wordcount" label="字数" value={state.selectedWordCount.value} options={WORD_COUNT_OPTIONS} onOpen={openSheet} />
        <OptionSelector id="purpose" label="用途" value={state.selectedPurpose.value} options={PURPOSE_OPTIONS} onOpen={openSheet} />
        <OptionSelector id="logic" label="生成逻辑" value={state.selectedLogic.value} options={LOGIC_OPTIONS} subOptions={EXPAND_OPTIONS} onOpen={openSheet} />
        <OptionSelector id="language" label="学习者语种" value={state.selectedLanguage.value} options={LANGUAGE_OPTIONS} onOpen={openSheet} />
        <OptionSelector id="model" label="模型" value={state.selectedModel.value} options={MODEL_OPTIONS} onOpen={openSheet} />
      </div>

      {showCustomWordInput && <div className="custom-word-wrap"><span>自定义字数：</span><input type="number" value={state.customWordCount} maxLength={5} placeholder="请输入" onChange={(event) => setState((prev) => ({ ...prev, customWordCount: event.target.value }))} /><span>字</span></div>}

      <button className={`generate-btn ${loading.active ? 'loading' : ''}`} disabled={loading.active} onClick={generate}>{loading.active ? '生成中……' : result.text ? '重 新 生 成' : '生 成 文 本'}</button>

      {result.text && <section ref={resultRef} className="result-section"><div className="result-header"><span className="result-title">生成文本</span><span className="result-count">实际字数：{result.charCount}字</span></div><RichEditor text={result.text} charCount={result.charCount} toast={setToast} /></section>}

      <section className="info-section">
        <button className="info-toggle" onClick={() => setShowInfo((prev) => !prev)}><span className="info-icon">i</span><span>使用说明</span><span>{showInfo ? '▲' : '▼'}</span></button>
        {showInfo && <div className="info-content">　　本工具以严谨的语言习得理论和词汇教学研究为基础，致力于解决传统汉语词汇教学中“先找课文、再选生词”的低效模式。<br /><br />　　根据认知心理学的研究，词汇在人类记忆中以语义网络的形式储存，孤立的词汇不易记忆，也不易检索。因此，本工具通过相似性、相关性和联想等方法，将词汇置于丰富的自然语境中，帮助学习者建立词汇网络，实现真正意义上的程序性知识习得。<br /><br />　　无论是希望集中强化词汇教学的汉语教师，还是正在备考HSK的汉语学习者，只需输入目标词汇，即可获得符合教学理论、语体适当、难度可控的高质量语言材料。</div>}
      </section>

      {sheet.visible && <div className="sheet-mask" onClick={closeSheet} />}
      <section className={`sheet-panel ${sheet.visible ? 'sheet-show' : ''}`}>
        <div className="sheet-header"><strong>{sheet.label}</strong><button onClick={closeSheet}>×</button></div>
        {!sheet.showSub && sheet.options?.map((item) => <button key={item.value} className={`sheet-item ${String(item.value) === String(sheet.currentValue) ? 'sheet-item-active' : ''}`} onClick={() => onSheetItem(item)}><span>{item.label}</span>{item.desc && <small>{item.desc}</small>}{String(item.value) === String(sheet.currentValue) && <b>✓</b>}</button>)}
        {!sheet.showSub && sheet.showCustom && <div className="sheet-custom-row"><input value={sheet.custom} autoFocus placeholder="请输入…" onChange={(event) => setSheet((prev) => ({ ...prev, custom: event.target.value }))} /><button onClick={confirmCustom}>确定</button></div>}
        {sheet.showSub && <><button className="sheet-sub-back" onClick={() => setSheet((prev) => ({ ...prev, showSub: false }))}>‹ 返回</button><div className="sheet-sub-title">选择扩展方式</div>{sheet.subOptions?.map((item) => <button key={item.value} className="sheet-item" onClick={() => { const main = sheet.options.find((option) => option.value === sheet.currentValue); applySelection(main, item.value, item.label); closeSheet(); }}><span>{item.label}</span>{item.desc && <small>{item.desc}</small>}</button>)}</>}
      </section>
    </main>
  );
}

function readStoredAuth() {
  try {
    const parsed = JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY) || 'null');
    return parsed?.token ? parsed : null;
  } catch {
    return null;
  }
}

function LoginPage({ onAuthenticated, toast, setToast }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ phone: '', password: '' });
  const [submitting, setSubmitting] = useState(false);

  async function submit(event) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: mode, phone: form.phone, password: form.password }),
      });
      const data = await response.json();
      if (!response.ok || !data.token) throw new Error(data.error || '操作失败，请重试');
      onAuthenticated({ token: data.token, user: data.user });
      setToast(mode === 'register' ? '注册成功' : '登录成功');
    } catch (error) {
      setToast(error.message || '操作失败，请重试');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      {toast && <div className="toast">{toast}</div>}
      <section className="login-visual" aria-hidden="true">
        <div className="login-brand">
          <CakeMark />
          <span>点词成文</span>
        </div>
        <div className="visual-copy">
          <span className="visual-kicker">汉语词汇教学工作台</span>
          <h2>把零散词汇，组织成可以直接教学的文本。</h2>
          <p>输入目标词、选择语体和难度，生成适合课堂、写作和复习的语言材料。</p>
        </div>
        <div className="preview-window">
          <div className="preview-toolbar"><span /><span /><span /></div>
          <img src="/image_214290945933763.png" alt="" />
        </div>
        <div className="floating-words">
          <span>语义网络</span>
          <span>HSK 7-9</span>
          <span>课堂文本</span>
          <span>词汇复现</span>
        </div>
      </section>
      <section className="login-panel">
        <section className="login-header">
          <CakeMark />
          <h1>点词成文</h1>
          <p>请先登录后使用文本生成工具</p>
        </section>
        <div className="login-tabs">
          <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>登录</button>
          <button type="button" className={mode === 'register' ? 'active' : ''} onClick={() => setMode('register')}>注册</button>
        </div>
        <form className="login-form" onSubmit={submit}>
          <label>
            <span>手机号</span>
            <input
              value={form.phone}
              inputMode="tel"
              autoComplete="tel"
              placeholder="请输入手机号"
              onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
            />
          </label>
          <label>
            <span>密码</span>
            <input
              value={form.password}
              type="password"
              autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
              placeholder="至少 6 位"
              onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
            />
          </label>
          <button className={`login-btn ${submitting ? 'loading' : ''}`} disabled={submitting}>
            {submitting ? '请稍候……' : mode === 'register' ? '注 册 并 登 录' : '登 录'}
          </button>
        </form>
        <p className="agreement">手机号仅用于账户登录，密码会加盐哈希后存储。</p>
      </section>
    </main>
  );
}

function OptionSelector({ id, label, value, options, subOptions = [], onOpen }) {
  const labelText = optionLabel(options, value);
  return <button className="selector-btn" onClick={() => onOpen(id, label, options, subOptions, value)}><span>{label}</span><strong className={labelText ? 'has-value' : ''}>{labelText || '请选择'}</strong><em>▾</em></button>;
}

function LoadingCake({ progress, tip }) {
  const rounded = Math.min(100, Math.round(progress));
  return <div className="loading-overlay"><div className="loading-box"><div className="cake-scene"><CakeMark animated /><div className="track-line" /></div><div className="progress-bar-bg"><div style={{ width: `${rounded}%` }} /></div><span className="progress-text">{rounded < 100 ? `${rounded}%` : '生成完成'}</span><p>{tip}</p></div></div>;
}

function CakeMark({ animated = false }) {
  return <div className={`cake-mark ${animated ? 'animated' : ''}`}><span /><i /><b /></div>;
}

function RichEditor({ text, charCount, toast }) {
  const [html, setHtml] = useState(textToHtml(text));
  const [toolbar, setToolbar] = useState(false);
  const editorRef = useRef(null);

  useEffect(() => setHtml(textToHtml(text)), [text]);

  function getText() {
    return editorRef.current?.innerText.trim() || '';
  }

  function command(name, value = null) {
    document.execCommand(name, false, value);
    editorRef.current?.focus();
  }

  async function copyText() {
    await navigator.clipboard.writeText(getText());
    toast('已复制到剪贴板');
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function exportImage() {
    const canvas = await html2canvas(editorRef.current, { backgroundColor: '#fafff8', scale: 2 });
    canvas.toBlob((blob) => blob && downloadBlob(blob, `点词成文_${Date.now()}.png`));
  }

  async function exportPDF() {
    const canvas = await html2canvas(editorRef.current, { backgroundColor: '#fafff8', scale: 2 });
    const img = canvas.toDataURL('image/jpeg', 0.95);
    const width = 595.28;
    const imgHeight = (canvas.height * width) / canvas.width;
    const pageHeight = Math.max(841.89, imgHeight);
    const pdf = new jsPDF({ orientation: 'p', unit: 'pt', format: [width, pageHeight] });
    pdf.addImage(img, 'JPEG', 0, 0, width, imgHeight);
    pdf.save(`点词成文_${Date.now()}.pdf`);
  }

  function exportWord() {
    const body = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{font-family:SimSun,serif;font-size:12pt;line-height:1.8}p{text-indent:2em;margin:4pt 0}</style></head><body>${editorRef.current.innerHTML}</body></html>`;
    downloadBlob(new Blob([body], { type: 'application/msword;charset=utf-8' }), `点词成文_${Date.now()}.doc`);
  }

  return <div className="editor-container"><div className="editor-topbar"><span>字数：{charCount}</span><div><button onClick={copyText}>复制</button><button onClick={exportImage}>图片</button><button onClick={exportPDF}>PDF</button><button onClick={exportWord}>Word</button></div></div><button className="toolbar-toggle" onClick={() => setToolbar((prev) => !prev)}>{toolbar ? '收起工具栏 ▲' : '编辑工具栏 ▼'}</button>{toolbar && <div className="toolbar-panel"><button onClick={() => command('bold')}>加粗</button><button onClick={() => command('underline')}>下划线</button><button onClick={() => command('strikeThrough')}>删除线</button><button onClick={() => command('backColor', '#fff9c4')}>高亮</button><button onClick={() => command('fontSize', '5')}>大字</button><button onClick={() => command('foreColor', '#cc3333')}>红色</button><button onClick={() => command('foreColor', '#2255aa')}>蓝色</button><button onClick={() => command('foreColor', '#336633')}>绿色</button><button onClick={() => command('undo')}>撤销</button><button onClick={() => command('redo')}>重做</button><button onClick={() => command('removeFormat')}>清除格式</button></div>}<article ref={editorRef} className="rich-editor" contentEditable suppressContentEditableWarning dangerouslySetInnerHTML={{ __html: html }} /></div>;
}

function textToHtml(value) {
  return sanitizeOutputText(value).split('\n').map((line) => `<p>${escapeHtml(line || ' ')}</p>`).join('');
}

function sanitizeOutputText(value) {
  return String(value || '')
    .normalize('NFC')
    .replace(/\uFEFF/g, '')
    .replace(/[\u200B-\u200D\u2060]/g, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\uFFFD+/g, '')
    .trim();
}

function escapeHtml(value) {
  return value.replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char]);
}

createRoot(document.getElementById('root')).render(<App />);
