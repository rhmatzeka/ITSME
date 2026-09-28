# python3 hello.py
import random

names = ["tamu", "friend", "visitor", "fellow dev"]
print(f"Hello, {random.choice(names)}! Welcome to Mapporto village.")

for i in range(1, 6):
    print("*" * i)
