import { test, expect } from "@playwright/test";

test("graph fills content bounds and notes repaginate to the measured space", async ({
  page,
}, info) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const desktop = info.project.name === "desktop";
  await page.setViewportSize(
    desktop ? { width: 1366, height: 768 } : { width: 390, height: 664 },
  );
  await page.goto("/#/lesson/huffman");
  await page
    .getByRole("navigation", { name: "课程章节" })
    .getByRole("button", { name: "图解实验" })
    .click();
  const slider = page.getByLabel("演示进度");
  await slider.fill((await slider.getAttribute("max"))!);
  const result = page.getByRole("region", { name: "演示输出" });
  await expect(result).toContainText("编码位串");
  const shell = await page.locator(".node-shell").first().boundingBox();
  expect(shell!.height).toBeGreaterThan(desktop ? 48 : 25);
  const fit = await page.locator(".fit-scene").boundingBox(),
    viewport = await page.locator(".fit-viewport").boundingBox();
  expect(
    Math.max(fit!.width / viewport!.width, fit!.height / viewport!.height),
  ).toBeGreaterThan(0.94);
  if (desktop) {
    await expect(
      page.getByRole("button", { name: "讲解下一页", exact: true }),
    ).toHaveCount(0);
    await expect(result).toContainText("往返校验：一致");
    await expect(result.locator("tbody tr")).toHaveCount(5);
  }
  const allText = async () => {
    let text = "",
      pages = 0;
    while (true) {
      const content = page.locator(".note-page:not(.note-measure)");
      expect(
        await content.evaluate((el) => el.scrollHeight <= el.clientHeight + 1),
      ).toBe(true);
      text += await content.innerText();
      pages++;
      const next = page.getByRole("button", {
        name: "讲解下一页",
        exact: true,
      });
      if (!(await next.count()) || (await next.isDisabled())) break;
      await next.click();
      expect(pages).toBeLessThan(30);
    }
    expect(text.replace(/\s/g, "")).toContain(
      "编码位串：01101110100010101101110",
    );
    expect(text).toContain("往返校验：一致");
    for (const row of [
      /a\s+5\s+0/,
      /b\s+2\s+110/,
      /r\s+2\s+111/,
      /c\s+1\s+100/,
      /d\s+1\s+101/,
    ])
      expect(text).toMatch(row);
    return pages;
  };
  const originalPages = await allText();
  await page.setViewportSize(
    desktop ? { width: 1366, height: 600 } : { width: 390, height: 844 },
  );
  await page
    .getByRole("navigation", { name: "实验讲解" })
    .getByRole("button", { name: /^结果/ })
    .click();
  const resizedPages = await allText();
  if (desktop) expect(resizedPages).toBeGreaterThan(originalPages);
  else expect(resizedPages).toBeLessThan(originalPages);
  await page.setViewportSize({ width: 1366, height: 900 });
  await expect(
    page.getByRole("button", { name: "讲解下一页", exact: true }),
  ).toHaveCount(0);
  await expect(result.locator("tbody tr")).toHaveCount(5);
  await expect(result).toContainText("往返校验：一致");
});
