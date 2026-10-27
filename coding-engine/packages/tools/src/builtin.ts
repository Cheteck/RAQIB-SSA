import { ToolDefinition } from "./tool";

export const listFilesTool: ToolDefinition = {
  name: "list_files",
  description: "List files in the workspace",
  inputSchema: {},
  execute: async (input, context) => {
    return await context.workspace.listFiles();
  },
};

export const readFileTool: ToolDefinition = {
  name: "read_file",
  description: "Read a file from workspace",
  inputSchema: { path: "string" },
  execute: async (input: { path: string }, context) => {
    return await context.workspace.readFile(input.path);
  },
};
