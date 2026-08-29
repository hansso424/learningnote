import { LearningMaterial, NoteAnalysisResult, NoteAnalysisStatus } from '../types';

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

/**
 * Recognize student handwriting using server OCR API
 */
export async function recognizeHandwriting(
  file: File,
  apiKey?: string
): Promise<string> {
  try {
    const base64 = await fileToBase64(file);
    const res = await fetch('/api/ocr-handwriting', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageBase64: base64,
        mimeType: file.type || 'image/jpeg',
        apiKey,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.text && data.text.trim()) {
        return data.text.trim();
      }
    }
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || '손글씨 인식에 실패했습니다.');
  } catch (err: any) {
    console.warn('OCR error:', err);
    throw new Error(
      err.message || 'API 키가 설정되지 않았거나 이미지를 읽지 못했습니다. 직접 입력해주세요.'
    );
  }
}

export interface AnalyzeLearningNoteParams {
  studentName?: string;
  subject: string;
  topic: string;
  targetGrade?: string;
  step1Text: string;
  learningMaterials?: LearningMaterial[];
  apiKey?: string;
}

/**
 * Main AI Note Analysis & Question Generator
 * Calls backend API with fallback heuristic model
 */
export async function analyzeLearningNote(
  params: AnalyzeLearningNoteParams
): Promise<NoteAnalysisResult> {
  const {
    studentName,
    subject,
    topic,
    targetGrade,
    step1Text,
    learningMaterials = [],
    apiKey,
  } = params;

  try {
    const res = await fetch('/api/analyze-learning-note', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentName,
        subject,
        topic,
        targetGrade,
        step1Text,
        learningMaterials: learningMaterials.map((m) => ({
          title: m.title,
          subject: m.subject,
          grade: m.grade,
          unit: m.unit,
          topic: m.topic,
          description: m.description,
          extractedText: m.extractedText?.slice(0, 1500),
        })),
        apiKey,
      }),
    });

    if (res.ok) {
      const data = (await res.json()) as NoteAnalysisResult;
      if (data && data.status && data.feedback) {
        return data;
      }
    } else {
      const errJson = await res.json().catch(() => ({}));
      console.warn('Backend note analysis returned error:', errJson);
    }
  } catch (err) {
    console.warn('Backend note analysis network error, using local fallback:', err);
  }

  // Local Educational Heuristic Fallback
  return generateHeuristicAnalysis(params);
}

/**
 * Local heuristic analyzer for robust offline/no-key handling
 */
