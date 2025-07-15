#!/usr/bin/env python3
"""Random Python code example"""

import random
from datetime import datetime
from typing import List, Dict, Optional


class RandomDataGenerator:
    """Generates various types of random data"""
    
    def __init__(self, seed: Optional[int] = None):
        if seed:
            random.seed(seed)
        self.generated_count = 0
    
    def generate_numbers(self, count: int = 10) -> List[int]:
        """Generate a list of random integers"""
        self.generated_count += count
        return [random.randint(1, 100) for _ in range(count)]
    
    def generate_user(self) -> Dict[str, any]:
        """Generate a random user object"""
        first_names = ["Alice", "Bob", "Charlie", "Diana", "Eve", "Frank", "Grace"]
        last_names = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Davis", "Miller"]
        domains = ["example.com", "test.org", "demo.net"]
        
        return {
            "id": random.randint(1000, 9999),
            "name": f"{random.choice(first_names)} {random.choice(last_names)}",
            "age": random.randint(18, 65),
            "email": f"user{random.randint(100, 999)}@{random.choice(domains)}",
            "created_at": datetime.now().isoformat(),
            "is_active": random.choice([True, False])
        }
    
    def fibonacci(self, n: int) -> List[int]:
        """Generate Fibonacci sequence up to n terms"""
        if n <= 0:
            return []
        elif n == 1:
            return [0]
        
        sequence = [0, 1]
        while len(sequence) < n:
            sequence.append(sequence[-1] + sequence[-2])
        
        return sequence
    
    def generate_color(self) -> str:
        """Generate a random hex color"""
        return f"#{random.randint(0, 0xFFFFFF):06x}"


def main():
    """Main function to demonstrate the generator"""
    generator = RandomDataGenerator(seed=42)
    
    # Generate some random numbers
    numbers = generator.generate_numbers(5)
    print(f"Random numbers: {numbers}")
    
    # Generate a random user
    user = generator.generate_user()
    print(f"\nRandom user: {user}")
    
    # Generate Fibonacci sequence
    fib = generator.fibonacci(10)
    print(f"\nFibonacci sequence (10 terms): {fib}")
    
    # Simple list comprehension example
    squares = [x**2 for x in range(1, 11)]
    print(f"\nSquares of 1-10: {squares}")
    
    # Dictionary comprehension
    word_lengths = {word: len(word) for word in ["python", "typescript", "react", "vite"]}
    print(f"\nWord lengths: {word_lengths}")
    
    print(f"\nTotal numbers generated: {generator.generated_count}")


if __name__ == "__main__":
    main()