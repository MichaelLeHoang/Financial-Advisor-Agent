import numpy as np
import pandas as pd 
from sklearn.preprocessing import MinMaxScaler
from src.data.fetch import fetch_stock_history

def compute_features(df: pd.DataFrame) -> pd.DataFrame: 
    """
    Engineer features from raw OHLCV data.
    WHY FEATURE ENGINEERING?
    Raw prices alone are poor predictors. Derived features
    capture patterns the model can learn from:
    - Returns: Percentage change (more stationary than price)
    - Moving Averages: Smooth out noise to show trends
    - Volatility: How much the price swings
    - RSI: Momentum indicator (overbought/oversold)
    """
    features = pd.DataFrame(index=df.index)

    # Raw price feartures 
    features["close"] = df["Close"]
    features["volume"] = df["Volume"] 

    # Returns (percentage change)
    features["return_1d"] = df["Close"].pct_change(1) # 1-day return 
    features["return_5d"] = df["Close"].pct_change(5) # 5-day return 
    features["return_20d"] = df["Close"].pct_change(20) # 20-day return 
    
    # Moving Averages (trend indicators)
    features["sma_10"] = df["Close"].rolling(window=10).mean()   # 10-day avg
    features["sma_30"] = df["Close"].rolling(window=30).mean()   # 30-day avg
    features["ema_10"] = df["Close"].ewm(span=10).mean()         # exponential MA

    # Volatility (risk indicators) 
    features["volatility_10d"] = df["Close"].rolling(window=10).std() # 10-day std dev

    # Price relative to moving average
    features["price_to_sma10"] = df["Close"] / features["sma_10"]

    # RSI (Relative Strength Index) - momentum oscillator 
    features["rsi_14"] = _compute_rsi(df["Close"], window=14)

    # Drop rows with NaN (from rolling calculations)
    features = features.dropna()

    return features 

def _compute_rsi(series: pd.Series, window: int = 14) -> pd.Series: 
    """
    Compute Relative Strength Index.
    RSI measures speed and magnitude of price changes:
    - RSI > 70: Overbought (price might drop)
    - RSI < 30: Oversold (price might rise)
    - RSI ~ 50: Neutral
    """
    
    delta = series.diff()
    gain = delta.where(delta > 0, 0.0).rolling(window=window).mean()
    loss = (-delta.where(delta < 0, 0.0)).rolling(window=window).mean()
    rs = gain / loss
    return 100 - (100 / (1 + rs))

def create_sequences(
    data: np.ndarray, 
    sequence_length: int = 30,
) -> tuple[np.ndarray, np.ndarray]: 
    """
    Convert time series into input/output sequences for LSTM.
    
    LSTM needs fixed-length input sequences. We slide a window
    across the data:

    Data: [1, 2, 3, 4, 5, 6, 7, 8]
    Window size: 3
    Sequences:
      X = [1, 2, 3] → y = 4
      X = [2, 3, 4] → y = 5
      X = [3, 4, 5] → y = 6
      ...
    Args:
        data: Normalized feature array (samples x features)
        sequence_length: Number of past days to look at (default 30)
    Returns:
        X: Input sequences (num_samples, sequence_length, num_features)
        y: Target values (next day's close price)
    """
    X, y = [], []
    for i in range(sequence_length, len(data)):
        X.append(data[i - sequence_length: i])
        y.append(data[i, 0]) # Column = 0 = close price
    
    return np.array(X), np.array(y)

def create_flat(
    data: np.ndarray,
    lookback: int = 5,
) -> tuple[np.ndarray, np.ndarray]: 
    """
    Create flat feature rows for Random Forest.
    DIFFERENCE FROM LSTM:
    LSTM takes 3D sequences (samples, timesteps, features).
    Random Forest takes 2D flat rows (samples, features).
    We flatten by taking the last N days of features and
    arranging them as one wide row:
      [day1_close, day1_vol, ..., day5_close, day5_vol, ...] → next_close
    Args:
        data: Normalized feature array
        lookback: Number of past days to include as features
    """
    X, y = [], []
    for i in range(lookback, len(data)):
        # Flatten the lookback window into a single row
        row = data[i - lookback : i].flatten()
        X.append(row)
        y.append(data[i, 0])  # Predict next close
    return np.array(X), np.array(y)

def prepare_training_data(
    ticker: str, 
    sequence_length: int = 30,
    test_split: float = 0.2, 
    model_type: str = "lstm", # "lstm" or "random_forest"
) -> dict: 
    """
    Full preprocessing pipeline: fetch → features → normalize → sequences.
    
    Args:
        ticker: Stock symbol (e.g., 'AAPL')
        sequence_length: Number of past days per input
        test_split: Fraction of data for testing (0.2 = last 20%)
        model_type: "lstm" or "random_forest"

    Returns:
        Dict with X_train, y_train, X_test, y_test, scaler, feature_names
    """

    # Fetch raw data 
    raw = fetch_stock_history([ticker], period="2y")
    if raw.empty: 
        raise ValueError(f"No data found for ticker: {ticker}")
    
    # Engineer features 
    features = compute_features(raw)
    feature_names = features.columns.tolist()

    # Normalize to [0, 1]
    scaler = MinMaxScaler()
    scaled_data = scaler.fit_transform(features.values)

    # Create inputs based on model type
    if model_type == "lstm":
        X, y = create_sequences(scaled_data, sequence_length)
    else:
        X, y = create_flat(scaled_data, lookback=sequence_length)

    split_idx = int(len(X) * (1 - test_split))
    X_train, X_test = X[:split_idx], X[split_idx:]
    y_train, y_test = y[:split_idx], y[split_idx:]

    print(f"Data prepared for {ticker} ({model_type}):")
    print(f"  Features: {feature_names}")
    print(f"  Train: {X_train.shape[0]} samples, shape: {X_train.shape}")
    print(f"  Test:  {X_test.shape[0]} samples")

    return {
        "X_train": X_train,
        "y_train": y_train,
        "X_test": X_test,
        "y_test": y_test,
        "scaler": scaler,
        "feature_names": feature_names,
    }
