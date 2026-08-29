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
