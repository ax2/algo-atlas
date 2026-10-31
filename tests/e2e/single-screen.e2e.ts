import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

test("single screen stage fits controls, paged explanations and complete output without scrolling", async ({
  page,
}, info) => {
  test.setTimeout(90000);
  if (info.project.name === "desktop")
    await page.setViewportSize({ width: 1366, height: 768 });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type()))
      errors.push(message.text());
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const id of ["huffman", "topological", "knapsack", "avl"]) {
    await page.goto("/#/lesson/" + id);
    await expect(page).toHaveTitle(/Algo Atlas/);
    await expect(page.locator("vite-error-overlay")).toHaveCount(0);
    await page
      .getByRole("navigation", { name: "课程章节" })
      .getByRole("button", { name: "图解实验" })
      .click();
    await expect
      .poll(() =>
        page.locator(".single-screen").evaluate((el) => {
          const r = el.getBoundingClientRect();
          return r.top >= 0 && r.bottom <= innerHeight + 1;
        }),
      )
      .toBe(true);
    const slider = page.getByLabel("演示进度"),
      max = +(await slider.getAttribute("max"))!;
    for (const step of [Math.floor(max / 2), max]) {
      await slider.fill(String(step));
      const stage = await page.locator(".single-screen").boundingBox();
      const scene = await page.locator(".fit-scene").boundingBox();
      const viewport = await page.locator(".fit-viewport").boundingBox();
      expect(viewport!.height).toBeGreaterThan(40);
      expect(scene!.width).toBeLessThanOrEqual(viewport!.width + 2);
      expect(scene!.height).toBeLessThanOrEqual(viewport!.height + 2);
      const controls = await page
        .locator(".playback button:not(:disabled), .experiment-footer input")
        .evaluateAll((elements) =>
          elements.map((el) => {
            const r = el.getBoundingClientRect(),
              hit = document.elementFromPoint(
                r.x + r.width / 2,
                r.y + r.height / 2,
              );
            return hit === el || el.contains(hit);
          }),
        );
      expect(controls.every(Boolean), id + " controls covered").toBe(true);
      for (const tab of ["这一步", "详解", "数据", "结果"]) {
        await page
          .getByRole("navigation", { name: "实验讲解" })
          .getByRole("button", { name: new RegExp("^" + tab) })
          .click();
        let pages = 0;
        do {
          expect(
            await page
              .locator(".note-page")
              .evaluate((el) => el.scrollHeight <= el.clientHeight + 1),
            id + " " + tab + " page " + pages,
          ).toBe(true);
          const next = page.getByRole("button", {
            name: "讲解下一页",
            exact: true,
          });
          if (!(await next.count()) || (await next.isDisabled())) break;
          await next.click();
          expect(++pages).toBeLessThan(100);
        } while (true);
      }
      expect((await page.locator(".single-screen").boundingBox())!.height).toBe(
        stage!.height,
      );
    }
    if (id === "huffman") {
      await page
        .getByRole("navigation", { name: "实验讲解" })
        .getByRole("button", { name: /^结果/ })
        .click();
      await page
        .getByRole("button", { name: "讲解下一页", exact: true })
        .click();
      await expect(
        page.getByRole("region", { name: "演示输出" }),
      ).toContainText("编码位串");
      const out = process.env.ATLAS_EVIDENCE_DIR || test.info().outputDir;
      await mkdir(out, { recursive: true });
      await page.screenshot({
        path: join(out, `stage006-final-${info.project.name}.png`),
      });
    }
  }
  if (info.project.name === "desktop") {
    await page.getByRole("button", { name: "专注模式", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "退出专注模式", exact: true }),
    ).toBeVisible();
    expect(await page.evaluate(() => !!document.fullscreenElement)).toBe(true);
    await page
      .getByRole("button", { name: "退出专注模式", exact: true })
      .click();
    expect(await page.evaluate(() => !!document.fullscreenElement)).toBe(false);
  }
  expect(errors).toEqual([]);
});
