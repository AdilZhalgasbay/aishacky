import os
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

client = OpenAI(
    base_url=os.getenv("NIM_BASE_URL", "https://integrate.api.nvidia.com/v1"),
    api_key=os.getenv("DEEPSEEK_API_KEY"),
)

MODEL = "meta/llama-3.3-70b-instruct"

def test_llm():
    print(f"Testing LLM with model: {MODEL}")
    print(f"Using API Key: {os.getenv('DEEPSEEK_API_KEY')[:10]}...")
    try:
        completion = client.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": "Test"},
                {"role": "user", "content": "Hello, are you there?"},
            ],
            temperature=0.2,
            max_tokens=50,
        )
        print("Response:", completion.choices[0].message.content)
    except Exception as e:
        print("Error:", e)

if __name__ == "__main__":
    test_llm()
