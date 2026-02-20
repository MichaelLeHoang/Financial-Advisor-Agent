import numpy as np 
import pennylane as qml 
from pennylane import qaoa
import pandas as pd

def build_qubo_matrix(
    mean_returns: pd.Series, 
    cov_matrix: pd.DataFrame, 
    risk_penalty: float = 0.5,
    budget_penalty: float = 1.0,
    target_assets: int = 3,
) -> np.ndarray:
    """
    Build QUBO matrix for portfolio selection.

    The QUBO encodes three objectives: 
        1. Maximize returns (diagonal terms, negative = good)
        2. Minimize risk (off-diagonal terms from covariance)
        3. select exactly target_assets stocks (penalty term)

    Args:
        mean_returns: Expected annual return per stock
        cov_matrix: Covariance matrix of returns
        risk_penalty: Weight for risk minimization (higher = less risky)
        budget_penalty: Weight for budget constraint
        target_assets: How many stocks to select
    Returns:
        QUBO matrix Q (n x n) where n = number of stocks
    """
    n = len(mean_returns)
    Q = np.zeros((n, n))

    returns = mean_returns.values
    cov = cov_matrix.values

    for i in range (n):
        # diagonal: reward for selecting high-return stcks
        # negative because AQOA minimizes 
        Q[i,i] = -returns[i] * risk_penalty * cov[i,i]

        # budget penalty: (sum(x) - target)^2 expansion
        # diagonal contribution: budget_penalty * (1 - 2*target)
        Q[i,i] += budget_penalty * (1 - 2 * target_assets)

        for j in range(i + 1, n):
            # off-diagonal: penalize correlated stocks (risk)
            Q[i, j] = cov[i, j] * risk_penalty
            # budget penalty cross-terms: 2 * budget_penalty 
            Q[j, i] = cov[j, i] * risk_penalty

    return Q

def qaoa_optimize(
    mean_returns: pd.Series, 
    cov_matrix: pd.DataFrame, 
    n_layers: int = 2,
    n_iterations: int = 80,
    risk_penalty: float = 0.5,
    target_assets: int = 3, 
) -> dict:
    """
    Run QAOA to find optimal stock selection.
    Args:
        mean_returns: Expected returns per stock
        cov_matrix: Covariance matrix
        n_layers: QAOA circuit depth (more = better but slower)
        n_iterations: Classical optimizer iterations
        risk_penalty: How much to penalize risk
        target_assets: How many stocks to select
    Returns:
        Dict with selected stocks, probabilities, and circuit info
    """
    n_qubits = len(mean_returns)
    tickers = list(mean_returns.index)

    # Build QUBO matrix
    Q = build_qubo_matrix(
        mean_returns,
        cov_matrix,
        risk_penalty=risk_penalty,
        target_assets=target_assets,
    )

    # create cost and mixer Hamiltonians 
    # cost Hamiltonian from QUBOL H_C = sum Q_ij Z_i Z_j
    cost_coeffs = []
    cost_obs = []

    for i in range(n_qubits):
        # diagonal terms: single Z
        if abs(Q[i,i]) > 1e-10:
            cost_coeffs.append(Q[i,i])
            cost_obs.append(qml.PauliZ(i))
        
        for j in range(i + 1, n_qubits):
            # off-diagonal terms: Z_i Z_j (ZZ interaction)
            if abs(Q[i,j]) > 1e-10:
                cost_coeffs.append(Q[i,j])
                cost_obs.append(qml.PauliZ(i) @ qml.PauliZ(j))
    
    # create cost Hamiltonian
    cost_h = qml.Hamiltonian(cost_coeffs, cost_obs)

    # mixer Hamiltonian: sum of X_i (enables transitions between states)
    mixer_h = qml.Hamiltonian(
        [1.0] * n_qubits, 
        [qml.PauliX(i) for i in range(n_qubits)],
    )

    # define QAOA circuit
    dev = qml.device("default.qubit", wires=n_qubits)

    def qaoa_layer(gamma, beta):
        qaoa.cost_layer(gamma, cost_h)
        qaoa.mixer_layer(beta, mixer_h)


    @qml.qnode(dev)
    def circuit(params):
        # Apply Hadamard gates to all qubits (create superposition)
        for i in range(n_qubits):
            qml.Hadamard(wires=i)
        
        # Apply p QAOA layers
        qml.layer(qaoa_layer, n_layers, params[0], params[1])
        return qml.expval(cost_h)

    
    # optimize parameters
    # Initialize with small random values
    params = qml.numpy.array(
        np.random.uniform(0.01, 0.5, (2, n_layers)),
        requires_grad=True,
    )
    optimizer = qml.GradientDescentOptimizer(stepsize=0.1)

    print(f"Running QAOA ({n_qubits} qubits, {n_layers} layers, {n_iterations} iterations)...")

    best_cost = float("inf")
    for i in range(n_iterations):
        params, cost = optimizer.step_and_cost(circuit, params)
        if cost < best_cost: 
            best_cost = cost
        if (i + 1) % 20 == 0:
            print(f"  Iteration {i+1}/{n_iterations}, Cost: {cost:.4f}")

    # Sample the optimized circuit to get stock selections
    @qml.qnode(dev)
    def probabilities_circuit(params):
        # Apply Hadamard gates to all qubits (create superposition)
        for i in range(n_qubits):
            qml.Hadamard(wires=i)
        
        # Apply p QAOA layers
        qml.layer(qaoa_layer, n_layers, params[0], params[1])
        return qml.probs(wires=range(n_qubits))

    probs = probabilities_circuit(params)
    
    # find the most likely bitstring
    best_idx = np.argmax(probs)
    best_bitstring = format(best_idx, f"0{n_qubits}b")

    # map bitstring to stock selection 
    selected = [tickers[i] for i, bit in enumerate(best_bitstring) if bit == "1"]

    # get top-5 most probable states
    top_indices = np.argsort(probs)[::-1][:5]
    top_states = []
    for idx in top_indices: 
        bitstring = format(idx, f"0{n_qubits}b")
        stocks = [tickers[i] for i, bit in enumerate(bitstring) if bit == "1"]
        top_states.append({
            "bitstring": bitstring,
            "stocks": stocks,
            "probability": round(float(probs[idx]), 4),
        })

    return {
        "method": "qaoa",
        "selected_stocks": selected,
        "best_bitstring": best_bitstring,
        "best_probability": round(float(probs[best_idx]), 4),
        "top_states": top_states,
        "n_qubits": n_qubits,
        "n_layers": n_layers,
        "final_cost": round(float(best_cost), 4),
    }