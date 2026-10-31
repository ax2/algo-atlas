import { test, expect } from "@playwright/test";
import { aiLabs } from "../../src/content/ai-labs";
import type { LabId } from "../../src/engine/ai-labs";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

for (const id of Object.keys(aiLabs) as LabId[]) {
  test(`${id}: data flow, updates, replay, settings, sharing and answers`, async ({
    page,
  }, info) => {
    const errors: string[] = [],
      warnings: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error" || m.type() === "warning")
        warnings.push(m.text());
    });
    const content = aiLabs[id];
    const out = process.env.ATLAS_EVIDENCE_DIR || test.info().outputDir;
    await mkdir(out, { recursive: true });
    await page.goto("/#/cases");
    await expect(page).toHaveTitle(/Algo Atlas/);
    await expect(page.locator(".case-card")).toHaveCount(9);
    await page.locator(".case-card").filter({ hasText: content.title }).click();
    await expect(page).toHaveURL(new RegExp("cases/" + id));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      content.title,
    );
    await expect(page.locator("vite-error-overlay")).toHaveCount(0);
    await expect(page.locator(".ai-source")).toContainText("初始数据");
    const progress = page.getByRole("slider", { name: "AI 演示进度" });
    await page.getByRole("combobox", { name: "播放速度" }).selectOption("300");
    await page.getByRole("button", { name: "播放", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "播放", exact: true }),
    ).toBeVisible();
    await expect(page.locator(".ai-explanation h2")).toContainText(
      id === "transformer-lab"
        ? "掩码"
        : id === "neural-training"
          ? "损失"
          : "Bellman",
    );
    await page
      .locator(".ai-phases")
      .getByRole("button", { name: "参数更新", exact: true })
      .click();
    await expect(page.locator(".ai-parameters")).toContainText("已执行更新");
    await expect(page.locator(".ai-parameters tbody tr")).not.toHaveCount(0);
    if (info.project.name === "desktop") {
      await page.waitForTimeout(400);
      await page
        .locator(".ai-data-panels")
        .screenshot({
          path: join(out, `stage004-${id}-parameters-desktop.png`),
        });
    }
    if (id === "transformer-lab") {
      await page.getByRole("combobox", { name: "参数组" }).selectOption("WQ");
      await expect(page.locator(".ai-parameters tbody tr")).toHaveCount(16);
      await page
        .locator(".ai-phases")
        .getByRole("button", { name: "掩码注意力" })
        .click();
      await page.getByRole("combobox", { name: "选择张量" }).selectOption("3");
      await expect(page.locator(".ai-tensor")).toContainText("头 2");
    }
    await page.locator(".ai-tensor .matrix button").first().click();
    await expect(page.locator(".ai-tensor [role=status]")).toContainText(
      "单元格",
    );
    await page.getByRole("button", { name: "生成实验分享链接" }).click();
    const url = await page
        .getByRole("textbox", { name: "实验分享链接" })
        .inputValue(),
      saved = await progress.inputValue();
    await page.goto(url);
    await expect(progress).toHaveValue(saved);
    await page.getByRole("combobox", { name: "AI 数据场景" }).selectOption("1");
    await expect(progress).toHaveValue("0");
    await page
      .getByRole("combobox", { name: "学习率" })
      .selectOption(
        id === "neural-training"
          ? "0.1"
          : id === "transformer-lab"
            ? "0.02"
            : "1",
      );
    await expect(progress).toHaveValue("0");
    if (id === "reinforcement-lab") {
      await page.getByRole("combobox", { name: "探索率" }).selectOption("0.8");
      await page
        .getByRole("combobox", { name: "折扣因子" })
        .selectOption("0.5");
    }
    await page.getByRole("combobox", { name: "跳到轮次" }).selectOption("2");
    await expect(page.locator(".ai-stage-top")).toContainText("2");
    const max = (await progress.getAttribute("max"))!;
    await progress.fill(max);
    await expect(page.locator(".ai-result")).toContainText("本次实验结果");
    await expect(
      page.getByRole("button", { name: "下一步", exact: true }),
    ).toBeDisabled();
    // Capture a useful real computation state after restoring the baseline experiment.
    await page.goto("/#/cases/" + id);
    await page.reload();
    await page
      .locator(".ai-phases")
      .getByRole("button", {
        name: id === "transformer-lab" ? "掩码注意力" : "参数更新",
        exact: true,
      })
      .click();
    if (id === "transformer-lab")
      await page.getByRole("combobox", { name: "选择张量" }).selectOption("1");
    await page.waitForTimeout(1000);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: join(out, `stage004-${id}-${info.project.name}.png`),
      fullPage: false,
    });
    if (info.project.name === "mobile") {
      await page.locator(".ai-stage").scrollIntoViewIfNeeded();
      await page.screenshot({
        path: join(out, `stage004-${id}-workspace-mobile.png`),
      });
    } else
      await page
        .locator(".ai-workspace")
        .screenshot({
          path: join(out, `stage004-${id}-workspace-desktop.png`),
        });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(page.locator(".ai-stage-top")).toContainText("静态模式");
    await page.locator(".ai-exercises button").first().click();
    await expect(page).toHaveURL(
      new RegExp("practice/" + content.exercises[0]),
    );
    await expect(page.getByRole("heading", { level: 1 })).not.toBeEmpty();
    await page.getByRole("button", { name: "展开提示", exact: true }).click();
    await page
      .getByRole("button", { name: "查看完整题解", exact: true })
      .click();
    await expect(page.locator(".solution code")).toContainText(
      "export function",
    );
    await page.getByRole("button", { name: "返回 AI 综合实验" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      content.title,
    );
    expect(errors).toEqual([]);
    expect(warnings).toEqual([]);
  });
}
