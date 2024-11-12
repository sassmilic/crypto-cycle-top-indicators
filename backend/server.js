import express from "express";
import axios from "axios";
import fs from "fs";
import csv from "csv-parser";
import { createObjectCsvWriter } from "csv-writer";
import cron from "node-cron";

const app = express();
const PORT = process.env.PORT || 3000;

const csvFilePath = "./data/btc_usd/btcusd_1-min_data.csv";

// Add a variable to track total entries
let totalEntriesAdded = 0;

// Function to fetch Bitcoin price from multiple APIs with fallback
const fetchBitcoinPrice = async () => {
  const apis = [
    "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd",
    "https://api.coincap.io/v2/assets/bitcoin",
    "https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT",
    "https://api.coinbase.com/v2/prices/spot?currency=USD",
  ];

  for (let api of apis) {
    try {
      const response = await axios.get(api);
      if (response.data) {
        return extractPrice(api, response.data);
      }
    } catch (error) {
      console.error(`Failed to fetch from ${api}:`, error.message);
    }
  }
  return null;
};

// Function to fetch OHLCV data from multiple APIs with fallback
const fetchBitcoinOhlcv = async () => {
  console.log("Starting fetchBitcoinOhlcv function...");

  const apis = [
    "https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1m&limit=1",
    "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd",
    "https://api.coincap.io/v2/assets/bitcoin",
    "https://api.coinbase.com/v2/prices/spot?currency=USD",
  ];

  console.log("APIs to try:", apis);

  for (let api of apis) {
    console.log(`\nAttempting to fetch from ${api}...`);
    try {
      console.log("Making API request...");
      const response = await axios.get(api);

      if (response.data) {
        console.log("Received response data:", JSON.stringify(response.data));
        console.log("Extracting OHLCV data...");
        const ohlcvData = extractOhlcvData(api, response.data);

        if (ohlcvData) {
          console.log("Successfully extracted OHLCV data:", ohlcvData);
          return ohlcvData;
        } else {
          console.log("Failed to extract OHLCV data from response");
        }
      } else {
        console.log("No data in response");
      }
    } catch (error) {
      console.error(`Failed to fetch from ${api}:`, error.message);
      console.error("Full error:", error);
    }
  }

  console.log("All APIs failed, returning null");
  return null;
};

// Extract OHLCV data based on the API response structure
const extractOhlcvData = (api, data) => {
  const timestamp = Math.floor(Date.now() / 1000);

  switch (api) {
    case "https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1m&limit=1":
      return {
        Timestamp: Math.floor(data[0][0] / 1000),
        Open: parseFloat(data[0][1]),
        High: parseFloat(data[0][2]),
        Low: parseFloat(data[0][3]),
        Close: parseFloat(data[0][4]),
        Volume: parseFloat(data[0][5]),
      };

    case "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd":
      return {
        Timestamp: timestamp,
        Open: null,
        High: null,
        Low: null,
        Close: data.bitcoin.usd,
        Volume: null,
      };

    case "https://api.coincap.io/v2/assets/bitcoin":
      return {
        Timestamp: timestamp,
        Open: null,
        High: null,
        Low: null,
        Close: parseFloat(data.data.priceUsd),
        Volume: parseFloat(data.data.volumeUsd24Hr),
      };

    case "https://api.coinbase.com/v2/prices/spot?currency=USD":
      return {
        Timestamp: timestamp,
        Open: null,
        High: null,
        Low: null,
        Close: parseFloat(data.data.amount),
        Volume: null,
      };

    default:
      return null;
  }
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
        console.log(
          `Timestamp ${unixTime}: ${isInRange ? "in range" : "filtered out"}`
        );
        return isInRange;
      })
      .map(([timestamp, price], index) => {
        // Find the corresponding volume for this timestamp
        const volumeEntry = response.data.total_volumes.find(
          ([volTimestamp, _]) => Math.abs(volTimestamp - timestamp) < 3600000 // Within 1 hour
        );
        // Divide hourly volume by 60 to get approximate per-minute volume
        // Convert USD volume to BTC volume by dividing by the price
        const volumeUSD = volumeEntry ? volumeEntry[1] / 60 : 0;
        const volumeBTC = volumeUSD / price; // Convert to BTC

        console.log(`Processing entry ${index}:`);
        console.log(`  Timestamp: ${Math.floor(timestamp / 1000)}`);
        console.log(`  Price: ${price}`);
        console.log(`  Volume (BTC): ${volumeBTC}`);

        return {
          Timestamp: Math.floor(timestamp / 1000),
          Open: price,
          High: price,
          Low: price,
          Close: price,
          Volume: volumeBTC, // Now in BTC
        };
      });

    console.log(`Returning ${filteredData.length} processed entries`);
    console.log("First entry:", filteredData[0]);
    console.log("Last entry:", filteredData[filteredData.length - 1]);

    return filteredData;
  } catch (error) {
    console.error(`Error fetching historical data: ${error.message}`);
    console.error("Full error object:", error);
    return [];
  }
};

