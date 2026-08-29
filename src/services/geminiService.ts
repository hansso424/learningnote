/**
 * Gemini AI Service for Reflection Note
 * Handles Handwriting OCR and Reflection Question Generation
 */

export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function recognizeHandwriting(
  file: File,
  apiKey?: string
): Promise<string> {
  const key = apiKey?.trim();

  if (key) {
    try {
      const base64 = await fileToBase64(file);
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(
        key
      )}`;

      const payload = {
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: '이미지에 있는 학생의 손글씨 공책 필기를 읽어 텍스트로 깔끔하게 변환해주세요. 읽을 수 없는 부분은 추측하지 말고 [판독불가]라고 표시하세요. 부가적인 인사나 설명 없이 변환된 텍스트 내용만 출력하세요.',
              },
              {
                inlineData: {
                  mimeType: file.type || 'image/jpeg',
                  data: base64,
                },
              },
            ],
          },
        ],
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const data = await response.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text && text.trim()) {
          return text.trim();
        }
      }
    } catch (err) {
      console.warn('Gemini OCR API error, using fallback simulated recognition:', err);
    }
  }

  // If no API key or API call failed, provide a helpful message
  throw new Error('API 키가 설정되지 않았거나 이미지를 읽지 못했습니다. 직접 입력해주세요.');
}

export async function generateReflectionQuestion(
  subject: string,
  step1Text: string,
  topic?: string,
  targetGrade?: string,
  apiKey?: string
): Promise<{ question: string; hint: string }> {
  const key = apiKey?.trim();

  if (key) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(
        key
      )}`;

      const prompt = `과목: ${subject}
학습 주제: ${topic || '미입력'}
대상 학년: ${targetGrade || '초등학생'}
학생의 배움 기록:
${step1Text}

당신은 학생들을 따뜻하게 격려하는 친절한 선생님입니다. 서비스 이름은 「생각 한 칸 더」입니다.
학생이 작성한 학습 주제와 배움 기록을 바탕으로, 단순 암기 확인이 아니라 학생의 생각과 감정, 실생활 연결, 또는 '생각을 한 칸 더' 넓힐 수 있는 맞춤형 성찰 질문 1개와 구체적인 생각 힌트 1개를 만들어주세요.
학생의 학년 수준에 알맞은 다정하고 쉬운 어조를 사용하세요.`;

      const payload = {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'OBJECT',
            properties: {
              question: { type: 'STRING', description: '학생을 위한 깊은 성찰 질문' },
              hint: { type: 'STRING', description: '답변을 돕는 친절한 생각 힌트' },
            },
            required: ['question', 'hint'],
          },
        },
      };

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (rawText) {
          const parsed = JSON.parse(rawText);
          if (parsed.question && parsed.hint) {
            return {
              question: parsed.question,
              hint: parsed.hint,
            };
          }
        }
      }
    } catch (e) {
      console.warn('Gemini question generation error, falling back to heuristic question:', e);
    }
  }

  // Pedagogical fallback questions tailored to subjects
  const fallbackBySubject: Record<string, { question: string; hint: string }> = {
    국어: {
      question: '오늘 배운 이야기나 글에서 가장 마음에 와닿았던 표현이나 인물의 행동은 무엇이고, 왜 그렇게 생각했나요?',
      hint: '내가 그 인물이었다면 어땠을지 상상해보거나, 가장 기억에 남는 문장을 떠올려보세요.',
    },
    수학: {
      question: '오늘 배운 수학 개념이나 문제 해결 방법은 우리 생활 속 어디에서 유용하게 쓰일 수 있을까요?',
      hint: '마트에서 물건을 살 때, 시간을 계산할 때, 길이를 잴 때 등 주변의 상황을 떠올려보세요.',
    },
    사회: {
      question: '오늘 배운 사회 현상이나 역사적 사실을 통해 지금 우리 사회나 나의 삶을 돌아보면 어떤 생각이 드나요?',
      hint: '그 당시 사람들의 마음은 어땠을지, 혹은 우리 동네와 비교했을 때 어떤 점이 다른지 생각해보세요.',
    },
    과학: {
      question: '오늘 배운 과학 원리를 직접 관찰하거나 실험해보고 싶은 나만의 궁금한 점은 무엇인가요?',
      hint: '"만약 ~라면 어떻게 될까?" 하는 호기심이나 우리 주변에서 비슷한 현상을 본 적이 있는지 떠올려보세요.',
    },
    영어: {
      question: '오늘 배운 단어나 문장 중 외국인 친구를 만났을 때 가장 먼저 써보고 싶은 표현은 무엇인가요?',
      hint: '그 표현을 사용하는 나의 모습을 상상하며 간단한 상황극을 머릿속으로 그려보세요.',
    },
    도덕: {
      question: '오늘 배운 가치를 내일 나의 하루 생활에서 실천해본다면 어떤 작은 행동부터 시작할 수 있을까요?',
      hint: '친구에게 건네는 따뜻한 말 한마디나 스스로 지킬 수 있는 약속을 생각해보세요.',
    },
    음악: {
      question: '오늘 배운 음악이나 활동은 나에게 어떤 기분이나 느낌을 선물해주었나요?',
      hint: '마음속에 떠오른 색깔이나 날씨, 기분을 자유롭게 표현해보세요.',
    },
    미술: {
      question: '오늘 작품이나 표현 활동을 하면서 나의 마음이나 생각이 가장 잘 담긴 부분은 어디인가요?',
      hint: '색칠할 때나 만들 때 가장 정성을 들였던 순간을 떠올려보세요.',
    },
    체육: {
      question: '오늘 활동에서 내가 가장 뿌듯했던 순간이나 친구들과 함께 협동하며 느낀 점은 무엇인가요?',
      hint: '승패와 상관없이 내가 최선을 다한 순간이나 친구를 응원했던 기억을 적어보세요.',
    },
  };

  const selected = fallbackBySubject[subject] || {
    question: '오늘 배운 내용 중에서 친구나 가족에게 가장 자랑스럽게 알려주고 싶은 핵심은 무엇인가요?',
    hint: '가장 새롭게 알게 된 사실이나 나를 놀라게 했던 내용을 하나 골라보세요.',
  };

  return selected;
}

