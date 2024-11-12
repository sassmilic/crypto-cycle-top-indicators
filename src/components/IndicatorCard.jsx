import React, { useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
} from "recharts";

const IndicatorCard = ({
  title,
  value,
  description,
  status,
  historicalData,
  dataKey,
  multiLine = false,
  dataKeys = [],
}) => {
  const [isLogScale, setIsLogScale] = useState(true); // State to manage log scale toggle

  // Function to format Unix timestamp to readable date
  const formatXAxis = (unixTime) => {
    return new Date(unixTime * 1000).toLocaleDateString();
  };

  // Function to format tooltip timestamp
  const formatTooltip = (unixTime) => {
    return new Date(unixTime * 1000).toLocaleString();
  };

  // BTC tops in Unix time with labels
  const btcTops = [
    { timestamp: 1385683200, label: "2013 Cycle Top" },
    { timestamp: 1513536000, label: "2017 Cycle Top" },
    { timestamp: 1636502400, label: "2021 Cycle Top" },
  ];

  // Find closest timestamps in historicalData for each btcTop
  const closestTimestamps = btcTops.map((top) => ({
    timestamp: historicalData.reduce((prev, curr) => {
      return Math.abs(curr.Timestamp - top.timestamp) <
        Math.abs(prev.Timestamp - top.timestamp)
        ? curr
        : prev;
    }).Timestamp,
    label: top.label,
  }));

  // Generate ticks for powers of 10 based on data range
  const generateLogTicks = () => {
    if (!historicalData || historicalData.length === 0) return [];

    // Find min and max values
    let minValue = Infinity;
    let maxValue = -Infinity;

    if (multiLine) {
      dataKeys.forEach(({ key }) => {
        historicalData.forEach((data) => {
          if (data[key] > 0) {
            // Ensure we only consider positive values for log scale
            minValue = Math.min(minValue, data[key]);
            maxValue = Math.max(maxValue, data[key]);
          }
        });
      });
    } else {
      historicalData.forEach((data) => {
        if (data[dataKey] > 0) {
          minValue = Math.min(minValue, data[dataKey]);
          maxValue = Math.max(maxValue, data[dataKey]);
        }
      });
    }

    // Generate power of 10 ticks
    const minPower = Math.floor(Math.log10(minValue));
    const maxPower = Math.ceil(Math.log10(maxValue));

    return Array.from({ length: maxPower - minPower + 1 }, (_, i) =>
      Math.pow(10, minPower + i)
    );
  };

  // Find crossing points between 111MA and 350MA*2
  const findCrossingPoints = () => {
    const crossings = [];

    // Only calculate crossings for Pi Cycle Top indicator
    if (title === "Pi Cycle Top") {
      for (let i = 1; i < historicalData.length; i++) {
        const prev = historicalData[i - 1];
        const curr = historicalData[i];

        // Check if MA111 crosses MA350_x2
        if (
          (prev.MA111 <= prev.MA350_x2 && curr.MA111 > curr.MA350_x2) ||
          (prev.MA111 >= prev.MA350_x2 && curr.MA111 < curr.MA350_x2)
        ) {
          // Find the next crossing point or use the last data point
          let endIndex = i + 1;
          while (endIndex < historicalData.length) {
            const nextPoint = historicalData[endIndex];
            if (
              (curr.MA111 > curr.MA350_x2 &&
                nextPoint.MA111 <= nextPoint.MA350_x2) ||
              (curr.MA111 < curr.MA350_x2 &&
                nextPoint.MA111 >= nextPoint.MA350_x2)
            ) {
              break;
            }
            endIndex++;
          }

          crossings.push({
            startTimestamp: curr.Timestamp,
            endTimestamp:
              endIndex < historicalData.length
                ? historicalData[endIndex].Timestamp
                : historicalData[historicalData.length - 1].Timestamp,
            label: `Cross: $${curr.Close.toLocaleString()}`,
            type: curr.MA111 > curr.MA350_x2 ? "up" : "down",
          });

          // Move i to the end of this crossing period
          i = endIndex;
        }
      }
    }
    return crossings;
  };

  const crossingPoints = findCrossingPoints();

  return (
    <div className="indicator-card">
      <div className="indicator-header">
        <div>
          <div className="indicator-title">{title}</div>
          <div className="indicator-value">{value}</div>
          <div className="indicator-description">{description}</div>
          {status && (
            <div className={`status ${status.className}`}>{status.text}</div>
          )}
        </div>
        <button
          className="toggle-scale-button"
          onClick={() => setIsLogScale(!isLogScale)}
        >
          {isLogScale ? "Switch to Regular" : "Switch to Log"}
        </button>
      </div>
      {historicalData && (
        <div className="chart-container">
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={historicalData}>
              <XAxis
                dataKey="Timestamp"
                tickFormatter={formatXAxis}
                minTickGap={50}
              />
              <YAxis
                domain={["auto", "auto"]}
                scale={isLogScale ? "log" : "linear"} // Toggle between log and linear scale
                ticks={isLogScale ? generateLogTicks() : undefined}
                tickFormatter={(value) => value.toLocaleString()}
              />
              <Tooltip
                labelFormatter={formatTooltip}
                formatter={(value) => [value.toLocaleString(), title]}
              />
              {closestTimestamps.map(({ timestamp, label }) => (
                <ReferenceLine
                  key={timestamp}
                  x={timestamp}
                  stroke="red"
                  label={{
                    value: label,
                    position: "insideBottom",
                    fill: "red",
                    offset: 10,
                  }}
                />
              ))}
              {crossingPoints.map(
                ({ startTimestamp, endTimestamp, type }, index) => (
                  <ReferenceArea
                    key={index}
                    x1={startTimestamp}
                    x2={endTimestamp}
                    fill={
                      type === "up"
                        ? "rgba(0, 255, 0, 0.2)"
                        : "rgba(255, 165, 0, 0.2)"
                    }
                  />
                )
              )}
              {multiLine ? (
                dataKeys.map(({ key, color }) => (
                  <Line
                    key={key}
                    type="monotone"
                    dataKey={key}
                    stroke={color}
                    dot={false}
                    strokeWidth={2}
                  />
                ))
              ) : (
                <Line
                  type="monotone"
                  dataKey={dataKey}
                  stroke="#8884d8"
                  dot={false}
                  strokeWidth={2}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

export default IndicatorCard;