// Read the CSV file to get the last entry
const getLastTimestamp = () => {
  return new Promise((resolve) => {
    let lastTimestamp = null;
    fs.createReadStream(csvFilePath)
      .pipe(csv())
      .on("data", (row) => {
        lastTimestamp = row.Timestamp;
      })
      .on("end", () => {
        resolve(lastTimestamp);
      });
  });
};

// Modify the appendToCSV function to track entries
const appendToCSV = async (data) => {
  const csvWriter = createObjectCsvWriter({
    path: csvFilePath,
    header: [
      { id: "Timestamp", title: "Timestamp" },
      { id: "Open", title: "Open" },
      { id: "High", title: "High" },
      { id: "Low", title: "Low" },
      { id: "Close", title: "Close" },
      { id: "Volume", title: "Volume" },
    ],
    append: true,
  });
  const records = Array.isArray(data) ? data : [data];
  await csvWriter.writeRecords(records);
  totalEntriesAdded += records.length;
  console.log(
    `CSV updated: ${records.length} record(s) added to ${csvFilePath}`
  );
};

// Function to update the CSV file with the latest Bitcoin price
const updateBitcoinPrice = async () => {
  const ohlcv = await fetchBitcoinOhlcv();
  if (ohlcv) {
    const timestamp = Math.floor(Date.now() / 1000);
    console.log(`Fetched Bitcoin OHLCV data at ${timestamp}`);
    const data = {
      Timestamp: timestamp,
      Open: ohlcv.Open,
      High: ohlcv.High,
      Low: ohlcv.Low,
      Close: ohlcv.Close,
      Volume: ohlcv.Volume,
    };
    console.log("Writing data to CSV:", data);
    await appendToCSV(data);
  } else {
    console.log("Failed to fetch Bitcoin OHLCV data");
  }
};

// Fill missing data from the last timestamp to now using historical API
const fillMissingData = async () => {
  const lastTimestamp = await getLastTimestamp();
  if (!lastTimestamp) {
    console.log("No existing data found in CSV file");
    return;
  }

  const currentUnixTime = Math.floor(Date.now() / 1000);
  const diffDays = Math.floor(
    (currentUnixTime - lastTimestamp) / (24 * 60 * 60)
  );
  console.log(
    `Last timestamp in CSV: ${lastTimestamp} (Current: ${currentUnixTime}, ~${Math.floor(
      (currentUnixTime - lastTimestamp) / (60 * 60)
    )} hours ago)`
  );
  const currentTime = Math.floor(Date.now() / 1000);
  const oneMonthAgo = currentTime - 30 * 24 * 60 * 60;

  if (lastTimestamp < oneMonthAgo) {
    console.error("Gap is too large; Binance API only supports one month.");
    return;
  }

  console.log(
    `Fetching historical data from ${lastTimestamp} to ${currentTime}`
  );
  const historicalData = await fetchHistoricalData(
    lastTimestamp * 1000,
    currentTime * 1000
  );
  if (historicalData.length > 0) {
    await appendToCSV(historicalData);
    console.log(`Filled missing data with ${historicalData.length} entries.`);
  } else {
    console.log("No historical data to fill");
  }
};

// Start the server
app.listen(PORT, async () => {
  console.log(`Server is running on port ${PORT}`);
  console.log("Filling missing data...");
  totalEntriesAdded = 0; // Reset counter
  await fillMissingData();
  console.log(
    `Initial data fill complete. Added ${totalEntriesAdded} new entries to the CSV.`
  );

  // Schedule cron job only after initial data fill is complete
  cron.schedule("* * * * *", updateBitcoinPrice);
  console.log("Scheduled regular price updates");
});
