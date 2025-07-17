#!/usr/bin/env python3
"""
Pure Python Neural Network - No Dependencies!
"""

import random
import math


class PureNeuralNetwork:
    """A simple neural network using only Python standard library"""
    
    def __init__(self, input_size=2, hidden_size=4, output_size=1, learning_rate=0.5):
        # Initialize weights randomly
        self.w1 = [[random.uniform(-1, 1) for _ in range(hidden_size)] for _ in range(input_size)]
        self.b1 = [0.0 for _ in range(hidden_size)]
        self.w2 = [[random.uniform(-1, 1) for _ in range(output_size)] for _ in range(hidden_size)]
        self.b2 = [0.0 for _ in range(output_size)]
        
        self.learning_rate = learning_rate
        self.input_size = input_size
        self.hidden_size = hidden_size
        self.output_size = output_size
    
    def sigmoid(self, x):
        """Sigmoid activation function"""
        try:
            return 1.0 / (1.0 + math.exp(-x))
        except OverflowError:
            return 0.0 if x < 0 else 1.0
    
    def sigmoid_derivative(self, x):
        """Derivative of sigmoid"""
        return x * (1.0 - x)
    
    def forward(self, inputs):
        """Forward propagation"""
        # Input to hidden layer
        self.hidden = []
        for j in range(self.hidden_size):
            sum_val = self.b1[j]
            for i in range(len(inputs)):
                sum_val += inputs[i] * self.w1[i][j]
            self.hidden.append(self.sigmoid(sum_val))
        
        # Hidden to output layer
        self.output = []
        for k in range(self.output_size):
            sum_val = self.b2[k]
            for j in range(self.hidden_size):
                sum_val += self.hidden[j] * self.w2[j][k]
            self.output.append(self.sigmoid(sum_val))
        
        return self.output
    
    def backward(self, inputs, targets):
        """Backward propagation"""
        # Calculate output layer deltas
        output_deltas = []
        for k in range(self.output_size):
            error = targets[k] - self.output[k]
            delta = error * self.sigmoid_derivative(self.output[k])
            output_deltas.append(delta)
        
        # Calculate hidden layer deltas
        hidden_deltas = []
        for j in range(self.hidden_size):
            error = 0.0
            for k in range(self.output_size):
                error += output_deltas[k] * self.w2[j][k]
            delta = error * self.sigmoid_derivative(self.hidden[j])
            hidden_deltas.append(delta)
        
        # Update weights and biases
        # Update w2 and b2
        for j in range(self.hidden_size):
            for k in range(self.output_size):
                self.w2[j][k] += self.learning_rate * output_deltas[k] * self.hidden[j]
        for k in range(self.output_size):
            self.b2[k] += self.learning_rate * output_deltas[k]
        
        # Update w1 and b1
        for i in range(len(inputs)):
            for j in range(self.hidden_size):
                self.w1[i][j] += self.learning_rate * hidden_deltas[j] * inputs[i]
        for j in range(self.hidden_size):
            self.b1[j] += self.learning_rate * hidden_deltas[j]
    
    def train(self, training_data, epochs=10000, verbose=True):
        """Train the network"""
        for epoch in range(epochs):
            total_error = 0.0
            
            for inputs, targets in training_data:
                # Forward pass
                outputs = self.forward(inputs)
                
                # Calculate error
                for k in range(len(targets)):
                    total_error += 0.5 * (targets[k] - outputs[k]) ** 2
                
                # Backward pass
                self.backward(inputs, targets)
            
            # Print progress
            if verbose and epoch % 1000 == 0:
                avg_error = total_error / len(training_data)
                print(f"Epoch {epoch:5d} - Average Error: {avg_error:.6f}")
    
    def predict(self, inputs):
        """Make a prediction"""
        return self.forward(inputs)


