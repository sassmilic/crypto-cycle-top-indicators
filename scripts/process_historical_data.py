import pandas as pd
import numpy as np
from pathlib import Path
import json

# Read the data
def load_and_process_data():
    # Read CSV file
    df = pd.read_csv("data/btc_usd/btcusd_1-min_data.csv")

    # Convert timestamp to datetime for processing
    df["Timestamp"] = pd.to_datetime(df["Timestamp"], unit="s")

    # Sort by timestamp
    df = df.sort_values("Timestamp")
    
    # Calculate daily metrics
    daily_df = df.resample('D', on='Timestamp').agg({
        'Open': 'first',
        'High': 'max',
        'Low': 'min',
        'Close': 'last',
        'Volume': 'sum'
    }).dropna()

    # Calculate indicators
    daily_df['MA200'] = daily_df['Close'].rolling(window=200).mean()
    daily_df['MA111'] = daily_df['Close'].rolling(window=111).mean()
    daily_df['MA350'] = daily_df['Close'].rolling(window=350).mean()
    daily_df['MA350_x2'] = daily_df['MA350'] * 2
    daily_df['Pi_Cycle_Distance'] = (daily_df['MA111'] / daily_df['MA350_x2'] - 1) * 100
    
    # Rainbow Price Bands calculation
    days = (daily_df.index - daily_df.index[0]).days
    log_price = np.log(daily_df['Close'])
    
    coeffs = np.polyfit(days, log_price, 1)
    regression = np.exp(coeffs[1] + coeffs[0] * days)
    
    bands = [0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.2, 1.3]
    for i, band in enumerate(bands):
        daily_df[f'Rainbow_Band_{i}'] = regression * band

    # Convert to dictionary and handle NaN values
    processed_data = {
        'daily': daily_df.reset_index().replace({np.nan: None}).to_dict(orient='records'),
        'metadata': {
            'start_date': int(daily_df.index.min().timestamp()),
            'end_date': int(daily_df.index.max().timestamp()),
            'total_days': len(daily_df)
        }
    }

    # Convert timestamps to Unix time (seconds since epoch)
    for record in processed_data['daily']:
        record['Timestamp'] = int(record['Timestamp'].timestamp())

    # Save to JSON file
    output_path = Path('data/processed/btc_usd/daily_indicators.json')
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    with open(output_path, 'w') as f:
        json.dump(processed_data, f, indent=2)

    print(f"Processed {len(daily_df)} days of data")
    print(f"Data saved to {output_path}")

    # Save recent data
    recent_data = daily_df.tail(90).reset_index()
    # Convert timestamps to Unix time and handle NaN values
    recent_data['Timestamp'] = recent_data['Timestamp'].apply(lambda x: int(x.timestamp()))
    recent_dict = recent_data.replace({np.nan: None}).to_dict(orient='records')
    
    recent_path = Path('data/processed/btc_usd/recent_indicators.json')
    with open(recent_path, 'w') as f:
        json.dump(recent_dict, f, indent=2)

    print(f"Recent data saved to {recent_path}")

if __name__ == "__main__":
    load_and_process_data() 