import { useState, useEffect, useCallback } from "react";
import IndicatorCard from "./components/IndicatorCard";
import processedData from "../data/processed/btc_usd/daily_indicators.json";
import "./App.css";

function App() {
  const [historicalData, setHistoricalData] = useState(processedData.daily);
  const [currentData, setCurrentData] = useState(null);

  // Function to fetch latest data point
  const fetchLatestData = useCallback(async () => {
    try {
      const response = await fetch("/api/latest");
      const newDataPoint = await response.json();

      // Only update if we have new data
      if (
        newDataPoint.Timestamp >
        historicalData[historicalData.length - 1].Timestamp
      ) {
        // Update historical data efficiently by adding new point
        setHistoricalData((prevData) => [...prevData, newDataPoint]);
        setCurrentData(newDataPoint);
      }
    } catch (error) {
      console.error("Error fetching latest data:", error);
    }
  }, [historicalData]);

  // Initial setup
  useEffect(() => {
    if (historicalData && historicalData.length > 0) {
      setCurrentData(historicalData[historicalData.length - 1]);
    }
  }, []);

  // Poll for updates every minute
  useEffect(() => {
    const intervalId = setInterval(fetchLatestData, 60000); // 60000ms = 1 minute

    return () => clearInterval(intervalId); // Cleanup on unmount
  }, [fetchLatestData]);

  if (!currentData) {
    return <div>Loading...</div>;
  }

  return (
    <div className="dashboard">
      <IndicatorCard
        title="Bitcoin Price"
        value={`$${currentData.Close.toLocaleString()}`}
        description="Current Bitcoin price in USD"
        historicalData={historicalData}
        dataKey="Close"
      />

      <IndicatorCard
        title="Pi Cycle Top"
        value={`BTC Price: $${currentData.Close.toLocaleString()} | 111MA: $${currentData.MA111.toLocaleString()} / 350MA*2: $${currentData.MA350_x2.toLocaleString()}`}
        description="111MA and 350MA*2 with BTC Price"
        historicalData={historicalData}
        multiLine={true}
        dataKeys={[
          { key: "Close", color: "#000000" },
          { key: "MA111", color: "#FF0000" },
          { key: "MA350_x2", color: "#0000FF" },
        ]}
      />

      <IndicatorCard
        title="200-Day Moving Average"
        value={`$${currentData.MA200.toLocaleString()}`}
        description="200-day moving average price"
        historicalData={historicalData}
        dataKey="MA200"
      />

      <IndicatorCard
        title="Rainbow Price"
        value={`$${currentData.Close.toLocaleString()}`}
        description="Position in Rainbow Chart"
        historicalData={historicalData.map((d) => ({
          ...d,
          RainbowTop: d.Rainbow_Band_10,
          RainbowBottom: d.Rainbow_Band_0,
        }))}
        multiLine={true}
        dataKeys={[
          { key: "Close", color: "#000" },
          { key: "RainbowTop", color: "#FF0000" },
          { key: "RainbowBottom", color: "#00FF00" },
        ]}
      />

      <IndicatorCard
        title="Volume"
        value={`$${currentData.Volume.toLocaleString()}`}
        description="Daily trading volume in USD"
        historicalData={historicalData}
        dataKey="Volume"
      />

      <IndicatorCard
        title="Moving Averages"
        value={`${currentData.MA111.toLocaleString()}`}
        description="Key moving averages"
        historicalData={historicalData}
        multiLine={true}
        dataKeys={[
          { key: "MA111", color: "#FF0000" },
          { key: "MA350", color: "#0000FF" },
          { key: "MA350_x2", color: "#00FF00" },
        ]}
      />
    </div>
  );
}

function getPiCycleStatus(distance) {
  if (distance > -1 && distance < 1) {
    return { className: "danger", text: "Cross Imminent" };
  } else if (distance > -3 && distance < 3) {
    return { className: "warning", text: "Watch Closely" };
  }
  return { className: "neutral", text: "No Signal" };
}

export default App;
