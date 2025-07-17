import random

def generate_random_number(min_value=1, max_value=100):
    """Generate a random integer between min_value and max_value (inclusive)."""
    return random.randint(min_value, max_value)

def generate_random_float(min_value=0.0, max_value=1.0):
    """Generate a random float between min_value and max_value."""
    return random.uniform(min_value, max_value)

def generate_random_list(length=10, min_value=1, max_value=100):
    """Generate a list of random integers."""
    return [random.randint(min_value, max_value) for _ in range(length)]

def generate_random_choice(choices):
    """Select a random item from a list of choices."""
    return random.choice(choices)

if __name__ == "__main__":
    # Example usage
    print(f"Random integer (1-100): {generate_random_number()}")
    print(f"Random integer (1-1000): {generate_random_number(1, 1000)}")
    print(f"Random float (0.0-1.0): {generate_random_float()}")
    print(f"Random float (0.0-10.0): {generate_random_float(0.0, 10.0)}")
    print(f"Random list of 5 integers: {generate_random_list(5)}")
    
    colors = ["red", "blue", "green", "yellow", "purple"]
    print(f"Random color: {generate_random_choice(colors)}")