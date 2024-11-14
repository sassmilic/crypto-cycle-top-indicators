import pandas as pd
import os

# Input path
input_path = "./data/btc_usd/btcusd_1-min_data.csv"

# Derive output paths programmatically
output_dir = os.path.join("./data/processed", os.path.dirname(input_path).split('/')[-1])
output_file = os.path.basename(input_path)
output_path = os.path.join(output_dir, output_file)

# Create output directory if it doesn't exist
os.makedirs(output_dir, exist_ok=True)

# Read the CSV
print(f"Reading data from {input_path}...")
df = pd.read_csv(input_path)

# Calculate the price as average of (high+low)/2 and (open+close)/2
print("Processing prices...")
df['price'] = (
    ((df['High'] + df['Low']) / 2 + 
     (df['Open'] + df['Close']) / 2) / 2
)

# Keep only timestamp and calculated price
result_df = df[['Timestamp']].copy()
result_df['price'] = df['price']

# Ensure timestamp is integer and price is float
result_df['Timestamp'] = result_df['Timestamp'].astype(int)
result_df['price'] = result_df['price'].astype(float)

# Save to new CSV
print(f"Saving processed data to {output_path}...")
result_df.to_csv(output_path, index=False)

print(f"Done! Processed {len(result_df)} rows")
print(f"Sample of processed data:\n{result_df.head()}")
