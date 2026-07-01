import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
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

const TEXT_TYPES = ['情景对话', '叙事短文', '说明短文', '考试阅读材料', '课堂角色扮演', '看图说话文本', '通知 / 公告'];
const LESSON_USES = ['新词导入', '课堂复习', '阅读理解', '口语操练', '写作示范'];
const AUDIENCES = ['成人学习者', '中学生', '零基础学习者', '进阶学习者', '汉语方言母语者'];
const FOCUS_OPTIONS = ['词汇覆盖', 'HSK 匹配', '课堂可用'];
const TAB_OPTIONS = [
  { id: 'text', label: '生成文本' },
  { id: 'vocab', label: '词汇说明' },
  { id: 'questions', label: '理解问题' },
  { id: 'activity', label: '课堂活动' },
];

const DEFAULT_FORM = {
  inputWords: '',
  topic: '',
  textType: '情景对话',
  hskLevel: 'hsk3',
  register: 'spoken',
  lessonUse: '新词导入',
  audience: 'en',
  grammar: '',
  goal: '',
  constraints: '',
  wordCount: 280,
  questionCount: 4,
  vocabMode: 'only_input',
  focus: '词汇覆盖',
  model: 'gpt-5.4',
};

const SAMPLE_FORM = {
  inputWords: '市场、水果、一斤、便宜、老板、商量、多少钱、我想要',
  topic: '在中国市场买水果',
  textType: '情景对话',
  hskLevel: 'hsk3',
  register: 'spoken',
  lessonUse: '新词导入',
  audience: 'en',
  grammar: '可以……吗；想要；多少钱',
  goal: '让学生能在购物场景中使用目标词汇，询问价格，表达购买需求，并尝试进行简单商量。',
  constraints: '每个目标词至少出现一次；句子不要太长；适合课堂朗读。',
  wordCount: 280,
  questionCount: 4,
  vocabMode: 'only_input',
  focus: '词汇覆盖',
  model: 'gpt-5.4',
};

const RELATED_WORDS = {
  市场: ['购物', '价格', '顾客'],
  水果: ['苹果', '香蕉', '新鲜'],
  交通: ['地铁', '站台', '方向'],
  城市: ['街道', '社区', '变化'],
  学习: ['复习', '练习', '课堂'],
  工作: ['任务', '同事', '会议'],
};

