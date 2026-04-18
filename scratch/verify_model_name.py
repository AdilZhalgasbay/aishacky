import os
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

client = OpenAI(
    base_url=os.getenv("NIM_BASE_URL", "https://integrate.api.nvidia.com/v1"),
    api_key=os.getenv("DEEPSEEK_API_KEY"),
)

# Correct model name
MODEL = "deepseek-ai/deepseek-v3" 

def test_chat():
    print(f"Testing chat with key: {os.getenv('DEEPSEEK_API_KEY')[:10]}...")
    try:
        completion = client.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "user", "content": "Tell me a short joke."},
            ],
            max_tokens=30,
        )
        print("Success!")
        print(f"Response: {completion.choices[0].message.content}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_chat()
