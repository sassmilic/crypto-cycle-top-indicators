import logging
from typing import List, Optional, Dict

logger = logging.getLogger(__name__)

MINUTES_PER_DAY = 24 * 60
MA111_WINDOW = 111 * MINUTES_PER_DAY
MA350_WINDOW = 350 * MINUTES_PER_DAY

class PriceManager:
    def __init__(self, initial_prices: Optional[List[float]] = None):
        """
        Initialize PriceManager with optional historical prices.
        
        Args:
            initial_prices: Optional list of historical prices for the last 350 days
        """
        if initial_prices and len(initial_prices) != MA350_WINDOW:
            raise ValueError(
                f"Initial prices must contain exactly {MA350_WINDOW} values "
                f"(350 days worth of minute data)"
            )
            
        self.prices_350d = initial_prices
        self.latest_price: Optional[float] = None
        self.moving_averages: Dict[str, Optional[float]] = {'MA111': None, 'MA350': None}
        
        # Initialize sums if we have initial prices
        if initial_prices:
            self.sum_350 = sum(initial_prices)
            self.sum_111 = sum(initial_prices[-(MA111_WINDOW):])
        else:
            self.sum_350 = 0.0
            self.sum_111 = 0.0

    def update_moving_averages(self, new_price: float) -> None:
        """
        Update moving averages with new price data.
        
        Args:
            new_price: The latest BTC price
        """
        if not isinstance(new_price, (int, float)):
            raise ValueError("Price must be a number")

        self.prices_350d.append(new_price)
        self.sum_350 += new_price

        # Remove the oldest price if the list exceeds 350 days
        if len(self.prices_350d) > MA350_WINDOW:
            oldest_price = self.prices_350d.pop(0)
            self.sum_350 -= oldest_price

        # Update the sum for the 111-day window
        if len(self.prices_350d) < MA350_WINDOW:
            raise ValueError("Not enough data points for 350-day moving average")

        self.sum_111 -= self.prices_350d[-MA111_WINDOW - 1]
        self.sum_111 += new_price
        self.moving_averages['MA111'] = self.sum_111 / MA111_WINDOW
        self.moving_averages['MA350'] = self.sum_350 / MA350_WINDOW
