import OpenAI from "openai";
import "../config/dotenv.mjs";
import {
  addChatMessages,
  createChatRoom,
  getChatMessages,
} from "../models/chat.mjs";
import logger from "../utils/logger.mjs";

const openRouter = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
});

export const FREE_MODELS = [
  "anthropic/claude-3.5-haiku",
  "deepseek/deepseek-prover-v2",
  "deepseek/deepseek-r1-0528",
  "google/gemini-2.5-flash",
  "microsoft/phi-4-reasoning-plus",
  "moonshotai/kimi-k2",
  "openai/gpt-4.1",
  "openai/o4-mini",
];

export const PAID_MODELS = ["anthropic/claude-4-sonnet:thinking", "openai/o3"];

const AUTO_MODELS = [
  "openai/gpt-4.1-nano",
  "openai/o4-mini",
  "anthropic/claude-3.5-haiku",
  "openai/gpt-4.1",
];

const SUMMARIZER = "openai/gpt-4.1-mini";
const SELECTOR = "openai/gpt-4.1-nano";
const TITLER = "openai/gpt-4.1-nano";

export const getUsage = async () => {
  try {
    const res = await fetch("https://openrouter.ai/api/v1/credits", {
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      },
    });
    const data = await res.json();
    logger.info("API 사용량 조회", { usage: data });
    return data;
  } catch (error) {
    logger.error("API 사용량 조회 실패", { error: error.message });
    throw error;
  }
};

const summarizeMemory = async (userId, room) => {
  if (!room) return "No previous messages";
  logger.verbose("메모리 요약 시작");

  const rawMessages = await getChatMessages(userId, room);

  const history = Array.isArray(rawMessages)
    ? rawMessages.map((m) => m.message).join("\n")
    : String(rawMessages);

  try {
    const response = await openRouter.chat.completions.create({
      model: SUMMARIZER,
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

export const generateAutoResponse = async (userId, prompt, room, search) => {
  try {
    const systemPrompt =
      (!room
        ? "다음 프롬프트의 복잡성을 평가하고 적절한 모델을 선택하며, 프롬프트를 요약하여 채팅방 이름을 작성하세요:\n"
        : "다음 프롬프트의 복잡성을 평가하고 적절한 모델을 선택하세요:\n") +
      "- 단순한 질문: 0 (작은 모델)\n" +
      "- 복잡한 추론 필요: 1 (중간 모델)\n" +
      "- 프로그래밍 또는 심화 지식 필요: 2 (고급 모델)\n" +
      "- 광범위한 정보 및 큰 모델 필요: 3 (대규모 모델)\n" +
      (!room
        ? '결과는 {"model": "10", "title": "제목"}의 JSON 형식으로 반환'
        : '결과는 {"model": "10"}의 JSON 형식으로 반환');
    const modelSelection = await openRouter.chat.completions
      .create({
        model: SELECTOR,
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
    let title;
    try {
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

    const model = AUTO_MODELS[selectedModelIndex];

    logger.info(`선택된 모델: ${model}`);

    const response = await openRouter.chat.completions
      .create({
        model: model + search ? ":online" : "",
        messages: [
          {
            role: "system",
            content: "불필요한 경우 1000 토큰 이내로 응답하세요",
          },
          {
            role: "system",
            content: "LaTex 수식은 $또는 $$로 감싸서 응답하세요.",
          },
          {
            role: "system",
            content: `기존 채팅내용 요약: ${await summarizeMemory(userId, room)}`,
          },
          { role: "user", content: prompt },
        ],
      })
      .catch((error) => {
        logger.error(`응답 생성 중 오류: ${error.status}, ${error.name}`);
        throw error;
      });

    logger.info("AI 응답 생성 완료");

    const aiResponseText =
      response.choices[0].message.content ||
      "죄송합니다. 응답을 생성하는 데 문제가 발생했습니다. 다시 시도해 주세요.";

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

export const generateCustomResponse = async (
  userId,
  prompt,
  model,
  room,
  search,
) => {
  try {
    let message_to_ai = [];
    if (!room) {
      const modelSelection = await openRouter.chat.completions
        .create({
          model: TITLER,
          messages: [
            {
              role: "system",
              content:
                "다음 프롬프트를 요약하여 적절한 채팅방 이름을 작성하세요:\n" +
                '결과는 {"title": "제목"의 JSON 형식으로 반환',
            },
            { role: "user", content: prompt },
          ],
        })
        .catch((error) => {
          logger.error(`모델 선택 중 오류: ${error.status}, ${error.name}`);
          throw error;
        });

      let title = "";
      try {
        title = JSON.parse(modelSelection.choices[0].message.content).title;
      } catch (error) {
        logger.error(
          `Json 파싱 오류. 원본 문자열: ${modelSelection.choices[0].message.content}`,
        );
        throw error;
      }

      room = (await createChatRoom(userId, title)).id;
      message_to_ai = [
        {
          role: "system",
          content: "불필요한 경우 1000 토큰 이내로 응답하세요",
        },
        {
          role: "system",
          content: "LaTex 수식은 $또는 $$로 감싸서 응답하세요.",
        },
        {
          role: "system",
          content:
            "마크다운 문법으로 사용자의 질문에 대해 확실히 문단 구분을 해서 응답하세요.",
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
          role: "system",
          content: "LaTex 수식은 $또는 $$로 감싸서 응답하세요.",
        },
        {
          role: "system",
          content:
            "마크다운 문법으로 사용자의 질문에 대해 확실히 문단 구분을 해서 응답하세요.",
        },
        {
          role: "user",
          content: `기존 채팅내용 요약: ${await summarizeMemory(userId, room)}`,
        },
        { role: "user", content: prompt },
      ];
    }
    if (!FREE_MODELS.includes(model)) {
      logger.warn(`선택된 모델이 모델 목록에 없습니다: ${model}`);
      throw new Error("선택된 모델이 목록에 없습니다");
    }
    const response = await openRouter.chat.completions
      .create({
        model: model + search ? ":online" : "",
        messages: message_to_ai,
      })
      .catch((error) => {
        logger.error(`응답 생성 중 오류: ${error.status}, ${error.name}`);
        throw error;
      });

    logger.info("AI 응답 생성 완료");

    const aiResponseText =
      response.choices[0].message.content ||
      "죄송합니다. 응답을 생성하는 데 문제가 발생했습니다. 다시 시도해 주세요.";

    await addChatMessages(userId, room, prompt, aiResponseText);

    return { text: aiResponseText, room };
  } catch (error) {
    logger.error("AI 응답 생성 중 에러:", error);
    throw error;
  }
};
