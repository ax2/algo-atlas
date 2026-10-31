import { test, expect, type Page } from "@playwright/test";
import { defaults, runAILab } from "../../src/engine/ai-labs";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

async function bounded(page: Page) {
  await page
    .locator(".single-screen")
    .evaluate((e) => e.scrollIntoView({ block: "start", behavior: "instant" }));
  await expect
    .poll(() =>
      page.locator(".single-screen").evaluate((root) => {
        const b = root.getBoundingClientRect(),
          errors: string[] = [];
        if (b.top < -1 || b.bottom > innerHeight + 1) errors.push("viewport");
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
            errors.push(e.className);
        return errors;
      }),
    )
    .toEqual([]);
}
async function explanation(page: Page) {
  const text: string[] = [];
  for (let i = 0; i < 120; i++) {
    await bounded(page);
    text.push(
      await page
        .locator(".ai-derivation .note-page:not(.note-measure)")
        .innerText(),
    );
    const next = page
      .locator(".ai-derivation")
      .getByRole("button", { name: "讲解下一页", exact: true });
    if (!(await next.count()) || (await next.isDisabled()))
      return text.join("\n");
    await next.click();
  }
  throw Error("Derivation pagination did not terminate");
}
async function capture(page: Page, name: string) {
  const dir = process.env.ATLAS_EVIDENCE_DIR || test.info().outputDir;
  await mkdir(dir, { recursive: true });
  await page.screenshot({
    path: join(dir, `stage010-${name}-${test.info().project.name}.png`),
  });
}
test("tensor and ledger values reverse-select the graph, preserve paging and track the full SGD update", async ({
  page,
}) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/#/cases/neural-training");
  await expect(page).toHaveTitle(/Algo Atlas/);
  await page
    .getByRole("combobox", { name: "训练阶段", exact: true })
    .selectOption("forward");
  await page.locator('[data-node="h1"]').click();
  const cell = page
    .locator(".tensor-table")
    .getByRole("button", { name: /单元格 \[2,0\]/ });
  while (!(await cell.count()))
    await page.getByRole("button", { name: "张量下一页", exact: true }).click();
  await cell.click();
  await expect(page.locator('[data-node="x0"] .node-subtitle')).toHaveText(
    "1.0000",
  );
  await expect(page.locator('[data-node="x1"] .node-subtitle')).toHaveText(
    "0.0000",
  );
  await expect(
    page.getByRole("region", { name: "所选数值计算过程" }),
  ).toBeVisible();
  await expect(page.locator('[data-edge="x0-h1"]')).toHaveClass(
    /data-selected/,
  );
  await expect(page.locator('[data-edge="x1-h1"]')).toHaveClass(
    /data-selected/,
  );
  expect(await explanation(page)).toContain("tanh");
  await page.getByRole("button", { name: "返回数值表", exact: false }).click();
  await expect(cell).toBeVisible();
  await page
    .getByRole("combobox", { name: "训练阶段", exact: true })
    .selectOption("backward");
  await page.getByRole("button", { name: "参数", exact: true }).click();
  await page
    .getByRole("combobox", { name: "参数组", exact: true })
    .selectOption("W1");
  const first = page
    .locator(".ai-ledger .note-page:not(.note-measure) tbody tr")
    .first();
  while (!(await first.count()))
    await page
      .locator(".ai-ledger")
      .getByRole("button", { name: "讲解下一页", exact: true })
      .click();
  const parameter = await first.locator("td").first().innerText();
  await first.locator("td").nth(2).getByRole("button").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator('[data-edge="h0-x0"]')).toHaveClass(
    /data-selected/,
  );
  await expect(page.locator('[data-term="gradient"]')).toHaveAttribute(
    "data-picked",
    "true",
  );
  const before = await page.locator('[data-term="before"] strong').innerText();
  expect(await explanation(page)).toContain("本轮反传贡献");
  await page
    .getByRole("combobox", { name: "训练阶段", exact: true })
    .selectOption("update");
  await expect(page.getByRole("combobox", { name: "观察参数" })).toHaveValue(
    parameter,
  );
  await expect(page.locator('[data-term="before"] strong')).toHaveText(before);
  await expect(page.locator(".update-terms [data-changed]")).toHaveCount(1);
  await expect(page.locator('[data-term="rate"] strong')).toHaveText(
    String(defaults("neural-training").rate),
  );
  await bounded(page);
  await capture(page, "neural-update");
  expect(await explanation(page)).toContain("本步已写入");
  await page.getByRole("button", { name: "返回数值表", exact: false }).click();
  await expect(page.locator(".ai-parameters")).toBeVisible();
  expect(errors).toEqual([]);
});
test("Transformer cells explain projections and masks; Q cells bind the exact TD write without scrolling", async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/#/cases/transformer-lab");
  await page
    .getByRole("combobox", { name: "训练阶段", exact: true })
    .selectOption("qkv");
  await page.getByRole("button", { name: "张量", exact: true }).click();
  await page.getByRole("combobox", { name: "选择张量" }).selectOption("1");
  await page.locator(".tensor-table button").first().click();
  await expect(page.locator('[data-edge="1-2"]')).toHaveClass(/data-selected/);
  const details = await explanation(page);
  expect(details).toContain("LayerNorm");
  expect(details).toContain("WK");
  await page.getByRole("button", { name: "返回数值表", exact: false }).click();
  await expect(page.getByRole("combobox", { name: "选择张量" })).toHaveValue(
    "1",
  );
  await page
    .getByRole("combobox", { name: "训练阶段", exact: true })
    .selectOption("mask");
  await page.getByRole("combobox", { name: "选择张量" }).selectOption("1");
  await page
    .locator(".tensor-table")
    .getByRole("button", { name: /单元格 \[0,2\]/ })
    .click();
  await expect(page.locator('[data-node="3"]')).toHaveClass(/data-selected/);
  await bounded(page);
  await capture(page, "transformer-mask");
  expect(await explanation(page)).toContain("不参与归一化分母");
  const config = defaults("reinforcement-lab"),
    trace = runAILab("reinforcement-lab", config);
  const step = trace.frames.findIndex(
      (f) =>
        f.phase === "update" &&
        f.transition!.state >= 8 &&
        f.transition!.old !== f.transition!.updated,
    ),
    tr = trace.frames[step].transition!;
  await page.goto("/#/cases/reinforcement-lab");
  await page.getByRole("slider", { name: "AI 演示进度" }).fill(String(step));
  await page.getByRole("button", { name: "张量", exact: true }).click();
  await page.locator(".tensor-table [data-active] button").click();
  await expect(page.locator(`[data-node="${tr.state}"]`)).toHaveClass(
    /data-selected/,
  );
  await expect(page.locator(`[data-node="${tr.next}"]`)).toHaveClass(
    /data-selected/,
  );
  await expect(page.locator('[data-term="rate"] strong')).toHaveText(
    String(config.rate),
  );
  await bounded(page);
  await capture(page, "q-update");
  expect(await explanation(page)).toContain("TD 目标");
  await page.getByRole("button", { name: "上一步", exact: true }).click();
  await expect(page.locator(".update-terms [data-changed]")).toHaveCount(0);
  expect(await explanation(page)).toContain("下一步写入预览");
  await page.getByRole("button", { name: "返回数值表", exact: false }).click();
  await expect(page.locator(".tensor-table [data-active]")).toBeVisible();
});
