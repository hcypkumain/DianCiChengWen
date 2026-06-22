import { HSK_LEVELS, LANGUAGE_OPTIONS, REGISTER_OPTIONS } from './config.js';

const HSK_RULES = {
  hsk1: { vocab: 500, sentenceRule: '每句不超过8个字，只用最基础的主谓宾简单句，绝不出现复合句或从句', lexicalRule: '严格限制在HSK1词表约500词以内，包括：你、我、他、好、大、小、吃、喝、来、去、看、说、学习、汉语、工作、朋友、今天等基础词', syntaxRule: '只用"SVO"基本句型及"是……的"判断句，不用任何关联词（因为、虽然、但是等均禁止），不用补语结构', exampleSentence: '我吃饭。他喝水。这是书。她来学校。我学汉语。今天很好。', forbiddenWords: '禁止：经历、感受、逐渐、习惯、熟悉、经验、情况、问题、关系、影响、表示、认为、发现、已经、一直、其实、应该、可能、需要、注意' },
  hsk2: { vocab: 1272, sentenceRule: '每句不超过12个字，可以有1个简单的并列或顺承复合句，避免多重嵌套', lexicalRule: '使用HSK1-2词表共约1272词，新增词汇包括：周末、地方、事情、结果、觉得、希望、帮助、方便、安静、干净等', syntaxRule: '可用"先……然后……"、"又……又……"、"一边……一边……"等基础关联词，可用简单的"把"字句，不用"被"字句，不用"虽然……但是……"', exampleSentence: '他先去商店，然后回家。她又唱歌，又跳舞。我一边吃饭，一边看电视。', forbiddenWords: '禁止：经历、感受、逐渐、文化、社会、发展、影响、环境、提高、加强、建立、实现、目前、实际、相当、总体、基本上、普遍' },
  hsk3: { vocab: 2245, sentenceRule: '每句不超过18个字，可以使用转折、因果、假设等基础复合句，但每句最多1层嵌套', lexicalRule: '使用HSK1-3词表共约2245词，新增词汇包括：经历、感受、文化、社会、环境、提高、安排、计划、方法、重要、认真、努力等', syntaxRule: '可用"虽然……但是……"、"如果……就……"、"不但……而且……"、"越来越"等，可用"被"字句、简单的定语从句，可用比较句（比……更……）', exampleSentence: '虽然天气很冷，但是他还是去学校了。如果明天不下雨，我们就去公园。他的汉语越来越好了。', forbiddenWords: '禁止：反映、折射、彰显、潜移默化、付诸实践、呈现、诠释、凸显、契合、层面、维度、视角、范畴、构建、赋予、渗透' },
  hsk4: { vocab: 3245, sentenceRule: '每句不超过22个字，可用多重修饰语和并列定语，复合句可以有2层结构，句式较为灵活', lexicalRule: '使用HSK1-4词表共约3245词，新增词汇包括：反映、影响、关键、过程、效果、代表、目标、特点、形成、发挥、具有、表现、体现等', syntaxRule: '可用"即使……也……"、"尽管……还是……"、"之所以……是因为……"等复杂关联词，可用简单的"使"字兼语句，可使用定语从句，可用倒装强调句', exampleSentence: '通过不断努力，他终于实现了自己的目标。这个问题之所以重要，是因为它影响了整个计划。', forbiddenWords: '禁止：呈现、折射、潜移默化、彰显、付诸实践、荡然无存、俨然、诠释、凸显、契合、层面、维度、蕴含、审视、探讨（书面深度词）' },
  hsk5: { vocab: 4316, sentenceRule: '每句不超过28个字，可用较复杂的多重从句，允许含丰富定语和状语的长句，但要保持逻辑清晰', lexicalRule: '使用HSK1-5词表共约4316词，可使用常见成语（如：一举两得、事半功倍、循序渐进），可用专业常见词汇', syntaxRule: '可用"与其……不如……"、"宁可……也不……"、"何况"、"况且"、"从而"、"进而"等较复杂关联词，可用倒装句、省略句、含多层修饰的复杂结构', exampleSentence: '在过去几十年里，随着经济的持续发展，人们的生活水平有了显著提高，物质条件得到了极大改善。', forbiddenWords: '禁止：彰显、付诸实践、荡然无存、诠释（哲学义）、蕴含深意、折射出、契合时代、凸显价值、赋予内涵、审视问题' },
  hsk6: { vocab: 5456, sentenceRule: '句子长度不限，句式丰富多样，可以使用较长的复合句，接近受过良好教育的非母语者书面语水平', lexicalRule: '使用HSK1-6全部词表约5456词，可以适当使用成语、惯用语和固定搭配，词汇选择考究，搭配自然', syntaxRule: '可用倒装句、省略句、互文句等修辞结构，可用"固然"、"诚然"、"毕竟"、"不妨"等书面词，句式变化多样，逻辑层次清晰', exampleSentence: '面对这一挑战，他没有选择退缩，而是积极寻找解决问题的有效途径，最终取得了令人满意的结果。', forbiddenWords: '避免生僻字、冷僻成语和文言词汇，保持现代书面汉语风格，不用"之乎者也"等古文形式' },
  hsk789: { vocab: 11092, sentenceRule: '句式完全自由，可灵活运用长句、短句、散句、整句，以服务语篇表达目的', lexicalRule: '可使用全部HSK词汇约11092词，包括专业学术词汇、成语典故、文学词汇和高级书面语词，词汇选择精准有力', syntaxRule: '所有现代汉语结构均可自由使用，句式选择服从语篇表达需要', exampleSentence: '语言不仅是交流的工具，更是文化认同与思维方式的载体。', forbiddenWords: '无特别禁止词汇，保持文体一致，不混用书面语与口语' },
};

