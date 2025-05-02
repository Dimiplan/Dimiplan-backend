/**
 * AI Service
 * Handles interactions with OpenAI API
 */
const OpenAI = require("openai");
require("../config/dotenv"); // Load environment variables

const openRouter = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
});

const FREE_MODELS = [
  "openai/gpt-4.1-nano",
  "openai/o4-mini",
  "anthropic/claude-3.5-haiku",
  "openai/gpt-4.1",
];

const PAID_MODELS = {
  CLAUDE_SONNET: "anthropic/claude-3.7-sonnet:thinking",
  O3: "openai/o3",
};

/**
 * Generate a response from Automatic AI model
 * @param {string} prompt - User prompt
 * @returns {Promise<Object>} - AI response
 */
const generateAutoResponse = async (prompt) => {
  try {
    const model_selection = await openRouter.chat.completions.create({
      model: "openai/gpt-4.1-nano",
      messages: [
        {
          role: "system",
          content:
            "Choose the AI model for this prompt. If the prompt is simple, respond {model: 0}, if it requires more complex reasoning, respond {model: 1}, if it requires more knowledge or is about programming, respond {model: 2}, and if it requires more information and large AI model size, respond {model: 3}",
        },
        { role: "user", content: prompt },
      ],
    });

    const selectedModel = model_selection.choices[0].message.content;

    const model = FREE_MODELS[parseInt(selectedModel.match(/\d+/)[0])];

    console.log(model);

    const response = await openRouter.chat.completions.create({
      model: model,
      messages: [
        {
          role: "system",
          content:
            "Do not response in more than 1000 tokens if it is not necessary",
        },
        { role: "user", content: prompt },
      ],
    });

    return response;
  } catch (error) {
    console.error(`Error generating response:`, error);
    throw error;
  }
};

/**
 * Generate a response from the AI model
 * @param {string} model - AI model to use
 * @param {string} prompt - User prompt
 * @returns {Promise<Object>} - AI response
 * @deprecated
 */
const generateResponse = async (model, prompt) => {
  try {
    if (!Object.values(AI_MODELS).includes(model)) {
      throw new Error(`Invalid model: ${model}`);
    }

    const response = await openai.responses.create({
      model: model,
      input: prompt,
    });

    return response;
  } catch (error) {
    console.error(`Error generating ${model} response:`, error);
    throw error;
  }
};

module.exports = {
  generateAutoResponse,
};
