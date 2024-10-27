import chalk from "chalk";

export function log(message: string, level: "info" | "success" | "error") {
  if (process.env.VERBOSE?.toLowerCase() !== "true") return;
  const colors = {
    info: chalk.blueBright,
    success: chalk.greenBright,
    error: chalk.redBright,
  };
  console.log(colors[level](message));
}

export const logProgress = (
  codeBatch: number[],
  totalItemsTouched: number,
  progress: number
) =>
  process.stdout.write(
    "\r" +
      [
        chalk.yellowBright(codeBatch.length, "bytes"),
        `${totalItemsTouched} items`,
        `${chalk.greenBright(progress)}%`,
      ].join(chalk.redBright(" | "))
  );
