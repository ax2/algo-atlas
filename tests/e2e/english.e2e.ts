import { test, expect, type Page } from "@playwright/test";
import { topics } from "../../src/content/catalog";
import { defaults, runAILab } from "../../src/engine/ai-labs";
import { readFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

async function untranslated(page: Page) {
  return page.locator("body").evaluate((body) => {
    const result: string[] = [];
    const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode,
        parent = node.parentElement;
      if (
        parent &&
        !parent.closest(
          '[translate="no"],script,style,.note-measure,.pagination-probe',
        ) &&
        parent.getClientRects().length &&
        /\p{Script=Han}/u.test(node.textContent || "")
      )
        result.push(node.textContent!.trim());
    }
    for (const e of body.querySelectorAll("[aria-label],[title],[placeholder]"))
      if (!e.closest('[translate="no"]'))
        for (const name of ["aria-label", "title", "placeholder"])
          if (/\p{Script=Han}/u.test(e.getAttribute(name) || ""))
            result.push(`${name}: ${e.getAttribute(name)}`);
    return [...new Set(result)];
  });
}
async function bounded(page: Page) {
  await page
    .locator(".single-screen")
    .evaluate((e) => e.scrollIntoView({ block: "start", behavior: "instant" }));
  await expect
    .poll(() =>
      page.locator(".single-screen").evaluate((root) => {
        const box = root.getBoundingClientRect(),
          errors: string[] = [];
        if (box.top < -1 || box.bottom > innerHeight + 1)
          errors.push("viewport");
        for (const e of root.querySelectorAll("*"))
          if (
            e instanceof HTMLElement &&
            !(e instanceof HTMLInputElement) &&
            !e.closest(".note-measure,.pagination-probe") &&
            e.clientHeight &&
            e.clientWidth &&
            (e.scrollHeight > e.clientHeight + 2 ||
              e.scrollWidth > e.clientWidth + 2)
          )
            errors.push(
              `${e.tagName}.${e.className} ${e.textContent?.slice(0, 60)} (${e.scrollWidth}/${e.clientWidth},${e.scrollHeight}/${e.clientHeight})`,
            );
        return errors;
      }),
    )
    .toEqual([]);
}
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem("algo-atlas.locale", "en"),
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
});
test("English Q updates, settings and light theme remain readable", async ({
  page,
}, info) => {
  await page.goto("/#/cases/reinforcement-lab");
  const frames = runAILab(
    "reinforcement-lab",
    defaults("reinforcement-lab"),
  ).frames;
  const index = frames.findIndex(
    (f) => f.phase === "update" && f.transition!.old !== f.transition!.updated,
  );
  await page.locator(".ai-timeline").fill(String(index));
  await page.getByRole("button", { name: "Tensors", exact: true }).click();
  await page.locator(".tensor-table [data-active] button").click();
  await page.getByRole("button", { name: "Step-by-step", exact: true }).click();
  const slider = page.locator(".micro-timeline");
  await slider.fill((await slider.getAttribute("max"))!);
  await bounded(page);
  await expect.poll(() => untranslated(page)).toEqual([]);
  if (info.project.name === "mobile")
    await page
      .getByRole("button", { name: "Open navigation", exact: true })
      .click();
  await page
    .getByRole("button", { name: "Switch to light theme", exact: true })
    .click();
  if (info.project.name === "mobile")
    await page
      .getByRole("button", { name: "Close sidebar", exact: true })
      .click();
  await bounded(page);
  const dir = process.env.ATLAS_EVIDENCE_DIR || info.outputDir;
  await mkdir(dir, { recursive: true });
  await page.screenshot({
    path: join(dir, `stage012-q-en-light-${info.project.name}.png`),
  });
  await page.locator(".calculation-back").click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect.poll(() => untranslated(page)).toEqual([]);
  await bounded(page);
});
test("English curriculum, interactions and every lesson render without untranslated text", async ({
  page,
}) => {
  test.setTimeout(180000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const route of [
    "catalog",
    "cases",
    "practice",
    "learning",
    ...topics.map((t) => `lesson/${t.id}`),
  ]) {
    await page.goto(`/#/${route}`);
    await expect(page.locator("main")).toBeVisible();
    await expect.poll(() => untranslated(page), route).toEqual([]);
  }
  expect(errors).toEqual([]);
});
test("English exercise solutions and locale switching preserve learning data", async ({
  page,
}, info) => {
  test.setTimeout(120000);
  const ids = [
    ...readFileSync("src/content/problems.ts", "utf8").matchAll(
      /\bp\(\s*"([\w-]+)"/g,
    ),
  ].map((m) => m[1]);
  expect(ids).toHaveLength(37);
  for (const id of ids) {
    await page.goto(`/#/practice/${id}`);
    await page.locator(".problem-actions button").first().click();
    await page.locator(".problem-actions button").last().click();
    await expect.poll(() => untranslated(page), id).toEqual([]);
  }
  await page.goto("/#/lesson/huffman");
  await page.evaluate(() =>
    localStorage.setItem(
      "algo-atlas.learning.v1",
      JSON.stringify({
        version: 1,
        favorites: ["huffman"],
        completed: [],
        notes: { huffman: "我的原始笔记 — keep this text" },
        updatedAt: new Date().toISOString(),
      }),
    ),
  );
  await page.reload();
  const saved = await page.evaluate(() =>
    localStorage.getItem("algo-atlas.learning.v1"),
  );
  if (info.project.name === "mobile")
    await page
      .getByRole("button", { name: "Open navigation", exact: true })
      .click();
  await page
    .getByRole("button", { name: "Switch to Chinese", exact: true })
    .click();
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
  await page
    .getByRole("button", { name: "Switch to English", exact: true })
    .click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  expect(
    await page.evaluate(() => localStorage.getItem("algo-atlas.learning.v1")),
  ).toBe(saved);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});
test("English AI backpropagation keeps layers, formulas and controls within one screen", async ({
  page,
}, info) => {
  test.setTimeout(120000);
  for (const id of ["neural-training", "transformer-lab"]) {
    await page.goto(`/#/cases/${id}`);
    await page
      .getByRole("combobox", { name: "Training stage", exact: true })
      .selectOption("backward");
    await page.getByRole("button", { name: "Parameters", exact: true }).click();
    const row = page
      .locator(".ai-ledger .note-page:not(.note-measure) tbody tr")
      .first();
    for (let n = 0; n < 15 && !(await row.count()); n++)
      await page
        .locator(".ai-ledger .experiment-pager:not(.pagination-probe) button")
        .last()
        .click();
    await row.locator("td").nth(2).getByRole("button").click();
    await page
      .getByRole("button", { name: "Step-by-step", exact: true })
      .click();
    await expect(page.locator(".calculation-player")).toHaveAttribute(
      "data-operation",
      "seed",
    );
    const stages = page.locator(".micro-stage");
    const values = await stages
      .locator("option")
      .evaluateAll((opts) => opts.map((o) => (o as HTMLOptionElement).value));
    for (const stage of values) {
      await stages.selectOption(stage);
      await bounded(page);
      await expect.poll(() => untranslated(page)).toEqual([]);
      await page.locator(".micro-controls button").last().click();
      await bounded(page);
      if (stage !== "update") {
        await page
          .getByRole("button", {
            name: "Read this step's explanation",
            exact: true,
          })
          .click();
        await bounded(page);
        await page
          .getByRole("button", {
            name: "Return to this step's formula",
            exact: true,
          })
          .click();
      }
    }
    await stages.selectOption(
      values.find((v) => v !== "update" && v !== values[0])!,
    );
    const original = page.viewportSize()!;
    await page.setViewportSize(
      original.width > 760
        ? { width: 1366, height: 600 }
        : { width: 360, height: 640 },
    );
    await bounded(page);
    const dir = process.env.ATLAS_EVIDENCE_DIR || info.outputDir;
    await mkdir(dir, { recursive: true });
    await page.screenshot({
      path: join(dir, `stage012-${id}-en-${info.project.name}.png`),
    });
    await page.setViewportSize(original);
  }
});