import { ReflectionAnalysis, ReflectionLevelNumber, ReflectionLevelName } from '../types';

const LEVEL_NAMES: Record<ReflectionLevelNumber, ReflectionLevelName> = {
  1: '사실 나열',
  2: '이유 설명',
  3: '개념 연결',
  4: '전이 및 적용',
};

const STOPWORDS = new Set([
  '오늘', '오늘은', '나는', '내가', '우리는', '우리', '그리고', '해서', '했다', '배웠다', '배웠습니다',
  '알았다', '알게', '되었다', '너무', '정말', '있다', '있습니다', '것이다', '생각한다', '생각', '생각이',
  '선생님', '수업', '시간', '느꼈다', '같다', '같습니다', '통해', '대한', '모두', '그것', '이것', '저것',
  '에서', '으로', '하게', '때문', '하기', '위해', '다시', '매우', '가장', '관련', '내용', '기록', '단계',
  '어떤', '무엇', '어떻게', '조금', '많이', '진짜', '한번', '있는', '없는', '하는', '되는', '보면', '들었다'
]);

export function extractKeywordsFromText(text: string): string[] {
  if (!text) return [];
  // Split words and clean punctuation
  const rawWords = text
    .replace(/[^\w\sㄱ-ㅎ가-힣]/g, ' ')
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 2);

  const freq: Record<string, number> = {};
  for (const word of rawWords) {
    // Strip common Korean noun postpositions
    const cleaned = word.replace(/(이|가|을|를|은|는|에|의|로|와|과|도|만|에게|에서|으로|보다|처럼|마다|조차)$/, '');
    if (cleaned.length >= 2 && !STOPWORDS.has(cleaned) && !STOPWORDS.has(word)) {
      freq[cleaned] = (freq[cleaned] || 0) + 1;
    }
  }

  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([w]) => w);
}

/**
 * Heuristic fallback reflection level classifier that evaluates cognitive depth
 * regardless of text length or subject.
 */
