import { test, expect, type Page } from "@playwright/test";
import { aiLabs } from "../../src/content/ai-labs";
import { defaults, runAILab, fmt, type LabId } from "../../src/engine/ai-labs";

async function bounded(page: Page) {
  await page
    .locator("#section-experiment .single-screen")
    .evaluate((e) => e.scrollIntoView({ block: "start" }));
  await expect
    .poll(() =>
      page.locator("#section-experiment .single-screen").evaluate((root) => {
        const bounds = root.getBoundingClientRect(),
          errors: string[] = [];
        if (bounds.top < -1 || bounds.bottom > innerHeight + 1)
          errors.push(
            `viewport ${bounds.top}..${bounds.bottom}/${innerHeight}`,
          );
        if (document.documentElement.scrollWidth > innerWidth + 1)
          errors.push("page horizontal overflow");
        for (const e of root.querySelectorAll("*")) {
          if (
            !(e instanceof HTMLElement) ||
            e instanceof HTMLInputElement || // A selectable URL may exceed its native text field.
            e.closest(".note-measure,.pagination-probe") ||
            !e.clientHeight ||
            !e.clientWidth
          )
            continue;
          if (
            e.scrollHeight > e.clientHeight + 2 ||
            e.scrollWidth > e.clientWidth + 2
          )
            errors.push(
              `${e.className || e.tagName}: ${e.clientWidth}x${e.clientHeight}/${e.scrollWidth}x${e.scrollHeight}`,
            );
        }
        const canvas = root.querySelector(".fit-viewport");
        if (canvas) {
          const box = canvas.getBoundingClientRect();
          for (const node of canvas.querySelectorAll(
            ".node-shell,.node-subtitle,.edge-weight",
          )) {
            const rect = node.getBoundingClientRect();
            if (
              rect.left < box.left - 2 ||
              rect.right > box.right + 2 ||
              rect.top < box.top - 2 ||
              rect.bottom > box.bottom + 2
            )
              errors.push(
                `clipped graph: ${node.textContent || node.getAttribute("class")}`,
              );
          }
        }
        return errors;
      }),
    )
    .toEqual([]);
}

test("all integrated workspaces stay within one viewport across phases and panels", async ({
  page,
}, info) => {
  test.setTimeout(180000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const id of Object.keys(aiLabs) as LabId[]) {
    await page.goto(`/#/cases/${id}`);
    for (const phase of aiLabs[id].steps) {
      await page
        .getByRole("combobox", { name: "训练阶段", exact: true })
        .selectOption(phase);
      for (const panel of ["讲解", "张量", "参数", "趋势", "设置"]) {
        await page.getByRole("button", { name: panel, exact: true }).click();
        await bounded(page);
        if (panel === "讲解" && info.project.name === "desktop") {
          await expect(
            page.locator(
              ".ai-explanation .note-page:not(.note-measure) .note-block",
            ),
          ).toHaveCount(5);
          await expect(
            page
              .locator(".ai-explanation")
              .getByRole("button", { name: "讲解下一页" }),
          ).toHaveCount(0);
        }
        if (panel === "张量") {
          const tensor = page.getByRole("combobox", { name: "选择张量" });
          const count = await tensor.locator("option").count();
          for (let i = 0; i < count; i++) {
            await tensor.selectOption(String(i));
            await bounded(page);
          }
        }
      }
    }
    await page.getByRole("button", { name: "生成实验分享链接" }).click();
    await bounded(page);
    await page.getByRole("button", { name: "讲解", exact: true }).click();
    // Short laptop/phone, live resizing, and returning to the original size.
    const original = page.viewportSize()!;
    await page.setViewportSize({
      width: info.project.name === "desktop" ? 1366 : 390,
      height: 600,
    });
    await bounded(page);
    await page.setViewportSize(original);
    await bounded(page);
    if (info.project.name === "desktop") {
      await page.getByRole("button", { name: "进入专注模式" }).click();
      await expect
        .poll(() => page.evaluate(() => !!document.fullscreenElement))
        .toBe(true);
      await bounded(page);
      await page.getByRole("button", { name: "退出专注模式" }).click();
    }
  }
  for (const id of [
    "routes",
    "cache",
    "scheduler",
    "budget",
    "search",
    "diff",
  ]) {
    await page.goto(`/#/cases/${id}`);
    await bounded(page);
    if (id !== "diff") {
      await page.getByRole("combobox", { name: "专题场景" }).selectOption("1");
      await bounded(page);
    }
    if (id === "cache") {
      await page.getByRole("combobox", { name: "缓存容量" }).selectOption("1");
      await bounded(page);
    }
  }
  expect(errors).toEqual([]);
});

