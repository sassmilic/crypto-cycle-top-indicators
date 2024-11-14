import math
import os
import fcntl
import logging
import contextlib
from typing import Optional, List
from kaggle.api.kaggle_api_extended import KaggleApi
import pandas as pd
import requests
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

@contextlib.contextmanager
def file_lock(filename: str, timeout: Optional[float] = None):
    """
    Context manager for file locking to prevent concurrent access.
    
    Args:
        filename: Path to the file to lock
        timeout: Optional timeout in seconds. None means wait indefinitely
        
    Yields:
        None. Use this in a 'with' statement.
        
    Raises:
        TimeoutError: If timeout is specified and lock cannot be acquired
        IOError: If lock file cannot be created or other IO errors occur
    """
    lock_file = f"{filename}.lock"
    lock_fd = None
    try:
        # Open the lock file for locking
        lock_fd = open(lock_file, 'w')
        fcntl.flock(lock_fd.fileno(), fcntl.LOCK_EX)
        yield
    finally:
        # Unlock and close the lock file
        if lock_fd:
            try:
                fcntl.flock(lock_fd.fileno(), fcntl.LOCK_UN)
                lock_fd.close()
                os.remove(lock_file)
            except (IOError, OSError) as e:
                logger.error(f"Error releasing file lock: {str(e)}")

class KaggleDataDownloader:
    def __init__(self, download_dir: str):
        self.dataset_slug = "mczielinski/bitcoin-historical-data"
        self.download_dir = download_dir
        self.filename = "btcusd_1-min_data.csv"
        self.download_path = os.path.join(download_dir, self.filename)

    def get_dataset_size(self) -> Optional[int]:
        """Check the size of the dataset on Kaggle before downloading."""
        logger.info("Authenticating with Kaggle...")
        api = KaggleApi()
        api.authenticate()

        logger.info(f"Fetching metadata for dataset: {self.dataset_slug}...")
        try:
            files = api.dataset_list_files(self.dataset_slug).files
            target_file = next((file for file in files if file.name == self.filename), None)
            if target_file and target_file.size is not None:
                size_str = target_file.size.upper()
                number = float(''.join(c for c in size_str if c.isdigit() or c == '.'))
                unit = ''.join(c for c in size_str if c.isalpha())
                
                multipliers = {
                    'B': 1,
                    'KB': 1024,
                    'MB': 1024 * 1024,
                    'GB': 1024 * 1024 * 1024
                }
                
                total_bytes = int(number * multipliers.get(unit, 1))
                total_size_mb = total_bytes / (1024 * 1024)
                logger.info(f"Remote file size: {total_size_mb:.2f} MB")
                return total_bytes
            return None
        except Exception as e:
            logger.error(f"Error fetching dataset metadata: {str(e)}")
            return None

    def verify_download(self) -> int:
        """Verify that the dataset was downloaded successfully and return its size"""
        if os.path.exists(self.download_path):
            size_bytes = os.path.getsize(self.download_path)
            size_mb = round(size_bytes / (1024 * 1024))
            logger.info(f"Local dataset found at {self.download_path}")
            logger.info(f"Local file size: {size_mb} MB")
            return size_bytes
        return 0

    def download_dataset(self) -> bool:
        """Download the Bitcoin dataset from Kaggle if remote is larger"""
        remote_size = self.get_dataset_size()
        if remote_size is None:
            logger.error("Could not determine remote dataset size. Aborting download.")
            return False

        local_size = self.verify_download()
        local_size_mb = math.ceil(local_size / (1024 * 1024))
        
        if local_size >= remote_size:
            logger.info(f"Local file is up to date ({local_size_mb} MB). No download needed.")
            return True

        logger.info(f"Remote file is larger. Proceeding to download...")
        
        api = KaggleApi()
        api.authenticate()
        
        os.makedirs(self.download_dir, exist_ok=True)

        try:
            api.dataset_download_files(
                self.dataset_slug, 
                path=self.download_dir, 
                unzip=True
            )
            logger.info("Download complete!")
            return True
        except Exception as e:
            logger.error(f"Error downloading dataset: {str(e)}")
            return False

def process_historical_data(input_path: str, output_path: str) -> bool:
    """
    Process historical Bitcoin data by calculating price and moving averages.
    
    Args:
        input_path: Path to the raw CSV file
        output_path: Path where processed CSV should be saved
        
    Returns:
        bool: True if processing successful, False otherwise
    """
    try:
        # Create output directory if it doesn't exist
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        
        logger.info(f"Reading data from {input_path}...")
        df = pd.read_csv(input_path)

        # Calculate the price as average of (high+low)/2 and (open+close)/2
        logger.info("Processing prices...")
        df['price'] = (
            ((df['High'] + df['Low']) / 2 + 
             (df['Open'] + df['Close']) / 2) / 2
        )

        # Keep only timestamp and calculated price
        result_df = df[['Timestamp']].copy()
        result_df['price'] = df['price']

        # Add moving averages - multiply by minutes per day since data is minute-by-minute
        logger.info("Calculating moving averages...")
        minutes_per_day = 24 * 60  # 1440 minutes per day
        result_df['MA111'] = df['price'].rolling(window=111 * minutes_per_day).mean()
        result_df['MA350'] = df['price'].rolling(window=350 * minutes_per_day).mean()

        # Check for and handle any NaN values before conversion
        nan_count = result_df['Timestamp'].isna().sum()
        if nan_count > 0:
            logger.warning(f"Found {nan_count} NaN values in Timestamp column. Dropping these rows...")
            result_df = result_df.dropna(subset=['Timestamp'])

        # Convert data types
        result_df['Timestamp'] = result_df['Timestamp'].astype(int)
        result_df['price'] = result_df['price'].astype(float)

        # Save to new CSV
        logger.info(f"Saving processed data to {output_path}...")
        result_df.to_csv(output_path, index=False)

        logger.info(f"Done! Processed {len(result_df)} rows")
        return True
        
    except Exception as e:
        logger.error(f"Error processing historical data: {str(e)}")
        return False
    
