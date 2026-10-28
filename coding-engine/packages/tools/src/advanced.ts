import { ToolDefinition } from "./tool";
import { TypeScriptLanguageAdapter, PythonLanguageAdapter } from "../../project/src";

export const searchCodeTool: ToolDefinition<{ query: string }, { matches: Array<{ path: string; line: number; text: string }> }> = {
  name: "search_code",
  description: "Search workspace files for a text pattern or symbol",
  inputSchema: { query: "string" },
  execute: async (input, context) => {
    const files = await context.workspace.listFiles();
    const matches: Array<{ path: string; line: number; text: string }> = [];

    for (const file of files) {
      if (file.size > 500000) continue;
      try {
        const content = await context.workspace.readFile(file.path);
        const lines = content.split("\n");
        lines.forEach((line, idx) => {
          if (line.includes(input.query)) {
            matches.push({ path: file.path, line: idx + 1, text: line.trim() });
          }
        });
      } catch {}
    }

    return { matches };
  },
};

export const inspectProjectTool: ToolDefinition<{}, { detectedLanguage: string; inspection: any }> = {
  name: "inspect_project",
  description: "Inspect project structure to detect language, build, and test setup",
  inputSchema: {},
  execute: async (input, context) => {
    const tsAdapter = new TypeScriptLanguageAdapter();
    const pyAdapter = new PythonLanguageAdapter();

    if (await tsAdapter.detect(context.workspace)) {
      const inspection = await tsAdapter.inspect(context.workspace);
      return { detectedLanguage: "typescript", inspection };
    }

    if (await pyAdapter.detect(context.workspace)) {
      const inspection = await pyAdapter.inspect(context.workspace);
      return { detectedLanguage: "python", inspection };
    }

    return { detectedLanguage: "generic", inspection: { language: "generic" } };
  },
};
