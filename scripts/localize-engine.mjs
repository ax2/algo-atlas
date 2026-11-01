import ts from "typescript";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
const read = (p) => fs.readFileSync(root + p, "utf8").replace(/\r\n/g, "\n");
const module = async (p) =>
  import(
    "data:text/javascript;base64," +
      Buffer.from(
        ts.transpileModule(read(p), {
          compilerOptions: { module: ts.ModuleKind.ESNext },
        }).outputText,
      ).toString("base64")
  );
const english = (await module("src/i18n/en.ts")).default;
const sources = JSON.parse(read("src/i18n/source.json"));
const dict = new Map(sources.map((s, i) => [s, english[i]]));
for (const [k, v] of Object.entries(
  (await module("src/i18n/composed.ts")).composed,
))
  dict.set(k, v);
const han = /\p{Script=Han}/u;
const translate = (s) => {
  if (!han.test(s)) return s;
  const value = dict.get(s.replace(/\s+/g, " ").trim());
  if (!value) throw new Error("Missing source translation: " + s);
  return value;
};
const result = {};
for (const file of [
  "balanced",
  "advanced",
  "ai",
  "sorting",
  "structures",
  "graphs",
  "strategies",
  "strings",
  "math",
]) {
  const source = ts.createSourceFile(
    file + ".ts",
    read(`src/engine/${file}.ts`),
    ts.ScriptTarget.Latest,
    true,
  );
  const transformed = ts.transform(source, [
    (context) => {
      const f = context.factory;
      const visit = (node) => {
        if (
          (ts.isStringLiteral(node) ||
            ts.isNoSubstitutionTemplateLiteral(node)) &&
          han.test(node.text)
        )
          return f.createStringLiteral(translate(node.text));
        if (ts.isIdentifier(node) && han.test(node.text)) {
          if (ts.isPropertyAssignment(node.parent) && node.parent.name === node)
            return f.createStringLiteral(translate(node.text));
          throw new Error("Unsupported identifier: " + node.text);
        }
        if (ts.isTemplateExpression(node)) {
          const key =
            node.head.text +
            node.templateSpans
              .map((s, i) => `{${i}}` + s.literal.text)
              .join("");
          if (han.test(key)) {
            const parts = translate(key).split(/(\{\d+\})/);
            const spans = [];
            for (let i = 1; i < parts.length; i += 2) {
              const index = +parts[i].slice(1, -1);
              spans.push(
                f.createTemplateSpan(
                  ts.visitNode(node.templateSpans[index].expression, visit),
                  i + 2 >= parts.length
                    ? f.createTemplateTail(parts[i + 1])
                    : f.createTemplateMiddle(parts[i + 1]),
                ),
              );
            }
            return f.createTemplateExpression(
              f.createTemplateHead(parts[0]),
              spans,
            );
          }
        }
        return ts.visitEachChild(node, visit, context);
      };
      return (node) => ts.visitNode(node, visit);
    },
  ]);
  result[file] = ts
    .createPrinter({ newLine: ts.NewLineKind.LineFeed })
    .printFile(transformed.transformed[0]);
  transformed.dispose();
  if (han.test(result[file]))
    throw new Error(`Untranslated comment or source in ${file}`);
}
const output = JSON.stringify(result, null, 2) + "\n";
const destination = root + "src/content/engine-source.en.json";
if (process.argv.includes("--check")) {
  if (
    !fs.existsSync(destination) ||
    fs.readFileSync(destination, "utf8").replace(/\r\n/g, "\n") !== output
  )
    throw new Error("English engine source is stale. Run npm run i18n:source.");
} else fs.writeFileSync(destination, output);
console.log("9 English engine source views verified.");
