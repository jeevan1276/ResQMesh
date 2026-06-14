from classifier import classify_emergency

result = classify_emergency(
    "Building collapsed and two children are trapped."
)

print(result)
print(type(result))