export function heuristicAnalyzeReflection(
  subject: string,
  topic: string | undefined,
  step1Text: string,
  step2Text: string
): ReflectionAnalysis {
  const combined = `${step1Text} ${step2Text} ${topic || ''}`.trim();
  const step2Trim = (step2Text || '').trim();
  const step1Trim = (step1Text || '').trim();

  const keywords = extractKeywordsFromText(combined);

  // Transfer & Application (Level 4) patterns:
  // Applying learned concepts to real life, school, personal experience, new domain
  const level4Regex = /(실제\s*생활|우리\s*생활|일상|일상생활|나의\s*삶|학교에서도|교실에서도|집에서도|내\s*경험|사회에서도|반장의\s*결정|대표의\s*결정|빨래가|생활\s*속|실생활|적용|활용|새로운\s*상황|비교할\s*수\s*있|설명할\s*수\s*있|바꿀\s*수\s*있|미칠\s*수\s*있|실천|나도\s*앞으로|다른\s*문제)/i;

  // Concept Linking (Level 3) patterns:
  // Connecting distinct concepts, macro/social causality, general principle, multi-concept relationship
  const level3Regex = /(정치적\s*결정|사회의\s*변화|나라의\s*운명|정착\s*생활|마을이\s*생겨|농사를\s*짓기\s*시작하면서|같은\s*단위로\s*바꾸|단위를\s*같은\s*단위|개념|원리|관계|상호작용|영향을\s*줄\s*수\s*있다는\s*것을\s*알았다|연결|일반화|더\s*넓은|법칙|공통점|차이점)/i;

  // Reasoning & Cause-Effect (Level 2) patterns:
  // Explaining why, how, mechanism, causes
  const level2Regex = /(위화도\s*회군|계기|이유는|원인은|때문에|때문이다|광합성|단위가\s*다르기|왜냐하면|이로\s*인해|결과로|원리로|과정으로|과정을\s*통해|햇빛을\s*받아야|수\s*있기\s*때문)/i;

  let level: ReflectionLevelNumber = 1;
  let reason = '학생이 수업에서 배운 사실과 핵심 내용을 기억하고 정리하였습니다.';
  let evidence = step1Trim || combined;

  if (level4Regex.test(combined)) {
    level = 4;
    reason = '배운 학습 개념의 원리를 실제 생활, 학교 상황 또는 새로운 경험에 전이하여 적용하고 있습니다.';
    // Find matching sentence
    const sentences = combined.split(/(?<=[.?!])\s+/);
    evidence = sentences.find((s) => level4Regex.test(s)) || (step2Trim || step1Trim);
  } else if (level3Regex.test(combined)) {
    level = 3;
    reason = '서로 다른 학습 개념이나 원인과 결과의 관계를 넓은 시각에서 연결하여 설명하고 있습니다.';
    const sentences = combined.split(/(?<=[.?!])\s+/);
    evidence = sentences.find((s) => level3Regex.test(s)) || (step2Trim || step1Trim);
  } else if (level2Regex.test(combined) || combined.includes('때문') || combined.includes('이유') || combined.includes('계기')) {
    level = 2;
    reason = '학습 내용의 이유, 원인 또는 발생 과정을 명확하게 설명하고 있습니다.';
    const sentences = combined.split(/(?<=[.?!])\s+/);
    evidence = sentences.find((s) => level2Regex.test(s)) || (step1Trim || step2Trim);
  } else {
    level = 1;
    reason = '수업에서 배운 사실이나 주요 내용을 나열하고 정리하고 있습니다.';
    evidence = step1Trim || combined;
  }

  return {
    reflectionLevel: level,
    levelName: LEVEL_NAMES[level],
    confidence: 0.88,
    reason,
    evidence: evidence.slice(0, 140),
    keywords,
  };
}

/**
 * AI-powered reflection depth analysis for student reflections.
 * Evaluates cognitive thought depth across 4 pedagogical levels.
 */
export async function analyzeReflectionDepth(
  subject: string,
  topic: string | undefined,
  step1Text: string,
  step2Text: string,
  targetGrade?: string,
  apiKey?: string
): Promise<ReflectionAnalysis> {
  const key = apiKey?.trim();

  if (key) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(
        key
      )}`;

      const prompt = `당신은 초·중등 교육과정 전문가 및 성찰 사고 분석 AI입니다.
학생의 배움노트(1단계 배움 기록 및 2단계 생각 한 칸 더)를 분석하여 학생의 '성찰 깊이'를 다음 4단계 중 하나로 정확하게 분류해주세요.

