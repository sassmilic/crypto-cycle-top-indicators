import time
import logging
import pandas as pd
import requests
import numpy as np
import backoff
from typing import Optional, Dict, List
import os
from utils import file_lock

logger = logging.getLogger(__name__)

class HistoricalDataManager:
    COINGECKO_HIST_URL = "https://api.coingecko.com/api/v3/coins/bitcoin/market_chart/range"
    BATCH_SIZE = 1440  # Number of minutes to fetch per request
    MIN_REQUEST_INTERVAL = 1.5  # Minimum seconds between requests
    MAX_RETRIES = 3
    MILLISECONDS_THRESHOLD = 1e12  # Used to detect millisecond timestamps

    def __init__(self, raw_data_path: str):
        self.raw_data_path = raw_data_path
        self.last_request_time = 0
        
        # Validate path
        if not os.path.exists(os.path.dirname(raw_data_path)):
            raise ValueError(f"Directory does not exist: {os.path.dirname(raw_data_path)}")

    def get_last_timestamp(self) -> Optional[int]:
        """Read the last timestamp from the raw data file"""
        try:
            df = pd.read_csv(self.raw_data_path)
            if not df.empty:
                return int(df['Timestamp'].iloc[-1])
            return None
        except Exception as e:
            logger.error(f"Error reading last timestamp: {str(e)}")
            return None

    def _wait_for_rate_limit(self):
        """Ensure we don't exceed CoinGecko's rate limit"""
        elapsed = time.time() - self.last_request_time
        if elapsed < self.MIN_REQUEST_INTERVAL:
            time.sleep(self.MIN_REQUEST_INTERVAL - elapsed)
        self.last_request_time = time.time()

    @backoff.on_exception(
        backoff.expo,
        (requests.exceptions.RequestException, ValueError),
        max_tries=MAX_RETRIES
    )
    def fetch_historical_batch(self, from_ts: int, to_ts: int) -> List[Dict]:
        """Fetch a batch of historical data from CoinGecko"""
        self._wait_for_rate_limit()
        
        params = {
            'vs_currency': 'usd',
            'from': from_ts,
            'to': to_ts
        }

        response = requests.get(self.COINGECKO_HIST_URL, params=params)
        if response.status_code == 429:  # Rate limit exceeded
            logger.warning("Rate limit exceeded, waiting longer...")
            time.sleep(60)  # Wait a minute before retry
            raise requests.exceptions.RequestException("Rate limit exceeded")
            
        if response.status_code != 200:
            raise requests.exceptions.RequestException(
                f"API returned status code {response.status_code}"
            )

        data = response.json()
        if 'prices' not in data:
            raise ValueError("Unexpected API response format")

        return data['prices']

    def process_api_data(self, price_data: List) -> Dict:
        """Convert CoinGecko price data to our CSV format"""
        timestamp, price = price_data
        # Convert milliseconds to seconds if necessary
        timestamp = int(timestamp / 1000) if timestamp > 1e12 else int(timestamp)
        
        return {
            'Timestamp': timestamp,
            'Open': price,
            'High': price,
            'Low': price,
            'Close': price,
            'Volume': np.nan
        }

    def append_to_csv(self, data: List[Dict]):
        """Append new data to the CSV file with file locking"""
        df = pd.DataFrame(data)
        
        with file_lock(self.raw_data_path):
            df.to_csv(self.raw_data_path, mode='a', header=False, index=False)

    def get_missing_data(self) -> bool:
        """Fetch and append missing historical data"""
        try:
            last_timestamp = self.get_last_timestamp()
            if not last_timestamp:
                logger.error("Could not determine last timestamp")
                return False

            current_time = int(time.time())
            if current_time - last_timestamp < 60:
                logger.info("Historical data is up to date")
                return True

            logger.info(f"Fetching historical data from {last_timestamp} to {current_time}")
            
            current_ts = last_timestamp + 60
            all_new_data = []
            
            while current_ts < current_time:
                batch_end = min(current_ts + self.BATCH_SIZE * 60, current_time)
                
                try:
                    batch_data = self.fetch_historical_batch(current_ts, batch_end)
                    processed_data = [
                        self.process_api_data(point) 
                        for point in batch_data 
                        if (point[0] / 1000 if point[0] > 1e12 else point[0]) > last_timestamp
                    ]
                    
                    all_new_data.extend(processed_data)
                    current_ts = batch_end + 60
                    
                except Exception as e:
                    logger.error(f"Error processing batch: {str(e)}")
                    current_ts = batch_end + 60
                    continue
            
            if all_new_data:
                all_new_data.sort(key=lambda x: x['Timestamp'])
                self.append_to_csv(all_new_data)
                logger.info(f"Added {len(all_new_data)} new historical data points")
            
            return True

        except Exception as e:
            logger.error(f"Error updating historical data: {str(e)}")
            return False 