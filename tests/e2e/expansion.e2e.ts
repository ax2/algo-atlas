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
    await expect(page.getByLabel("自适应图解")).toBeVisible();
    await page
      .getByRole("navigation", { name: "课程章节" })
      .getByRole("button", { name: "图解实验" })
      .click();
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
        await expect(page.locator(".note-deck")).toBeVisible();
        const geometry = await page.locator(".single-screen").evaluate((el) => {
          const r = el.getBoundingClientRect();
          const scrollbars = [...el.querySelectorAll("*")]
            .filter((child) => {
              const css = getComputedStyle(child);
              return (
                child.clientHeight > 0 &&
                ((["auto", "scroll"].includes(css.overflowY) &&
                  child.scrollHeight > child.clientHeight + 1) ||
                  (["auto", "scroll"].includes(css.overflowX) &&
                    child.scrollWidth > child.clientWidth + 1))
              );
            })
            .map((child) => child.className);
          const note = el.querySelector(".note-page:not(.note-measure)")!;
          return {
            height: r.height,
            viewport: innerHeight,
            scrollbars,
            noteFits: note.scrollHeight <= note.clientHeight + 1,
          };
        });
        expect(geometry.scrollbars, t.id + " nested scrollbar").toEqual([]);
        expect(geometry.height, t.id + " stage height").toBeLessThan(
          geometry.viewport,
        );
        expect(geometry.noteFits, t.id + " clipped note").toBe(true);
        await expect
          .poll(
            () =>
              page.locator(".fit-viewport").evaluate((el) => {
                const viewport = el.getBoundingClientRect();
                return [
                  ...el.querySelectorAll(
                    ".node-shell, .node-subtitle, .edge-weight",
                  ),
                ].every((node) => {
                  const r = node.getBoundingClientRect();
                  return (
                    r.left >= viewport.left - 2 &&
                    r.right <= viewport.right + 2 &&
                    r.top >= viewport.top - 2 &&
                    r.bottom <= viewport.bottom + 2
                  );
                });
              }),
            { message: t.id + " graph label cropped" },
          )
          .toBe(true);
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
  await expect(page.locator(".canvas .original-input")).toBeVisible();
  await page.getByLabel("讲解模式：关键节点自动暂停").check();
  await page.getByRole("combobox", { name: "动画速度" }).selectOption("140");
  await page.getByRole("button", { name: "播放", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "播放", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".current-step")).toContainText("插入后的完整树");
  await expect(page.locator(".canvas .processing-row")).toContainText("下一个");
  const checkpoint = page.getByRole("combobox", { name: "关键节点导航" });
  const rotation = await checkpoint
    .locator("option")
    .filter({ hasText: "左旋修复平衡" })
    .last()
    .getAttribute("value");
  await checkpoint.selectOption(rotation!);
  await page
    .getByRole("navigation", { name: "实验讲解" })
    .getByRole("button", { name: "详解", exact: true })
    .click();
  // Explanation remains complete and is now read one focused page at a time.
  let explanation = "";
  while (true) {
    explanation += await page.locator(".step-explanation").innerText();
    const next = page.getByRole("button", { name: "讲解下一页", exact: true });
    if (!(await next.count()) || (await next.isDisabled())) break;
    await next.click();
  }
  expect(explanation).toContain("祖先");
  await expect(
    page.getByRole("button", { name: "专注模式", exact: true }),
  ).toBeVisible();
  const fitted = await page.locator(".fit-scene").boundingBox();
  const viewport = await page.locator(".fit-viewport").boundingBox();
  expect(fitted!.width).toBeLessThanOrEqual(viewport!.width + 2);
  expect(fitted!.height).toBeLessThanOrEqual(viewport!.height + 2);
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
  await expect(page.locator(".pagination")).toContainText("2 /");
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
  await page.getByRole("button", { name: /^AI 数值训练 \d+ 题$/ }).click();
  await expect(page.locator(".problem-row")).toHaveCount(8);
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