[성찰 깊이 4단계 기준]
1단계: 사실 나열
- 배운 사실이나 내용을 단순 나열/정리하는 수준 (원인, 이유, 관계, 해석 거의 없음)
- 예: "오늘은 조선의 건국 과정을 배웠다.", "조선은 이성계가 세웠다.", "오늘 분수의 덧셈을 배웠다."

2단계: 이유 설명
- '왜', '어떻게', '무엇 때문에' 등의 이유, 원인, 과정, 원리를 설명하는 수준
- 예: "이성계가 위화도 회군을 한 것이 조선 건국의 중요한 계기가 되었다.", "분모가 다른 분수를 바로 더할 수 없는 이유는 단위가 다르기 때문이다.", "식물은 햇빛을 받아야 광합성을 할 수 있기 때문에 햇빛이 필요하다."

3단계: 개념 연결
- 하나의 학습 내용을 다른 개념/내용/사회적 영향과 연결하거나, 개념 간의 관계 및 일반화된 원리를 설명하는 수준
- 예: "권력을 가진 사람의 결정이 나라의 운명을 바꿀 수 있다는 것을 알았다.", "위화도 회군과 조선 건국을 통해 한 사람의 정치적 결정이 사회 변화에 영향을 준다는 것을 알았다.", "신석기 시대 농경 시작이 정착 생활과 마을 형성으로 이어졌다."

4단계: 전이 및 적용
- 배운 내용을 새로운 상황, 실제 생활, 학교/자신의 경험, 다른 문제에 적용하거나 새로운 상황에서 추론/활용하는 수준
- 예: "리더의 결정이 사회에 미치는 영향을 배우고, 학교에서도 반장의 결정이 학급 분위기를 바꿀 수 있다는 생각이 들었다.", "물의 증발 원리를 생각해보면 빨래가 햇빛에서 더 빨리 마르는 이유를 설명할 수 있다.", "분수의 덧셈 원리로 실생활의 서로 다른 단위 문제도 해결할 수 있겠다."

[매우 중요한 판단 원칙]
- 절대로 글의 길이로 판단하지 마세요. 짧은 문장이라도 깊은 연결/적용이 있다면 3~4단계가 될 수 있으며, 긴 문장이라도 단순 나열이면 1단계입니다.
- 과목에 종속되지 않고 학생의 실제 사고 구조를 공정하게 분석하세요.
- 학생의 1단계 기록과 2단계 생각한칸더 답변을 종합하여 학생이 도달한 최고 수준의 성찰 깊이를 판단하세요.

