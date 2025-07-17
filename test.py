#!/usr/bin/env python3
"""
Examples of Pythonic code patterns and idioms
"""

from collections import defaultdict, Counter
from itertools import chain, groupby
from functools import lru_cache
import random


# List comprehensions and generator expressions
def get_even_squares(numbers):
    """Pythonic way to filter and transform data"""
    return [n**2 for n in numbers if n % 2 == 0]


# Dictionary comprehensions
def invert_dict(original):
    """Swap keys and values in a dictionary"""
    return {v: k for k, v in original.items()}


# Using enumerate instead of range(len())
def find_duplicates(items):
    """Find indices of duplicate items"""
    seen = {}
    duplicates = defaultdict(list)
    
    for index, item in enumerate(items):
        if item in seen:
            duplicates[item].extend([seen[item], index])
        else:
            seen[item] = index
    
    return dict(duplicates)


# Context managers and with statements
def read_lines_from_file(filename):
    """Safely read lines from a file"""
    try:
        with open(filename, 'r') as f:
            return [line.strip() for line in f]
    except FileNotFoundError:
        return []


# Using zip and unpacking
def transpose_matrix(matrix):
    """Transpose a matrix using zip(*matrix)"""
    return list(zip(*matrix))


# Decorators and caching
@lru_cache(maxsize=128)
def fibonacci(n):
    """Calculate fibonacci with memoization"""
    if n < 2:
        return n
    return fibonacci(n-1) + fibonacci(n-2)


# Using any() and all()
def validate_data(records):
    """Check if all records have required fields"""
    required_fields = {'id', 'name', 'email'}
    return all(required_fields.issubset(record.keys()) for record in records)


# Grouping data with itertools
def group_by_category(items):
    """Group items by their category attribute"""
    sorted_items = sorted(items, key=lambda x: x.get('category', ''))
    return {
        category: list(group)
        for category, group in groupby(sorted_items, key=lambda x: x.get('category', ''))
    }


# Using Counter for frequency analysis
def most_common_words(text, n=5):
    """Find the n most common words in text"""
    words = text.lower().split()
    return Counter(words).most_common(n)


# Pythonic string formatting
def format_user_info(users):
    """Format user information using f-strings"""
    return [
        f"{user['name']} ({user['email']}) - Active: {user.get('active', False)}"
        for user in users
    ]


# Using setdefault for nested dictionaries
def build_tree(paths):
    """Build a tree structure from file paths"""
    tree = {}
    for path in paths:
        parts = path.split('/')
        current = tree
        for part in parts:
            current = current.setdefault(part, {})
    return tree


# Main function with example usage
def main():
    """Demonstrate the Pythonic functions"""
    
    # Test even squares
    numbers = range(10)
    print(f"Even squares: {get_even_squares(numbers)}")
    
    # Test dictionary inversion
    original = {'a': 1, 'b': 2, 'c': 3}
    print(f"Inverted dict: {invert_dict(original)}")
    
    # Test duplicate finder
    items = ['a', 'b', 'c', 'b', 'a', 'd', 'a']
    print(f"Duplicates: {find_duplicates(items)}")
    
    # Test matrix transpose
    matrix = [[1, 2, 3], [4, 5, 6], [7, 8, 9]]
    print(f"Transposed: {transpose_matrix(matrix)}")
    
    # Test fibonacci
    print(f"Fibonacci(10): {fibonacci(10)}")
    
    # Test word frequency
    text = "the quick brown fox jumps over the lazy dog the fox"
    print(f"Most common words: {most_common_words(text, 3)}")


if __name__ == "__main__":
    main()