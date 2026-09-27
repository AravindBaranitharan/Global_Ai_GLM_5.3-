import { expect, test } from '@playwright/test'

test('language picker lists all nine languages', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('domain-generative_ai').click()
  const select = page.getByTestId('language-select')
  await expect(select.locator('option')).toHaveCount(10)
  await select.selectOption('ta')
  await page.getByTestId('question-input').click()
  if (process.env.SHOTS_DIR) await page.screenshot({ path: `${process.env.SHOTS_DIR}/10-language-picker.png` })
  await expect(page.getByTestId('question-input')).toHaveAttribute('placeholder', /answer in தமிழ்/)
  await select.selectOption('auto')
})
