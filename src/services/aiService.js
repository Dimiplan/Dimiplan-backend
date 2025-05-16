/**
 * AI 서비스
 * OpenRouter AI API와의 상호작용 관리
 * 자동 모델 선택 및 AI 응답 생성 기능 제공
 */
const OpenAI = require("openai");
require("../config/dotenv"); // 환경 변수 로드
const logger = require("../utils/logger");
const {
  addChatMessages,
  createChatRoom,
  getChatMessages,
} = require("../models/chatModel");

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
 * 채팅 이력을 요약해 메모리로 전달
 *
 * @param {string} userId - 사용자 ID
 * @param {number|string} room - 채팅방 ID
 * @returns {Promise<string>} 요약 문자열
 */
const summarizeMemory = async (userId, room) => {
  if (!room) return "No previous messages";

  // 1) 데이터베이스에서 기존 메시지들을 가져온 후 문자열로 직렬화
  //    (배열로 올 수 있으므로 안전하게 처리)
  const rawMessages = await getChatMessages(userId, room);
  const history = Array.isArray(rawMessages)
    ? rawMessages.join("\n")
    : String(rawMessages);

  try {
    const response = await openRouter.chat.completions.create({
      model: "openai/gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content:
            "다음 대화 내용을 요약하여 이후 AI가 쉽게 이해할 수 있도록 작성하세요. " +
            "디테일을 잃지 말고 결과를 다음 JSON 형식 **한 줄**로만 응답하세요:\n" +
            '{"summary":"..."}',
        },
        { role: "user", content: history },
      ],
    });

    // OpenAI 응답에서 JSON 파싱 및 요약 추출
    const { summary } = JSON.parse(response.choices[0].message.content.trim());
    logger.verbose("메모리 요약:", summary);
    return summary;
  } catch (error) {
    logger.error("메모리 요약 중 에러:", error);
    throw error;
  }
};

/**
 * 자동 AI 모델 선택 및 응답 생성
 * 프롬프트의 복잡성에 따라 적절한 AI 모델 선택
 *
 * @param {string} prompt - 사용자 입력 프롬프트
 * @returns {Promise<Object>} AI 응답 객체
 */
const generateAutoResponse = async (userId, prompt, room) => {
  try {
    // 모델 선택 로직
    const systemPrompt =
      (!room
        ? "다음 프롬프트의 복잡성을 평가하고 적절한 모델을 선택하며, 프롬프트를 요약하여 채팅방 이름을 작성하세요:\n"
        : "다음 프롬프트의 복잡성을 평가하고 적절한 모델을 선택하세요:\n") +
      "- 단순한 질문: 0 (작은 모델)\n" +
      "- 복잡한 추론 필요: 1 (중간 모델)\n" +
      "- 프로그래밍 또는 심화 지식 필요: 2 (고급 모델)\n" +
      "- 광범위한 정보 및 큰 모델 필요: 3 (대규모 모델)\n" +
      (!room
        ? "결과는 {model: integer, title: string}의 JSON 형식으로 반환"
        : "결과는 {model: integer}의 JSON 형식으로 반환");
    const modelSelection = await openRouter.chat.completions
      .create({
        model: "openai/gpt-4.1-mini",
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          { role: "user", content: prompt },
        ],
      })
      .catch((error) => {
        logger.error(`모델 선택 중 오류: ${error.status}, ${error.name}`);
        throw error;
      });
    let selectedModelIndex = 0;
    let title = undefined;
    try {
      // 선택된 모델 인덱스 및 제목 추출
      const parsedResponse = JSON.parse(
        modelSelection.choices[0].message.content,
      );
      selectedModelIndex = parsedResponse.model;
      title = parsedResponse.title;
    } catch (error) {
      logger.error("모델 선택 중 에러:", error);
      logger.verbose(modelSelection.choices[0].message.content);
      throw error;
    }
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
          {
            role: "system",
            content:
              "기존 채팅내용 요약: " + (await summarizeMemory(userId, room)),
          },
          { role: "user", content: prompt },
        ],
      })
      .catch((error) => {
        logger.error(`응답 생성 중 오류: ${error.status}, ${error.name}`);
        throw error;
      });

    logger.info("AI 응답 생성 완료");

    // AI 응답 텍스트 추출
    const aiResponseText =
      response.choices[0].message.content ||
      "죄송합니다. 응답을 생성하는 데 문제가 발생했습니다. 다시 시도해 주세요.";

    // 메시지 데이터베이스에 저장
    await addChatMessages(
      userId,
      room || (await createChatRoom(userId, title)).id,
      prompt,
      aiResponseText,
    );

    return { message: aiResponseText, room };
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
const generateCustomResponse = async (userId, prompt, model, room) => {
  try {
    let message_to_ai = [];
    if (!room) {
      const modelSelection = await openRouter.chat.completions
        .create({
          model: "openai/gpt-4.1-nano",
          messages: [
            {
              role: "system",
              content:
                "다음 프롬프트를 요약하여 적절한 채팅방 이름을 작성하세요:\n" +
                "결과는 {title: t} 형식으로 반환",
            },
            { role: "user", content: prompt },
          ],
        })
        .catch((error) => {
          logger.error(`모델 선택 중 오류: ${error.status}, ${error.name}`);
          throw error;
        });

      // 선택된 모델 인덱스 및 제목 추출
      const { title } = JSON.parse(modelSelection.choices[0].message.content);
      room = await createChatRoom(userId, title).id;
      message_to_ai = [
        {
          role: "system",
          content: "불필요한 경우 1000 토큰 이내로 응답하세요",
        },
        { role: "user", content: prompt },
      ];
    } else {
      message_to_ai = [
        {
          role: "system",
          content: "불필요한 경우 1000 토큰 이내로 응답하세요",
        },
        {
          role: "user",
          content:
            "기존 채팅내용 요약: " + (await summarizeMemory(userId, room)),
        },
        { role: "user", content: prompt },
      ];
    }
    if (model in FREE_MODELS === false) {
      logger.warn(`선택된 모델이 모델 목록에 없습니다: ${model}`);
      throw new Error("선택된 모델이 모델 목록에 없습니다");
    }
    // 선택된 모델로 응답 생성
    const response = await openRouter.chat.completions
      .create({
        model: model,
        messages: message_to_ai,
      })
      .catch((error) => {
        logger.error(`응답 생성 중 오류: ${error.status}, ${error.name}`);
        throw error;
      });

    logger.info("AI 응답 생성 완료");

    // AI 응답 텍스트 추출
    const aiResponseText =
      response.choices[0].message.content ||
      "죄송합니다. 응답을 생성하는 데 문제가 발생했습니다. 다시 시도해 주세요.";

    // 메시지 데이터베이스에 저장
    await addChatMessages(userId, room, prompt, aiResponseText);

    return aiResponseText;
  } catch (error) {
    logger.error("AI 응답 생성 중 에러:", error);
    throw error;
  }
};

module.exports = {
  generateAutoResponse,
  generateCustomResponse,
};
