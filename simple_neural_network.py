#!/usr/bin/env python3
"""
Simple Neural Network Implementation from Scratch
"""

import numpy as np
import matplotlib.pyplot as plt
from typing import List, Tuple, Callable


class NeuralNetwork:
    """A simple feedforward neural network with one hidden layer"""
    
    def __init__(self, input_size: int, hidden_size: int, output_size: int, learning_rate: float = 0.1):
        """Initialize the neural network with random weights"""
        # Xavier initialization for better convergence
        self.W1 = np.random.randn(input_size, hidden_size) * np.sqrt(2.0 / input_size)
        self.b1 = np.zeros((1, hidden_size))
        self.W2 = np.random.randn(hidden_size, output_size) * np.sqrt(2.0 / hidden_size)
        self.b2 = np.zeros((1, output_size))
        
        self.learning_rate = learning_rate
        self.losses = []
    
    @staticmethod
    def sigmoid(x: np.ndarray) -> np.ndarray:
        """Sigmoid activation function"""
        return 1 / (1 + np.exp(-np.clip(x, -500, 500)))
    
    @staticmethod
    def sigmoid_derivative(x: np.ndarray) -> np.ndarray:
        """Derivative of sigmoid function"""
        return x * (1 - x)
    
    @staticmethod
    def relu(x: np.ndarray) -> np.ndarray:
        """ReLU activation function"""
        return np.maximum(0, x)
    
    @staticmethod
    def relu_derivative(x: np.ndarray) -> np.ndarray:
        """Derivative of ReLU function"""
        return (x > 0).astype(float)
    
    def forward(self, X: np.ndarray) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
        """Forward propagation through the network"""
        # Input to hidden layer
        self.z1 = np.dot(X, self.W1) + self.b1
        self.a1 = self.relu(self.z1)
        
        # Hidden to output layer
        self.z2 = np.dot(self.a1, self.W2) + self.b2
        self.a2 = self.sigmoid(self.z2)
        
        return self.a2, self.a1, X
    
    def backward(self, X: np.ndarray, y: np.ndarray, output: np.ndarray, hidden: np.ndarray) -> None:
        """Backward propagation to calculate gradients"""
        m = X.shape[0]  # Number of examples
        
        # Output layer gradients
        self.dz2 = output - y
        self.dW2 = (1/m) * np.dot(hidden.T, self.dz2)
        self.db2 = (1/m) * np.sum(self.dz2, axis=0, keepdims=True)
        
        # Hidden layer gradients
        self.da1 = np.dot(self.dz2, self.W2.T)
        self.dz1 = self.da1 * self.relu_derivative(hidden)
        self.dW1 = (1/m) * np.dot(X.T, self.dz1)
        self.db1 = (1/m) * np.sum(self.dz1, axis=0, keepdims=True)
    
    def update_weights(self) -> None:
        """Update weights using gradient descent"""
        self.W2 -= self.learning_rate * self.dW2
        self.b2 -= self.learning_rate * self.db2
        self.W1 -= self.learning_rate * self.dW1
        self.b1 -= self.learning_rate * self.db1
    
    def train(self, X: np.ndarray, y: np.ndarray, epochs: int = 1000, verbose: bool = True) -> None:
        """Train the neural network"""
        for epoch in range(epochs):
            # Forward propagation
            output, hidden, _ = self.forward(X)
            
            # Calculate loss (binary cross-entropy)
            loss = -np.mean(y * np.log(output + 1e-8) + (1 - y) * np.log(1 - output + 1e-8))
            self.losses.append(loss)
            
            # Backward propagation
            self.backward(X, y, output, hidden)
            
            # Update weights
            self.update_weights()
            
            # Print progress
            if verbose and epoch % 100 == 0:
                accuracy = self.accuracy(X, y)
                print(f"Epoch {epoch:4d} | Loss: {loss:.4f} | Accuracy: {accuracy:.2%}")
    
    def predict(self, X: np.ndarray) -> np.ndarray:
        """Make predictions"""
        output, _, _ = self.forward(X)
        return (output > 0.5).astype(int)
    
    def accuracy(self, X: np.ndarray, y: np.ndarray) -> float:
        """Calculate prediction accuracy"""
        predictions = self.predict(X)
        return np.mean(predictions == y)


