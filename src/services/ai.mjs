/**
 * AI 서비스
 * OpenRouter AI API와의 상호작용을 관리하고 자동 모델 선택 및 AI 응답 생성 기능을 제공합니다
 *
 * @fileoverview OpenRouter API를 통한 AI 채팅 서비스 관리 모듈
 */
import OpenAI from "openai";
import "../config/dotenv.mjs"; // 환경 변수 로드
import logger from "../utils/logger.mjs";
import {
  addChatMessages,
  createChatRoom,
  getChatMessages,
} from "../models/chat.mjs";

/**
 * OpenRouter API 클라이언트 인스턴스
 * OpenAI 호환 인터페이스를 사용하여 OpenRouter API에 연결합니다
 *
 * @type {OpenAI}
 * @constant
 */
const openRouter = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
});

/**
 * 무료 AI 모델 목록
 * 자동 모델 선택 시 사용할 수 있는 무료 모델들의 목록입니다
 * 인덱스 0-3에 따라 단순한 질문부터 복잡한 추론까지 대응합니다
 *
 * @type {string[]}
 * @constant
 * @example
 * // 모델 인덱스 0: 가장 빠른 모델
 * const quickModel = FREE_MODELS[0]; // "openai/gpt-4.1-nano"
 */
const FREE_MODELS = [
  "openai/gpt-4.1-nano",
  "openai/o4-mini",
  "anthropic/claude-3.5-haiku",
  "openai/gpt-4.1",
];

/**
 * 유료 AI 모델 목록
 * 고급 기능이 필요한 경우 사용할 수 있는 유료 모델들의 목록입니다
 * 현재는 미사용 상태이지만 향후 확장을 위해 정의되어 있습니다
 *
 * @type {string[]}
 * @example
 * // 모델 인덱스 0: 가장 빠른 모델
 * const quickModel = PAID_MODELS[0]; // "anthropic/claude-3.7-sonnet:thinking"
 */
const PAID_MODELS = ["anthropic/claude-3.7-sonnet:thinking", "openai/o3"];

/**
 * 채팅 이력을 요약해 메모리로 전달
 * 기존 대화 내역을 AI가 이해하기 쉽도록 요약합니다
 * 대화의 맥락과 세부 사항을 유지하면서 쿨팩트하게 만듭니다
 *
 * @async
 * @function summarizeMemory
 * @param {string} userId - 사용자 ID
 * @param {number|string} room - 채팅방 ID
 * @returns {Promise<string>} 요약된 대화 내역 문자열
 * @throws {Error} AI 요약 요청 실패 시 예외 발생
 * @example
 * // 대화 이력 요약
 * const summary = await summarizeMemory('user123', 'room456');
 * console.log(summary); // "사용자가 이전에 코딩에 대해 문의한 내용..."
 */
const summarizeMemory = async (userId, room) => {
  if (!room) return "No previous messages";
  logger.verbose("메모리 요약 시작");

  // 1) 데이터베이스에서 기존 메시지들을 가져온 후 문자열로 직렬화
  //    (배열로 올 수 있으므로 안전하게 처리)
  // getChatMessages는 [{ owner, message, ... }, ...] 형태를 반환
  const rawMessages = await getChatMessages(userId, room);

  // 메시지 본문만 추출해 한 줄씩 이어붙임
  const history = Array.isArray(rawMessages)
    ? rawMessages.map((m) => m.message).join("\n")
    : String(rawMessages);

  try {
    const response = await openRouter.chat.completions.create({
      model: "openai/gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content:
            "다음 대화 내용을 요약하여 이후 AI가 쉽게 이해할 수 있도록 작성하세요. " +
            "디테일과 구체적 내용을 잃지 말고 요약하세요",
        },
        { role: "user", content: history },
      ],
    });
    const raw = response.choices[0].message.content.trim();
    logger.verbose("메모리 요약 응답:", raw);

    let summaryText;
    try {
      summaryText = JSON.parse(raw).summary;
    } catch (e) {
      logger.warn(
        "요약 응답 JSON 파싱 실패, 원본 문자열을 그대로 사용합니다:",
        e,
      );
      summaryText = raw;
    }

    logger.verbose("메모리 요약:", summaryText);
    return summaryText;
  } catch (error) {
    logger.error("메모리 요약 중 에러:", error);
    throw error;
  }
};

// eslint-disable-next-line jsdoc/require-returns
/**
 * 자동 AI 모델 선택 및 응답 생성
 * 프롬프트의 복잡성을 분석하여 적절한 AI 모델을 자동으로 선택하고 응답을 생성합니다
 * 새 채팅방인 경우 자동으로 제목을 생성하고, 기존 채팅방인 경우 대화 내역을 참고합니다
 *
 * @async
 * @function generateAutoResponse
 * @param {string} userId - 사용자 ID
 * @param {string} prompt - 사용자 입력 프롬프트
 * @param {string|number} [room] - 채팅방 ID (선택사항, 없으면 새 채팅방 생성)
 * @returns {Promise<object>} AI 응답 객체
 * @returns {string} returns.message - AI가 생성한 응답 메시지
 * @returns {string|number} returns.room - 사용된 채팅방 ID
 * @throws {Error} AI API 호출 실패 또는 모델 선택 오류 시 예외 발생
 * @example
 * // 새 채팅방에서 자동 응답 생성
 * const response = await generateAutoResponse('user123', '안녕하세요');
 * console.log(response.message); // AI 응답
 * console.log(response.room); // 새로 생성된 채팅방 ID
 */
export const generateAutoResponse = async (userId, prompt, room) => {
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
 * 사용자가 직접 선택한 특정 AI 모델로 응답을 생성합니다
 * 선택된 모델이 유효한지 확인하고, 새 채팅방인 경우 자동으로 제목을 생성합니다
 *
 * @async
 * @function generateCustomResponse
 * @param {string} userId - 사용자 ID
 * @param {string} prompt - 사용자 입력 프롬프트
 * @param {string} model - 사용자가 선택한 AI 모델 (무료 모델 목록에 있어야 함)
 * @param {string|number} [room] - 채팅방 ID (선택사항, 없으면 새 채팅방 생성)
 * @returns {Promise<string>} AI가 생성한 응답 메시지
 * @throws {Error} 선택된 모델이 목록에 없거나 AI API 호출 실패 시 예외 발생
 * @example
 * // 특정 모델로 응답 생성
 * const response = await generateCustomResponse(
 *   'user123',
 *   '코딩 질문',
 *   'openai/gpt-4.1',
 *   'room456'
 * );
 * console.log(response); // AI 응답 메시지
 */
export const generateCustomResponse = async (userId, prompt, model, room) => {
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
