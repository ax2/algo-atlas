import { test, expect, type Page, type Locator } from "@playwright/test";
import { defaults, runAILab, type LabId } from "../../src/engine/ai-labs";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

async function contained(page: Page) {
  await page
    .locator(".single-screen")
    .evaluate((e) => e.scrollIntoView({ block: "start" }));
  await expect
    .poll(() =>
      page.locator(".single-screen").evaluate((root) => {
        const b = root.getBoundingClientRect(),
          errors: string[] = [];
        if (b.top < -1 || b.bottom > innerHeight + 1)
          errors.push("stage outside viewport");
        for (const x of root.querySelectorAll("*")) {
          if (
            !(x instanceof HTMLElement) ||
            x instanceof HTMLInputElement ||
            x.closest(".note-measure,.pagination-probe") ||
            !x.clientHeight ||
            !x.clientWidth
          )
            continue;
          if (
            x.scrollHeight > x.clientHeight + 2 ||
            x.scrollWidth > x.clientWidth + 2
          )
            errors.push(
              `${x.className}:${x.clientWidth}/${x.scrollWidth},${x.clientHeight}/${x.scrollHeight}`,
            );
        }
        return errors;
      }),
    )
    .toEqual([]);
}
async function clickEdge(page: Page, edge: Locator) {
  // A broad transparent path is the actual hit target. Click a clear segment away from crossing edges.
  const point = await edge
    .locator(".edge-hit")
    .evaluate((e: SVGPathElement) => {
      const m = e.getScreenCTM()!;
      for (const fraction of [0.25, 0.75, 0.4, 0.6, 0.1, 0.9]) {
        const p = e.getPointAtLength(e.getTotalLength() * fraction);
        const x = m.a * p.x + m.c * p.y + m.e,
          y = m.b * p.x + m.d * p.y + m.f;
        if (
          document.elementFromPoint(x, y)?.closest(".energy-edge") ===
          e.parentElement
        )
          return { x, y };
      }
      throw new Error("No unobscured pointer target for this edge");
    });
  await page.mouse.click(point.x, point.y);
}

