import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
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
  // Function to format Unix timestamp to readable date
  const formatXAxis = (unixTime) => {
    return new Date(unixTime * 1000).toLocaleDateString();
  };

  // Function to format tooltip timestamp
  const formatTooltip = (unixTime) => {
    return new Date(unixTime * 1000).toLocaleString();
  };

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
              <YAxis domain={["auto", "auto"]} />
              <Tooltip
                labelFormatter={formatTooltip}
                formatter={(value) => [value.toLocaleString(), title]}
              />
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
