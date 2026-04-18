import os
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

client = OpenAI(
    base_url=os.getenv("NIM_BASE_URL", "https://integrate.api.nvidia.com/v1"),
    api_key=os.getenv("DEEPSEEK_API_KEY"),
)

def list_models():
    try:
        models = client.models.list()
        print("Matching models:")
        for m in models:
            if "deepseek" in m.id.lower():
                print(f"- {m.id}")
    except Exception as e:
        print(f"Error listing models: {e}")

if __name__ == "__main__":
    list_models()
