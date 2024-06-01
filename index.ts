import puppeteer, { Page } from "puppeteer";
import html2md from "html-to-md";
import { Document, Packer, Paragraph } from "docx";
import * as fs from "fs";

async function sleep(durationMs: number): Promise<void> {
  let remainingTime = durationMs;

  while (remainingTime > 0) {
    console.log(`Time remaining: ${remainingTime / 1000} seconds`); // Countdown
    await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second
    remainingTime -= 1000;
  }

  console.log("Sleep completed!");
}

async function waitForVideoEnd(page: Page) {
  const videoSelector = "video.vjs-tech"; // Or a more specific selector if needed

  await page.waitForSelector("video"); // Wait for the video element to appear

  while (true) {
    const video = await page.$(videoSelector);
    const duration = await page.evaluate((el) => el?.duration || 0, video);
    const currentTime = await page.evaluate(
      (el) => el?.currentTime || 0,
      video
    );

    if (Math.abs(currentTime - duration) <= 0.1) {
      // Allow for slight imprecision
      break;
    }

    await new Promise((resolve) => setTimeout(resolve, 500)); // Check every 500ms
  }

  console.log("Video finished playing!");
}

async function main() {
  try {
    const browser = await puppeteer.connect({
      browserWSEndpoint:
        "ws://127.0.0.1:9222/devtools/browser/7f3aeb93-7372-48a7-ac94-70fe0007a18c",
      defaultViewport: null,
    });
    const page = await browser.newPage();

    const courses = [
      "https://www.linkedin.com/learning/learning-design-thinking-lead-change-in-your-organization",
      "https://www.linkedin.com/learning/problem-solving-techniques",
      "https://www.linkedin.com/learning/critical-thinking-and-problem-solving",
    ];

    for (const course of courses) {
      console.log(course);

      await page.goto(course, {
        waitUntil: "load",
      });

      const collapsedElements = await page.$$(
        '.classroom-toc-section__toggle[aria-expanded="false"]'
      );

      for (const element of collapsedElements) {
        try {
          await element.click();
        } catch (error) {
          console.error(`Error clicking element: ${error}`);
        }
      }

      const links = await page.evaluate(() =>
        Array.from(
          document.querySelectorAll(".classroom-toc-item__link"),
          (e) => e.getAttribute("href")
        )
      );

      console.log(links);

      const transcripts = [];

      const linksLength = links.length;

      for (let i = 0; i < linksLength; i++) {
        const link = links[i];
        if (link?.includes("quiz")) {
          continue;
        }
        console.log(link);

        const baseUrl = "https://www.linkedin.com";
        await page.goto(`${baseUrl}${link}`, {
          waitUntil: "load",
        });

        // tunggu button transkrip muncul
        await sleep(2000);

        const button = await page.waitForSelector(
          '[data-live-test-classroom-layout-tab="TRANSCRIPT"]'
        );

        await button?.click();

        const text = html2md(
          (await page.evaluate(() => {
            const container = document.querySelector(".classroom-transcript");
            return container?.innerHTML;
          })) || "",
          {
            skipTags: ["a"],
          }
        );
        await sleep(10000);
        console.log(text);
        transcripts.push(text);
        await waitForVideoEnd(page);
      }

      const doc = new Document({
        sections: transcripts.map((text) => ({
          properties: {},
          children: [
            new Paragraph({
              text,
            }),
          ],
        })),
      });

      Packer.toBuffer(doc).then((buffer) => {
        fs.writeFileSync(
          `./document/${course.replace(
            "https://www.linkedin.com/learning/",
            ""
          )}.docx`,
          buffer
        );
      });

      console.log("Document Created");
    }
  } catch (error) {
    console.log(error);
  }
}

main()
  .then()
  .catch((e) => console.log(e));
