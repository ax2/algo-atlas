import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
test("lesson playback, persistence, sharing, theme and responsive layout", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/#/lesson/quick");
  await expect(page).toHaveTitle("快速排序 · Algo Atlas");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "快速排序",
  );
  await page.getByRole("button", { name: "下一步", exact: true }).click();
  await expect(page.getByRole("heading", { name: "选择基准值" })).toBeVisible();
  await page.getByRole("slider", { name: "演示进度" }).press("End");
  await expect(page.getByRole("heading", { name: "排序完成" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "下一步", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "重置", exact: true }).click();
  await expect(page.getByRole("slider", { name: "演示进度" })).toHaveValue("0");
  await page.getByRole("button", { name: "播放", exact: true }).click();
  await expect(page.getByRole("slider", { name: "演示进度" })).not.toHaveValue(
    "0",
  );
  await page.getByRole("button", { name: "暂停", exact: true }).click();
  await page.getByRole("button", { name: "收藏", exact: true }).click();
  await page.getByRole("button", { name: "笔记", exact: true }).click();
  await page
    .getByRole("textbox", { name: "学习笔记" })
    .fill("测试笔记：固定基准的最坏情况是 O(n²)。");
  await page.getByRole("button", { name: "完成", exact: true }).click();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "取消收藏", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "笔记", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "学习笔记" })).toHaveValue(
    "测试笔记：固定基准的最坏情况是 O(n²)。",
  );
  await page.getByRole("button", { name: "关闭对话框" }).click();
  await page
    .getByRole("textbox", { name: "输入数据", exact: true })
    .fill("1,2,3,4");
  await page.getByRole("button", { name: "应用", exact: true }).click();
  await page.getByRole("button", { name: "下一步", exact: true }).click();
  await page.getByRole("button", { name: "分享", exact: true }).click();
  const share = await page
    .getByRole("textbox", { name: "分享链接" })
    .inputValue();
  expect(share).not.toContain("笔记");
  await page.goto(share);
  await expect(
    page.getByRole("textbox", { name: "输入数据", exact: true }),
  ).toHaveValue("1,2,3,4");
  await expect(page.getByRole("slider", { name: "演示进度" })).toHaveValue("1");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("textbox", { name: "输入数据", exact: true })
    .fill("-1,2");
  await page.getByRole("button", { name: "应用", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("整数");
  await page.goto("/#/lesson/quick");
  await page.getByRole("button", { name: "下一步", exact: true }).click();
  await page.evaluate(() => window.scrollTo(0, 0));
  // Motion uses requestAnimationFrame; Playwright's CSS animation switch does not settle it.
  await page.waitForTimeout(1000);
  const out = process.env.ATLAS_EVIDENCE_DIR || test.info().outputDir;
  await mkdir(out, { recursive: true });
  await page.screenshot({
    path: join(out, `algo-atlas-${info.project.name}.png`),
    fullPage: info.project.name === "mobile",
    animations: "disabled",
  });
  if (info.project.name === "mobile") {
    await page.getByRole("button", { name: "打开导航" }).click();
    await expect(
      page.getByRole("navigation", { name: "主导航" }),
    ).toBeVisible();
  }
  await page.getByRole("button", { name: "切换浅色主题" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  expect(errors).toEqual([]);
});
test("catalog search, complexity, mastery and integrated cases", async ({
  page,
}) => {
  await page.goto("/#/catalog");
  await page.getByRole("textbox", { name: "目录搜索" }).fill("Dijkstra");
  await expect(page.locator(".topic-row")).toHaveCount(2);
  await page
    .locator(".topic-row")
    .filter({
      has: page.getByRole("heading", {
        name: "Dijkstra 最短路 Dijkstra",
        exact: true,
      }),
    })
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Dijkstra",
  );
  await page.getByRole("tab", { name: "复杂度分析" }).click();
  await expect(page.getByText("把复杂度拆开看")).toBeVisible();
  await page.getByRole("slider", { name: "复杂度输入规模" }).fill("128");
  await expect(page.locator(".scale-control")).toContainText("128");
  await page.getByRole("tab", { name: "原理与历史" }).click();
  await expect(page.getByRole("heading", { name: "发展背景" })).toBeVisible();
  await page.getByRole("tab", { name: "代码与练习" }).click();
  await page
    .locator(".answer-options button")
    .filter({ hasText: "在非负权前提下" })
    .click();
  await expect(page.getByRole("status")).toContainText("回答正确");
  await page.getByRole("button", { name: "标记本课已掌握" }).click();
  await page.goto("/#/learning");
  await expect(page.locator(".progress-banner")).toContainText("已掌握 1 / 79");
  for (const id of [
    "routes",
    "cache",
    "scheduler",
    "budget",
    "search",
    "diff",
  ]) {
    await page.goto("/#/cases/" + id);
    await expect(
      page.getByRole("heading", { name: "改变约束，比较结果" }),
    ).toBeVisible();
    const before = await page.locator(".case-metrics").innerText();
    if (id !== "diff") {
      await page.getByRole("combobox", { name: "专题场景" }).selectOption("1");
      if (id !== "search")
        await expect(page.locator(".case-metrics")).not.toHaveText(before);
    }
    await page.getByRole("button", { name: "查看解析" }).click();
    await expect(page.locator(".case-answer")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});
test("backup download/import, keyboard dialog and zero-valued search share", async ({
  page,
}) => {
  await page.goto("/#/lesson/binary-search?data=0%2C1%2C2&target=0&step=1");
  await expect(page.getByRole("spinbutton", { name: "搜索目标" })).toHaveValue(
    "0",
  );
  await page.getByRole("slider", { name: "演示进度" }).press("End");
  await expect(
    page.getByRole("heading", { name: "找到目标", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "收藏", exact: true }).click();
  await page.goto("/#/learning");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出备份" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("algo-atlas-learning.json");
  const incoming = {
    version: 1,
    favorites: ["quick"],
    completed: ["bfs"],
    notes: { quick: "导入的笔记" },
    updatedAt: new Date().toISOString(),
  };
  await page.locator("input[type=file]").setInputFiles({
    name: "backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(incoming)),
  });
  await expect(page.getByRole("status")).toContainText("已合并备份");
  await page.getByRole("button", { name: "学习笔记", exact: true }).click();
  await expect(page.locator(".learning-list")).toContainText("导入的笔记");
  await page.goto("/#/lesson/quick");
  await page.getByRole("button", { name: "笔记", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "笔记", exact: true }),
  ).toBeFocused();
});
