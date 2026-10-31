import { test, expect } from "@playwright/test";
import { topics } from "../../src/content/catalog";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
test("all lessons and both scenarios render at beginning, middle and end", async ({
  page,
}) => {
  test.setTimeout(180000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const t of topics) {
    await page.goto("/#/lesson/" + t.id);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(t.name);
    await expect(page.locator(".input-context")).toBeVisible();
    for (const variant of t.mode === "scenario" ? ["0", "1"] : ["0"]) {
      if (variant === "1")
        await page
          .getByRole("combobox", { name: "实验场景" })
          .selectOption("1");
      const slider = page.getByRole("slider", { name: "演示进度" }),
        max = +((await slider.getAttribute("max")) || 0);
      expect(max, t.id).toBeGreaterThan(0);
      for (const pos of [0, Math.floor(max / 2), max]) {
        await slider.fill(String(pos));
        await expect(slider).toHaveValue(String(pos));
        await expect(page.locator(".current-step h4")).not.toBeEmpty();
        await expect(page.locator(".step-explanation")).toBeVisible();
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
          t.id + " horizontal overflow",
        ).toBe(true);
      }
      await expect(
        page.getByRole("button", { name: "下一步", exact: true }),
      ).toBeDisabled();
    }
  }
  expect(errors).toEqual([]);
});
test("balanced tree guided pause, input queue, AI and practice workflow", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const out = process.env.ATLAS_EVIDENCE_DIR || test.info().outputDir;
  await mkdir(out, { recursive: true });
  await page.goto("/#/lesson/avl");
  await expect(page.locator(".input-context")).toContainText("初始数据");
  await page.getByLabel("讲解模式：关键节点自动暂停").check();
  await page.getByRole("combobox", { name: "动画速度" }).selectOption("140");
  await page.getByRole("button", { name: "播放", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "播放", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".current-step")).toContainText("插入后的完整树");
  await expect(page.locator(".input-context")).toContainText("下一个");
  await page
    .locator(".checkpoint-list button")
    .filter({ hasText: "左旋修复平衡" })
    .last()
    .click();
  await expect(page.locator(".step-explanation")).toContainText("祖先");
  const beforeZoom = await page.locator(".diagram-content").boundingBox();
  await page.getByRole("button", { name: "放大图解", exact: true }).click();
  expect(
    (await page.locator(".diagram-content").boundingBox())!.width,
  ).toBeGreaterThan(beforeZoom!.width);
  await page.getByRole("button", { name: "适应宽度", exact: true }).click();
  await page.waitForTimeout(1000);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(400);
  await page.screenshot({
    path: join(out, `stage003-avl-${info.project.name}.png`),
    fullPage: true,
  });
  await page.goto("/#/lesson/kmeans");
  await page.getByRole("button", { name: "下一步", exact: true }).click();
  await expect(page.locator(".current-step")).toContainText("最近中心");
  await page.getByRole("button", { name: "下一步", exact: true }).click();
  await page.waitForTimeout(1000);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(400);
  await page.screenshot({
    path: join(out, `stage003-ai-${info.project.name}.png`),
    fullPage: true,
  });
  await page.goto("/#/practice");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("练习库");
  await expect(page.locator(".problem-row")).toHaveCount(8);
  await page.getByRole("button", { name: "下一页", exact: true }).click();
  await expect(page.locator(".pagination")).toContainText("2 / 4");
  await page.getByRole("textbox", { name: "练习搜索" }).fill("逆序");
  await expect(page.locator(".problem-row")).toHaveCount(1);
  await page.locator(".problem-row").click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "逆序的程度",
  );
  await page.getByRole("button", { name: "展开提示", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("归并");
  await page.getByRole("button", { name: "查看完整题解", exact: true }).click();
  await expect(page.locator(".solution code")).toContainText(
    "function inversions",
  );
  await page.getByRole("button", { name: "标记已练习", exact: true }).click();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "已练习（点击撤销）" }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.goto("/#/practice");
  await page.getByRole("button", { name: "AI 数值训练 4 题" }).click();
  await expect(page.locator(".problem-row")).toHaveCount(4);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(400);
  await page.screenshot({
    path: join(out, `stage003-practice-${info.project.name}.png`),
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});
