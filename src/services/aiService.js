/**
 * AI 서비스
 * OpenRouter AI API와의 상호작용 관리
 * 자동 모델 선택 및 AI 응답 생성 기능 제공
 */
const OpenAI = require("openai");
require("../config/dotenv"); // 환경 변수 로드
const logger = require("../utils/logger");

// OpenRouter API 클라이언트 초기화
const openRouter = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
});

// 무료 AI 모델 목록
const FREE_MODELS = [
  "openai/gpt-4.1-nano",
  "openai/o4-mini",
  "anthropic/claude-3.5-haiku",
  "openai/gpt-4.1",
];

// 유료 AI 모델 목록
const PAID_MODELS = {
  CLAUDE_SONNET: "anthropic/claude-3.7-sonnet:thinking",
  O3: "openai/o3",
};

/**
 * 자동 AI 모델 선택 및 응답 생성
 * 프롬프트의 복잡성에 따라 적절한 AI 모델 선택
 *
 * @param {string} prompt - 사용자 입력 프롬프트
 * @returns {Promise<Object>} AI 응답 객체
 */
const generateAutoResponse = async (prompt) => {
  try {
    // 모델 선택 로직
    const modelSelection = await openRouter.chat.completions
      .create({
        model: "openai/gpt-4.1-nano",
        messages: [
          {
            role: "system",
            content:
              "다음 프롬프트의 복잡성을 평가하고 적절한 모델을 선택하세요:\n" +
              "- 단순한 질문: 0 (작은 모델)\n" +
              "- 복잡한 추론 필요: 1 (중간 모델)\n" +
              "- 프로그래밍 또는 심화 지식 필요: 2 (고급 모델)\n" +
              "- 광범위한 정보 및 큰 모델 필요: 3 (대규모 모델)\n" +
              "결과는 {model: X} 형식으로 반환",
          },
          { role: "user", content: prompt },
        ],
      })
      .catch((error) => {
        logger.error(`모델 선택 중 오류: ${error.status}, ${error.name}`);
        throw error;
      });

    // 선택된 모델 인덱스 추출
    const selectedModelIndex = parseInt(
      modelSelection.choices[0].message.content.match(/\d+/)[0],
    );
    const model = FREE_MODELS[selectedModelIndex];

    logger.info(`선택된 모델: ${model}`);

    // 선택된 모델로 응답 생성
    const response = await openRouter.chat.completions
      .create({
        model: model,
        messages: [
          {
            role: "system",
            content: "불필요한 경우 1000 토큰 이내로 응답하세요",
          },
          { role: "user", content: prompt },
        ],
      })
      .catch((error) => {
        logger.error(`응답 생성 중 오류: ${error.status}, ${error.name}`);
        throw error;
      });

    logger.info("AI 응답 생성 완료");
    return response;
  } catch (error) {
    logger.error("AI 응답 생성 중 에러:", error);
    throw error;
  }
};

/**
 * 수동 AI 모델로 응답 생성
 * 프롬프트의 복잡성에 따라 적절한 AI 모델 선택
 *
 * @param {string} prompt - 사용자 입력 프롬프트
 * @param {string} model - 사용자가 선택한 AI 모델
 * @returns {Promise<Object>} AI 응답 객체
 */
const generateCustomResponse = async (prompt, model) => {
  try {
    if (model in FREE_MODELS === false) {
      logger.warn(`선택된 모델이 모델 목록에 없습니다: ${model}`);
      throw new Error("선택된 모델이 모델 목록에 없습니다");
    }
    // 선택된 모델로 응답 생성
    const response = await openRouter.chat.completions
      .create({
        model: model,
        messages: [
          {
            role: "system",
            content: "불필요한 경우 1000 토큰 이내로 응답하세요",
          },
          { role: "user", content: prompt },
        ],
      })
      .catch((error) => {
        logger.error(`응답 생성 중 오류: ${error.status}, ${error.name}`);
        throw error;
      });

    logger.info("AI 응답 생성 완료");
    return response;
  } catch (error) {
    logger.error("AI 응답 생성 중 에러:", error);
    throw error;
  }
};

module.exports = {
  generateAutoResponse,
  generateCustomResponse
};
