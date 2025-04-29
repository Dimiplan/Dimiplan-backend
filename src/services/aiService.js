/**
 * AI Service
 * Handles interactions with OpenAI API
 */
const OpenAI = require("openai");

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Available AI models
 * @type {Object}
 */
const AI_MODELS = {
  GPT4O_MINI: "gpt-4o-mini",
  GPT4O: "gpt-4o",
  GPT41: "gpt-4.1",
  O4_MINI: "o4-mini",
};

/**
 * Generate a response from the AI model
 * @param {string} model - AI model to use
 * @param {string} prompt - User prompt
 * @returns {Promise<Object>} - AI response
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
  AI_MODELS,
  generateResponse,
};
