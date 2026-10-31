import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

test("continuous lesson keeps all sections and their state while animation changes", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/#/lesson/huffman");
  await expect(page.locator(".lesson-section")).toHaveCount(5);
  for (const id of ["principles", "complexity", "implementation", "practice"])
    await expect(page.locator(`#section-${id}`)).toBeVisible();
  const source = await page.locator(".original-input").innerText();
  const top = () =>
    page
      .locator("#section-principles")
      .evaluate((el) => el.getBoundingClientRect().top + window.scrollY);
  const baseline = await top();
  await page.getByRole("combobox", { name: "实现语言" }).selectOption("python");
  await expect(page.locator(".implementation-code")).toContainText("def solve");
  await page.getByRole("slider", { name: "复杂度输入规模" }).fill("128");
  const slider = page.getByRole("slider", { name: "演示进度" }),
    max = +(await slider.getAttribute("max"))!;
  for (const step of [1, Math.floor(max / 2), max, 0, max]) {
    await slider.fill(String(step));
    await expect(page.locator(".original-input")).toHaveText(source, {
      useInnerText: true,
    });
    expect(Math.abs((await top()) - baseline)).toBeLessThan(1);
  }
  let result = "";
  while (true) {
    result += await page.getByRole("region", { name: "演示输出" }).innerText();
    const next = page.getByRole("button", { name: "讲解下一页", exact: true });
    if (!(await next.count()) || (await next.isDisabled())) break;
    await next.click();
  }
  expect(result).toContain("编码位串");
  expect(result).toContain("往返校验：一致");
  expect(result).toContain("结果明细");
  expect(result).toContain("101");
  await expect(page.getByRole("combobox", { name: "实现语言" })).toHaveValue(
    "python",
  );
  await expect(
    page.getByRole("slider", { name: "复杂度输入规模" }),
  ).toHaveValue("128");
  await page
    .getByRole("navigation", { name: "课程章节" })
    .getByRole("button", { name: "多语言实现" })
    .click();
  const out = process.env.ATLAS_EVIDENCE_DIR || test.info().outputDir;
  await mkdir(out, { recursive: true });
  await page.screenshot({
    path: join(out, `stage005-implementation-${info.project.name}.png`),
  });
  await page.locator(".final-output").scrollIntoViewIfNeeded();
  await page.screenshot({
    path: join(out, `stage005-huffman-${info.project.name}.png`),
  });
  expect(errors).toEqual([]);
});

test("lesson practice entry selects current course including courses with no standalone problems", async ({
  page,
}) => {
  for (const id of ["bfs", "huffman", "array"]) {
    await page.goto("/#/lesson/" + id);
    await page.getByRole("link", { name: "进入本课专题练习库" }).click();
    await expect(page).toHaveURL(new RegExp(`practice\\?topic=${id}$`));
    await expect(page.getByRole("combobox", { name: "关联课程" })).toHaveValue(
      id,
    );
    await expect(page.getByLabel("当前练习专题")).toBeVisible();
    if (await page.locator(".problem-row").count()) {
      await page.locator(".problem-row").first().click();
      await page
        .getByRole("button", { name: "返回练习库", exact: true })
        .click();
      await expect(
        page.getByRole("combobox", { name: "关联课程" }),
      ).toHaveValue(id);
    }
  }
  await page.goto("/#/lesson/topological");
  if (test.info().project.name === "mobile")
    await page.getByRole("button", { name: "打开导航" }).click();
  await page
    .getByRole("navigation", { name: "主导航" })
    .getByRole("button", { name: /练习库/ })
    .click();
  await expect(page.getByRole("combobox", { name: "关联课程" })).toHaveValue(
    "topological",
  );
});

test("graph queues remain explicit and graph-to-matrix frames do not move reading sections", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const id of ["bfs", "dfs", "topological", "max-flow", "scc"]) {
    await page.goto("/#/lesson/" + id);
    const slider = page.getByRole("slider", { name: "演示进度" }),
      max = +(await slider.getAttribute("max"))!;
    await expect(page.locator(".original-input")).toHaveCount(0);
    const baseline = await page
      .locator("#section-principles")
      .evaluate((el) => el.getBoundingClientRect().top + scrollY);
    for (const step of [1, Math.floor(max / 2), max]) {
      await slider.fill(String(step));
      await expect(page.getByLabel("算法工作区")).toContainText(/队列|栈|候选/);

      const top = await page
        .locator("#section-principles")
        .evaluate((el) => el.getBoundingClientRect().top + scrollY);
      expect(Math.abs(top - baseline)).toBeLessThan(1);
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
  }
  await page.goto("/#/lesson/scc?data=1");
  const forward = page.locator('[data-edge="0-1"] .edge-core');
  const reverse = page.locator('[data-edge="1-0"] .edge-core');
  await expect(forward).toHaveAttribute("d", / Q /);
  await expect(reverse).toHaveAttribute("d", / Q /);
  const control = async (locator: typeof forward) => {
    const path = (await locator.getAttribute("d"))!;
    return path.split(" Q ")[1].split(" ").slice(0, 2).map(Number);
  };
  expect(await control(forward)).not.toEqual(await control(reverse));
});
