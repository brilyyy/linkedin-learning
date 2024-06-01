import * as fs from "fs";

export async function sleep(durationS: number): Promise<void> {
  let remainingTime = durationS * 1000;

  while (remainingTime > 0) {
    console.log(`💤: ${remainingTime / 1000}s`);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    remainingTime -= 1000;
  }

  console.log("sleep completed 🥱");
}

export async function appendToFile(filePath: string, data: string) {
  try {
    await fs.promises.access(filePath, fs.constants.F_OK);
  } catch (err: any) {
    if (err.code === "ENOENT") {
      await fs.promises.writeFile(filePath, data, "utf8");
      console.log(`File created and data written to: ${filePath}`);
      return;
    } else {
      console.error(`Error appending or writing to file: ${err}`);
      throw err;
    }
  }

  await fs.promises.appendFile(filePath, `\n\n${data}`, "utf8");
  console.log(`Data appended to: ${filePath}`);
}

export function getTitle(url: string) {
  const regex = /\/learning\/([\w-]+)\?/;
  const match = url.match(regex);

  if (match) {
    const extractedString = match[1];
    return extractedString;
  }

  return url.replace("https://www.linkedin.com/learning/", "");
}
