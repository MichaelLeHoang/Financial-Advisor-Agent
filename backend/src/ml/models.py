import numpy as np 
import joblib
import json 
from pathlib import Path 
from abc import ABC, abstractmethod

from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error

class StockPredictor(ABC): 
    """Base clase for all stock predictors """

    @abstractmethod
    def train(self, X_train: np.ndarray, y_train: np.ndarray) -> dict:  
        """Train the model. Returns training metrics"""
        ...
    @abstractmethod
    def predict(self, X: np.ndarray) -> np.ndarray:
        """Make predictions."""
        ...
    @abstractmethod
    def save(self, path: str) -> None:
        """Save model to disk."""
        ...
    @abstractmethod
    def load(self, path: str) -> None:
        """Load model from disk."""
        ...

class RandomForestPredictor(StockPredictor): 
    """
    Random Forest for stock price prediction.

    - Fast to train (seconds vs minutes for LSTM)
    - No GPU required
    - Handles non-linear relationships well
    - Built-in feature importance (which features matter most)
    - Resistant to overfitting (ensemble of decision trees)

    """

    def __init__(self, n_estimators: int = 200, max_depth: int = 15): 
        self.model = RandomForestRegressor(
            n_estimators=n_estimators, 
            max_depth=max_depth, 
            random_state=42, # Reproducibility
            n_jobs=-1, # Use all CPU cores
        )
        self._is_trained = False

    def train(self, X_train: np.ndarray, y_train: np.ndarray) -> dict: 
        """
        Train the Random Forest model.
        Returns metrics dict with MAE, RMSE, and feature importances.
        """
        print(f"Training Random Forest ({self.model.n_estimators} trees)...")
        self.model.fit(X_train, y_train)
        self._is_trained = True
        
        # Evaluate on training data
        train_pred = self.model.predict(X_train)
        metrics = {
            "model": "random_forest",
            "train_mae": float(mean_absolute_error(y_train, train_pred)),
            "train_rmse": float(mean_squared_error(y_train, train_pred)),
        }
        print(f"  Train MAE:  {metrics['train_mae']:.6f}")
        print(f"  Train RMSE: {metrics['train_rmse']:.6f}")
        return metrics

    def predict(self, X: np.ndarray) -> np.ndarray:
        if not self._is_trained:
            raise RuntimeError("Model not trained. Call train() first.")
        return self.model.predict(X)

    def get_feature_importances(self, feature_names: list[str]) -> dict[str, float]:
        if not self._is_trained:
            raise RuntimeError("Model not trained. Call train() first.")
        importances = self.model.feature_importances_
        
        # Handle flattened features (lookback × num_features)
        if len(importances) != len(feature_names):
            lookback = len(importances) // len(feature_names)
            expanded_names = [
                f"day{d+1}_{name}"
                for d in range(lookback)
                for name in feature_names
            ]
        else:
            expanded_names = feature_names
        sorted_idx = np.argsort(importances)[::-1]
        return {
            expanded_names[i]: float(importances[i])
            for i in sorted_idx
        }


    def save(self, path: str) -> None: 
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        joblib.dump(self.model, path)
        print(f"Model saved to {path}")

    def load(self, path: str) -> None:
        self.model = joblib.load(path)
        self._is_trained = True
        print(f"Model loaded from {path}")
        
# ============================================================
# LSTM Model
# ============================================================