function generateHeuristicAnalysis(
  params: AnalyzeLearningNoteParams
): NoteAnalysisResult {
  const { subject, topic, step1Text, learningMaterials = [] } = params;
  const trimmed = step1Text.trim();
  const lowerText = trimmed.toLowerCase();

  // Find if matching learning material exists
  const matchedMaterial = learningMaterials.find(
    (m) =>
      m.subject === subject &&
      (topic && m.topic ? m.topic.includes(topic) || topic.includes(m.topic) : true)
  ) || learningMaterials[0];

  // Detect pure emotions/sentiment patterns
  const emotionOnlyPatterns = [
    '재미있었다',
    '재밌었다',
    '신기했다',
    '어려웠다',
    '쉬웠다',
    '좋았다',
    '지루했다',
    '그냥 그랬다',
    '즐거웠다',
    '몰라요',
    '없음',
  ];

  const isPureEmotion =
    emotionOnlyPatterns.some((pattern) => trimmed.includes(pattern)) &&
    trimmed.length < 30 &&
    !trimmed.includes('왜냐하면') &&
    !trimmed.includes('배웠다');

  const isTooShort = trimmed.length < 15 && !trimmed.includes(' ');

  if (isPureEmotion || isTooShort) {
    return {
      status: 'needs_more_detail',
      confidence: 0.88,
      learningSummary: {
        coreConcepts: [topic || `${subject} 핵심 개념`],
        coveredConcepts: [],
        missingConcepts: [topic || `${subject} 주요 배움 내용`],
      },
      analysis: {
        understanding: '배움에 대한 단순 느낌이나 단어만 적혀 있습니다.',
        error: null,
        reason: '수업에서 배운 구체적인 원리나 핵심 개념이 드러나지 않아 추가 정리가 필요합니다.',
      },
      feedback:
        '오늘 수업에 대한 솔직한 마음을 적어주었네요! 오늘 수업 시간에 배운 중요한 내용이나 새로 알게 된 사실을 1~2문장으로 조금만 더 적어볼까요?',
      revisionPrompt:
        '오늘 배운 핵심 개념, 과정, 원리 중에서 기억에 남는 내용을 나의 말로 1~2문장 덧붙여 써보세요.',
    };
  }

  // Detect common misconceptions or inverted reasoning
  const misconceptionCheck = checkPotentialMisconceptions(subject, topic, trimmed);
  if (misconceptionCheck) {
    return {
      status: 'needs_revision',
      confidence: 0.85,
      learningSummary: {
        coreConcepts: [topic || `${subject} 개념`],
        coveredConcepts: [],
        missingConcepts: [topic || `${subject} 올바른 개념`],
      },
      analysis: {
        understanding: '핵심 개념의 원인이나 정의에 보완할 부분이 있습니다.',
        error: misconceptionCheck.error,
        reason: '배운 내용과 사실적 인과관계가 다르게 작성되었습니다.',
      },
      feedback: misconceptionCheck.feedback,
      revisionPrompt: misconceptionCheck.prompt,
    };
  }

  // Ready for Question -> Generate rich question tailored to subject & student's writing
  const { question, hint, questionType } = generateSubjectSpecificQuestion(
    subject,
    topic,
    trimmed,
    matchedMaterial
  );

  return {
    status: 'ready_for_question',
    confidence: 0.94,
    learningSummary: {
      coreConcepts: [topic || `${subject} 탐구`],
      coveredConcepts: [topic || `${subject} 핵심 요점`],
      missingConcepts: [],
    },
    analysis: {
      understanding: '오늘 배운 핵심 내용을 자신의 언어로 잘 요약하여 정리했습니다.',
      error: null,
      reason: '배움의 핵심이 잘 정리되어 성찰 질문을 통해 사고를 확장할 준비가 되었습니다.',
    },
    feedback: '오늘 배운 내용을 핵심을 짚어 아주 훌륭하게 정리했어요! 이제 생각을 한 칸 더 넓혀볼까요?',
    questionType,
    nextQuestion: question,
    nextQuestionHint: hint,
  };
}

function checkPotentialMisconceptions(
  subject: string,
  topic: string,
  text: string
): { error: string; feedback: string; prompt: string } | null {
  // Example cross-subject sanity checks for heuristic mode
  if (subject === '과학' && text.includes('해가 지구를 돌') && !text.includes('지동설')) {
    return {
      error: '지구의 자전/공전과 태양의 겉보기 운동에 대한 혼동이 있습니다.',
      feedback: '태양이 움직이는 것처럼 보이는 현상에 대해 적어주었네요. 실제로 스스로 돌고 있는 것은 태양일까요, 지구일까요? 다시 한 번 떠올려볼까요?',
      prompt: '지구의 움직임(자전과 공전)을 생각하며 배운 내용을 다시 수정해보세요.',
    };
  }
  return null;
}

