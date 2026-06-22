export const HSK_LEVELS = [
  { label: 'HSK 1级', value: 'hsk1', desc: '500词·初等', vocabCount: 500, stage: '初等', ability: '能理解并使用最简单的词语和句子，满足基本交际需求' },
  { label: 'HSK 2级', value: 'hsk2', desc: '1272词·初等', vocabCount: 1272, stage: '初等', ability: '能就熟悉的话题进行简单交流，理解日常高频词汇' },
  { label: 'HSK 3级', value: 'hsk3', desc: '2245词·初等', vocabCount: 2245, stage: '初等', ability: '能完成生活、学习、工作等方面的基本交际任务' },
  { label: 'HSK 4级', value: 'hsk4', desc: '3245词·中等（留学基准）', vocabCount: 3245, stage: '中等', ability: '能就比较复杂的话题讨论，词汇覆盖常用生活及学术场景' },
  { label: 'HSK 5级', value: 'hsk5', desc: '4316词·中等', vocabCount: 4316, stage: '中等', ability: '能阅读中文报刊，进行较完整的演讲和书面表达' },
  { label: 'HSK 6级', value: 'hsk6', desc: '5456词·中等', vocabCount: 5456, stage: '中等', ability: '能轻松理解各类中文信息，流利表达，接近母语者日常水平' },
  { label: 'HSK 7-9级', value: 'hsk789', desc: '11092词·高等', vocabCount: 11092, stage: '高等', ability: '具备在专业、学术领域进行高水平交际的能力' },
  { label: '不限制', value: 'none', desc: '不限HSK等级', vocabCount: 0, stage: '', ability: '' },
];

export const WORD_COUNT_OPTIONS = [
  { label: '100字', value: 100 },
  { label: '200字', value: 200 },
  { label: '300字', value: 300 },
  { label: '400字', value: 400 },
  { label: '500字', value: 500 },
  { label: '600字', value: 600 },
  { label: '…自定义', value: 'custom' },
];

export const REGISTER_OPTIONS = [
  { label: '口语', value: 'spoken', desc: '自然口语风格，符合真实交际' },
  { label: '书面语', value: 'written', desc: '正式书面语风格，语法规范' },
];

export const PURPOSE_OPTIONS = [
  { label: '背诵', value: 'memorize', desc: '便于记忆，逻辑连贯，自然流畅' },
  { label: '写作', value: 'writing', desc: '语法准确，应试化，标注语法格式' },
  { label: '演讲', value: 'speech', desc: '吸引观众，逻辑流畅，松弛有度' },
  { label: '考试', value: 'exam', desc: '贴近HSK真题风格阅读文本' },
  { label: '聊天', value: 'chat', desc: '母语者自然对话，互动性强' },
  { label: '…智能选择', value: 'auto', desc: '根据语言学理论智能生成' },
];

export const LOGIC_OPTIONS = [
  { label: '仅使用输入的词汇', value: 'only_input', desc: '严格只使用用户提供的词汇' },
  { label: '智能增加额外核心词汇', value: 'smart_add', desc: '智能扩展相关词汇' },
];

export const EXPAND_OPTIONS = [
  { label: '相似性扩展', value: 'similar', desc: '同义词、近义词、同类词' },
  { label: '相关性扩展', value: 'related', desc: '场景相关词、联想词' },
  { label: '…智能综合', value: 'auto', desc: '综合分析最优扩展方式' },
];

export const MODEL_OPTIONS = [
  { label: '平衡版', value: 'gpt-5.4', desc: '速度与质量均衡，适合日常使用' },
  { label: '质量版', value: 'gpt-5.5', desc: '输出质量更优，适合精细化需求' },
];

export const LANGUAGE_OPTIONS = [
  { label: '英语', value: 'en' }, { label: '日语', value: 'ja' }, { label: '韩语', value: 'ko' }, { label: '泰语', value: 'th' },
  { label: '德语', value: 'de' }, { label: '法语', value: 'fr' }, { label: '西班牙语', value: 'es' }, { label: '葡萄牙语', value: 'pt' },
  { label: '俄语', value: 'ru' }, { label: '阿拉伯语', value: 'ar' }, { label: '印地语', value: 'hi' }, { label: '印尼语', value: 'id' },
  { label: '越南语', value: 'vi' }, { label: '马来语', value: 'ms' }, { label: '意大利语', value: 'it' }, { label: '荷兰语', value: 'nl' },
  { label: '波兰语', value: 'pl' }, { label: '土耳其语', value: 'tr' }, { label: '斯瓦希里语', value: 'sw' }, { label: '汉语方言', value: 'dialect' },
  { label: '…其他语言', value: 'custom' },
];