def print_network_state(nn):
    """Print the network's weights in a readable format"""
    print("\nNetwork Weights:")
    print("Input -> Hidden:")
    for i in range(nn.input_size):
        for j in range(nn.hidden_size):
            print(f"  w[{i}][{j}] = {nn.w1[i][j]:6.3f}", end="  ")
        print()
    
    print("\nHidden -> Output:")
    for j in range(nn.hidden_size):
        print(f"  w[{j}][0] = {nn.w2[j][0]:6.3f}")


def demo():
    """Run a complete demo of the neural network"""
    print("=" * 60)
    print("Pure Python Neural Network Demo - Learning XOR")
    print("=" * 60)
    
    # XOR training data
    training_data = [
        ([0, 0], [0]),  # 0 XOR 0 = 0
        ([0, 1], [1]),  # 0 XOR 1 = 1
        ([1, 0], [1]),  # 1 XOR 0 = 1
        ([1, 1], [0]),  # 1 XOR 1 = 0
    ]
    
    print("\nXOR Truth Table:")
    print("Input1 | Input2 | Output")
    print("-------|--------|-------")
    for inputs, targets in training_data:
        print(f"   {inputs[0]}   |   {inputs[1]}    |   {targets[0]}")
    
    # Create and train the network
    print("\nCreating neural network...")
    print("Architecture: 2 inputs -> 4 hidden neurons -> 1 output")
    
    nn = PureNeuralNetwork(input_size=2, hidden_size=4, output_size=1, learning_rate=0.5)
    
    # Show initial predictions (before training)
    print("\nInitial predictions (before training):")
    for inputs, targets in training_data:
        output = nn.predict(inputs)[0]
        print(f"  Input: {inputs} -> Output: {output:.4f} (Target: {targets[0]})")
    
    # Train the network
    print("\nTraining the network...")
    nn.train(training_data, epochs=10000, verbose=True)
    
    # Show final predictions
    print("\nFinal predictions (after training):")
    correct = 0
    for inputs, targets in training_data:
        output = nn.predict(inputs)[0]
        predicted = 1 if output > 0.5 else 0
        is_correct = predicted == targets[0]
        correct += is_correct
        status = "✓" if is_correct else "✗"
        print(f"  Input: {inputs} -> Output: {output:.4f} -> Predicted: {predicted} (Target: {targets[0]}) {status}")
    
    accuracy = (correct / len(training_data)) * 100
    print(f"\nAccuracy: {accuracy:.1f}%")
    
    # Test with intermediate values
    print("\nTesting with intermediate values:")
    test_inputs = [
        [0.1, 0.1],
        [0.1, 0.9],
        [0.9, 0.1],
        [0.9, 0.9],
        [0.5, 0.5],
        [0.3, 0.7],
        [0.7, 0.3],
    ]
    
    for inputs in test_inputs:
        output = nn.predict(inputs)[0]
        predicted = 1 if output > 0.5 else 0
        print(f"  Input: {inputs} -> Output: {output:.4f} -> Predicted: {predicted}")
    
    # Visualize the network
    print("\n" + "=" * 60)
    print("Network Architecture Visualization")
    print("=" * 60)
    print()
    print("    INPUT          HIDDEN           OUTPUT")
    print()
    print("      X₁ ─────┬──── H₁ ─────┬──── Y")
    print("              ├──── H₂ ─────┤")
    print("              ├──── H₃ ─────┤")
    print("      X₂ ─────┴──── H₄ ─────┘")
    print()
    print("  (2 neurons)   (4 neurons)    (1 neuron)")
    print()
    print("Total parameters: 2×4 + 4×1 = 12 weights + 5 biases = 17 parameters")
    
    # Show some weights
    print_network_state(nn)
    
    print("\n" + "=" * 60)
    print("Demo Complete! The network learned XOR using only pure Python!")
    print("=" * 60)


if __name__ == "__main__":
    # Set random seed for reproducibility
    random.seed(42)
    
    # Run the demo
    demo()