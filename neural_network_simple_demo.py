#!/usr/bin/env python3
"""
Simple Neural Network Demo - Terminal Only Version
"""

import numpy as np


class SimpleNeuralNetwork:
    """Minimal neural network implementation"""
    
    def __init__(self, learning_rate=0.5):
        # Initialize weights for 2 inputs, 4 hidden neurons, 1 output
        self.weights_input_hidden = np.random.randn(2, 4)
        self.weights_hidden_output = np.random.randn(4, 1)
        self.learning_rate = learning_rate
    
    def sigmoid(self, x):
        """Activation function"""
        return 1 / (1 + np.exp(-x))
    
    def sigmoid_derivative(self, x):
        """Derivative for backpropagation"""
        return x * (1 - x)
    
    def predict(self, inputs):
        """Forward pass through the network"""
        self.hidden = self.sigmoid(np.dot(inputs, self.weights_input_hidden))
        output = self.sigmoid(np.dot(self.hidden, self.weights_hidden_output))
        return output
    
    def train(self, inputs, targets, epochs=10000):
        """Train the network using backpropagation"""
        for epoch in range(epochs):
            # Forward pass
            hidden = self.sigmoid(np.dot(inputs, self.weights_input_hidden))
            output = self.sigmoid(np.dot(hidden, self.weights_hidden_output))
            
            # Calculate error
            output_error = targets - output
            
            # Backward pass
            output_delta = output_error * self.sigmoid_derivative(output)
            hidden_error = output_delta.dot(self.weights_hidden_output.T)
            hidden_delta = hidden_error * self.sigmoid_derivative(hidden)
            
            # Update weights
            self.weights_hidden_output += hidden.T.dot(output_delta) * self.learning_rate
            self.weights_input_hidden += inputs.T.dot(hidden_delta) * self.learning_rate
            
            # Print progress
            if epoch % 1000 == 0:
                loss = np.mean(np.square(targets - output))
                print(f"Epoch {epoch:5d} - Loss: {loss:.6f}")


def demo_xor():
    """Demonstrate learning XOR function"""
    print("=" * 50)
    print("Neural Network Learning XOR Function")
    print("=" * 50)
    print("\nXOR Truth Table:")
    print("A | B | A XOR B")
    print("--|---|--------")
    print("0 | 0 |    0")
    print("0 | 1 |    1")
    print("1 | 0 |    1")
    print("1 | 1 |    0")
    print("\nThis is non-linearly separable - perfect for testing neural networks!")
    
    # Training data for XOR
    inputs = np.array([
        [0, 0],
        [0, 1],
        [1, 0],
        [1, 1]
    ])
    
    targets = np.array([
        [0],  # 0 XOR 0 = 0
        [1],  # 0 XOR 1 = 1
        [1],  # 1 XOR 0 = 1
        [0]   # 1 XOR 1 = 0
    ])
    
    # Create and train network
    print("\nCreating neural network...")
    print("Architecture: 2 inputs -> 4 hidden neurons -> 1 output")
    
    nn = SimpleNeuralNetwork(learning_rate=0.5)
    
    print("\nTraining network on XOR data...")
    nn.train(inputs, targets, epochs=10000)
    
    # Test the trained network
    print("\nTesting trained network:")
    print("-" * 40)
    for i in range(len(inputs)):
        prediction = nn.predict(inputs[i])
        print(f"Input: {inputs[i]} -> Output: {prediction[0]:.4f} -> Rounded: {int(prediction[0] > 0.5)}")
    
    print("\nTesting with intermediate values:")
    test_inputs = [
        [0.1, 0.1],
        [0.1, 0.9],
        [0.9, 0.1],
        [0.9, 0.9],
        [0.5, 0.5]
    ]
    
    for test_input in test_inputs:
        prediction = nn.predict(np.array(test_input))
        print(f"Input: {test_input} -> Output: {prediction[0]:.4f} -> Rounded: {int(prediction[0] > 0.5)}")
    
    return nn


def demo_and_gate():
    """Demonstrate learning AND function"""
    print("\n" + "=" * 50)
    print("Neural Network Learning AND Function")
    print("=" * 50)
    
    inputs = np.array([[0, 0], [0, 1], [1, 0], [1, 1]])
    targets = np.array([[0], [0], [0], [1]])  # AND logic
    
    nn = SimpleNeuralNetwork(learning_rate=0.5)
    print("\nTraining on AND gate...")
    
    # Fewer epochs needed for simpler problem
    for epoch in range(5000):
        hidden = nn.sigmoid(np.dot(inputs, nn.weights_input_hidden))
        output = nn.sigmoid(np.dot(hidden, nn.weights_hidden_output))
        
        output_error = targets - output
        output_delta = output_error * nn.sigmoid_derivative(output)
        hidden_error = output_delta.dot(nn.weights_hidden_output.T)
        hidden_delta = hidden_error * nn.sigmoid_derivative(hidden)
        
        nn.weights_hidden_output += hidden.T.dot(output_delta) * nn.learning_rate
        nn.weights_input_hidden += inputs.T.dot(hidden_delta) * nn.learning_rate
        
        if epoch % 1000 == 0:
            loss = np.mean(np.square(targets - output))
            print(f"Epoch {epoch:5d} - Loss: {loss:.6f}")
    
    print("\nAND Gate Results:")
    for i in range(len(inputs)):
        prediction = nn.predict(inputs[i])
        print(f"Input: {inputs[i]} -> Output: {prediction[0]:.4f} -> Rounded: {int(prediction[0] > 0.5)}")


def visualize_network_ascii(nn):
    """Create ASCII visualization of the network"""
    print("\n" + "=" * 50)
    print("Network Architecture Visualization")
    print("=" * 50)
    print()
    print("Input Layer    Hidden Layer    Output Layer")
    print("    (2)            (4)             (1)")
    print()
    print("    X₁ ────┬──── H₁ ────┬──── Y")
    print("           ├──── H₂ ────┤")
    print("           ├──── H₃ ────┤")
    print("    X₂ ────┴──── H₄ ────┘")
    print()
    print("Each connection has a weight that's adjusted during training")
    print(f"Total parameters: {2*4 + 4*1} = 12 weights")


if __name__ == "__main__":
    # Run XOR demo
    xor_network = demo_xor()
    
    # Run AND gate demo
    demo_and_gate()
    
    # Show network visualization
    visualize_network_ascii(xor_network)
    
    print("\n" + "=" * 50)
    print("Demo Complete!")
    print("=" * 50)