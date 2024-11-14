import axios from "axios";

const testCryptoPriceApis = async () => {
  const apis = [
    {
      url: "https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1m&limit=1",
      name: "Binance",
      validate: (data) => {
        if (!Array.isArray(data) || !data[0] || data[0].length !== 12) {
          throw new Error("Invalid Binance data structure");
        }
        const [timestamp, open, high, low, close, volume] = data[0];
        return {
          timestamp,
          open: parseFloat(open),
          high: parseFloat(high),
          low: parseFloat(low),
          close: parseFloat(close),
          volume: parseFloat(volume),
        };
      },
    },
    {
      url: "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd",
      name: "CoinGecko",
      validate: (data) => {
        if (!data.bitcoin?.usd) {
          throw new Error("Invalid CoinGecko data structure");
        }
        return {
          price: data.bitcoin.usd,
        };
      },
    },
    {
      url: "https://api.coincap.io/v2/assets/bitcoin",
      name: "CoinCap",
      validate: (data) => {
        if (!data.data?.priceUsd || !data.data?.volumeUsd24Hr) {
          throw new Error("Invalid CoinCap data structure");
        }
        return {
          price: parseFloat(data.data.priceUsd),
          volume: parseFloat(data.data.volumeUsd24Hr),
        };
      },
    },
    {
      url: "https://api.coinbase.com/v2/prices/spot?currency=USD",
      name: "Coinbase",
      validate: (data) => {
        if (!data.data?.amount) {
          throw new Error("Invalid Coinbase data structure");
        }
        return {
          price: parseFloat(data.data.amount),
        };
      },
    },
  ];

  console.log("Starting API tests...\n");

  for (const api of apis) {
    try {
      console.log(`Testing ${api.name} API...`);
      console.log(`URL: ${api.url}`);

      const startTime = Date.now();
      const response = await axios.get(api.url);
      const endTime = Date.now();

      const validatedData = api.validate(response.data);

      console.log("✅ Success!");
      console.log("Response time:", `${endTime - startTime}ms`);
      console.log("Validated data:", validatedData);
      console.log("Rate limit info:", {
        remaining: response.headers["x-ratelimit-remaining"],
        limit: response.headers["x-ratelimit-limit"],
        reset: response.headers["x-ratelimit-reset"],
      });
    } catch (error) {
      console.log(`❌ Error testing ${api.name}:`);
      if (error.response) {
        console.log("Status:", error.response.status);
        console.log("Headers:", error.response.headers);
        console.log("Data:", error.response.data);
      } else {
        console.log("Error:", error.message);
      }
    }
    console.log("\n-------------------\n");
  }
};

// Run the tests
testCryptoPriceApis().then(() => {
  console.log("API tests completed");
});
