#!/usr/bin/env ts-node

import puppeteer, { Page } from "puppeteer-core";
import html2md from "html-to-md";
import * as fs from "fs";
import { Command } from "commander";
import { appendToFile, getTitle, sleep } from "./utils";
import packageJSON from "../package.json";

type TData = {
  hostURL: string;
  courses: string[];
};

const program = new Command();

program
  .version(packageJSON.version)
  .description("linkedin learning kok manual");

program.option("-t, --transcript-only", "get transcript only");

program.command("run <filename>").action(async (filename) => {
  const isTranscriptOnly = !!program.opts().transcriptOnly;
  console.log(isTranscriptOnly);

  const rawData = fs.readFileSync(filename, "utf8");
  const jsonData = JSON.parse(rawData) as TData;
  const browser = await puppeteer.connect({
    browserWSEndpoint: jsonData.hostURL,
    defaultViewport: null,
  });

  try {
    if (jsonData.courses.length < 1) throw new Error("Courses link empty");
    const page = await browser.newPage();
    const courses = jsonData.courses;
    for (const course of courses) {
      console.log(course);
      await page.goto(course, {
        waitUntil: "load",
      });
      const collapsedElements = await page.$$(
        '.classroom-toc-section__toggle[aria-expanded="false"]'
      );
      for (const element of collapsedElements) {
        await element.click();
      }
      const links = await page.evaluate(() => {
        const tocItems = document.querySelectorAll(".classroom-toc-item");
        const itemLinks = Array.from(tocItems).map((tocItem) => {
          // const isComplete = !!tocItem.querySelector(
          //   "svg.classroom-toc-item__completed-icon"
          // );
          // if (isComplete) return null;
          const href =
            tocItem
              .querySelector(".classroom-toc-item__link")
              ?.getAttribute("href") || "";
          return {
            href,
            id: tocItem.getAttribute("data-toc-content-id") || "",
          };
        });

        return itemLinks;
      });

      const linksLength = links.length;
      for (let i = 0; i < linksLength; i++) {
        const link = links[i]?.href;
        if (link?.includes("quiz")) {
          continue;
        }
        console.log(`\n🚀 ${link}\n`);
        const baseUrl = "https://www.linkedin.com";
        await page.goto(`${baseUrl}${link}`, {
          waitUntil: "load",
        });
        await sleep(2);
        const button = await page.waitForSelector(
          '[data-live-test-classroom-layout-tab="TRANSCRIPT"]'
        );
        await button?.click();
        page
          .waitForSelector(".classroom-transcript", { visible: true })
          .then(() => console.log("✅ got the classroom transcript container"));

        await sleep(isTranscriptOnly ? 15 : 5);

        if (!isTranscriptOnly) {
          console.log("⏰ Waiting video until it's end");
          await page.waitForSelector(
            ".classroom-toc-item--selected a .classroom-toc-item__completed-icon",
            {
              visible: true,
              timeout: 0,
            }
          );
        }

        const innerHTML = await page.evaluate(() => {
          const container = document.querySelector(".classroom-transcript");
          return container?.innerHTML;
        });
        const text = html2md(innerHTML || "", {
          skipTags: ["a"],
        });
        console.log(text);
        appendToFile(`./${getTitle(course)}.txt`, text);
      }
    }
  } catch (error) {
    console.log(error);
  } finally {
    await browser.close();
  }
});
program.parse(process.argv);
