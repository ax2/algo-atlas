import { test, expect, type Page } from "@playwright/test";
import { topics } from "../../src/content/catalog";
import { lessonOverviews } from "../../src/content/lesson-overviews";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

async function bounded(page: Page) {
  await expect
    .poll(() =>
      page.locator(".single-screen").evaluate((root) => {
        const box = root.getBoundingClientRect();
        const errors: string[] = [];
        if (box.top < -1 || box.bottom > innerHeight + 1)
          errors.push("stage outside viewport");
        for (const el of root.querySelectorAll("*")) {
          if (
            !(el instanceof HTMLElement) ||
            el instanceof HTMLInputElement ||
            el.closest(".note-measure,.pagination-probe") ||
            !el.clientHeight ||
            !el.clientWidth
          )
            continue;
          if (
            el.scrollHeight > el.clientHeight + 2 ||
            el.scrollWidth > el.clientWidth + 2
          )
            errors.push(el.className + ": " + el.textContent?.slice(0, 40));
        }
        return errors;
      }),
    )
    .toEqual([]);
}

async function readOverview(page: Page, english = false) {
  let text = "";
  for (let count = 0; count < 50; count++) {
    await bounded(page);
    text += (
      await page.locator(".note-page:not(.note-measure) p").allTextContents()
    ).join("");
    const next = page.getByRole("button", {
      name: english ? "Next explanation page" : "讲解下一页",
      exact: true,
    });
    if (!(await next.count()) || (await next.isDisabled())) return text;
    await next.click();
  }
  throw Error("Overview pagination did not terminate");
}

test("every lesson has its own complete bilingual overview on a short screen", async ({
  page,
}, info) => {
  test.setTimeout(480000);
  await page.setViewportSize(
    info.project.name === "desktop"
      ? { width: 1366, height: 600 }
      : { width: 360, height: 640 },
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (["error", "warning"].includes(m.type())) errors.push(m.text());
  });
  for (const english of [false, true]) {
    await page.goto("/");
    await page.evaluate(
      (locale) => localStorage.setItem("algo-atlas.locale", locale),
      english ? "en" : "zh",
    );
    await page.reload();
    for (const topic of topics) {
      await page.goto(`/#/lesson/${topic.id}`);
      await expect(page).toHaveTitle(/Algo Atlas/);
      await expect(page.locator("vite-error-overlay")).toHaveCount(0);
      await expect(page.locator(".orientation-route li")).toHaveCount(3);
      const intro = await page.locator(".lesson-orientation").innerText();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 2,
        ),
      ).toBe(true);
      if (english) expect(intro, topic.id).not.toMatch(/\p{Script=Han}/u);
      else expect(intro, topic.id).toContain(lessonOverviews[topic.id].goal);
      await page
        .getByRole("button", {
          name: english ? "Open experiment" : "进入实验",
          exact: true,
        })
        .click();
      await expect(
        page.locator(".lesson-note-tabs button").first(),
      ).toHaveAttribute("aria-pressed", "true");
      const overview = await readOverview(page, english);
      if (english) expect(overview, topic.id).not.toMatch(/\p{Script=Han}/u);
      else {
        const compact = (value: string) => value.replace(/\s/g, "");
        for (const part of [
          lessonOverviews[topic.id].goal,
          ...lessonOverviews[topic.id].steps,
          lessonOverviews[topic.id].check,
        ])
          expect(compact(overview), topic.id).toContain(compact(part));
      }
    }
  }
  expect(errors).toEqual([]);
});

test("overview preserves position, pauses playback and follows applied input and scenario", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/#/lesson/binary-search");
  await page.getByRole("button", { name: "进入实验", exact: true }).click();
  await page
    .getByRole("textbox", { name: "输入数据", exact: true })
    .fill("9, 4, 7");
  await page.getByRole("spinbutton", { name: "搜索目标" }).fill("7");
  await page.getByRole("button", { name: "应用", exact: true }).click();
  let overview = await readOverview(page);
  expect(overview).toContain("9, 4, 7");
  expect(overview).toContain("搜索目标 = 7");
  await page.getByRole("button", { name: "下一步", exact: true }).click();
  await expect(page.locator(".lesson-note-tabs button").nth(1)).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  const slider = page.getByLabel("演示进度", { exact: true });
  await expect(slider).toHaveValue("1");
  await page.getByRole("button", { name: "总览", exact: true }).click();
  await expect(slider).toHaveValue("1");
  await page.getByLabel("动画速度").selectOption("1400");
  await page.getByRole("button", { name: "播放", exact: true }).click();
  await page.getByRole("button", { name: "总览", exact: true }).click();
  const paused = await slider.inputValue();
  await expect(
    page.getByRole("button", { name: "播放", exact: true }),
  ).toBeVisible();
  await page.waitForTimeout(1550);
  await expect(slider).toHaveValue(paused);
  await page.getByRole("button", { name: "重置", exact: true }).click();
  await expect(slider).toHaveValue("0");
  await page
    .getByRole("textbox", { name: "输入数据", exact: true })
    .fill("not applied");
  overview = await readOverview(page);
  expect(overview).toContain("9, 4, 7");
  expect(overview).not.toContain("not applied");
  await page.goto("/#/lesson/knapsack");
  await page.getByRole("button", { name: "进入实验", exact: true }).click();
  await page.getByLabel("实验场景", { exact: true }).selectOption("1");
  expect(await readOverview(page)).toContain("W=8");
  await page.getByLabel("实验场景", { exact: true }).selectOption("0");
  expect(await readOverview(page)).toContain("W=7");
  await page.goto("/#/lesson/huffman?data=abbccc&target=5&step=3");
  await expect(slider).toHaveValue("3");
  await expect(
    page.locator(".lesson-note-tabs button").first(),
  ).toHaveAttribute("aria-pressed", "false");
  await page.getByRole("button", { name: "总览", exact: true }).click();
  await expect(slider).toHaveValue("3");
});

test("Huffman roadmap and overview have desktop and mobile visual evidence", async ({
  page,
}, info) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize(
    info.project.name === "desktop"
      ? { width: 1440, height: 1000 }
      : { width: 390, height: 844 },
  );
  const out = process.env.ATLAS_EVIDENCE_DIR || test.info().outputDir;
  await mkdir(out, { recursive: true });
  await page.goto("/#/lesson/huffman");
  await expect(page.locator(".orientation-heading")).toContainText("解码还原");
  await page.screenshot({
    path: join(out, `stage015-roadmap-${info.project.name}.png`),
  });
  await page.getByRole("button", { name: "进入实验", exact: true }).click();
  await bounded(page);
  await page.screenshot({
    path: join(out, `stage015-overview-${info.project.name}.png`),
  });
  await page.evaluate(() => localStorage.setItem("algo-atlas.locale", "en"));
  await page.reload();
  await page
    .getByRole("button", { name: "Open experiment", exact: true })
    .click();
  await bounded(page);
  await page.screenshot({
    path: join(out, `stage015-overview-en-${info.project.name}.png`),
  });
});