function generateSubjectSpecificQuestion(
  subject: string,
  topic: string,
  studentText: string,
  material?: LearningMaterial
): { question: string; hint: string; questionType: string } {
  if (material && material.extractedText) {
    return {
      question: `오늘 배운 [${material.title || topic || subject}]에서 내가 정리한 내용과 연결지어볼 때, 이 원리가 실생활이나 다른 상황에 적용된다면 어떤 변화나 영향이 나타날까요?`,
      hint: '교재나 수업 자료에서 보았던 예시 또는 우리 주변의 생활 모습을 떠올려보세요.',
      questionType: 'application',
    };
  }

  const bank: Record<string, { question: string; hint: string; questionType: string }> = {
    국어: {
      question: '오늘 배운 글이나 표현 방법 중에서, 만약 내가 직접 글을 쓰거나 다른 사람에게 마음을 전할 때 꼭 활용해보고 싶은 부분은 무엇이고 왜 그런가요?',
      hint: '가장 마음에 와닿았던 표현이나 인상 깊었던 인물의 말/행동을 떠올려보세요.',
      questionType: 'empathy',
    },
    수학: {
      question: '오늘 배운 수학적 원리나 계산 방법은 일상생활 속 어떤 문제를 해결할 때 가장 유용하게 쓰일 수 있을까요?',
      hint: '물건을 구매하거나 길이를 재고, 시간을 계획할 때 등 구체적인 상황을 상상해보세요.',
      questionType: 'application',
    },
    사회: {
      question: '오늘 배운 사회 현상이나 제도(또는 역사적 사건)가 우리 삶이나 사회에 준 가장 큰 변화는 무엇이라고 생각하나요?',
      hint: '그 사건 이전과 이후에 사람들의 생활 모습이 어떻게 달라졌을지 비교해보세요.',
      questionType: 'cause_and_effect',
    },
    과학: {
      question: '오늘 배운 과학 원리나 관찰 결과에서 "만약 ~라는 조건이 바뀐다면 어떻게 될까?" 하고 추가로 궁금해진 점은 무엇인가요?',
      hint: '온도, 빛, 힘, 모양 등 조건을 하나 바꾸었을 때 어떤 새로운 결과가 생길지 예상해보세요.',
      questionType: 'prediction',
    },
    도덕: {
      question: '오늘 배운 가치나 덕목을 내일 나의 하루 생활에서 작은 행동으로 실천해본다면 무엇을 해볼 수 있을까요?',
      hint: '친구, 가족, 또는 나 자신에게 건넬 수 있는 따뜻한 한마디나 행동을 생각해보세요.',
      questionType: 'application',
    },
    영어: {
      question: '오늘 배운 단어나 표현을 실제 외국인 친구와의 대화 상황에서 쓴다면 어떤 질문이나 대답을 주고받고 싶나요?',
      hint: '내가 좋아하는 취미나 일상을 소개하는 짧은 대화를 머릿속으로 그려보세요.',
      questionType: 'application',
    },
  };

  return (
    bank[subject] || {
      question: `오늘 배운 [${topic || subject}] 내용 중에서 가장 흥미로웠던 부분은 무엇이며, 이것이 나에게 주는 의미나 새로운 깨달음은 무엇인가요?`,
      hint: '배우기 전에는 몰랐는데 오늘 새롭게 알게 된 점과 그 이유를 연결해보세요.',
      questionType: 'reflection',
    }
  );
}

/**
 * Step 2 Thought Reflection Evaluation API helper
 */
export async function analyzeStep2Reflection(params: {
  studentName?: string;
  subject: string;
  topic: string;
  targetGrade?: string;
  step1Text: string;
  aiQuestion: string;
  step2Text: string;
  apiKey?: string;
}): Promise<{ praise: string; summaryInsight: string; deepeningTip?: string }> {
  try {
    const res = await fetch('/api/analyze-step2-reflection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.praise) return data;
    }
  } catch (e) {
    console.warn('Step 2 reflection evaluation notice:', e);
  }

  // Heuristic fallback
  return {
    praise: '질문에 대해 깊이 있게 고민하고 자신만의 생각을 논리적으로 아주 멋지게 펼쳐냈어요!',
    summaryInsight: '단순한 지식 암기를 넘어 실제 삶과 연결지어 사고를 한 칸 더 확장했습니다.',
    deepeningTip: '오늘 기록한 생각을 다음 수업이나 일상생활 속에서도 꼭 기억하며 실천해보세요.',
  };
}
