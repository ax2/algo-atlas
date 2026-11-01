import ts from "typescript";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
const destination = path.join(root, "src/i18n/source.json");
const old = fs.existsSync(destination)
  ? JSON.parse(fs.readFileSync(destination, "utf8"))
  : [];
const messages = new Set(old);
const han = /\p{Script=Han}/u;
const add = (value) => {
  if (!han.test(value)) return;
  if (value.includes("|") && value.includes("\n")) {
    for (const part of value.trim().split(/[|\n]/)) add(part);
  } else messages.add(value.replace(/\s+/g, " ").trim());
};
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "i18n") walk(file);
      continue;
    }
    if (!/\.tsx?$/.test(file)) continue;
    const source = ts.createSourceFile(
      file,
      fs.readFileSync(file, "utf8"),
      ts.ScriptTarget.Latest,
      true,
    );
    const visit = (node) => {
      if (
        ts.isStringLiteral(node) ||
        ts.isNoSubstitutionTemplateLiteral(node) ||
        ts.isJsxText(node) ||
        ts.isIdentifier(node)
      )
        add(node.text);
      else if (ts.isTemplateExpression(node))
        add(
          node.head.text +
            node.templateSpans
              .map((span, i) => `{${i}}` + span.literal.text)
              .join(""),
        );
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
}
walk(path.join(root, "src"));
fs.mkdirSync(path.dirname(destination), { recursive: true });
if (process.argv.includes("--check")) {
  if (messages.size !== old.length) {
    console.error("New messages need extraction and English translation.");
    process.exitCode = 1;
  }
} else
  fs.writeFileSync(destination, JSON.stringify([...messages], null, 2) + "\n");
console.log(
  `${messages.size} messages (${messages.size - old.length} new). IDs are stable array positions.`,
);
