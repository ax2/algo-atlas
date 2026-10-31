import { test, expect } from "@playwright/test";
test("edges draw through intermediate states and retract on removal", async ({
  page,
}) => {
  await page.goto("/#/lesson/convex-hull");
  await expect(page.getByRole("button", { name: "光影动效" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.locator(".edge-core")).toHaveCount(0);
  await page.getByRole("button", { name: "下一步", exact: true }).click();
  await expect(page.locator(".edge-core")).toHaveCount(1);
  const samples = await page.locator(".edge-core").evaluate(async (element) => {
    const values: number[] = [];
    for (let i = 0; i < 18; i++) {
      values.push(parseFloat(element.getAttribute("stroke-dasharray") || "1"));
      await new Promise((r) => setTimeout(r, 40));
    }
    return values;
  });
  expect(samples.some((v) => v > 0 && v < 0.98)).toBe(true);
  expect(samples.at(-1)).toBeGreaterThan(0.98);
  await page.getByRole("button", { name: "上一步", exact: true }).click();
  expect(await page.locator(".edge-core").count()).toBe(1);
  await expect(page.locator(".edge-core")).toHaveCount(0);
  await page.getByRole("button", { name: "光影动效" }).click();
  await expect(page.getByRole("button", { name: "光影动效" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await page.getByRole("button", { name: "下一步", exact: true }).click();
  await expect(page.locator(".edge-particle")).toHaveCount(0);
});
test("system reduced motion removes decorative layers; lesson tab preserves position", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/#/lesson/quick");
  await expect(page.getByRole("button", { name: "光影动效" })).toBeDisabled();
  await page.getByRole("button", { name: "下一步", exact: true }).click();
  await expect(page.locator(".bar-glow")).toHaveCount(0);
  await page
    .getByRole("navigation", { name: "课程章节" })
    .getByRole("button", { name: "复杂度分析" })
    .click();
  await page
    .getByRole("navigation", { name: "课程章节" })
    .getByRole("button", { name: "图解实验" })
    .click();
  await expect(page.getByRole("slider", { name: "演示进度" })).toHaveValue("1");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(page.getByRole("button", { name: "光影动效" })).toBeEnabled();
  await page.getByRole("combobox", { name: "动画速度" }).selectOption("140");
  await page.getByRole("button", { name: "播放", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "排序完成", exact: true }),
  ).toBeVisible({ timeout: 15000 });
  await expect(page.locator(".moving-bar")).toHaveCount(10);
});
