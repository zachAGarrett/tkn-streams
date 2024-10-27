import fs from "fs";
import net from "net";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { log, logProgress } from "./util.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const targetFile = process.env.TARGETFILE;
const targetFilePath = path.join(__dirname, `../files/${targetFile}`);
const port = Number(process.env.PORT || 3000);
const sendInterval = Number(process.env.SENDINTERVAL || 10); // Interval in milliseconds between sending batches
const batchSize = Number(process.env.BATCHSIZE || 10); // Number of characters to send at a time
const maxBufferSize = Number(process.env.MAXBUFFERSIZE || 1000); // Maximum size of the buffer before throttling
const resumeRatio = Number(process.env.RESUMERATIO || 2);
const host = process.env.HOST || "localhost";
const socket = net.createConnection({
  host,
  port,
});

const buffer: string[] = []; // Buffer to accumulate characters
let totalItemsTouched = 0;
let headerPrinted = false; // Flag to ensure header is printed once

// Get the file size in kilobytes
const stats = fs.statSync(targetFilePath);
const fileSize = stats.size; // File size in kilobytes

log(`Total file size: ${fileSize.toFixed(2)} KB`, "success");

// Function to send characters from the buffer at a fixed interval
const sendCharactersAtInterval = () => {
  const intervalId = setInterval(() => {
    if (buffer.length > 0) {
      // Process a batch of characters at a time
      const batch = buffer.splice(0, batchSize); // Get a batch of characters

      const codeBatch = batch
        .filter((item) => item !== "N")
        .map((item) => item.charCodeAt(0));

      if (codeBatch.length) {
        // Write the character code to the connection
        socket.write(Buffer.from(codeBatch), (err) => {
          if (err) {
            log(err.message, "error");
          }
        });
      }

      totalItemsTouched += batch.length;

      // Log progress to the console
      logProgress(
        codeBatch,
        totalItemsTouched,
        Math.round((totalItemsTouched / fileSize) * 10000) / 100
      );
    } else {
      // If the buffer is empty and the file has finished reading, stop the interval
      clearInterval(intervalId);

      log("\nFinished sending all items.", "success");
      socket.end(); // Close the connection when done
    }
  }, sendInterval);
};

// Start reading the file with throttling
const readStream = fs.createReadStream(targetFilePath, {
  encoding: "utf-8",
  highWaterMark: maxBufferSize, // Limit the size of the internal buffer
});

readStream.on("data", (chunk) => {
  // Split the chunk into characters and push them into the buffer
  const lines = (chunk as string).split("\n");
  // Handle the header line if it's the first chunk
  if (!headerPrinted && lines[0][0] === ">") {
    const header = lines.shift(); // Remove the header from the buffer

    log(header!, "info");
    headerPrinted = true;
  }

  for (const line of lines) {
    for (const char of line) {
      buffer.push(char as string);
    }
  }

  // Throttle reading if the buffer exceeds maxBufferSize
  if (buffer.length > maxBufferSize) {
    readStream.pause(); // Pause the read stream
    log(`\nBuffer is full (${buffer.length} items). Pausing stream...`, "info");
  }
});

// Resume the stream once characters are sent
const resumeStream = () => {
  if (buffer.length <= maxBufferSize / resumeRatio) {
    readStream.resume(); // Resume the read stream if buffer is below half the max size
    log(`\nResuming stream...`, "success");
  }
};

// Monitor sending characters and resume the stream
const interval = setInterval(() => {
  if (buffer.length < maxBufferSize) {
    resumeStream();
  }
}, sendInterval);

// Start sending characters at the specified interval
sendCharactersAtInterval();

readStream.on("end", () => {
  clearInterval(interval);
  log("\nFinished reading file.", "success");
});

readStream.on("error", (err) => {
  log(err.message, "error");
});

socket.on("data", (chunk) => {
  log(chunk.toString(), "info");
});
