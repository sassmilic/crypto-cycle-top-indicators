import os
import time
import pandas as pd
import requests
from flask import Flask, jsonify
from apscheduler.schedulers.background import BackgroundScheduler
import subprocess
import logging
from managers.price_manager import PriceManager
from managers.historical_manager import HistoricalDataManager
from utils import KaggleDataDownloader, file_lock, process_historical_data, load_initial_prices, get_missing_data

# Constants
RAW_DATA_DIR = "data/raw/btc_usd"
PROCESSED_DATA_DIR = "data/processed/btc_usd"
FILENAME = "btcusd_1-min_data.csv"
RAW_DATA_PATH = os.path.join(RAW_DATA_DIR, FILENAME)
PROCESSED_DATA_PATH = os.path.join(PROCESSED_DATA_DIR, FILENAME)

# API URLs
PRICE_APIS = {
    'cryptocompare': {
        'url': 'https://min-api.cryptocompare.com/data/price',
        'params': {'fsym': 'BTC', 'tsyms': 'USD'},
        'price_key': ['USD']
    },
    'coingecko': {
        'url': 'https://api.coingecko.com/api/v3/simple/price',
        'params': {'ids': 'bitcoin', 'vs_currencies': 'usd'},
        'price_key': ['bitcoin', 'usd']
    },
    'binance': {
        'url': 'https://api.binance.com/api/v3/ticker/price',
        'params': {'symbol': 'BTCUSDT'},
        'price_key': ['price']
    },
    'coinmarketcap': {
        'url': 'https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest',
        'params': {'symbol': 'BTC', 'convert': 'USD'},
        'headers': {'X-CMC_PRO_API_KEY': 'YOUR_API_KEY'},
        'price_key': ['data', 'BTC', 'quote', 'USD', 'price']
    },
    'bitfinex': {
        'url': 'https://api-pub.bitfinex.com/v2/ticker/tBTCUSD',
        'params': {},
        'price_key': [6]  # The 7th element in the response is the last price
    }
}

# Initialize Flask app and logging
app = Flask(__name__)
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize managers
price_manager = PriceManager()

def check_and_download_historical():
    """Check if historical data exists and download if needed"""
    downloader = KaggleDataDownloader(download_dir=RAW_DATA_DIR)
    
    if not os.path.exists(RAW_DATA_PATH):
        logger.info("Historical data file not found. Initiating download...")
    else:
        logger.info("Checking if historical data needs updating...")
        remote_size = downloader.get_dataset_size()
        if remote_size is None:
            logger.error("Could not determine remote dataset size. Keeping existing file.")
            return
            
        local_size = downloader.verify_download()
        if local_size >= remote_size:
            logger.info("Local file is up to date. No download needed.")
            return
        
        logger.info("Remote file is larger. Initiating update...")
    
    if not downloader.download_dataset():
        error_msg = "Failed to download historical data"
        logger.error(error_msg)
        raise FileNotFoundError(error_msg)
    
    if not os.path.exists(RAW_DATA_PATH):
        raise FileNotFoundError("Historical data file not found after download")

def get_latest_price():
    """Try multiple APIs to get the latest price"""
    for api_name, api_config in PRICE_APIS.items():
        try:
            response = requests.get(api_config['url'], params=api_config['params'], timeout=5)
            data = response.json()
            
            # Navigate through the response to get the price
            price = data
            for key in api_config['price_key']:
                price = price[key]
            
            return float(price)
        except Exception as e:
            logger.error(f"Error fetching price from {api_name}: {str(e)}")
    
    raise Exception("All APIs failed to return price")

def update_price(price_manager):
    """Update price and moving averages"""
    try:
        new_price = get_latest_price()
        price_manager.latest_price = new_price
        price_manager.update_moving_averages(new_price)
        
        # Use file lock when writing to the CSV
        with file_lock(PROCESSED_DATA_PATH):
            timestamp = int(time.time())
            with open(PROCESSED_DATA_PATH, 'a') as f:
                f.write(f"{timestamp},{new_price},{price_manager.moving_averages['MA111']},{price_manager.moving_averages['MA350']}\n")
            
        logger.info(f"Updated price: ${new_price:.2f}")
    except Exception as e:
        logger.error(f"Error updating price: {str(e)}")

# API endpoints
@app.route('/api/latest-price')
def api_latest_price():
    return jsonify({
        'price': price_manager.latest_price,
        'timestamp': int(time.time())
    })

@app.route('/api/latest-moving-averages')
def api_latest_moving_averages():
    return jsonify(price_manager.moving_averages)

def initialize_server():
    """Initialize the server with historical data and start price updates"""
    # Check and download historical data
    check_and_download_historical()
    
    # Get any missing data between historical dataset and current time
    logger.info("Checking for missing data between historical dataset and current time...")
    if not get_missing_data(RAW_DATA_PATH):
        logger.warning("Failed to fetch missing data, continuing with existing dataset")
    # Process historical data
    logger.info("Processing historical data...")
    if not process_historical_data(RAW_DATA_PATH, PROCESSED_DATA_PATH):
        raise RuntimeError("Failed to process historical data")
    
    # Load initial prices into PriceManager
    try:
        initial_prices = load_initial_prices(PROCESSED_DATA_PATH)
        price_manager = PriceManager(initial_prices=initial_prices)
    except Exception as e:
        raise RuntimeError(f"Failed to initialize price manager: {str(e)}")

    # Setup scheduler for price updates
    scheduler = BackgroundScheduler()
    scheduler.add_job(lambda: update_price(price_manager), 'interval', minutes=1)
    scheduler.start()

if __name__ == "__main__":
    initialize_server()
    app.run(host='0.0.0.0', port=8080)