class LSTMPredictor(StockPredictor): 
    """
    LSTM Neural Network for stock price prediction.

    WHY LSTM?
    - Designed for sequential data (time series)
    - Has "memory cells" that remember long-term patterns
    - Captures complex non-linear temporal dependencies
    - State-of-the-art for many time series tasks

    ARCHITECTURE:
    Input → LSTM(128) → Dropout(0.2) → LSTM(64) → Dropout(0.2)
    → Dense(32) → Dense(1) → Close price prediction
    """
    def __init__(
        self,
        hidden_size: int = 128,
        num_layers: int = 2,
        dropout: float = 0.2,
        learning_rate: float = 0.001,
        epochs: int = 50,
        batch_size: int = 32,
    ):
        import torch
        import torch.nn as nn

        self.hidden_size = hidden_size
        self.num_layers = num_layers
        self.dropout = dropout
        self.learning_rate = learning_rate
        self.epochs = epochs
        self.batch_size = batch_size
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self._model = None
        self._is_trained = False

    def _build_model(self, input_size: int): 
        """
        Build the LSTM model.
        """
        
        import torch.nn as nn
        class LSTMNetwork(nn.Module):
            def __init__(self, input_size, hidden_size, num_layers, dropout):
                super().__init__()
                self.lstm = nn.LSTM(
                    input_size=input_size,
                    hidden_size=hidden_size,
                    num_layers=num_layers,
                    dropout=dropout if num_layers > 1 else 0,
                    batch_first=True,
                )
                self.fc1 = nn.Linear(hidden_size, 32)
                self.fc2 = nn.Linear(32, 1)
                self.relu = nn.ReLU()
                self.dropout = nn.Dropout(dropout)
            def forward(self, x):
                lstm_out, _ = self.lstm(x)
                # Take the output from the last time step
                last_out = lstm_out[:, -1, :]
                out = self.dropout(self.relu(self.fc1(last_out)))
                return self.fc2(out).squeeze(-1)
        self._model = LSTMNetwork(
            input_size, self.hidden_size, self.num_layers, self.dropout
        ).to(self.device)

    def train(self, X_train: np.ndarray, y_train: np.ndarray) -> dict:
        """Train the LSTM model."""
        import torch
        import torch.nn as nn
        from torch.utils.data import TensorDataset, DataLoader

        input_size = X_train.shape[2]  # Number of features
        self._build_model(input_size)

        # Convert to tensors
        X_tensor = torch.FloatTensor(X_train).to(self.device)
        y_tensor = torch.FloatTensor(y_train).to(self.device)
        dataset = TensorDataset(X_tensor, y_tensor)
        loader = DataLoader(dataset, batch_size=self.batch_size, shuffle=True)

        # Training setup
        optimizer = torch.optim.Adam(self._model.parameters(), lr=self.learning_rate)
        criterion = nn.MSELoss()

        print(f"Training LSTM on {self.device} ({self.epochs} epochs)...")
        self._model.train()

        for epoch in range(self.epochs):
            total_loss = 0
            for X_batch, y_batch in loader:
                optimizer.zero_grad()
                predictions = self._model(X_batch)
                loss = criterion(predictions, y_batch)
                loss.backward()
                optimizer.step()
                total_loss += loss.item()
            avg_loss = total_loss / len(loader)
            if (epoch + 1) % 10 == 0:
                print(f"  Epoch {epoch+1}/{self.epochs}, Loss: {avg_loss:.6f}")

        self._is_trained = True

        # Calculate training metrics
        self._model.eval()

        with torch.no_grad():
            train_pred = self._model(X_tensor).cpu().numpy()
        metrics = {
            "model": "lstm",
            "train_mae": float(mean_absolute_error(y_train, train_pred)),
            "train_rmse": float(np.sqrt(mean_squared_error(y_train, train_pred))),
            "final_loss": avg_loss,
        }

        print(f"  Train MAE:  {metrics['train_mae']:.6f}")
        print(f"  Train RMSE: {metrics['train_rmse']:.6f}")

        return metrics

    def predict(self, X: np.ndarray) -> np.ndarray:
        import torch

        if not self._is_trained:
            raise RuntimeError("Model not trained. Call train() first.")

        self._model.eval()

        with torch.no_grad():
            X_tensor = torch.FloatTensor(X).to(self.device)
            predictions = self._model(X_tensor).cpu().numpy()

        return predictions

    def save(self, path: str) -> None:
        import torch

        Path(path).parent.mkdir(parents=True, exist_ok=True)
        torch.save(self._model.state_dict(), path)

        # Save config alongside
        config_path = path.replace(".pt", "_config.json")
        config = {
            "hidden_size": self.hidden_size,
            "num_layers": self.num_layers,
            "dropout": self.dropout,
        }

        with open(config_path, "w") as f:
            json.dump(config, f)

        print(f"Model saved to {path}")

    def load(self, path: str, input_size: int = 11) -> None:
        import torch

        config_path = path.replace(".pt", "_config.json")

        if Path(config_path).exists():
            with open(config_path) as f:
                config = json.load(f)
            self.hidden_size = config["hidden_size"]
            self.num_layers = config["num_layers"]
            self.dropout = config["dropout"]

        self._build_model(input_size)
        self._model.load_state_dict(torch.load(path, map_location=self.device))
        self._is_trained = True

        print(f"Model loaded from {path}")

# ============================================================
# Evaluation Utility
# ============================================================
def evaluate_model(
    model: StockPredictor,
    X_test: np.ndarray,
    y_test: np.ndarray,
    scaler=None,
) -> dict:
    """
    Evaluate a trained model on test data.
    Returns MAE and RMSE in both normalized and original scale.
    """
    predictions = model.predict(X_test)
    metrics = {
        "test_mae": float(mean_absolute_error(y_test, predictions)),
        "test_rmse": float(np.sqrt(mean_squared_error(y_test, predictions))),
    }
    # If scaler provided, compute metrics in original price scale
    if scaler is not None:
        n_features = scaler.n_features_in_

        # Create dummy arrays to inverse-transform just the close price (col 0)
        pred_full = np.zeros((len(predictions), n_features))
        pred_full[:, 0] = predictions
        actual_full = np.zeros((len(y_test), n_features))
        actual_full[:, 0] = y_test

        pred_prices = scaler.inverse_transform(pred_full)[:, 0]
        actual_prices = scaler.inverse_transform(actual_full)[:, 0]

        metrics["test_mae_dollars"] = float(mean_absolute_error(actual_prices, pred_prices))
        metrics["test_rmse_dollars"] = float(np.sqrt(mean_squared_error(actual_prices, pred_prices)))

    print(f"\nTest Results:")
    print(f"  MAE:  {metrics['test_mae']:.6f}")
    print(f"  RMSE: {metrics['test_rmse']:.6f}")

    if "test_mae_dollars" in metrics:
        print(f"  MAE ($):  ${metrics['test_mae_dollars']:.2f}")
        print(f"  RMSE ($): ${metrics['test_rmse_dollars']:.2f}")

    return metrics
