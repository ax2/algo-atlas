import { test, expect, type Page } from "@playwright/test";
import { defaults, runAILab } from "../../src/engine/ai-labs";
import { calculationSteps } from "../../src/engine/ai-calculation-steps";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

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
              `${e.tagName}.${e.className}: ${e.textContent?.slice(0, 48)} (${e.scrollWidth}/${e.clientWidth}, ${e.scrollHeight}/${e.clientHeight})`,
            );
        return errors;
      }),
    )
    .toEqual([]);
  const pairs = await page
    .locator(".micro-formula [data-cell-ref]")
    .evaluateAll((refs) =>
      refs.map((ref) => {
        const cell = [...document.querySelectorAll(".micro-cell")].find(
          (c) =>
            c.getAttribute("data-cell-id") ===
            ref.getAttribute("data-cell-ref"),
        );
        return (
          !!cell &&
          cell.getAttribute("data-slot") === ref.getAttribute("data-slot") &&
          cell.querySelector("strong")?.textContent === ref.textContent
        );
      }),
    );
  expect(pairs.length).toBeGreaterThan(0);
  expect(pairs.every(Boolean)).toBe(true);
}
async function capture(page: Page, name: string) {
  const dir = process.env.ATLAS_EVIDENCE_DIR || test.info().outputDir;
  await mkdir(dir, { recursive: true });
  await page.screenshot({
    path: join(dir, `stage011-${name}-${test.info().project.name}.png`),
  });
}
const phase = (page: Page, value: string) =>
  page
    .getByRole("combobox", { name: "训练阶段", exact: true })
    .selectOption(value);
const progress = (page: Page) =>
  page.getByRole("slider", { name: "计算步骤进度", exact: true });

test("neural arithmetic playback maps cells and edges, pauses independently and replays gradient/SGD", async ({
  page,
}) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  // Exercise real motion and timers here; the second test also covers reduced motion.
  await page.goto("/#/cases/neural-training");
  await phase(page, "forward");
  await page.locator('[data-node="h1"]').click();
  const cell = page
    .locator(".tensor-table")
    .getByRole("button", { name: /单元格 \[2,0\]/ });
  while (!(await cell.count()))
    await page.getByRole("button", { name: "张量下一页", exact: true }).click();
  await cell.click();
  await page.getByRole("button", { name: "逐步演示", exact: true }).click();
  const config = defaults("neural-training"),
    trace = runAILab("neural-training", config);
  const steps = calculationSteps("neural-training", trace.frames[1], config, {
    key: "hidden",
    row: 2,
    col: 1,
  });
  const outer = page.getByRole("slider", { name: "AI 演示进度" });
  const outerValue = await outer.inputValue();
  for (let i = 0; i < steps.length; i++) {
    await progress(page).fill(String(i));
    await expect(page.locator(".calculation-player")).toHaveAttribute(
      "data-operation",
      steps[i].operation,
    );
    await bounded(page);
    if (steps[i].operation === "mul") {
      const [a, b] = steps[i].edges[0];
      await expect(page.locator(`[data-edge="${a}-${b}"]`)).toHaveClass(
        /data-selected/,
      );
      await expect(
        page.locator(`[data-edge="${a === "x0" ? "x1" : "x0"}-h1"]`),
      ).not.toHaveClass(/data-selected/);
      await expect(page.locator('[data-node="h1"] .node-subtitle')).toHaveText(
        `本步 ${Number(steps[i].cells.find((c) => c.id === steps[i].result)!.value).toFixed(4)}`,
      );
    }
  }
  await expect(page.locator('[data-node="x0"] .node-subtitle')).toHaveText("1");
  await expect(page.locator('[data-node="x1"] .node-subtitle')).toHaveText("0");
  await capture(page, "neural-activation");
  await page.getByRole("button", { name: "计算重新开始", exact: true }).click();
  await page.getByRole("button", { name: "播放计算演示", exact: true }).click();
  await expect.poll(() => progress(page).inputValue()).not.toBe("0");
  await page.getByRole("button", { name: "暂停计算演示", exact: true }).click();
  const paused = await progress(page).inputValue();
  await page.waitForTimeout(1150);
  await expect(progress(page)).toHaveValue(paused);
  await expect(outer).toHaveValue(outerValue);
  await page.getByRole("button", { name: "计算下一步", exact: true }).click();
  await expect(progress(page)).toHaveValue(String(Number(paused) + 1));
  await page.getByRole("button", { name: "计算上一步", exact: true }).click();
  await expect(progress(page)).toHaveValue(paused);
  await page.getByRole("button", { name: /返回数值表/ }).click();
  await expect(cell).toBeVisible();
  await phase(page, "update");
  await page.getByRole("button", { name: "参数", exact: true }).click();
  await page
    .getByRole("combobox", { name: "参数组", exact: true })
    .selectOption("W1");
  const row = page
    .locator(".ai-ledger .note-page:not(.note-measure) tbody tr")
    .first();
  while (!(await row.count()))
    await page
      .locator(".ai-ledger")
      .getByRole("button", { name: "讲解下一页", exact: true })
      .click();
  const name = await row.locator("td").first().innerText();
  await row.locator("td").nth(2).getByRole("button").click();
  await page.getByRole("button", { name: "逐步演示", exact: true }).click();
  const gradientSteps = calculationSteps(
    "neural-training",
    trace.frames.find((f) => f.phase === "update")!,
    config,
    { key: "parameter", row: 0, col: 0, parameter: name, field: "gradient" },
  );
  for (let i = 0; i < gradientSteps.length; i++) {
    await progress(page).fill(String(i));
    await bounded(page);
    const s = gradientSteps[i];
    if (s.field)
      await expect(page.locator(`[data-term="${s.field}"]`)).toHaveAttribute(
        "data-picked",
        "true",
      );
    if (s.direction === "backward")
      await expect(page.locator('[data-edge="h0-x0"]')).toHaveClass(
        /data-selected/,
      );
    if (s.edgeLabel)
      await expect(
        page.locator(
          `[data-edge="${s.direction === "backward" ? "h0-x0" : "x0-h0"}"] .edge-weight`,
        ),
      ).toHaveText(s.edgeLabel);
  }
  await expect(page.locator(".micro-cell")).toHaveCount(4);
  await capture(page, "neural-update");
  await phase(page, "backward");
  await expect(progress(page)).toHaveValue("0");
  await expect(
    page.getByRole("button", { name: "播放计算演示", exact: true }),
  ).toBeVisible();
  await progress(page).fill(String(gradientSteps.length - 1));
  await expect(page.locator(".micro-controls")).toContainText("预览");
  await phase(page, "input");
  await expect(progress(page)).toHaveValue("0");
  await expect(page.locator(".calculation-player")).toHaveAttribute(
    "data-operation",
    "read",
  );
  expect(errors).toEqual([]);
});

