import { test, expect } from '@playwright/test';

test('creator entry preserves the lesson and supports both languages on desktop and mobile', async ({page}, info) => {
  await page.goto('/#/lesson/huffman');
  const slider=page.locator('.timeline input[type=range]');
  await slider.fill('2');
  for(const english of [false,true]) {
    if(info.project.name==='mobile') await page.getByRole('button',{name:/^(打开导航|Open navigation)$/}).click();
    if(english) await page.getByRole('button',{name:'Switch to English',exact:true}).click();
    const follow=page.getByRole('button',{name:english?'Follow ZiCode':'关注字与码',exact:true});
    await follow.click();
    const modal=page.getByRole('dialog');
    await expect(modal).toBeVisible();
    await expect(modal.locator('img')).toHaveJSProperty('complete',true);
    expect(await modal.locator('img').evaluate((el:HTMLImageElement)=>el.naturalWidth)).toBeGreaterThan(0);
    await expect(modal.locator('a[href="https://x.com/ax2_zicode"]')).toBeVisible();
    await expect(modal.locator('a[href="https://www.zicode.com/"]')).toBeVisible();
    if(english) expect(await modal.innerText()).not.toMatch(/\p{Script=Han}/u);
    await page.keyboard.press('Escape');
    await expect(modal).toHaveCount(0);
    await expect(slider).toHaveValue('2');
  }
});