[학생 배움노트 데이터]
- 과목: ${subject}
- 학습 주제: ${topic || '미입력'}
- 1단계 배움 기록: ${step1Text}
- 2단계 생각 한 칸 더: ${step2Text}
- 대상 학년: ${targetGrade || '초등학생'}`;

      const payload = {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'OBJECT',
            properties: {
              reflectionLevel: {
                type: 'INTEGER',
                description: '성찰 깊이 단계 (1, 2, 3, 4)',
              },
              levelName: {
                type: 'STRING',
                description: '단계 이름 (사실 나열, 이유 설명, 개념 연결, 전이 및 적용)',
              },
              confidence: {
                type: 'NUMBER',
                description: '분석 신뢰도 (0.0 ~ 1.0)',
              },
              reason: {
                type: 'STRING',
                description: '해당 단계로 판단한 중립적이고 교육적인 이유',
              },
              evidence: {
                type: 'STRING',
                description: '판단의 근거가 된 학생 글의 핵심 문장',
              },
              keywords: {
                type: 'ARRAY',
                items: { type: 'STRING' },
                description: '학생 글에서 추출한 핵심 학습 개념 키워드 3~5개',
              },
            },
            required: ['reflectionLevel', 'levelName', 'confidence', 'reason', 'evidence'],
          },
        },
      };

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (rawText) {
          const parsed = JSON.parse(rawText);
          const lvl = Number(parsed.reflectionLevel) as ReflectionLevelNumber;
          if ([1, 2, 3, 4].includes(lvl)) {
            return {
              reflectionLevel: lvl,
              levelName: LEVEL_NAMES[lvl] || parsed.levelName,
              confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.9,
              reason: parsed.reason || 'AI 분석 완료',
              evidence: parsed.evidence || step1Text,
              keywords: Array.isArray(parsed.keywords) && parsed.keywords.length > 0
                ? parsed.keywords
                : extractKeywordsFromText(`${step1Text} ${step2Text}`),
            };
          }
        }
      }
    } catch (err) {
      console.warn('Gemini reflection analysis error, using pedagogical heuristics:', err);
    }
  }

  // Fallback heuristic evaluation
  return heuristicAnalyzeReflection(subject, topic, step1Text, step2Text);
}

/**
 * Generates neutral, supportive class reflection insights for teachers.
 */
export function generateClassInsightSummary(
  distribution: { level: ReflectionLevelNumber; count: number; percent: number }[],
  topKeywords: string[],
  subjectAverages: { subject: string; average: number; count: number }[]
): {
  overviewText: string;
  bulletPoints: string[];
  pedagogicalSuggestion: string;
} {
  const total = distribution.reduce((sum, d) => sum + d.count, 0);

  if (total === 0) {
    return {
      overviewText: '아직 분석할 학생 배움노트가 등록되지 않았습니다.',
      bulletPoints: ['학생들이 방 코드를 통해 접속하여 첫 성찰을 작성하면 자동으로 통계가 산출됩니다.'],
      pedagogicalSuggestion: '수업 후 5분간 배운 내용과 AI 확장 질문을 작성하도록 안내해보세요.',
    };
  }

  const dominant = [...distribution].sort((a, b) => b.count - a.count)[0];
  const level3And4Count = distribution.filter((d) => d.level >= 3).reduce((sum, d) => sum + d.count, 0);
  const level3And4Percent = Math.round((level3And4Count / total) * 100);

  let overviewText = `오늘 제출된 배움노트는 ${dominant.level}단계 '${LEVEL_NAMES[dominant.level]}'에 가장 많이 분포(${dominant.percent}%)되어 있습니다.`;
  if (dominant.level <= 2) {
    overviewText += ` 학생들이 학습 내용을 체계적으로 정리하고 원인과 이유를 설명하는 단계에 안정적으로 도달하였습니다.`;
  } else {
    overviewText += ` 많은 학생들이 단순 암기를 넘어 개념 간의 연결과 실생활 적용으로 사고를 깊이 있게 확장하고 있습니다.`;
  }

  const bullets: string[] = [
    `가장 많은 학생(${dominant.percent}%)이 ${dominant.level}단계 '${LEVEL_NAMES[dominant.level]}' 수준의 성찰을 기록했습니다.`,
    `개념을 연결하거나 실생활에 적용한 심화 성찰(3단계 이상) 비율은 전체의 ${level3And4Percent}%입니다.`,
  ];

  if (topKeywords.length > 0) {
    bullets.push(`학생들이 가장 주목한 핵심 학습 키워드는 '${topKeywords.slice(0, 4).join("', '")}'입니다.`);
  }

  if (subjectAverages.length > 0) {
    const highestSub = [...subjectAverages].sort((a, b) => b.average - a.average)[0];
    if (highestSub && highestSub.count > 0) {
      bullets.push(`과목 중 '${highestSub.subject}' 과목의 평균 성찰 깊이(${highestSub.average.toFixed(1)}단계)가 가장 높게 나타났습니다.`);
    }
  }

  let suggestion = '다음 수업에서는 학생들이 배운 개념 사이의 관계를 짝과 함께 비교해보거나, 일상생활의 유사 사례를 찾아보는 활동을 더해보는 것도 좋습니다.';
  if (level3And4Percent < 20) {
    suggestion = '학습 개념을 다른 교과나 일상 속 경험과 연결해보는 발문이나 생각 나눔 시간을 짧게 구성해보시면 학생들의 사고 전이에 도움이 됩니다.';
  } else {
    suggestion = '학생들의 높은 사고 확장을 바탕으로, 모둠별 적용 사례 발표나 창의적 문제 해결 토론으로 수업을 심화해보실 수 있습니다.';
  }

  return {
    overviewText,
    bulletPoints: bullets,
    pedagogicalSuggestion: suggestion,
  };
}