def create_dataset(dataset_type: str = 'xor') -> Tuple[np.ndarray, np.ndarray]:
    """Create different datasets for testing"""
    if dataset_type == 'xor':
        # XOR problem - classic non-linearly separable problem
        X = np.array([[0, 0], [0, 1], [1, 0], [1, 1]])
        y = np.array([[0], [1], [1], [0]])
    elif dataset_type == 'and':
        # AND gate
        X = np.array([[0, 0], [0, 1], [1, 0], [1, 1]])
        y = np.array([[0], [0], [0], [1]])
    elif dataset_type == 'or':
        # OR gate
        X = np.array([[0, 0], [0, 1], [1, 0], [1, 1]])
        y = np.array([[0], [1], [1], [1]])
    elif dataset_type == 'spiral':
        # Spiral dataset - more complex
        np.random.seed(42)
        n_points = 100
        n_classes = 2
        X = np.zeros((n_points * n_classes, 2))
        y = np.zeros((n_points * n_classes, 1))
        
        for j in range(n_classes):
            ix = range(n_points * j, n_points * (j + 1))
            r = np.linspace(0.0, 1, n_points)
            t = np.linspace(j * 4, (j + 1) * 4, n_points) + np.random.randn(n_points) * 0.2
            X[ix] = np.c_[r * np.sin(t), r * np.cos(t)]
            y[ix] = j
        
    return X, y


def visualize_decision_boundary(nn: NeuralNetwork, X: np.ndarray, y: np.ndarray, title: str = "Decision Boundary"):
    """Visualize the decision boundary learned by the neural network"""
    # Create a mesh
    h = 0.01
    x_min, x_max = X[:, 0].min() - 0.5, X[:, 0].max() + 0.5
    y_min, y_max = X[:, 1].min() - 0.5, X[:, 1].max() + 0.5
    xx, yy = np.meshgrid(np.arange(x_min, x_max, h), np.arange(y_min, y_max, h))
    
    # Predict on mesh
    Z = nn.predict(np.c_[xx.ravel(), yy.ravel()])
    Z = Z.reshape(xx.shape)
    
    # Plot
    plt.figure(figsize=(10, 8))
    plt.contourf(xx, yy, Z, alpha=0.4, cmap='RdBu')
    scatter = plt.scatter(X[:, 0], X[:, 1], c=y.ravel(), cmap='RdBu', edgecolor='black', s=100)
    plt.xlabel('Feature 1')
    plt.ylabel('Feature 2')
    plt.title(title)
    plt.colorbar(scatter)
    plt.grid(True, alpha=0.3)
    plt.show()


def main():
    """Demonstrate the neural network on different problems"""
    print("=" * 60)
    print("Simple Neural Network Demo")
    print("=" * 60)
    
    # Test 1: XOR Problem
    print("\n1. XOR Problem (Classic Non-linearly Separable)")
    print("-" * 40)
    X_xor, y_xor = create_dataset('xor')
    print("Input data (X):")
    print(X_xor)
    print("\nTarget output (y):")
    print(y_xor.ravel())
    
    # Create and train neural network
    nn_xor = NeuralNetwork(input_size=2, hidden_size=4, output_size=1, learning_rate=0.5)
    print("\nTraining...")
    nn_xor.train(X_xor, y_xor, epochs=1000, verbose=True)
    
    # Test predictions
    print("\nFinal predictions:")
    predictions = nn_xor.predict(X_xor)
    for i in range(len(X_xor)):
        print(f"Input: {X_xor[i]} -> Predicted: {predictions[i][0]}, Actual: {y_xor[i][0]}")
    
    # Visualize
    visualize_decision_boundary(nn_xor, X_xor, y_xor, "XOR Problem - Decision Boundary")
    
    # Test 2: AND Gate
    print("\n2. AND Gate Problem")
    print("-" * 40)
    X_and, y_and = create_dataset('and')
    nn_and = NeuralNetwork(input_size=2, hidden_size=3, output_size=1, learning_rate=0.5)
    nn_and.train(X_and, y_and, epochs=500, verbose=False)
    print(f"Final accuracy: {nn_and.accuracy(X_and, y_and):.2%}")
    
    # Test 3: OR Gate
    print("\n3. OR Gate Problem")
    print("-" * 40)
    X_or, y_or = create_dataset('or')
    nn_or = NeuralNetwork(input_size=2, hidden_size=3, output_size=1, learning_rate=0.5)
    nn_or.train(X_or, y_or, epochs=500, verbose=False)
    print(f"Final accuracy: {nn_or.accuracy(X_or, y_or):.2%}")
    
    # Plot learning curves
    plt.figure(figsize=(10, 6))
    plt.plot(nn_xor.losses, label='XOR', linewidth=2)
    plt.xlabel('Epoch')
    plt.ylabel('Loss')
    plt.title('Training Loss Over Time')
    plt.legend()
    plt.grid(True, alpha=0.3)
    plt.show()
    
    # Test on custom input
    print("\n4. Custom Input Test")
    print("-" * 40)
    custom_input = np.array([[0.5, 0.5], [0.2, 0.8], [0.9, 0.1]])
    print("Testing XOR network on custom inputs:")
    predictions = nn_xor.predict(custom_input)
    for i in range(len(custom_input)):
        output, _, _ = nn_xor.forward(custom_input[i:i+1])
        print(f"Input: {custom_input[i]} -> Output: {output[0][0]:.4f} -> Predicted: {predictions[i][0]}")


if __name__ == "__main__":
    main()