import express from "express";
import axios from "axios";
import fs from "fs";
import csv from "csv-parser";
import { createObjectCsvWriter } from "csv-writer";
import cron from "node-cron";
import { cryptoApis } from "./config/apis.js";

const app = express();
const PORT = process.env.PORT || 3000;

const csvFilePath = "./data/btc_usd/btcusd_1-min_data.csv";

// Memory storage - no max limit
const priceHistory = [];

// Function to fetch OHLCV data from multiple APIs with fallback
const fetchBitcoinOhlcv = async () => {
  console.log("Starting fetchBitcoinOhlcv function...");

  const apis = cryptoApis.map((api) => api.url);
  console.log("APIs to try:", apis);

  for (const apiConfig of cryptoApis) {
    console.log(`\nAttempting to fetch from ${apiConfig.name}...`);
    try {
      console.log("Making API request...");
      const response = await axios.get(apiConfig.url);

      if (response.data) {
        console.log("Received response data:", JSON.stringify(response.data));
        try {
          const validatedData = apiConfig.validate(response.data);
          console.log("Successfully validated data:", validatedData);
          return validatedData;
        } catch (error) {
          console.log(
            `Validation failed for ${apiConfig.name}:`,
            error.message
          );
        }
      }
    } catch (error) {
      console.error(`Failed to fetch from ${apiConfig.name}:`, error.message);
    }
  }

  console.log("All APIs failed, returning null");
  return null;
};

// Function to fetch historical data from CoinGecko API
const fetchHistoricalData = async (startTimestamp, endTimestamp) => {
  // Calculate days needed based on timestamp difference
  // Convert seconds to days, rounding up to nearest day
  const daysDiff = Math.ceil(
    (endTimestamp - startTimestamp) / (24 * 60 * 60 * 1000)
  );
  console.log(`Start timestamp: ${startTimestamp}`);
  console.log(`End timestamp: ${endTimestamp}`);
  console.log(`Days difference calculated: ${daysDiff}`);

  const url = `https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=${daysDiff}`;
  console.log(`Requesting data from CoinGecko API: ${url}`);

  try {
    const response = await axios.get(url);
    console.log(`Raw API response:`, response.data);
    console.log(
      `Fetched ${response.data.prices.length} price entries and ${response.data.total_volumes.length} volume entries from CoinGecko API`
    );

    // Filter prices within our timestamp range and format data
    const filteredData = response.data.prices
      .filter(([timestamp, _]) => {
        const unixTime = Math.floor(timestamp);
        const isInRange =
          unixTime >= startTimestamp && unixTime <= endTimestamp;
        return isInRange;
      })
      .map(([timestamp, price]) => {
        return {
          Timestamp: Math.floor(timestamp / 1000),
          Price: price,
        };
      });

    console.log(`Returning ${filteredData.length} processed entries`);
    return filteredData;
  } catch (error) {
    console.error(`Error fetching historical data: ${error.message}`);
    return [];
  }
};

// Combine memory storage and CSV writing
const addNewData = async (data) => {
  // Add to memory
  const records = Array.isArray(data) ? data : [data];
  priceHistory.push(...records);

  // Append to CSV
  const csvWriter = createObjectCsvWriter({
    path: csvFilePath,
    header: [
      { id: "Timestamp", title: "Timestamp" },
      { id: "Price", title: "Price" },
    ],
    append: true,
  });

  await csvWriter.writeRecords(records);
  console.log(
    `Memory storage: ${priceHistory.length} entries, CSV updated with ${records.length} new entries`
  );
};

// Update the price update function
const updateBitcoinPrice = async () => {
  const priceData = await fetchBitcoinOhlcv();
  if (priceData) {
    const timestamp = Math.floor(Date.now() / 1000);
    console.log(`Fetched Bitcoin price data at ${timestamp}`);
    const data = {
      Timestamp: timestamp,
      Price: priceData.price,
    };
    console.log("Adding new data:", data);
    await addNewData(data);
  } else {
    console.log("Failed to fetch Bitcoin price data");
  }
};

// Update fillMissingData to use both memory and CSV
const fillMissingData = async () => {
  if (priceHistory.length === 0) {
    console.log("No existing data found in memory");
    return;
  }

  const lastTimestamp = priceHistory[priceHistory.length - 1].Timestamp;
  const currentUnixTime = Math.floor(Date.now() / 1000);

  const historicalData = await fetchHistoricalData(
    lastTimestamp * 1000,
    currentUnixTime * 1000
  );
  if (historicalData.length > 0) {
    await addNewData(historicalData);
    console.log(`Filled missing data with ${historicalData.length} entries`);
  } else {
    console.log("No historical data to fill");
  }
};

// Start the server
app.listen(PORT, async () => {
  console.log(`Server is running on port ${PORT}`);
  console.log("Filling missing data...");
  await fillMissingData();
  console.log("Initial data fill complete");
  // Schedule cron job only after initial data fill is complete
  cron.schedule("* * * * *", updateBitcoinPrice);
  console.log("Scheduled regular price updates");
});

// Add this near your other Express routes
app.get("/api/latest", (req, res) => {
  fs.createReadStream(csvFilePath)
    .pipe(csv())
    .on("data", () => {}) // Skip all but last row
    .on("end", (data) => {
      const lastRow = data[data.length - 1];
      res.json(lastRow);
    });
});