test("Transformer and Q calculations keep formulas addressable and bounded, including tiny viewports", async ({
  page,
}) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/#/cases/transformer-lab");
  await phase(page, "residual");
  await page.getByRole("button", { name: "张量", exact: true }).click();
  await page
    .getByRole("combobox", { name: "选择张量" })
    .selectOption({ label: "FFN(LN(R)) · 3×4" });
  await page.locator(".tensor-table button").first().click();
  await page.getByRole("button", { name: "逐步演示", exact: true }).click();
  const config = defaults("transformer-lab"),
    trace = runAILab("transformer-lab", config);
  const frame = trace.frames.find((f) => f.phase === "residual")!;
  const steps = calculationSteps("transformer-lab", frame, config, {
    key: "feed",
    row: 0,
    col: 0,
  });
  const selected = [
    ...new Set([
      0,
      steps.length - 1,
      ...["add", "mul", "relu"]
        .map((op) => steps.findIndex((s) => s.operation === op))
        .filter((n) => n >= 0),
    ]),
  ];
  expect(steps.some((s) => s.operation === "relu")).toBe(true);
  for (const i of selected) {
    await progress(page).fill(String(i));
    await bounded(page);
    await expect(page.locator('[data-node="4"]')).toHaveClass(/data-selected/);
  }
  await capture(page, "transformer-relu");
  await page.getByRole("button", { name: /返回数值表/ }).click();
  await phase(page, "mask");
  await page.getByRole("combobox", { name: "选择张量" }).selectOption("1");
  await page
    .locator(".tensor-table")
    .getByRole("button", { name: /单元格 \[0,2\]/ })
    .click();
  await page.getByRole("button", { name: "逐步演示", exact: true }).click();
  await expect(page.locator(".micro-cell strong")).toHaveText("0.0000");
  await bounded(page);
  await page.goto("/#/cases/reinforcement-lab");
  const rlConfig = defaults("reinforcement-lab"),
    rlTrace = runAILab("reinforcement-lab", rlConfig);
  const index = rlTrace.frames.findIndex(
    (f) => f.phase === "update" && f.transition!.old !== f.transition!.updated,
  );
  const tr = rlTrace.frames[index].transition!;
  await page.getByRole("slider", { name: "AI 演示进度" }).fill(String(index));
  await page.getByRole("button", { name: "张量", exact: true }).click();
  await page.locator(".tensor-table [data-active] button").click();
  await page.getByRole("button", { name: "逐步演示", exact: true }).click();
  const max = Number(await progress(page).getAttribute("max"));
  for (let i = 0; i <= max; i++) {
    await progress(page).fill(String(i));
    await bounded(page);
  }
  await expect(page.locator(`[data-node="${tr.state}"]`)).toHaveClass(
    /data-selected/,
  );
  await expect(page.locator(".micro-cell")).toHaveCount(4);
  await capture(page, "q-update");
  const original = page.viewportSize()!;
  // Exercise a wider monospace face as well as the host's default UI font.
  await page.addStyleTag({
    content: ".micro-cell > strong { font-family: 'Courier New', monospace; }",
  });
  await page.setViewportSize(
    original.width > 760
      ? { width: 1366, height: 600 }
      : { width: 360, height: 640 },
  );
  await bounded(page);
  await capture(page, "q-compact");
  await page.getByRole("button", { name: "上一步", exact: true }).click();
  await expect(progress(page)).toHaveValue("0");
  await progress(page).fill(String(max));
  await expect(page.locator(".micro-controls")).toContainText("预览");
  await bounded(page);
  expect(errors).toEqual([]);
});
