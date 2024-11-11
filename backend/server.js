const express = require("express");
const mongoose = require("mongoose");
const cron = require("node-cron");
const axios = require("axios");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 3000;

// Connect to MongoDB
mongoose.connect(
  process.env.MONGODB_URI || "mongodb://localhost/crypto-indicators"
);

// Define schemas
const PriceDataSchema = new mongoose.Schema({
  timestamp: Date,
  price: Number,
  btcDominance: Number,
  volume: Number,
});

const IndicatorDataSchema = new mongoose.Schema({
  timestamp: Date,
  fearGreedIndex: Number,
  mvrvScore: Number,
  piCycleTop: Number,
  rainbowPrice: Number,
});

const PriceData = mongoose.model("PriceData", PriceDataSchema);
const IndicatorData = mongoose.model("IndicatorData", IndicatorDataSchema);

// Fetch current data
async function fetchCurrentData() {
  try {
    // Fetch price data from CoinGecko
    const priceResponse = await axios.get(
      "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_market_cap=true&include_24hr_vol=true"
    );

    // Fetch global market data
    const marketResponse = await axios.get(
      "https://api.coingecko.com/api/v3/global"
    );

    const priceData = new PriceData({
      timestamp: new Date(),
      price: priceResponse.data.bitcoin.usd,
      btcDominance: marketResponse.data.data.market_cap_percentage.btc,
      volume: priceResponse.data.bitcoin.usd_24h_vol,
    });

    await priceData.save();

    // Calculate and save indicators
    // Note: These are placeholder calculations - you'll need to implement the actual formulas
    const indicatorData = new IndicatorData({
      timestamp: new Date(),
      fearGreedIndex: Math.random() * 100, // Replace with actual Fear & Greed API
      mvrvScore: calculateMVRV(priceResponse.data.bitcoin.usd),
      piCycleTop: calculatePiCycle(),
      rainbowPrice: calculateRainbowPrice(priceResponse.data.bitcoin.usd),
    });

    await indicatorData.save();

    console.log("Data updated successfully");
  } catch (error) {
    console.error("Error updating data:", error);
  }
}

// Schedule data collection every 5 minutes
cron.schedule("*/5 * * * *", fetchCurrentData);

// API endpoints
app.get("/api/historical", async (req, res) => {
  try {
    const { timeframe } = req.query; // e.g., '24h', '7d', '30d', '1y'
    const timeframeMap = {
      "24h": 24 * 60 * 60 * 1000,
      "7d": 7 * 24 * 60 * 60 * 1000,
      "30d": 30 * 24 * 60 * 60 * 1000,
      "1y": 365 * 24 * 60 * 60 * 1000,
    };

    const startTime = new Date(Date.now() - timeframeMap[timeframe]);

    const [priceData, indicatorData] = await Promise.all([
      PriceData.find({ timestamp: { $gte: startTime } }).sort("timestamp"),
      IndicatorData.find({ timestamp: { $gte: startTime } }).sort("timestamp"),
    ]);

    res.json({ priceData, indicatorData });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  fetchCurrentData(); // Initial fetch
});
