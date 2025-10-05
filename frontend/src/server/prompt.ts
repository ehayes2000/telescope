import type { ChatCompletionTool } from "openai/resources.js";

export const TOOLS: ChatCompletionTool[] = [
  {
    function: {
      name: "search",
      description: "A keyword search tool to find document metadata. Use many specific searches for best results. Each search should be no more than 3 words",
      parameters: {
        type: "object",
        properties: {
          queries: {
            type: "array",
            items: {
              type: "string"
            },
            description: "List of search query keywords"
          }
        },
        required: ["queries"],
        additionalProperties: false
      },
      strict: true
    },
    type: "function"
  },
  {
    function: {
      name: "read_document",
      description: "Read the full content of a document by its ID",
      parameters: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description: "The document ID to read"
          }
        },
        required: ["id"],
        additionalProperties: false
      },
      strict: true
    },
    type: "function"
  }
] as const;
