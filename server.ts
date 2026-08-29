import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '20mb' }));

function getGeminiClient(apiKeyOverride?: string): GoogleGenAI | null {
  const key = apiKeyOverride?.trim() || process.env.GEMINI_API_KEY?.trim();
  if (!key) return null;
  return new GoogleGenAI({ apiKey: key });
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    hasEnvApiKey: Boolean(process.env.GEMINI_API_KEY),
    timestamp: Date.now(),
  });
});

/**
 * 1. AI Handwriting OCR API
 */
app.post('/api/ocr-handwriting', async (req, res) => {
  try {
    const { imageBase64, mimeType, apiKey } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ error: 'imageBase64 is required' });
    }

    const ai = getGeminiClient(apiKey);
    if (!ai) {
      return res.status(400).json({
        error: 'API 키가 필요합니다. 환경변수 GEMINI_API_KEY 또는 방 생성 시 입력한 API 키를 확인해주세요.',
      });
    }

    const prompt = '이미지에 있는 학생의 손글씨 공책 필기를 읽어 텍스트로 깔끔하게 변환해주세요. 읽을 수 없는 부분은 추측하지 말고 [판독불가]라고 표시하세요. 부가적인 인사나 설명 없이 변환된 텍스트 내용만 출력하세요.';

    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: mimeType || 'image/jpeg',
                data: imageBase64,
              },
            },
          ],
        },
      ],
    });

    const text = response.text?.trim() || '';
    return res.json({ text });
  } catch (error: any) {
    console.error('Server OCR error:', error);
    return res.status(500).json({ error: error.message || 'OCR 처리 실패' });
  }
});

/**
 * 2. Cross-Curricular Learning Note Analysis & Question Generation API
 *    범교과형 배움노트 분석 및 3단계 상태 분류 / 맞춤 질문 생성
 */
