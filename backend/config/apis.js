export const cryptoApis = [
  {
    url: "https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1m&limit=1",
    name: "Binance",
    validate: (data) => {
      if (!Array.isArray(data) || !data[0] || data[0].length !== 12) {
        throw new Error("Invalid Binance data structure");
      }
      const [timestamp, _, __, ___, close /*, volume*/] = data[0];
      return {
        timestamp,
        price: parseFloat(close),
        // volume: parseFloat(volume), // TODO: Implement volume tracking
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
        timestamp: Date.now(),
        price: data.bitcoin.usd,
      };
    },
  },
  {
    url: "https://api.coincap.io/v2/assets/bitcoin",
    name: "CoinCap",
    validate: (data) => {
      if (!data.data?.priceUsd /*|| !data.data?.volumeUsd24Hr*/) {
        throw new Error("Invalid CoinCap data structure");
      }
      return {
        timestamp: Date.now(),
        price: parseFloat(data.data.priceUsd),
        // volume: parseFloat(data.data.volumeUsd24Hr), // TODO: Implement volume tracking
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
        timestamp: Date.now(),
        price: parseFloat(data.data.amount),
      };
    },
  },
];
