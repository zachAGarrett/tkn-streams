import WebSocket from "ws";
import dotenv from "dotenv";
import chalk from "chalk";
import { randomUUID, UUID } from "crypto";
dotenv.config();

// TradeCondition represents trade conditions codes.
interface TradeCondition {
  code: string; // Trade condition code (more details may be available in the API documentation).
}

// Trade represents a single trade in the trades WebSocket API.
interface Trade {
  p: number; // Last price of the trade.
  s: string; // Symbol of the asset (e.g., "BINANCE:BTCUSDT").
  t: number; // UNIX milliseconds timestamp of the trade.
  v: number; // Volume of the trade.
  c?: TradeCondition[]; // Optional list of trade conditions.
}

// TradesResponse represents the response structure for trade updates.
interface TradesResponse {
  type: "trade"; // Type of the message.
  data: Trade[]; // List of trades or price updates.
}

const FINNHUB_TOKEN = process.env.FINHUBAPIKEY; // Replace with your Finnhub API key
const symbol = "AAPL"; // Specify the stock symbol you want to listen to

const startFinnhubTickerListener = (symbol: string) => {
  // Create a WebSocket connection to the Finnhub API
  const ws = new WebSocket(`wss://ws.finnhub.io?token=${FINNHUB_TOKEN}`);

  let lastPrice: number | null = null; // Variable to track the last price
  let lastPriceDelta: number | null = null;

  ws.on("open", () => {
    console.log(`Connected to Finnhub WebSocket`);

    // Subscribe to the ticker for the specified symbol
    const subscribeMessage = {
      type: "subscribe",
      symbol: symbol,
    };
    ws.send(JSON.stringify(subscribeMessage));
  });

  ws.on("message", (data: WebSocket.RawData) => {
    const id: UUID = randomUUID();
    const message: TradesResponse = JSON.parse(data.toString());

    // Check if the message is a ticker update
    if (message.type === "trade") {
      let totalVolume = 0; // Variable to accumulate total volume
      let totalWeightedPrice = 0; // Variable to accumulate total weighted price

      message.data.forEach((trade) => {
        const { p, v } = trade;

        // Accumulate weighted price and total volume
        totalWeightedPrice += p * v; // Weighted price contribution
        totalVolume += v; // Total volume accumulation
      });

      // Calculate the weighted average price
      const weightedAveragePrice = totalWeightedPrice / totalVolume;

      // Calculate price delta
      if (lastPrice !== null) {
        lastPriceDelta = weightedAveragePrice - lastPrice; // Calculate the difference from the last price
      }

      // Update last price
      lastPrice = weightedAveragePrice;

      // Log the trade information
      console.log(
        chalk.yellowBright(`[${id}]`) +
          [
            symbol,
            weightedAveragePrice.toFixed(3),
            chalk.greenBright(lastPriceDelta?.toFixed(3)),
          ].join(chalk.magentaBright("|"))
      );
    }
  });

  ws.on("close", () => {
    console.log("Disconnected from WebSocket");
  });

  ws.on("error", (error) => {
    console.error("WebSocket Error:", error);
  });
};

// Example usage
startFinnhubTickerListener(symbol);