app.post('/api/analyze-learning-note', async (req, res) => {
  try {
    const {
      studentName,
      subject,
      topic,
      targetGrade,
      step1Text,
      learningMaterials,
      apiKey,
    } = req.body;

    if (!subject || !step1Text) {
      return res.status(400).json({ error: '과목과 배움 기록은 필수입니다.' });
    }

    const ai = getGeminiClient(apiKey);
    if (!ai) {
      return res.status(400).json({
        error: 'API 키가 설정되지 않았습니다. 교사 설정에서 API 키를 입력하거나 관리자에게 문의하세요.',
      });
    }

    // Build teacher materials context
    let materialsContext = '교사가 등록한 별도의 학습자료가 없습니다. 표준 교육과정 및 교과 학습 원리를 기준으로 분석하세요.';
    if (Array.isArray(learningMaterials) && learningMaterials.length > 0) {
      const formatted = learningMaterials
        .slice(0, 4)
        .map((m: any, idx: number) => {
          return `[자료 ${idx + 1}]
- 제목: ${m.title || '무제'}
- 과목/학년/단원: ${m.subject || ''} / ${m.grade || ''} / ${m.unit || ''} (주제: ${m.topic || ''})
- 설명/개요: ${m.description || ''}
${m.extractedText ? `- 본문 내용 요약:\n${m.extractedText.slice(0, 1500)}` : ''}`;
        })
        .join('\n\n');
      materialsContext = `교사가 등록한 학습자료 목록(최우선 참조 기준):\n${formatted}`;
    }

    const systemInstruction = `당신은 초·중·고 교육 현장에서 학생들의 성찰을 돕는 대한민국 최고의 교육 전문 AI 선생님 「생각 한 칸 더」입니다.
당신의 역할은 학생이 작성한 '배움노트'를 읽고, 해당 수업의 핵심 학습내용을 제대로 이해했는지 정밀하게 분석한 뒤, 배움 상태를 3가지로 분류하고 알맞은 피드백과 질문을 생성하는 것입니다.

### 🌟 핵심 원칙
1. **범교과형 유연성**: 사회, 과학, 역사, 국어, 수학, 도덕, 미술, 음악 등 어떤 과목이든 교육과정 및 교사 학습자료의 핵심 개념/원리를 기준으로 엄밀히 분석합니다.
2. **학습자료 최우선**: 교사가 등록한 학습자료가 제공되면 그 내용을 최우선 정답/개념 기준으로 삼고, 없을 경우 해당 학년 교육과정의 표준 지식을 적용합니다.
3. **길이 기준 배제 (중요!)**: 글의 길이(글자 수)만으로 좋고 나쁨을 판단하지 마십시오. 짧더라도 핵심 개념과 원리를 자기 말로 잘 정리했으면 훌륭한 배움입니다. 반대로 길게 썼더라도 단순 감상이나 횡설수설이면 보완이 필요합니다.
4. **절대 정답을 직접 알려주지 않음**: 틀린 부분이나 부족한 부분이 있어도 답을 통째로 알려주지 말고, 소크라테스식 힌트와 질문으로 학생 스스로 찾아가도록 안내합니다.
5. **평가받는 느낌 최소화 & 따뜻한 격려**: "틀렸습니다", "오답", "점수" 같은 단어는 절대 사용하지 마세요. "잘 정리했어요", "이 부분을 한 번 더 짚어볼까요?", "생각을 한 칸 더 넓혀볼까요?" 등의 따뜻하고 정중한 어조를 씁니다.

### 🔍 3가지 배움 상태 분류 기준
1. "needs_revision" (수정 필요):
   - 학습 내용에 명백한 사실 오류, 개념 오개념, 원인-결과의 왜곡이 있는 경우.
   - **규칙**: 이 상태에서는 절대 '생각 한 칸 더' 심화 질문을 생성하지 않습니다. (questionType, nextQuestion, nextQuestionHint는 null)
   - 학생이 어느 부분을 다시 생각해보면 좋을지 힌트성 피드백(feedback)과 다시 쓰기 안내(revisionPrompt)를 제공합니다.

2. "needs_more_detail" (내용 보완 필요):
   - 오개념은 없으나, 단순 감상/기분("재미있었다", "신기했다", "어려웠다")만 적었거나, 핵심 개념 단어만 1~2개 덩그러니 나열하여 무엇을 배웠는지 파악하기 어려운 경우.
   - **규칙**: 이 상태에서도 심화 질문을 내지 않습니다. (questionType, nextQuestion, nextQuestionHint는 null)
   - "오늘 배운 중요한 핵심 원리나 내용을 내 말로 1~2문장만 더 적어볼까요?"라는 따뜻한 안내를 제공합니다.

3. "ready_for_question" (성찰 질문 가능):
   - 해당 수업의 핵심 개념/사실/원리가 학생의 표현으로 적절히 요약 및 이해된 경우.
   - **규칙**: 이제 학생의 사고를 한 단계 더 깊고 넓게 확장하는 **단 1개의 맞춤형 '생각 한 칸 더' 질문**과 **친절한 생각 힌트**를 생성합니다.
   - 질문은 학생이 쓴 글에서 출발하여 인과관계(왜 그랬을까?), 비교/변화(어떻게 달라졌을까?), 실생활 적용/확장(우리 주변이나 다른 상황에 적용하면?), 역지사지/관점(그 사람들의 입장은 어땠을까?), 문제해결(이 원리로 무엇을 해결할 수 있을까?) 중 가장 어울리는 1가지 유형을 선택합니다.
   - 학년 수준(${targetGrade || '초등학생'})에 맞춘 친절한 어조를 사용합니다.`;

    const userPrompt = `[수업 정보]
- 대상 학년: ${targetGrade || '초등학생'}
- 과목: ${subject}
- 단원/학습주제: ${topic || '미기재'}
- 학생 이름: ${studentName || '학생'}

[교사 학습자료 기준]
${materialsContext}

[학생이 작성한 배움노트 내용]
"""
${step1Text}
"""

위 내용을 엄밀히 분석하여 아래 JSON 스키마 형식으로만 응답하세요.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: [
        { role: 'user', parts: [{ text: userPrompt }] },
      ],
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            status: {
              type: 'STRING',
              description: '배움 상태: ready_for_question, needs_revision, needs_more_detail 중 하나',
            },
            confidence: {
              type: 'NUMBER',
              description: '분석 신뢰도 (0.0 ~ 1.0)',
            },
            learningSummary: {
              type: 'OBJECT',
              properties: {
                coreConcepts: {
                  type: 'ARRAY',
                  items: { type: 'STRING' },
                  description: '이 수업에서 다루는 핵심 개념 목록',
                },
                coveredConcepts: {
                  type: 'ARRAY',
                  items: { type: 'STRING' },
                  description: '학생이 바르게 언급/이해한 개념 목록',
                },
                missingConcepts: {
                  type: 'ARRAY',
                  items: { type: 'STRING' },
                  description: '누락되었거나 보완하면 좋은 핵심 개념 목록',
                },
              },
              required: ['coreConcepts', 'coveredConcepts', 'missingConcepts'],
            },
            analysis: {
              type: 'OBJECT',
              properties: {
                understanding: {
                  type: 'STRING',
                  description: '학생의 이해 수준 요약',
                },
                error: {
                  type: 'STRING',
                  description: '발견된 오류나 오개념 설명 (없으면 null 또는 빈 문자열)',
                },
                reason: {
                  type: 'STRING',
                  description: '이 상태로 판정한 구체적 이유',
                },
              },
              required: ['understanding', 'reason'],
            },
            feedback: {
              type: 'STRING',
              description: '학생에게 보여줄 따뜻하고 격려하는 피드백 메시지',
            },
            revisionPrompt: {
              type: 'STRING',
              description: 'needs_revision 또는 needs_more_detail일 때 다시 쓰기를 돕는 구체적 가이드 문구',
            },
            questionType: {
              type: 'STRING',
              description: 'ready_for_question일 때 선택한 질문 유형 (cause_and_effect, comparison, application, empathy, problem_solving, prediction 등)',
            },
            nextQuestion: {
              type: 'STRING',
              description: 'ready_for_question일 때 생성된 깊이 있는 생각 확장 질문 1개',
            },
            nextQuestionHint: {
              type: 'STRING',
              description: 'ready_for_question일 때 학생의 답변을 돕는 친절한 생각 힌트',
            },
          },
          required: ['status', 'learningSummary', 'analysis', 'feedback'],
        },
      },
    });

    const rawText = response.text?.trim() || '{}';
    const parsed = JSON.parse(rawText);

    return res.json(parsed);
  } catch (error: any) {
    console.error('Server Note Analysis error:', error);
    return res.status(500).json({
      error: error.message || '배움노트 분석 중 오류가 발생했습니다.',
    });
  }
});

/**
 * 3. Step 2 Reflection Thought Evaluation & Optional Follow-up API
 */
app.post('/api/analyze-step2-reflection', async (req, res) => {
  try {
    const {
      studentName,
      subject,
      topic,
      targetGrade,
      step1Text,
      aiQuestion,
      step2Text,
      learningMaterials,
      apiKey,
    } = req.body;

    const ai = getGeminiClient(apiKey);
    if (!ai) {
      return res.status(400).json({ error: 'API 키가 필요합니다.' });
    }

    const systemInstruction = `당신은 「생각 한 칸 더」 AI 선생님입니다.
학생이 1단계 배움 기록을 바탕으로 주어진 질문에 대해 2단계 '생각 한 칸 더' 답변을 작성했습니다.
학생의 답변에서 드러난 깊은 생각, 새로운 관점, 실천 의지를 칭찬하고, 생각을 정리해주는 따뜻한 총평과 추가 호기심을 자극하는 한마디를 JSON으로 생성하세요.`;

    const userPrompt = `과목: ${subject}
주제: ${topic || '미기재'}
대상: ${targetGrade || '초등학생'}
학생 이름: ${studentName || '학생'}
1단계 배움 기록:
${step1Text}

AI 선생님의 질문:
${aiQuestion}

학생의 2단계 '생각 한 칸 더' 답변:
${step2Text}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            praise: {
              type: 'STRING',
              description: '학생의 생각 확장에 대한 구체적이고 따뜻한 칭찬',
            },
            summaryInsight: {
              type: 'STRING',
              description: '학생의 생각을 종합해주는 핵심 통찰 요약',
            },
            deepeningTip: {
              type: 'STRING',
              description: '앞으로 실생활이나 다음 배움에서 실천해볼 수 있는 작은 팁',
            },
          },
          required: ['praise', 'summaryInsight'],
        },
      },
    });

    const parsed = JSON.parse(response.text?.trim() || '{}');
    return res.json(parsed);
  } catch (error: any) {
    console.error('Server Step 2 analysis error:', error);
    return res.status(500).json({ error: error.message || '성찰 평가 실패' });
  }
});

// Vite middleware / Static serving
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`「생각 한 칸 더」 Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