def load_initial_prices(processed_data_path: str, days: int = 350) -> List[float]:
    """
    Load the most recent prices from the processed data file for initializing PriceManager.
    
    Args:
        processed_data_path: Path to the processed CSV file
        days: Number of days of historical data to load (default: 350)
        
    Returns:
        List[float]: List of prices for the specified number of days
        
    Raises:
        FileNotFoundError: If the processed data file doesn't exist
        ValueError: If there isn't enough data in the file
    """
    try:
        logger.info(f"Loading last {days} days of price data...")
        
        # Calculate number of minutes needed
        minutes_needed = days * 24 * 60
        
        # Read only the last portion of the file
        df = pd.read_csv(processed_data_path).tail(minutes_needed)
        
        if len(df) < minutes_needed:
            raise ValueError(
                f"Not enough data in file. Need {minutes_needed} minutes "
                f"but only found {len(df)} records"
            )
        
        prices = df['price'].tolist()[-minutes_needed:]
        logger.info(f"Successfully loaded {len(prices)} price points")
        
        return prices
        
    except Exception as e:
        logger.error(f"Error loading initial prices: {str(e)}")
        raise

def get_missing_data(raw_data_path: str) -> bool:
    """
    Fetch missing data between the last timestamp in historical data and current time
    using CoinGecko API.
    
    Args:
        raw_data_path: Path to the raw historical data CSV file
        
    Returns:
        bool: True if successful, False if failed
    """
    logger.info("Reading last timestamp from historical data file...")

    # Read the last valid timestamp from the raw data file
    df = pd.read_csv(raw_data_path)
    # Check last 10 rows for valid timestamp, starting from the end
    for i in range(10):
        try:
            last_timestamp = int(df['Timestamp'].iloc[-(i+1)])
            break
        except (ValueError, TypeError):
            continue
    else:
        raise ValueError("Could not find valid timestamp in last 10 rows")

    current_timestamp = int(datetime.now(timezone.utc).timestamp())

    logger.debug(f"Last timestamp: {last_timestamp}, Current timestamp: {current_timestamp}")
    
    if (current_timestamp - last_timestamp) < 60:  # Less than 1 minute gap
        logger.info("Historical data is up to date")
        return True
        
    logger.info(f"Fetching missing data from {last_timestamp} to {current_timestamp}")
    
    # CoinGecko API endpoint
    url = "https://api.coingecko.com/api/v3/coins/bitcoin/market_chart"
    
    # Calculate days needed (rounding up to ensure we get all data)
    days_needed = math.ceil((current_timestamp - last_timestamp) / (24 * 3600))
    logger.debug(f"Requesting {days_needed} days of data from CoinGecko API")
    
    params = {
        "vs_currency": "usd",
        "days": str(days_needed)
    }
    
    logger.info("Making API request to CoinGecko...")
    try:
        response = requests.get(url, params=params)
        if response.status_code != 200:
            logger.error(f"CoinGecko API returned status code {response.status_code}")
            raise Exception(f"API Error: {response.text}")
            
        data = response.json()
    except requests.RequestException as e:
        logger.error(f"Failed to make request to CoinGecko API: {str(e)}")
        return False
    except ValueError as e:
        logger.error(f"Failed to parse CoinGecko API response: {str(e)}")
        return False

    prices = data.get('prices', [])  # [[timestamp, price], ...]
    market_caps = data.get('market_caps', [])  # [[timestamp, market_cap], ...]
    volumes = data.get('total_volumes', [])  # [[timestamp, volume], ...]
    
    if not prices:
        logger.warning("No new data received from CoinGecko")
        return True
        
    logger.info(f"Processing {len(prices)} new data points...")
    new_data = []
    try:
        for i in range(len(prices)):
            ts_ms, price = prices[i]
            _, market_cap = market_caps[i]
            _, volume = volumes[i]
            
            # Convert millisecond timestamp to second timestamp
            ts = int(ts_ms / 1000)
            
            new_data.append({
                'Timestamp': ts,
                'Open': price,
                'High': price,
                'Low': price,
                'Close': price,
                #'Volume_(BTC)': volume / price if price > 0 else 0,  # Convert USD volume to BTC
                'Volume': volume,
                #'Weighted_Price': price
            })
    except (IndexError, ValueError, TypeError) as e:
        logger.error(f"Error processing API response data: {str(e)}")
        return False
    
    if new_data:
        logger.info("Converting new data to DataFrame...")
        try:
            # Convert to DataFrame and append to existing file
            new_df = pd.DataFrame(new_data)
            logger.info(f"Appending {len(new_data)} records to {raw_data_path}")
            new_df.to_csv(raw_data_path, mode='a', header=False, index=False)
            logger.info(f"Successfully added {len(new_data)} new records to historical data")
        except (IOError, OSError) as e:
            logger.error(f"Failed to write new data to file: {str(e)}")
            return False
    
    return True