function App() {
  const [auth, setAuth] = useState(() => readStoredAuth());
  const [form, setForm] = useState(DEFAULT_FORM);
  const [toast, setToast] = useState('');
  const [activeTab, setActiveTab] = useState('text');
  const [loading, setLoading] = useState({ active: false, progress: 0, message: '' });
  const [status, setStatus] = useState({ tone: '', text: '等待输入' });
  const [result, setResult] = useState(null);
  const progressRef = useRef(null);
  const generationRef = useRef(0);

  const words = useMemo(() => parseWords(form.inputWords), [form.inputWords]);
  const annotatedWords = useMemo(() => lookupWords(words), [words]);
  const relatedWords = useMemo(() => (form.vocabMode === 'smart_add' ? buildRelatedWords(words) : []), [form.vocabMode, words]);
  const metrics = useMemo(() => computeMetrics(annotatedWords, form.hskLevel, form.wordCount, form.questionCount, Boolean(form.goal), Boolean(form.grammar)), [annotatedWords, form]);
  const preview = useMemo(() => buildPreview(form, words, relatedWords, metrics), [form, words, relatedWords, metrics]);
  const visibleResult = result || preview;

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 2200);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!words.length) {
      setStatus({ tone: '', text: '等待输入' });
      setResult(null);
      setActiveTab('text');
    } else if (!loading.active && !result) {
      setStatus({ tone: '', text: '已准备' });
    }
  }, [words.length, loading.active, result]);

  function saveAuth(nextAuth) {
    setAuth(nextAuth);
    if (nextAuth) localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextAuth));
    else localStorage.removeItem(AUTH_STORAGE_KEY);
  }

  function updateField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
    setResult(null);
  }

  function logout() {
    saveAuth(null);
    setResult(null);
    setToast('已退出登录');
  }

  function fillExample() {
    setForm(SAMPLE_FORM);
    setResult(null);
    setActiveTab('text');
    setStatus({ tone: '', text: '已恢复示例' });
    setToast('已填入示例');
  }

  function clearInputs() {
    setForm(DEFAULT_FORM);
    setResult(null);
    setActiveTab('text');
    setStatus({ tone: '', text: '输入已清空' });
    setToast('输入已清空');
  }

  function startProgress() {
    clearInterval(progressRef.current);
    const messages = [
      '正在检索 HSK 词汇等级并分配颜色。',
      '正在计算词汇覆盖率、等级距离和课堂可用性。',
      '正在根据文本类型组织语篇结构。',
      '正在生成可直接教学的文本材料。',
    ];
    setLoading({ active: true, progress: 8, message: messages[0] });
    progressRef.current = setInterval(() => {
      setLoading((current) => {
        if (current.progress >= 86) return current;
        const next = current.progress + (current.progress < 40 ? 9 : current.progress < 70 ? 5 : 2);
        const index = Math.min(messages.length - 1, Math.floor(next / 25));
        return { active: true, progress: next, message: messages[index] };
      });
    }, 420);
  }

  async function generate(event) {
    event.preventDefault();
    if (loading.active) return;
    if (!words.length) {
      setStatus({ tone: 'error', text: '需要词汇' });
      setToast('请输入至少 1 个目标词');
      return;
    }

    const generationId = generationRef.current + 1;
    generationRef.current = generationId;
    startProgress();
    setStatus({ tone: 'loading', text: '生成中' });
    setResult(null);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 70000);
    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth?.token || ''}` },
        body: JSON.stringify({
          words: form.inputWords,
          register: form.register,
          hskLevel: form.hskLevel,
          wordCount: form.wordCount,
          purpose: purposeFromTextType(form.textType),
          logic: form.vocabMode,
          expandType: 'auto',
          language: form.audience,
          model: form.model,
          customWordCount: form.wordCount,
        }),
        signal: controller.signal,
      });
      const data = await response.json();
      if (generationRef.current !== generationId) return;
      if (response.status === 401) {
        saveAuth(null);
        throw new Error('登录已过期，请重新登录');
      }
      if (!response.ok || !data.text) throw new Error(data.error || '生成失败，请重试');
      const text = sanitizeOutputText(data.text);
      const next = buildResultFromText(text, form, words, relatedWords, metrics);
      clearInterval(progressRef.current);
      setLoading({ active: true, progress: 100, message: '生成完成。' });
      setTimeout(() => {
        if (generationRef.current !== generationId) return;
        setLoading({ active: false, progress: 0, message: '' });
        setResult(next);
        setActiveTab('text');
        setStatus({ tone: '', text: '已生成' });
        setToast('已完成 HSK 检索并生成文本');
      }, 280);
    } catch (error) {
      if (generationRef.current !== generationId) return;
      clearInterval(progressRef.current);
      setLoading({ active: false, progress: 0, message: '' });
      setStatus({ tone: 'error', text: '生成失败' });
      setToast(error.name === 'AbortError' ? '生成超时，请重试' : error.message || '生成失败，请重试');
    } finally {
      clearTimeout(timeout);
    }
  }

  async function copyCurrent() {
    try {
      await navigator.clipboard.writeText(getTabPlainText(visibleResult, activeTab));
      setToast('内容已复制');
    } catch {
      setToast('当前浏览器不支持自动复制');
    }
  }

  async function copySample() {
    try {
      await navigator.clipboard.writeText(getTabPlainText(preview, 'text'));
      setToast('样例已复制');
    } catch {
      setToast('当前浏览器不支持自动复制');
    }
  }

  function downloadCurrent() {
    const blob = new Blob([getTabPlainText(visibleResult, activeTab)], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = '点词成文-生成文本.txt';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    setToast('文本已下载');
  }

  if (!auth?.token) {
    return <LoginPage onAuthenticated={saveAuth} toast={toast} setToast={setToast} />;
  }

  return (
    <main className="shell">
      {toast && <div className="toast">{toast}</div>}
      <Topbar auth={auth} onLogout={logout} onCopySample={copySample} />
      <Hero />

      <section className="workspace" aria-label="点词成文工作台">
        <section className="panel input-panel">
          <PanelHeader kicker="INPUT" title="输入词汇与教学约束" />
          <form className="form" onSubmit={generate}>
            <div className={`field ${!words.length && status.tone === 'error' ? 'has-error' : ''}`}>
              <label htmlFor="vocabInput">目标词汇</label>
              <textarea
                id="vocabInput"
                className="textarea vocab-input"
                value={form.inputWords}
                maxLength={2000}
                placeholder="市场、水果、一斤、便宜、老板、商量、多少钱、我想要"
                onChange={(event) => updateField('inputWords', event.target.value)}
              />
              <p className="helper">支持换行、空格、逗号、顿号、分号分隔；输入后会自动显示 HSK 检索结果。</p>
              <p className="field-error">请输入至少 1 个目标词汇。</p>
            </div>

            <div className="parsed-vocab" aria-live="polite">
              {annotatedWords.length ? annotatedWords.map((item) => <HskChip key={item.word} item={item} />) : <span className="empty">等待输入目标词</span>}
            </div>

            <div className="grid-2">
              <SelectField label="文本类型" value={form.textType} options={TEXT_TYPES.map((item) => ({ label: item, value: item }))} onChange={(value) => updateField('textType', value)} />
              <SelectField label="目标等级" value={form.hskLevel} options={HSK_LEVELS.filter((item) => item.value !== 'none')} onChange={(value) => updateField('hskLevel', value)} />
              <SelectField label="语体" value={form.register} options={REGISTER_OPTIONS} onChange={(value) => updateField('register', value)} />
              <SelectField label="课堂用途" value={form.lessonUse} options={LESSON_USES.map((item) => ({ label: item, value: item }))} onChange={(value) => updateField('lessonUse', value)} />
              <SelectField label="学习者语种" value={form.audience} options={LANGUAGE_OPTIONS} onChange={(value) => updateField('audience', value)} />
              <SelectField label="模型" value={form.model} options={MODEL_OPTIONS} onChange={(value) => updateField('model', value)} />
            </div>

            <SegmentedControl
              label="教学重点"
              value={form.focus}
              options={FOCUS_OPTIONS}
              onChange={(value) => updateField('focus', value)}
            />

            <SegmentedControl
              label="词汇模式"
              value={form.vocabMode}
              options={LOGIC_OPTIONS.map((item) => ({ label: item.value === 'only_input' ? '仅用输入词' : '智能扩词', value: item.value }))}
              onChange={(value) => updateField('vocabMode', value)}
              two
            />
            <p className="helper">{form.vocabMode === 'only_input' ? '当前模式会尽量只使用你输入的目标词，不主动加入近义词或相关词。' : '当前模式会在输入词基础上补充相关、相似词汇，让文本更自然完整。'}</p>

            <RangeField label="文本长度" min="100" max="600" step="20" value={form.wordCount} suffix="字" onChange={(value) => updateField('wordCount', Number(value))} />
            <RangeField label="问题数量" min="2" max="8" step="1" value={form.questionCount} suffix="题" onChange={(value) => updateField('questionCount', Number(value))} />

            <TextField label="主题 / 场景" value={form.topic} placeholder="例如：在中国市场买水果" onChange={(value) => updateField('topic', value)} />
            <TextField label="语法点" value={form.grammar} placeholder="例如：可以……吗；想要；多少钱" onChange={(value) => updateField('grammar', value)} />
            <TextareaField label="教学目标" value={form.goal} placeholder="写下这段材料要训练的课堂能力。" onChange={(value) => updateField('goal', value)} />
            <TextareaField label="限制要求" value={form.constraints} placeholder="例如：每个词至少出现一次；句子不要太长。" onChange={(value) => updateField('constraints', value)} />

            <div className="form-actions">
              <button className="primary-button" type="submit" disabled={loading.active}>{loading.active ? '生成中……' : result ? '重新生成文本' : '生成文本'}</button>
              <div className="button-row">
                <button className="secondary-button" type="button" onClick={fillExample}>填入示例</button>
                <button className="secondary-button" type="button" onClick={clearInputs}>清空输入</button>
              </div>
            </div>
          </form>
        </section>

        <section className="panel output-panel">
          <div className="output-toolbar">
            <div className="tabs" role="tablist" aria-label="输出内容">
              {TAB_OPTIONS.map((tab) => (
                <button key={tab.id} type="button" role="tab" className={`tab ${activeTab === tab.id ? 'active' : ''}`} aria-selected={activeTab === tab.id} onClick={() => setActiveTab(tab.id)}>
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="tool-actions">
              <button className="icon-button" type="button" onClick={copyCurrent}>复制</button>
              <button className="icon-button" type="button" onClick={downloadCurrent}>下载 TXT</button>
            </div>
          </div>

          <div className="output-body">
            <article className={`document ${loading.active ? 'generating' : ''}`}>
              <div className="document-top">
                <div className="doc-meta">
                  <span className="meta-pill primary">{labelFor(HSK_LEVELS, form.hskLevel)}</span>
                  <span className="meta-pill">{form.textType}</span>
                  <span className="meta-pill">{form.focus}</span>
                  <span className="meta-pill">{form.vocabMode === 'only_input' ? '仅用输入词' : '智能扩词'}</span>
                </div>
                <span className={`status-dot ${status.tone}`}>{status.text}</span>
              </div>

              <GeneratedContent result={visibleResult} activeTab={activeTab} />
              <GenerationOverlay loading={loading} />
            </article>

            <aside className="inspector" aria-label="生成适配度">
              <h3>HSK 检索与适配度</h3>
              <ul className="word-list">
                {annotatedWords.length ? annotatedWords.map((item) => <HskChip as="li" key={item.word} item={item} />) : <li className="hsk-chip hsk-unknown">等待输入 <small>—</small></li>}
                {relatedWords.map((word) => <HskChip as="li" key={`related-${word}`} item={{ ...lookupWords([word])[0], related: true }} />)}
              </ul>
              <Metric label="词汇覆盖" value={metrics.coverage} />
              <Metric label="水平匹配" value={metrics.levelMatch} />
              <Metric label="课堂可用" value={metrics.classroom} />
              <div className="metric-explain">
                <div><b>词汇覆盖：</b>{metrics.coverage}% = 已识别并用于生成的输入词 / 输入词总数。</div>
                <div><b>水平匹配：</b>{metrics.levelMatch}% = 根据目标 HSK 与输入词等级距离估算。</div>
                <div><b>课堂可用：</b>{metrics.classroom}% = 综合篇幅、问题数量、语法点、教学目标和限制要求。</div>
              </div>
              <h3>生成约束</h3>
              <ul className="constraint-list">
                <li>文本类型：{form.textType}</li>
                <li>文本长度目标：约 {form.wordCount} 字</li>
                <li>课堂用途：{form.lessonUse}</li>
                <li>已收录 {metrics.knownCount} 个，未收录 {metrics.unknownCount} 个</li>
              </ul>
            </aside>
          </div>
        </section>
      </section>
    </main>
  );
}

function Topbar({ auth, onLogout, onCopySample }) {
  return (
    <header className="topbar">
      <a className="brand" href="#top" aria-label="点词成文首页">
        <span className="brand-mark">点</span>
        <span>点词成文</span>
      </a>
      <div className="nav-actions">
        <button className="ghost-link" type="button" onClick={onCopySample}>复制样例</button>
        <span className="user-pill">{auth.user?.phone}</span>
        <button className="small-button" type="button" onClick={onLogout}>退出</button>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="hero">
      <div className="hero-copy-block">
        <span className="eyebrow">HSK 检索与生成动画版</span>
        <h1>把目标词汇变成可直接教学的中文文本。</h1>
        <p className="hero-copy">输入课堂词汇，系统先完成 <strong>HSK 分级检索</strong>，再生成文本、词汇说明、理解问题和课堂活动建议。</p>
        <div className="quick-row">
          <span className="quick-chip">词汇复现</span>
          <span className="quick-chip">HSK 1-9</span>
          <span className="quick-chip">课堂活动</span>
          <span className="quick-chip">一键复制下载</span>
        </div>
      </div>
      <div className="visual-card" aria-hidden="true">
        <div className="preview-doc">
          <div className="doc-head">
            <div className="doc-title"><b>课堂文本</b><span>自动匹配 HSK 与教学目标</span></div>
            <span className="level-pill">HSK 3</span>
          </div>
          <div className="preview-vocab">
            <span>市场 <small>HSK 4</small></span>
            <span>水果 <small>HSK 1</small></span>
            <span>便宜 <small>HSK 1</small></span>
          </div>
          <div className="doc-lines"><span className="line" /><span className="line" /><span className="line" /><span className="line" /><span className="line" /></div>
          <div className="doc-footer">
            <div className="mini-panel"><span>词汇覆盖</span><b>100%</b></div>
            <div className="mini-panel"><span>课堂可用</span><b>94%</b></div>
          </div>
        </div>
      </div>
    </section>
  );
}

function LoginPage({ onAuthenticated, toast, setToast }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ phone: '', password: '', confirmPassword: '', terms: false });
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState({ type: '', message: '' });
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const isRegister = mode === 'register';

  function changeMode(nextMode) {
    setMode(nextMode);
    setErrors({});
    setStatus({ type: '', message: '' });
    setPasswordVisible(false);
  }

  function updateLoginField(name, value) {
    const nextValue = name === 'phone' ? value.replace(/\D/g, '').slice(0, 11) : value;
    setForm((current) => ({ ...current, [name]: nextValue }));
    setErrors((current) => ({ ...current, [name]: false, terms: name === 'terms' ? false : current.terms }));
    if (status.type === 'error') setStatus({ type: '', message: '' });
  }

  function validateLoginForm() {
    const nextErrors = {};
    if (!/^1[3-9]\d{9}$/.test(form.phone.trim())) nextErrors.phone = true;
    if (form.password.length < 8) nextErrors.password = true;
    if (isRegister && (form.confirmPassword !== form.password || form.confirmPassword.length < 8)) nextErrors.confirmPassword = true;
    if (isRegister && !form.terms) nextErrors.terms = true;
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      setStatus({ type: 'error', message: nextErrors.terms ? '注册前请先同意服务条款与隐私政策。' : '请检查手机号和密码后再继续。' });
      return false;
    }
    return true;
  }

  async function submit(event) {
    event.preventDefault();
    if (submitting) return;
    if (!validateLoginForm()) return;
    setSubmitting(true);
    setStatus({ type: 'success', message: isRegister ? '正在创建账号并进入工程页面…' : '正在验证账号并进入工程页面…' });
    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: mode, phone: form.phone, password: form.password }),
      });
      const data = await response.json();
      if (!response.ok || !data.token) throw new Error(data.error || '操作失败，请重试');
      onAuthenticated({ token: data.token, user: data.user });
      setToast(isRegister ? '注册成功' : '登录成功');
    } catch (error) {
      setStatus({ type: 'error', message: error.message || '操作失败，请重试' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      {toast && <div className="toast">{toast}</div>}
      <section className="brand-panel" aria-label="点词成文产品介绍">
        <div className="brand-top">
          <a className="brand" href="#" aria-label="点词成文">
            <span className="brand-mark" aria-hidden="true">点</span>
            <span>点词成文</span>
          </a>
          <span className="locale-pill">简体中文 · CN</span>
        </div>

        <div className="login-hero-copy">
          <div className="eyebrow">对外汉语教师的词汇文本生成工程</div>
          <h1>登录后，继续生成可直接上课的中文文本。</h1>
          <p>
            点词成文围绕 <strong>目标词汇、HSK 等级、文本类型与课堂目标</strong> 生成教学材料。
            适合新词导入、阅读理解、口语操练和测验材料准备。
          </p>
        </div>

        <div className="product-shot" aria-label="产品预览">
          <article className="screen-card">
            <div className="screen-toolbar">
              <div className="traffic" aria-hidden="true"><span /><span /><span /></div>
              <b>HSK Lookup · Text Generation</b>
            </div>
            <div className="screen-body">
              <div className="vocab-row">
                <span className="chip hsk-2">市场 <small>HSK2</small></span>
                <span className="chip hsk-1">水果 <small>HSK1</small></span>
                <span className="chip hsk-3">一斤 <small>HSK3</small></span>
                <span className="chip hsk-4">商量 <small>HSK4</small></span>
              </div>
              <h2 className="mock-title">市场里的水果</h2>
              <div className="mock-lines" aria-hidden="true">
                <div className="mock-line" />
                <div className="mock-line" />
                <div className="mock-line" />
                <div className="mock-line" />
              </div>
              <div className="score-strip">
                <div className="score"><span>词汇覆盖</span><b>100%</b></div>
                <div className="score"><span>水平匹配</span><b>86%</b></div>
                <div className="score"><span>课堂可用</span><b>92%</b></div>
              </div>
            </div>
          </article>

          <aside className="insight-card">
            <ul className="insight-list">
              <li>输入词汇后自动检索 HSK 等级并分色。</li>
              <li>根据学习者水平生成对话、短文、通知、考试阅读等材料。</li>
              <li>适配度显示计算依据，便于教师判断是否可直接使用。</li>
            </ul>
            <div className="metric-card">
              <span>当前工程状态</span>
              <b>教学材料生成台</b>
            </div>
          </aside>
        </div>
      </section>

      <section className="form-panel" aria-label="登录与注册">
        <article className="auth-card">
          <div className="auth-head">
            <h2>{isRegister ? '创建账号' : '欢迎回来'}</h2>
            <p>{isRegister ? '注册后即可进入点词成文工程页面，开始生成课堂文本。' : '使用手机号和密码登录，进入点词成文工程页面。'}</p>
          </div>

          <div className="switcher" role="tablist" aria-label="登录或注册">
            <button type="button" className={!isRegister ? 'active' : ''} role="tab" aria-selected={!isRegister} disabled={submitting} onClick={() => changeMode('login')}>登录</button>
            <button type="button" className={isRegister ? 'active' : ''} role="tab" aria-selected={isRegister} disabled={submitting} onClick={() => changeMode('register')}>注册</button>
          </div>

          <form className="auth-form" onSubmit={submit} noValidate>
            <div className={`auth-field ${errors.phone ? 'has-error' : ''}`}>
              <label htmlFor="loginPhone">手机号</label>
              <div className="input-wrap">
                <span className="prefix">+86</span>
                <input
                  className="auth-input phone"
                  id="loginPhone"
                  value={form.phone}
                  inputMode="numeric"
                  autoComplete="tel"
                  placeholder="请输入 11 位手机号"
                  maxLength={11}
                  aria-invalid={errors.phone ? 'true' : undefined}
                  aria-describedby="phoneError"
                  onChange={(event) => updateLoginField('phone', event.target.value)}
                />
              </div>
              <p className="error" id="phoneError">请输入有效的 11 位中国大陆手机号。</p>
            </div>

            <div className={`auth-field ${errors.password ? 'has-error' : ''}`}>
              <div className="field-row">
                <label htmlFor="loginPassword">密码</label>
                {!isRegister && <button className="forgot" type="button" onClick={() => setStatus({ type: 'success', message: '已为你预留找回密码入口：实际接入时可跳转到短信验证流程。' })}>忘记密码？</button>}
              </div>
              <div className="input-wrap">
                <input
                  className="auth-input"
                  id="loginPassword"
                  value={form.password}
                  type={passwordVisible ? 'text' : 'password'}
                  autoComplete={isRegister ? 'new-password' : 'current-password'}
                  placeholder="请输入密码"
                  aria-invalid={errors.password ? 'true' : undefined}
                  aria-describedby="passwordHelp passwordError"
                  onChange={(event) => updateLoginField('password', event.target.value)}
                />
                <button className="password-toggle" type="button" aria-pressed={passwordVisible} onClick={() => setPasswordVisible((value) => !value)}>
                  {passwordVisible ? '隐藏' : '显示'}
                </button>
              </div>
              <p className="helper" id="passwordHelp">至少 8 位，建议包含字母与数字。</p>
              <p className="error" id="passwordError">密码至少需要 8 位。</p>
            </div>

            {isRegister && (
              <>
                <div className={`auth-field ${errors.confirmPassword ? 'has-error' : ''}`}>
                  <label htmlFor="confirmPassword">确认密码</label>
                  <div className="input-wrap">
                    <input
                      className="auth-input"
                      id="confirmPassword"
                      value={form.confirmPassword}
                      type="password"
                      autoComplete="new-password"
                      placeholder="请再次输入密码"
                      aria-invalid={errors.confirmPassword ? 'true' : undefined}
                      aria-describedby="confirmError"
                      onChange={(event) => updateLoginField('confirmPassword', event.target.value)}
                    />
                  </div>
                  <p className="error" id="confirmError">两次输入的密码不一致。</p>
                </div>

                <label className={`checkbox-row ${errors.terms ? 'has-error' : ''}`}>
                  <input type="checkbox" checked={form.terms} onChange={(event) => updateLoginField('terms', event.target.checked)} />
                  <span>我已阅读并同意 <a href="#">服务条款</a> 与 <a href="#">隐私政策</a>，并确认该账号用于教学材料生成。</span>
                </label>
              </>
            )}

            {status.message && <div className={`status-message show ${status.type}`} role="status" aria-live="polite">{status.message}</div>}

            <button className={`primary-button login-submit ${submitting ? 'loading' : ''}`} disabled={submitting}>
              <span className="spinner" aria-hidden="true" />
              <span className="button-text">{submitting ? '请稍候…' : isRegister ? '注册并进入工程' : '登录并进入工程'}</span>
            </button>
          </form>

          <p className="fineprint">
            继续即表示你同意点词成文对账号安全、教学内容生成和使用记录进行必要处理。
            <a href="#">了解更多</a>
          </p>
        </article>
      </section>
    </main>
  );
}

function PanelHeader({ kicker, title }) {
  return <div className="panel-header"><span className="panel-kicker">{kicker}</span><h2 className="panel-title">{title}</h2></div>;
}

function SelectField({ label, value, options, onChange }) {
  return <label className="field"><span>{label}</span><select className="select" value={value} onChange={(event) => onChange(event.target.value)}>{options.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>;
}

function TextField({ label, value, placeholder, onChange }) {
  return <label className="field"><span>{label}</span><input className="input" value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} /></label>;
}

function TextareaField({ label, value, placeholder, onChange }) {
  return <label className="field"><span>{label}</span><textarea className="textarea compact" value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} /></label>;
}

function SegmentedControl({ label, value, options, onChange, two = false }) {
  return (
    <fieldset className="field">
      <legend className="field-legend">{label}</legend>
      <div className={`segmented ${two ? 'two' : ''}`}>
        {options.map((item) => {
          const option = typeof item === 'string' ? { label: item, value: item } : item;
          return <button key={option.value} type="button" aria-pressed={value === option.value} className={`segment ${value === option.value ? 'active' : ''}`} onClick={() => onChange(option.value)}>{option.label}</button>;
        })}
      </div>
    </fieldset>
  );
}

function RangeField({ label, value, min, max, step, suffix, onChange }) {
  return (
    <label className="field">
      <span>{label}</span>
      <div className="range-row">
        <input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(event.target.value)} />
        <span className="range-value">{value}{suffix}</span>
      </div>
    </label>
  );
}

function HskChip({ item, as: Component = 'span' }) {
  const level = item.level === '7-9' ? '7' : item.level || 'unknown';
  return <Component className={`hsk-chip hsk-${level}`}>{item.word} <small>{item.related ? '扩展 · ' : ''}{item.levelLabel}</small></Component>;
}

function Metric({ label, value }) {
  return <div className="metric"><div className="metric-head"><span>{label}</span><b>{value}%</b></div><div className="score-track"><span style={{ width: `${value}%` }} /></div></div>;
}

function GeneratedContent({ result, activeTab }) {
  if (!result?.hasWords) {
    return <section className="generated-content"><div className="empty-state"><div className="state-card"><b>先输入目标词</b><p>在左侧粘贴课堂词汇后，这里会先检索 HSK 等级，再生成对应文本、词汇说明、理解问题和课堂活动。</p></div></div></section>;
  }
  const html = result[activeTab] || result.text;
  return <section className="generated-content is-entering" dangerouslySetInnerHTML={{ __html: html }} />;
}

function GenerationOverlay({ loading }) {
  return (
    <div className="generation-overlay" aria-hidden={!loading.active}>
      <div className="generation-card">
        <b>正在生成</b>
        <p>{loading.message || '正在准备生成任务。'}</p>
        <div className="progress-track"><div className="progress-fill" style={{ width: `${Math.min(100, Math.round(loading.progress))}%` }} /></div>
        <ul className="generation-steps">
          {['HSK 检索', '适配度计算', '结构组织', '文本生成'].map((item, index) => <li key={item} className={loading.progress > (index + 1) * 24 ? 'done' : loading.progress > index * 24 ? 'active' : ''}>{item}</li>)}
        </ul>
      </div>
    </div>
  );
}

function buildPreview(form, words, relatedWords, metrics) {
  const hasWords = words.length > 0;
  if (!hasWords) return { hasWords: false, text: '', vocab: '', questions: '', activity: '' };
  const topic = form.topic || '一次课堂练习';
  const allWords = [...words, ...relatedWords];
  const title = escapeHtml(topic);
  const safeWords = allWords.map(escapeHtml);
  const first = safeWords[0] || '目标词';
  const second = safeWords[1] || '课堂';
  const third = safeWords[2] || '练习';
  const text = `<h2>${title}</h2><p>老师把“${safeWords.join('、')}”写在黑板上，请学生先判断这些词的 HSK 等级，再把它们放进真实语境。</p><p>甲说：“我想重点练习‘${first}’，因为这个词在日常交流里很常见。”乙回答：“那我们可以围绕${second}设计一个小场景，让每个词自然出现。”</p><p>练习结束后，学生不仅记住了${third}，也能说明这些词之间的关系。这样，零散的词汇就变成了一段可以朗读、讨论和改写的课堂文本。</p><p>（实际字数：${Math.max(120, Math.round(form.wordCount * 0.55))}字）</p>`;
  return {
    hasWords,
    text,
    vocab: buildVocabHtml(words, relatedWords),
    questions: buildQuestionsHtml(allWords, form.questionCount, topic),
    activity: buildActivityHtml(words, relatedWords, form, metrics),
  };
}

function buildResultFromText(text, form, words, relatedWords, metrics) {
  const paragraphs = sanitizeOutputText(text).split(/\n+/).map((line) => line.trim()).filter(Boolean);
  return {
    hasWords: true,
    text: `<h2>${escapeHtml(form.topic || form.textType)}</h2>${paragraphs.map((line) => `<p>${escapeHtml(line)}</p>`).join('')}`,
    vocab: buildVocabHtml(words, relatedWords),
    questions: buildQuestionsHtml([...words, ...relatedWords], form.questionCount, form.topic || form.textType),
    activity: buildActivityHtml(words, relatedWords, form, metrics, countChineseChars(text)),
  };
}

function buildVocabHtml(words, relatedWords) {
  const base = lookupWords(words);
  const related = lookupWords(relatedWords).map((item) => ({ ...item, related: true }));
  return `<h2>词汇说明</h2>${[...base, ...related].map((item, index) => `<p><span class="hsk-chip hsk-${item.level === '7-9' ? '7' : item.level || 'unknown'}">${escapeHtml(item.word)} <small>${item.related ? '扩展 · ' : ''}${item.levelLabel}</small></span>：${['可以放在场景开头，用来建立语境。', '适合放进人物对话，帮助学生进行口语操练。', '可以和地点、动作、数量搭配，形成完整句子。', '适合做替换练习，让学生换人、换地点、换物品。'][index % 4]}</p>`).join('')}`;
}

function buildQuestionsHtml(words, count, topic) {
  const pool = words.length ? words : ['目标词'];
  return `<h2>理解问题</h2>${Array.from({ length: count }).map((_, index) => {
    const word = escapeHtml(pool[index % pool.length]);
    const questions = [
      `这段文本的主要场景是什么？`,
      `文本中“${word}”是什么意思？`,
      `说话人为什么要使用“${word}”这个词？`,
      `如果换一个场景，你可以怎样使用“${word}”？`,
      `这段材料适合训练哪一种课堂能力？`,
      `请用“${word}”再说一句话。`,
    ];
    return `<p>${index + 1}. ${escapeHtml(questions[index % questions.length].replace('这段文本', `“${topic}”`))}</p>`;
  }).join('')}`;
}

function buildActivityHtml(words, relatedWords, form, metrics, actualCount) {
  return `<h2>课堂活动建议</h2><p><strong>1. HSK 分级检查：</strong>学生先观察目标词颜色，判断哪些词更基础、哪些词更高级。</p><p><strong>2. 目标词定位：</strong>学生在文本中圈出 ${words.length} 个输入词，再说明每个词在句子里的作用。</p><p><strong>3. 词汇范围检查：</strong>${form.vocabMode === 'only_input' ? '检查文本是否严格围绕输入词展开。' : `比较输入词和扩展词：${relatedWords.join('、') || '相关表达'}。`}</p><p><strong>4. 输出展示：</strong>学生用${labelFor(REGISTER_OPTIONS, form.register)}复述文本，教师检查语法点“${escapeHtml(form.grammar || '根据输入词汇自然组织句子')}”是否自然出现。</p><p><strong>教师备注：</strong>目标长度约 ${form.wordCount} 字${actualCount ? `，实际约 ${actualCount} 字` : ''}；课堂可用度估算为 ${metrics.classroom}%。</p>`;
}

function buildRelatedWords(words) {
  const pool = words.flatMap((word) => RELATED_WORDS[word] || []);
  return [...new Set(pool)].filter((word) => !words.includes(word)).slice(0, Math.max(2, Math.min(6, words.length)));
}

function computeMetrics(annotatedWords, hskLevel, wordCount, questionCount, hasGoal, hasGrammar) {
  const total = annotatedWords.length;
  const knownCount = annotatedWords.filter((item) => item.level).length;
  const unknownCount = total - knownCount;
  const targetLevel = hskLevel === 'hsk789' ? 7 : Number(String(hskLevel).replace('hsk', '')) || 3;
  const distances = annotatedWords.map((item) => Math.abs((item.level === '7-9' ? 7 : Number(item.level) || targetLevel + 2) - targetLevel));
  const avgDistance = distances.length ? distances.reduce((sum, item) => sum + item, 0) / distances.length : 0;
  const coverage = total ? Math.round((knownCount / total) * 100) : 0;
  const levelMatch = clamp(Math.round(100 - avgDistance * 14 - unknownCount * 6), 0, 100);
  const classroom = clamp(Math.round(coverage * 0.34 + levelMatch * 0.26 + (questionCount >= 3 ? 12 : 6) + (wordCount >= 160 && wordCount <= 520 ? 12 : 6) + (hasGoal ? 8 : 2) + (hasGrammar ? 8 : 3)), 0, 100);
  return { coverage, levelMatch, classroom, knownCount, unknownCount };
}

function getTabPlainText(result, tab) {
  return stripHtml(result?.[tab] || result?.text || '');
}

function stripHtml(html) {
  const node = document.createElement('div');
  node.innerHTML = html;
  return node.innerText.trim();
}

function purposeFromTextType(type) {
  if (type.includes('考试')) return 'exam';
  if (type.includes('对话') || type.includes('角色')) return 'chat';
  if (type.includes('通知') || type.includes('说明')) return 'writing';
  return PURPOSE_OPTIONS.some((item) => item.value === 'memorize') ? 'memorize' : 'auto';
}

function labelFor(options, value) {
  return options.find((item) => String(item.value) === String(value))?.label || value;
}

function readStoredAuth() {
  try {
    const parsed = JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY) || 'null');
    return parsed?.token ? parsed : null;
  } catch {
    return null;
  }
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
  return String(value).replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char]);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

createRoot(document.getElementById('root')).render(<App />);
