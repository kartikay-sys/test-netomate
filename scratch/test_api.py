import os
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

api_key = "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"
print(f"Using key: {api_key[:10]}...")

client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=api_key,
)

try:
    response = client.chat.completions.create(
        model="openai/gpt-oss-120b",
        messages=[
            {"role": "user", "content": "test"}
        ],
    )
    print("Success!")
    print(response.choices[0].message.content)
except Exception as e:
    print(f"Failed: {e}")
