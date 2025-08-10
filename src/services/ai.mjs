import "../config/dotenv.mjs";
import {
  addChatMessages,
  createChatRoom,
  getChatMessages,
} from "../models/chat.mjs";
import logger from "../utils/logger.mjs";

export const FREE_MODELS = [
  "anthropic/claude-3.5-haiku",
  "deepseek/deepseek-prover-v2",
  "deepseek/deepseek-r1-0528",
  "google/gemini-2.5-flash",
  "microsoft/phi-4-reasoning-plus",
  "moonshotai/kimi-k2",
  "openai/gpt-5-chat",
  "openai/gpt-oss-120b",
];

export const PAID_MODELS = ["anthropic/claude-4-sonnet:thinking", "openai/o3"];

const AUTO_MODELS = [
  "openai/gpt-oss-120b",
  "anthropic/claude-3.5-haiku",
  "openai/gpt-5-chat",
];

const SUMMARIZER = "openai/gpt-oss-120b";
const SELECTOR = "openai/gpt-oss-120b";
const TITLER = "openai/gpt-oss-120b";

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
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      },
      body: JSON.stringify({
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
      })
    });
    const summaryText = response.choices[0].message.content.trim();

    logger.verbose("메모리 요약:", summaryText);
    return summaryText;
  } catch (error) {
    logger.error("메모리 요약 중 에러:", error);
    throw error;
  }
};

export const generateAutoResponse = async (userId, prompt, room, search) => {
  try {
    const systemPrompt = !room
      ? "다음 프롬프트의 복잡성을 평가하고 적절한 모델을 선택하며, 프롬프트를 요약하여 채팅방 이름을 작성하세요:\n"
      : "다음 프롬프트의 복잡성을 평가하고 적절한 모델을 선택하세요:\n";
    const modelSelection = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      },
      body: JSON.stringify({
        model: SELECTOR,
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          { role: "user", content: prompt },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "response",
            strict: true,
            schema: {
              type: "object",
              properties: !room
                ? {
                    model: {
                      type: "number",
                      description:
                        "Model index based on complexity(0: low, 1: medium, 2: high)",
                    },
                    title: {
                      type: "string",
                      description: "Title based on the summary of the prompt",
                    },
                  }
                : {
                    model: {
                      type: "number",
                      description:
                        "Model index based on complexity(0: low, 1: medium, 2: high)",
                    },
                  },
              required: !room ? ["model", "title"] : ["model"],
              additionalProperties: false,
            },
          },
        },
      })
    }).catch((error) => {
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

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      },
      body: JSON.stringify({
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
    }).catch((error) => {
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
      const titleGeneration = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        },
        body: JSON.stringify({
          model: TITLER,
          messages: [
            {
              role: "system",
              content:
                "다음 프롬프트를 요약하여 적절한 채팅방 이름을 작성하세요",
            },
            { role: "user", content: prompt },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "response",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  title: {
                    type: "string",
                    description: "Title based on the summary of the prompt",
                  },
                },
                required: ["title"],
                additionalProperties: false,
              },
            },
          },
        })
      }).catch((error) => {
        logger.error(`모델 선택 중 오류: ${error.status}, ${error.name}`);
        throw error;
      });

      let title = "";
      try {
        title = JSON.parse(titleGeneration.choices[0].message.content).title;
      } catch (error) {
        logger.error(
          `Json 파싱 오류. 원본 문자열: ${titleGeneration.choices[0].message.content}`,
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
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      },
      body: JSON.stringify({
        model: model + search ? ":online" : "",
        messages: message_to_ai,
      })
    }).catch((error) => {
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
