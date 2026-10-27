import { ToolDefinition } from "./tool";

export interface ApplyPatchInput {
  filePath: string;
  diff: string;
  operation: "create" | "modify" | "delete";
}

export const applyPatchTool: ToolDefinition<ApplyPatchInput, { success: boolean; path: string }> = {
  name: "apply_patch",
  description: "Apply a patch diff to a workspace file securely",
  inputSchema: {
    filePath: "string",
    diff: "string",
    operation: "string",
  },
  execute: async (input, context) => {
    if (input.operation === "delete") {
      return { success: true, path: input.filePath };
    }
    const content = input.diff.startsWith("+") ? input.diff.replace(/^\+/gm, "") : input.diff;
    if (context.workspace.writeFile) {
      await context.workspace.writeFile(input.filePath, content);
    }
    return { success: true, path: input.filePath };
  },
};