test("AI nodes and edges link real values, updates and Q cells across playback", async ({
  page,
}, info) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/#/cases/neural-training");
  await page
    .locator(".single-screen")
    .evaluate((e) => e.scrollIntoView({ block: "start" }));
  await clickEdge(page, page.locator('[data-edge="x0-h1"]'));
  await expect(
    page.getByRole("button", { name: "联动", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("combobox", { name: "观察参数" })).toHaveValue(
    "W1[0,1]",
  );
  await expect(page.locator(".tensor-table")).toContainText("待计算");
  await page
    .getByRole("combobox", { name: "训练阶段", exact: true })
    .selectOption("backward");
  await expect(page.locator('[data-edge="h1-x0"]')).toHaveClass(
    /data-selected/,
  );
  await expect(page.locator(".tensor-table")).not.toContainText("待计算");
  await expect(page.locator(".tensor-table [data-changed]")).toHaveCount(0);
  const old = await page.locator(".tensor-table tbody td").first().innerText();
  await page
    .getByRole("combobox", { name: "训练阶段", exact: true })
    .selectOption("update");
  await expect(page.locator(".tensor-table [data-changed]")).toHaveCount(1);
  await page.locator(".tensor-table [data-changed] button").click();
  await expect(page.locator(".tensor-inspect")).toContainText(old + " →");
  await expect(page.locator(".ai-update-equation [data-changed]")).toHaveCount(
    1,
  );
  await page.getByRole("button", { name: "节点 h2", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "选择张量" })).toHaveValue(
    "0",
  );
  await expect(page.locator(".tensor-table")).toHaveAttribute(
    "aria-label",
    /激活 h2/,
  );
  await contained(page);
  const out = process.env.ATLAS_EVIDENCE_DIR || test.info().outputDir;
  await mkdir(out, { recursive: true });
  await page.screenshot({
    path: join(out, `stage009-neural-${info.project.name}.png`),
  });

  await page.goto("/#/cases/transformer-lab");
  await page
    .getByRole("button", { name: "节点 Q / K / V", exact: true })
    .click();
  await page.getByRole("combobox", { name: "选择张量" }).selectOption("1");
  await page
    .getByRole("combobox", { name: "训练阶段", exact: true })
    .selectOption("backward");
  await expect(page.locator(".tensor-table")).toHaveAttribute(
    "aria-label",
    "关联权重与梯度 · 更新前后",
  );

  await page
    .getByRole("combobox", { name: "训练阶段", exact: true })
    .selectOption("update");
  await page
    .getByRole("button", { name: "节点 Q / K / V", exact: true })
    .click();
  await expect(page.locator(".tensor-table")).toHaveAttribute(
    "aria-label",
    "Q · 3×4",
  );
  await page.getByRole("combobox", { name: "选择张量" }).selectOption("1");
  await expect(page.locator(".tensor-table")).toHaveAttribute(
    "aria-label",
    "K · 3×4",
  );
  await expect(page.getByRole("combobox", { name: "观察参数" })).toHaveValue(
    /^WK\[/,
  );
  await page.getByRole("button", { name: "讲解", exact: true }).click();
  await page.getByRole("button", { name: "联动", exact: true }).click();
  await expect(page.locator(".tensor-table")).toHaveAttribute(
    "aria-label",
    "Q · 3×4",
  );
  await expect(page.getByRole("combobox", { name: "观察参数" })).toHaveValue(
    /^WQ\[/,
  );
  await page.getByRole("combobox", { name: "选择张量" }).selectOption("3");
  await expect(
    page.getByRole("combobox", { name: "观察参数" }).locator("option"),
  ).toHaveCount(48);
  await expect(page.locator(".tensor-table tbody tr")).not.toHaveCount(0);
  await contained(page);
  await page.screenshot({
    path: join(out, `stage009-transformer-${info.project.name}.png`),
  });
  // Keyboard selection of a reversed data-flow edge stays associated with the same operator.
  await page
    .getByRole("combobox", { name: "训练阶段", exact: true })
    .selectOption("backward");
  await page.locator('[data-edge="3-2"]').focus();
  await page.keyboard.press("Space");
  await expect(page.locator('[data-edge="3-2"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await contained(page);

  const trace = runAILab("reinforcement-lab", defaults("reinforcement-lab"));
  const step = trace.frames.findIndex(
    (f) =>
      f.phase === "update" &&
      f.transition!.state >= 8 &&
      f.transition!.old !== f.transition!.updated,
  );
  expect(step).toBeGreaterThan(0);
  const frame = trace.frames[step],
    tr = frame.transition!;
  await page.goto("/#/cases/reinforcement-lab");
  await page.getByRole("slider", { name: "AI 演示进度" }).fill(String(step));
  await page.getByRole("button", { name: "张量", exact: true }).click();
  await expect(page.locator(".tensor-table [data-active]")).toHaveCount(1);
  await expect(
    page.locator(".tensor-table [data-changed] button"),
  ).toHaveAttribute(
    "aria-label",
    new RegExp(`单元格 \\[${tr.state},${tr.action}\\]`),
  );
  await expect(page.locator(".motion-node[data-updating]")).toHaveAttribute(
    "data-node",
    String(tr.state),
  );
  await page.locator(".tensor-table [data-changed] button").click();
  await expect(page.locator(".tensor-inspect")).toContainText("→");
  await page.locator(`.motion-node[data-node="${tr.state}"]`).click();
  await expect(page.locator(".tensor-table [data-changed]")).toHaveCount(1);
  await contained(page);
  await page.screenshot({
    path: join(out, `stage009-q-learning-${info.project.name}.png`),
  });
  await page.getByRole("button", { name: "上一步", exact: true }).click();
  await expect(page.locator(".tensor-table [data-changed]")).toHaveCount(0);
  await expect(page.locator(".ai-update-focus")).toContainText("更新预览");
  await page
    .getByRole("combobox", { name: "训练阶段", exact: true })
    .selectOption("environment");
  await clickEdge(page, page.locator(`[data-edge="${tr.state}-${tr.next}"]`));
  await expect(page.locator(".tensor-table")).toHaveAttribute(
    "aria-label",
    `s${tr.state} · Q 值`,
  );
  await contained(page);
  expect(errors).toEqual([]);
});

test("every AI diagram target stays usable without internal scrolling", async ({
  page,
}) => {
  test.setTimeout(180000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const id of [
    "neural-training",
    "transformer-lab",
    "reinforcement-lab",
  ] as LabId[]) {
    await page.goto("/#/cases/" + id);
    for (const phase of id === "reinforcement-lab"
      ? ["action", "environment", "target", "update"]
      : ["input", "backward", "update"]) {
      await page
        .getByRole("combobox", { name: "训练阶段", exact: true })
        .selectOption(phase);
      const targets = page.locator('.graph-svg [role="button"]');
      for (let i = 0; i < (await targets.count()); i++) {
        await targets.nth(i).focus();
        await page.keyboard.press("Enter");
        await expect(
          page.getByRole("button", { name: "联动", exact: true }),
        ).toHaveAttribute("aria-pressed", "true");
        await contained(page);
        const picker = page.getByRole("combobox", { name: "选择张量" });
        const count = await picker.locator("option").count();
        // Include long weight/gradient tables, not only a node's first activation.
        await picker.selectOption(String(count - 1));
        await contained(page);
      }
    }
  }
});