export function buildSystemPrompt() {
  return `你是资深对外汉语教学文本生成专家，精通汉语词汇教学理论和语言习得研究。

【核心任务】根据用户提供的目标词汇，生成符合教学规范的高质量汉语教学文本。

【格式规范】
- 段落首行缩进两格（全角空格"　　"）
- 不使用任何markdown标记、项目符号或标题
- 文末单独一行写：（实际字数：N字）

【HSK等级原则】
使用的是2021年新版HSK标准，面向外国汉语学习者（非汉语母语者），不是中国本土教育体系。各等级的词汇量和句式难度以外国学习者的认知发展为基准，须严格执行：
1. 词汇约束：除目标词汇外，其他词汇必须在该等级词表范围内
2. 句式约束：句子长度和复杂度必须严格遵守当前等级限制，不得超纲
3. 自然性：词汇须自然融入语境，不生硬罗列，体现词汇网络关联性

【语言习得理论依据】
根据认知心理学研究，词汇在记忆中以语义网络形式储存。本工具通过将词汇置于自然语境中，帮助学习者建立词汇网络，实现程序性知识习得。`;
}

export function buildUserPrompt(options) {
  const { words, register, hskLevel, wordCount, purpose, logic, expandType, language, customWordCount } = options;
  const wordList = parseWords(words);
  const targetCount = wordCount === 'custom' ? customWordCount || 200 : wordCount || 200;
  const regLabel = REGISTER_OPTIONS.find((item) => item.value === register)?.label || '书面语';
  const hskInfo = HSK_LEVELS.find((item) => item.value === hskLevel);
  const langLabel = LANGUAGE_OPTIONS.find((item) => item.value === language)?.label || '英语';
  const rule = HSK_RULES[hskLevel];
  const hskPart = rule ? `【HSK等级约束】${hskInfo ? hskInfo.label : hskLevel}（新HSK2021，累计${rule.vocab}词，外国学习者标准）
- 句式规则：${rule.sentenceRule}
- 词汇范围：${rule.lexicalRule}
- 句型说明：${rule.syntaxRule}
- 参考示例：${rule.exampleSentence}
- 严格禁止：${rule.forbiddenWords}` : '【HSK等级约束】不限制等级，自然流畅即可';

  const logicPart = logic === 'only_input'
    ? `【词汇逻辑】严格模式：只使用输入的词汇【${wordList.join('、')}】作为核心词汇，不引入其他主题词汇。
所有目标词汇必须至少出现一次，自然融入语境，不得生硬堆砌。`
    : buildExpandLogic(wordList, logic, expandType);

  const isAdvanced = hskLevel === 'hsk789' || hskLevel === 'hsk6';
  const purposePart = buildPurposePart(purpose, isAdvanced);
  const audiencePart = language === 'dialect'
    ? '【目标读者】汉语方言母语者，正在强化普通话书面语输入，文本需符合标准普通话规范。'
    : language === 'custom'
      ? '【目标读者】外语背景的汉语学习者，注意词汇选择与文化背景的普适性。'
      : `【目标读者】母语为${langLabel}的汉语学习者，注意词汇的可理解性和文化背景的跨语言普适性。`;

  return `【目标词汇】${wordList.join('、')}
【语体风格】${regLabel}
【目标字数】约${targetCount}字（偏差不超过10%）

${hskPart}

${purposePart}

${logicPart}

${audiencePart}

【输出要求】直接输出正文，段落首行缩进两格，不加任何标题或说明，文末写（实际字数：N字）。`;
}

