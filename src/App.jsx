import { useState, useEffect } from "react";
import IndicatorCard from "./components/IndicatorCard";
import processedData from "../data/processed/btc_usd/daily_indicators.json";
import "./App.css";

function App() {
  const [currentData, setCurrentData] = useState(null);
  const historicalData = processedData.daily;

  useEffect(() => {
    // Get the most recent data point
    if (historicalData && historicalData.length > 0) {
      setCurrentData(historicalData[historicalData.length - 1]);
    }
  }, []);

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
