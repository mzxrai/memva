import random

def generate_random_with_seed(seed=42):
    """Generate a random number with a specific seed."""
    random.seed(seed)
    return random.random()

if __name__ == "__main__":
    # Generate random number with seed 42
    result = generate_random_with_seed(42)
    print(f"Random number with seed 42: {result}")