test("paginated explanations, tensors and parameter values preserve complete real data", async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const id of Object.keys(aiLabs) as LabId[]) {
    const trace = runAILab(id, defaults(id));
    const target = trace.frames.find((f) => f.phase === "update")!;
    await page.goto(`/#/cases/${id}`);
    await page
      .getByRole("combobox", { name: "训练阶段", exact: true })
      .selectOption("update");
    const parts: string[] = [];
    for (let i = 0; i < 30; i++) {
      parts.push(
        ...(await page
          .locator(".ai-explanation .note-page:not(.note-measure) p")
          .allTextContents()),
      );
      await bounded(page);
      const next = page.getByRole("button", {
        name: "讲解下一页",
        exact: true,
      });
      if (!(await next.count()) || (await next.isDisabled())) break;
      await next.click();
    }
    expect(parts.join("")).toBe(
      [
        target.formula,
        target.why,
        target.change,
        target.check,
        target.question,
      ].join(""),
    );
    await page.getByRole("button", { name: "参数", exact: true }).click();
    const group = id === "transformer-lab" ? "WQ" : "all";
    await page.getByRole("combobox", { name: "参数组" }).selectOption(group);
    const rows: string[][] = [];
    for (let i = 0; i < 35; i++) {
      rows.push(
        ...(await page
          .locator(".ai-ledger .note-page:not(.note-measure) tbody tr")
          .evaluateAll((list) =>
            list.map((row) =>
              [...row.querySelectorAll("td")].map((c) => c.textContent!),
            ),
          )),
      );
      await bounded(page);
      const next = page.getByRole("button", {
        name: "讲解下一页",
        exact: true,
      });
      if (!(await next.count()) || (await next.isDisabled())) break;
      await next.click();
    }
    expect(rows).toEqual(
      target.updates
        .filter((p) => group === "all" || p.group === group)
        .map((p) => [p.name, fmt(p.before), fmt(p.gradient), fmt(p.after)]),
    );
    await page.getByRole("button", { name: "张量", exact: true }).click();
    const cells = new Set<string>();
    for (let i = 0; i < 20; i++) {
      (
        await page
          .locator(".tensor-table button")
          .evaluateAll((list) => list.map((e) => e.getAttribute("aria-label")!))
      ).forEach((v) => cells.add(v));
      await bounded(page);
      const next = page.getByRole("button", {
        name: "张量下一页",
        exact: true,
      });
      if (await next.isDisabled()) break;
      await next.click();
    }
    const expected = target.tensors[0].rows.flatMap((row, i) =>
      row.map((v, j) => `单元格 [${i},${j}] = ${v}`),
    );
    const actual = [...cells].sort();
    expected.sort();
    expect(actual).toHaveLength(expected.length);
    actual.forEach((value, i) => {
      const [position, number] = value.split(" = ");
      const [expectedPosition, expectedNumber] = expected[i].split(" = ");
      expect(position).toBe(expectedPosition);
      // Node and Chromium libm can differ by one floating-point ULP.
      if (Number.isFinite(Number(expectedNumber)))
        expect(Number(number)).toBeCloseTo(Number(expectedNumber), 12);
      else expect(number).toBe(expectedNumber);
    });
    await page.getByRole("button", { name: "趋势", exact: true }).click();
    const historyRows: string[][] = [];
    for (let i = 0; i < 15; i++) {
      historyRows.push(
        ...(await page
          .locator(".ai-result .note-page:not(.note-measure) tbody tr")
          .evaluateAll((list) =>
            list.map((row) =>
              [...row.querySelectorAll("td")].map((c) => c.textContent!),
            ),
          )),
      );
      await bounded(page);
      const next = page.getByRole("button", {
        name: "讲解下一页",
        exact: true,
      });
      if (!(await next.count()) || (await next.isDisabled())) break;
      await next.click();
    }
    expect(historyRows).toEqual(
      target.history.map((v, i) => [
        String(i + (id === "reinforcement-lab" ? 1 : 0)),
        fmt(v),
      ]),
    );
  }
});