function buildExpandLogic(wordList, logic, expandType) {
  if (logic !== 'smart_add') return `【词汇逻辑】以【${wordList.join('、')}】为核心词汇生成文本，确保所有目标词至少出现一次。`;
  if (expandType === 'similar') return `【词汇逻辑】相似性扩展：以【${wordList.join('、')}】为核心，按相似性原则（同义词、近义词、同类词）扩展补充词汇。
扩展词必须在当前HSK等级词表内，扩展量不超过核心词数量的50%。`;
  if (expandType === 'related') return `【词汇逻辑】相关性扩展：以【${wordList.join('、')}】为核心，按相关性原则（场景共现词、语义联想词）扩展补充词汇。
扩展词必须在当前HSK等级词表内，扩展量不超过核心词数量的50%。`;
  return `【词汇逻辑】综合扩展：以【${wordList.join('、')}】为核心，综合运用相似性（同义近义词）和相关性（场景联想词）两种扩展方式，智能补充最优词汇。
扩展词必须在当前HSK等级词表内，扩展量不超过核心词数量的50%。`;
}

function buildPurposePart(purpose, isAdvanced) {
  const purposeMap = {
    memorize: `【用途：背诵材料】
要求：逻辑连贯，节奏感强，段落之间词汇网络自然呼应。
重点词汇在文中至少出现一次，部分关键词可自然重现以加深印象。
语言流畅，读来朗朗上口，适合学习者反复朗读和背诵。`,
    writing: isAdvanced ? `【用途：写作示范】
要求：语法结构规范，句式多样，展示目标词汇如何自然融入高水平书面写作。
文章有明确的论点或主题，逻辑严谨，语言精练，直接呈现范文正文，不加任何注释或标注。` : `【用途：写作示范】
要求：语法结构规范，句式多样，展示目标词汇如何自然融入书面写作。
文章有明确的论点或主题，逻辑严谨，可作为学习者写作模板，直接呈现范文正文。`,
    speech: `【用途：演讲稿】
要求：开头有感染力，中间有详有略，结尾有力。
语言生动不空洞，有适当的排比或对比，能展示词汇在公开表达中的自然用法。
整体节奏张弛有度，适合在课堂上朗读演练。`,
    exam: `【用途：模拟阅读题】
要求：完全还原HSK阅读理解真题文本风格：客观叙述，信息密度适中。
包含代词指代关系、逻辑转折和因果关系，便于出题考查。
语言中性，无明显个人情感色彩，接近新闻报道或百科说明文风格。`,
    chat: `【用途：对话材料】
要求：使用甲乙两人对话格式（甲：……  乙：……），模拟真实日常交流。
话轮自然轮换，目标词汇融入对话情节而非强行插入。
对话长度相当于约3-5分钟的真实交流，语气口语化，符合交际真实性原则。`,
    auto: `【用途：智能生成】
请根据输入词汇的语义场和主题，自动选择最合适的文本类型（叙事/说明/对话/议论），
选择时优先考虑词汇的自然语境和学习者的习得效率。`,
  };
  return purposeMap[purpose] || purposeMap.auto;
}

export function parseWords(input) {
  if (!input) return [];
  return input.split(/[\s\n\r，,；;、。.]+/).map((word) => word.trim()).filter(Boolean);
}

export function countChineseChars(text) {
  const match = text.match(/（实际字数：(\d+)字）/);
  if (match) return parseInt(match[1], 10);
  return (text.match(/[\u4e00-\u9fa5]/g) || []).length;
}
